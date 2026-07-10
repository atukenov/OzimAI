import { Injectable, NotFoundException } from '@nestjs/common';
import { AiMeta, Channel, ConversationStatus, MessageSenderType } from '@ozimai/shared';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { AuditService } from '../audit/audit.service';
import { ChannelAdapterRegistry } from '../channels/adapters/channel-adapter-registry.service';
import { ConversationEntity } from '../../database/entities/conversation.entity';
import { MessageEntity } from '../../database/entities/message.entity';
import { PatientEntity } from '../../database/entities/patient.entity';
import { LlmTurn } from '../ai/providers/llm-provider.interface';
import { DialoguesGateway } from './dialogues.gateway';

@Injectable()
export class DialoguesService {
  constructor(
    private readonly tenant: TenantContextService,
    private readonly audit: AuditService,
    private readonly gateway: DialoguesGateway,
    private readonly channels: ChannelAdapterRegistry,
  ) {}

  async getOrCreateOpenConversation(patientId: string, channel: Channel): Promise<ConversationEntity> {
    const repo = this.tenant.repo(ConversationEntity);
    let conversation = await repo.findOne({ where: { orgId: this.tenant.orgId, patientId }, order: { updatedAt: 'DESC' } });
    if (!conversation) {
      conversation = await repo.save(repo.create({ orgId: this.tenant.orgId, patientId, channel, status: ConversationStatus.Ai }));
    }
    return conversation;
  }

  async appendMessage(conversationId: string, senderType: MessageSenderType, text: string, aiMeta?: AiMeta): Promise<MessageEntity> {
    const msgRepo = this.tenant.repo(MessageEntity);
    const message = await msgRepo.save(
      msgRepo.create({ orgId: this.tenant.orgId, conversationId, senderType, text, aiMeta: aiMeta ?? null }),
    );
    const convRepo = this.tenant.repo(ConversationEntity);
    await convRepo.update({ id: conversationId, orgId: this.tenant.orgId }, { updatedAt: new Date() });

    this.gateway.emitToOrg(this.tenant.orgId, 'message', {
      conversationId,
      message: { id: message.id, senderType: message.senderType, text: message.text, createdAt: message.createdAt, aiMeta: message.aiMeta },
    });
    return message;
  }

  async setStatus(conversationId: string, status: ConversationStatus): Promise<void> {
    await this.tenant.repo(ConversationEntity).update({ id: conversationId, orgId: this.tenant.orgId }, { status });
    this.gateway.emitToOrg(this.tenant.orgId, 'status', { conversationId, status });
  }

  async getRecentTurns(conversationId: string, limit: number): Promise<LlmTurn[]> {
    const messages = await this.tenant
      .repo(MessageEntity)
      .find({ where: { orgId: this.tenant.orgId, conversationId }, order: { createdAt: 'DESC' }, take: limit });
    return messages
      .reverse()
      .filter((m) => m.senderType !== MessageSenderType.System)
      .map((m) => (m.senderType === MessageSenderType.Ai ? { role: 'assistant', text: m.text } : { role: 'user', text: m.text }));
  }

  async list(filter: 'attention' | 'all'): Promise<any[]> {
    const repo = this.tenant.repo(ConversationEntity);
    const qb = repo
      .createQueryBuilder('c')
      .innerJoinAndMapOne('c.patient', PatientEntity, 'p', 'p.id = c.patientId AND p.orgId = c.orgId')
      .where('c.orgId = :orgId', { orgId: this.tenant.orgId })
      .andWhere("p.phone != 'test-chat'")
      .orderBy('c.updatedAt', 'DESC');
    if (filter === 'attention') qb.andWhere('c.status = :status', { status: ConversationStatus.Attention });
    const conversations = await qb.getMany();

    const previews = await Promise.all(
      conversations.map(async (c) => {
        const last = await this.tenant
          .repo(MessageEntity)
          .findOne({ where: { orgId: this.tenant.orgId, conversationId: c.id }, order: { createdAt: 'DESC' } });
        const patient = (c as any).patient as PatientEntity;
        return {
          id: c.id,
          orgId: c.orgId,
          patientId: c.patientId,
          patientName: patient?.name || patient?.phone,
          patientPhone: patient?.phone,
          channel: c.channel,
          status: c.status,
          lastMessagePreview: last?.text ?? '',
          updatedAt: c.updatedAt,
        };
      }),
    );
    return previews;
  }

  async getThread(conversationId: string) {
    const conversation = await this.tenant.repo(ConversationEntity).findOneBy({ id: conversationId, orgId: this.tenant.orgId });
    if (!conversation) throw new NotFoundException('Conversation not found');
    const patient = await this.tenant.repo(PatientEntity).findOneBy({ id: conversation.patientId, orgId: this.tenant.orgId });
    const messages = await this.tenant
      .repo(MessageEntity)
      .find({ where: { orgId: this.tenant.orgId, conversationId }, order: { createdAt: 'ASC' } });
    return { conversation, patient, messages };
  }

  async takeover(conversationId: string, actorName: string): Promise<void> {
    await this.setStatus(conversationId, ConversationStatus.Human);
    // "Администратор" (not the person's name) governs the verb so this reads
    // correctly regardless of the admin's grammatical gender in Russian.
    await this.appendMessage(conversationId, MessageSenderType.System, `Администратор ${actorName} подключился к диалогу`);
    await this.audit.record({ actor: this.tenant.userId, action: 'conversation.takeover', entity: 'conversation', entityId: conversationId });
  }

  async returnToAi(conversationId: string): Promise<void> {
    await this.setStatus(conversationId, ConversationStatus.Ai);
    await this.appendMessage(conversationId, MessageSenderType.System, 'Айым продолжает диалог');
    await this.audit.record({ actor: this.tenant.userId, action: 'conversation.return_to_ai', entity: 'conversation', entityId: conversationId });
  }

  async adminReply(conversationId: string, text: string): Promise<MessageEntity> {
    const { conversation, patient } = await this.getThread(conversationId);
    const message = await this.appendMessage(conversationId, MessageSenderType.Admin, text);
    if (patient) {
      await this.channels.send(conversation.channel, patient.phone, text);
    }
    return message;
  }
}
