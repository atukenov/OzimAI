import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, MoreThanOrEqual } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { BillingStatus, Channel, MessageSenderType } from '@ozimai/shared';
import { SystemTaskRunner } from '../../common/tenant/system-task-runner.service';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { OrganizationEntity } from '../../database/entities/organization.entity';
import { ConversationEntity } from '../../database/entities/conversation.entity';
import { MessageEntity } from '../../database/entities/message.entity';
import { PatientEntity, WebPushSubscription } from '../../database/entities/patient.entity';
import { CrmService } from '../crm/crm.service';
import { OrchestratorService } from '../ai/orchestrator.service';
import { WebPushService } from '../notifications/web-push.service';
import { WebChatTokenPayload, WebChatTokenService } from './webchat-token.service';
import { normalizePhone } from './phone';

export interface PublicChatMessage {
  id: string;
  from: 'patient' | 'clinic' | 'system';
  /** 'ai' or 'admin' for clinic messages, so the widget can label a live operator. */
  author: MessageSenderType;
  text: string;
  createdAt: Date;
  /** True on the AI reply that completed a booking (widget then offers push reminders). */
  booked?: boolean;
}

@Injectable()
export class WebChatService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly runner: SystemTaskRunner,
    private readonly tenant: TenantContextService,
    private readonly crm: CrmService,
    private readonly orchestrator: OrchestratorService,
    private readonly tokens: WebChatTokenService,
    private readonly push: WebPushService,
  ) {}

  /** `organization` is the one table outside RLS, so resolving the tenant by slug is safe pre-context. */
  async resolveOrg(slug: string): Promise<OrganizationEntity> {
    const org = await this.dataSource.getRepository(OrganizationEntity).findOneBy({ publicSlug: slug.toLowerCase() });
    if (!org) throw new NotFoundException('Clinic not found');
    return org;
  }

  async info(slug: string) {
    const org = await this.resolveOrg(slug);
    return {
      clinicName: org.name,
      aiName: org.aiName || 'Айым',
      locale: org.locale,
      available: org.billingStatus !== BillingStatus.ReadOnly,
      pushPublicKey: this.push.publicKey,
    };
  }

  async start(slug: string, name: string, rawPhone: string) {
    const org = await this.resolveOrg(slug);
    this.assertAvailable(org);
    const phone = normalizePhone(rawPhone);
    if (!phone) throw new ForbiddenException('Неверный номер телефона');

    const patient = await this.runner.runAsOrg(org.id, () => this.crm.upsertByPhone(phone, name.trim(), Channel.Web));
    const sid = randomUUID();
    return { token: this.tokens.sign({ orgId: org.id, patientId: patient.id, sid }), name: patient.name };
  }

  async messages(slug: string, auth: string | undefined, after?: string): Promise<PublicChatMessage[]> {
    const org = await this.resolveOrg(slug);
    const session = this.tokens.verify(auth, org.id);
    return this.runner.runAsOrg(org.id, () => this.listMessages(session, after));
  }

  async send(slug: string, auth: string | undefined, text: string): Promise<PublicChatMessage[]> {
    const org = await this.resolveOrg(slug);
    this.assertAvailable(org);
    const session = this.tokens.verify(auth, org.id);
    return this.runner.runAsOrg(org.id, async () => {
      const patient = await this.getPatient(session);
      const before = await this.lastMessageAt(session);
      await this.orchestrator.handleInboundMessage({
        phone: patient.phone,
        text,
        channel: Channel.Web,
        nameGuess: patient.name ?? undefined,
        webSessionId: session.sid,
      });
      return this.listMessages(session, before?.toISOString());
    });
  }

  async savePushSubscription(slug: string, auth: string | undefined, subscription: WebPushSubscription | null) {
    const org = await this.resolveOrg(slug);
    const session = this.tokens.verify(auth, org.id);
    await this.runner.runAsOrg(org.id, () =>
      this.tenant
        .repo(PatientEntity)
        .update(
          { id: session.patientId, orgId: org.id },
          { pushSubscription: subscription ? { endpoint: subscription.endpoint, keys: subscription.keys } : null },
        ),
    );
    return { ok: true };
  }

  private assertAvailable(org: OrganizationEntity) {
    if (org.billingStatus === BillingStatus.ReadOnly) throw new ForbiddenException('Чат клиники временно недоступен');
  }

  private async getPatient(session: WebChatTokenPayload): Promise<PatientEntity> {
    const patient = await this.tenant.repo(PatientEntity).findOneBy({ id: session.patientId, orgId: session.orgId });
    if (!patient) throw new NotFoundException('Session expired');
    return patient;
  }

  private findConversation(session: WebChatTokenPayload) {
    return this.tenant.repo(ConversationEntity).findOne({
      where: { orgId: session.orgId, patientId: session.patientId, channel: Channel.Web, webSessionId: session.sid },
      order: { updatedAt: 'DESC' },
    });
  }

  private async lastMessageAt(session: WebChatTokenPayload): Promise<Date | null> {
    const conversation = await this.findConversation(session);
    if (!conversation) return null;
    const last = await this.tenant
      .repo(MessageEntity)
      .findOne({ where: { orgId: session.orgId, conversationId: conversation.id }, order: { createdAt: 'DESC' } });
    return last?.createdAt ?? null;
  }

  /**
   * `after` is inclusive (>=): messages written in one transaction share
   * Postgres' now(), so a strict > could drop siblings. The widget dedupes
   * by id. Internal AI metadata (tool calls, model) is never exposed.
   */
  private async listMessages(session: WebChatTokenPayload, after?: string): Promise<PublicChatMessage[]> {
    const conversation = await this.findConversation(session);
    if (!conversation) return [];
    const afterDate = after ? new Date(after) : null;
    const messages = await this.tenant.repo(MessageEntity).find({
      where: {
        orgId: session.orgId,
        conversationId: conversation.id,
        ...(afterDate && !Number.isNaN(afterDate.getTime()) ? { createdAt: MoreThanOrEqual(afterDate) } : {}),
      },
      order: { createdAt: 'ASC' },
      take: 200,
    });
    return messages.map((m) => ({
      id: m.id,
      from: m.senderType === MessageSenderType.Patient ? 'patient' : m.senderType === MessageSenderType.System ? 'system' : 'clinic',
      author: m.senderType,
      text: m.text,
      createdAt: m.createdAt,
      ...(m.aiMeta?.toolCalls?.some((t) => t.name === 'book_appointment' && String(t.output).startsWith('Записано'))
        ? { booked: true }
        : {}),
    }));
  }
}
