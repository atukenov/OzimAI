import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Channel, ConversationStatus, MessageSenderType } from '@ozimai/shared';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { AuditService } from '../audit/audit.service';
import { OrganizationEntity } from '../../database/entities/organization.entity';
import { CrmService } from '../crm/crm.service';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { DialoguesService } from '../dialogues/dialogues.service';
import { ChannelAdapterRegistry } from '../channels/adapters/channel-adapter-registry.service';
import { LlmRouterService } from './llm-router.service';
import { LlmTurn } from './providers/llm-provider.interface';
import { AI_TOOL_DEFS } from './ai-tools';
import { ToolExecutorService } from './tool-executor.service';
import { buildSystemPrompt } from './prompt-builder';
import { containsMedicalAdviceLeak, stripMarkdown } from './guardrails';

const MAX_TOOL_ITERATIONS = 4;
const TEST_CHAT_PHONE = 'test-chat';

export interface OrchestratorReply {
  conversationId?: string;
  reply: string;
  escalated: boolean;
  provider: string;
  usedFallback: boolean;
  latencyMs: number;
  toolCalls: { name: string; input: unknown; output: unknown }[];
}

@Injectable()
export class OrchestratorService {
  private readonly logger = new Logger(OrchestratorService.name);

  constructor(
    private readonly tenant: TenantContextService,
    private readonly audit: AuditService,
    private readonly crm: CrmService,
    private readonly knowledge: KnowledgeService,
    private readonly dialogues: DialoguesService,
    private readonly router: LlmRouterService,
    private readonly toolExecutor: ToolExecutorService,
    private readonly channels: ChannelAdapterRegistry,
  ) {}

  /** Real channel path: WhatsApp webhook or the dev-mock "simulate inbound" harness. */
  async handleInboundMessage(params: { phone: string; text: string; channel: Channel; nameGuess?: string }): Promise<OrchestratorReply> {
    const patient = await this.crm.upsertByPhone(params.phone, params.nameGuess ?? null, params.channel);
    const conversation = await this.dialogues.getOrCreateOpenConversation(patient.id, params.channel);

    await this.dialogues.appendMessage(conversation.id, MessageSenderType.Patient, params.text);

    // Human has taken over — the AI stays silent until "Вернуть Айым".
    if (conversation.status === ConversationStatus.Human) {
      return { conversationId: conversation.id, reply: '', escalated: false, provider: 'none', usedFallback: false, latencyMs: 0, toolCalls: [] };
    }

    const history = await this.dialogues.getRecentTurns(conversation.id, 12);
    const result = await this.converse(params.text, history, patient.id);

    const escalateCall = result.toolCalls.find((t) => t.name === 'escalate');
    const escalationReason = escalateCall ? (escalateCall.input as { reason?: string }).reason : undefined;

    await this.dialogues.appendMessage(conversation.id, MessageSenderType.Ai, result.reply, {
      model: result.provider,
      latencyMs: result.latencyMs,
      escalationReason,
      toolCalls: result.toolCalls,
    });

    await this.dialogues.setStatus(conversation.id, result.escalated ? ConversationStatus.Attention : ConversationStatus.Ai);

    if (result.reply) {
      const org = await this.tenant.manager.getRepository(OrganizationEntity).findOneByOrFail({ id: this.tenant.orgId });
      await this.channels.send(params.channel, patient.phone, result.reply, org.whatsappPhoneNumberId);
    }

    return { ...result, conversationId: conversation.id };
  }

  /**
   * Панель "Айым" test-chat: same orchestration and real tool execution
   * (bookings really happen, guardrails really run) but does not touch the
   * live Dialogues feed — it books under a per-org "test patient" contact so
   * admins can safely try to break the AI before launch (S-04 step 4).
   */
  async runTestChat(historyIn: { from: 'user' | 'ai'; text: string }[], newMessage: string): Promise<OrchestratorReply> {
    const testPatient = await this.crm.upsertByPhone(TEST_CHAT_PHONE, 'Тестовый диалог (онбординг)', Channel.DevMock);
    const turns: LlmTurn[] = historyIn.map((h) => (h.from === 'user' ? { role: 'user', text: h.text } : { role: 'assistant', text: h.text }));
    return this.converse(newMessage, turns, testPatient.id);
  }

  private async converse(newMessage: string, priorTurns: LlmTurn[], patientId: string): Promise<OrchestratorReply> {
    const start = Date.now();
    const org = await this.tenant.manager.getRepository(OrganizationEntity).findOneByOrFail({ id: this.tenant.orgId });
    const knowledge = await this.knowledge.listPublished();
    const system = buildSystemPrompt(org, knowledge);

    const turns: LlmTurn[] = [...priorTurns, { role: 'user', text: newMessage }];
    const toolCallLog: { name: string; input: unknown; output: unknown }[] = [];
    let escalated = false;
    let providerName = 'mock';
    let usedFallback = false;
    let finalText: string | null = null;

    for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
      const completion = await this.router.complete({ system, turns, tools: AI_TOOL_DEFS });
      providerName = completion.provider;
      usedFallback = completion.usedFallback;

      if (!completion.toolCalls.length) {
        finalText = completion.text ?? 'Уточню у администратора и вернусь с ответом.';
        break;
      }

      turns.push({ role: 'assistant', text: completion.text ?? undefined, toolCalls: completion.toolCalls });

      const toolResults = [];
      for (const call of completion.toolCalls) {
        const outcome = await this.toolExecutor.execute(call, { patientId });
        toolCallLog.push({ name: call.name, input: call.input, output: outcome.content });
        toolResults.push({ toolCallId: outcome.toolCallId, content: outcome.content });
        if (outcome.escalated) {
          escalated = true;
          await this.audit.record({ actor: 'ai', action: 'ai.escalate', entity: 'conversation', after: { reason: outcome.escalated.reason } });
        }
        if (outcome.booked) {
          await this.audit.record({ actor: 'ai', action: 'appointment.book_via_ai', entity: 'appointment' });
        }
      }
      turns.push({ role: 'user', toolResults });

      if (escalated) {
        finalText = toolResults[toolResults.length - 1]?.content ?? 'Передано администратору.';
        break;
      }
    }

    let reply = stripMarkdown(finalText ?? 'Уточню у администратора и вернусь с ответом.');
    if (!escalated && containsMedicalAdviceLeak(reply)) {
      this.logger.warn('Guardrail caught a medical-advice leak in the final response; forcing escalation.');
      reply = 'Это лучше уточнить у врача — передаю ваш вопрос администратору клиники.';
      escalated = true;
      toolCallLog.push({ name: 'escalate', input: { reason: 'post-filter: medical advice leak' }, output: reply });
    }

    return {
      reply,
      escalated,
      provider: providerName,
      usedFallback,
      latencyMs: Date.now() - start,
      toolCalls: toolCallLog,
    };
  }
}
