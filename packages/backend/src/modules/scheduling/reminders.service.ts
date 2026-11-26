import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AppointmentStatus, Channel } from '@ozimai/shared';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { SystemTaskRunner } from '../../common/tenant/system-task-runner.service';
import { ChannelAdapterRegistry } from '../channels/adapters/channel-adapter-registry.service';
import { WhatsAppCloudAdapter } from '../channels/adapters/whatsapp-cloud.adapter';
import { SmsService } from '../notifications/sms/sms.service';
import { WebPushService } from '../notifications/web-push.service';
import { AppointmentEntity } from '../../database/entities/appointment.entity';
import { OrganizationEntity } from '../../database/entities/organization.entity';
import { PatientEntity } from '../../database/entities/patient.entity';
import { PractitionerEntity } from '../../database/entities/practitioner.entity';

const WINDOW_MIN = 15; // wider than the 5-min cron cadence so no appointment is skipped between runs

export type ReminderRoute = 'chat' | 'push' | 'sms' | 'sms_failed' | 'sms_quota_exceeded';

/**
 * 24h / 2h appointment reminders, routed per patient:
 *   - WhatsApp patients: WhatsApp (if the Cloud API is configured), else SMS
 *   - Web chat patients: browser push if they subscribed, else SMS
 *   - Instagram (no outbound API yet): SMS
 *   - Dev-mock: the dev-mock chat (demo)
 *
 * Push/SMS can't take a reply, so they carry a link back to the clinic's
 * web chat where the patient can confirm, reschedule or cancel.
 */
@Injectable()
export class RemindersService {
  private readonly logger = new Logger(RemindersService.name);

  constructor(
    private readonly runner: SystemTaskRunner,
    private readonly tenant: TenantContextService,
    private readonly channels: ChannelAdapterRegistry,
    private readonly whatsapp: WhatsAppCloudAdapter,
    private readonly sms: SmsService,
    private readonly push: WebPushService,
    private readonly config: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async dispatch() {
    await this.runner.forEachOrg(async () => {
      await this.sendWindow('reminded24hAt', 24 * 60);
      await this.sendWindow('reminded2hAt', 2 * 60);
    });
  }

  private get timeZone(): string {
    return this.config.get<string>('CLINIC_TIMEZONE') || 'Asia/Almaty';
  }

  chatLink(org: OrganizationEntity): string | null {
    const base = (this.config.get<string>('PUBLIC_APP_URL') || '').replace(/\/$/, '');
    return base ? `${base}/c/${org.publicSlug}` : null;
  }

  private async sendWindow(field: 'reminded24hAt' | 'reminded2hAt', minutesAhead: number) {
    const repo = this.tenant.repo(AppointmentEntity);
    const from = new Date(Date.now() + (minutesAhead - WINDOW_MIN / 2) * 60_000);
    const to = new Date(Date.now() + (minutesAhead + WINDOW_MIN / 2) * 60_000);

    const due = await repo
      .createQueryBuilder('a')
      .where('a.orgId = :orgId', { orgId: this.tenant.orgId })
      .andWhere('a.status IN (:...statuses)', { statuses: [AppointmentStatus.Booked, AppointmentStatus.Confirmed] })
      .andWhere('a.slotStart BETWEEN :from AND :to', { from, to })
      .andWhere(`a.${field} IS NULL`)
      .getMany();
    if (!due.length) return;

    const org = await this.tenant.manager.getRepository(OrganizationEntity).findOneByOrFail({ id: this.tenant.orgId });

    for (const appt of due) {
      const patient = await this.tenant.repo(PatientEntity).findOneBy({ id: appt.patientId, orgId: this.tenant.orgId });
      const practitioner = await this.tenant.repo(PractitionerEntity).findOneBy({ id: appt.practitionerId, orgId: this.tenant.orgId });
      if (!patient) continue;

      const when = appt.slotStart.toLocaleString('ru-RU', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: this.timeZone,
      });
      const label = minutesAhead >= 60 * 24 ? 'завтра' : 'сегодня';
      const route = await this.deliver(org, patient, { label, when, doctor: practitioner?.name ?? null });
      await repo.update({ id: appt.id }, { [field]: new Date() });
      this.logger.log(`Sent ${field} reminder for appointment ${appt.id} via ${route}`);
    }
  }

  private async deliver(
    org: OrganizationEntity,
    patient: PatientEntity,
    info: { label: string; when: string; doctor: string | null },
  ): Promise<ReminderRoute> {
    const doctor = info.doctor ? `, ${info.doctor}` : '';
    const link = this.chatLink(org);

    const viaChat = patient.sourceChannel === Channel.DevMock || (patient.sourceChannel === Channel.WhatsApp && this.whatsapp.isConfigured);
    if (viaChat) {
      const text = `Напоминаем: у вас запись ${info.label} (${info.when})${doctor ? ` к ${info.doctor}` : ''}. Ответьте "подтверждаю", "перенести" или "отменить".`;
      await this.channels.send(patient.sourceChannel, patient.phone, text, org.whatsappPhoneNumberId);
      return 'chat';
    }

    if (patient.sourceChannel === Channel.Web && patient.pushSubscription) {
      const result = await this.push.send(patient.pushSubscription, {
        title: org.name,
        body: `Запись ${info.label} ${info.when}${doctor}. Нажмите, чтобы подтвердить или перенести.`,
        url: link ?? undefined,
      });
      if (result === 'sent') return 'push';
      if (result === 'gone') {
        await this.tenant.repo(PatientEntity).update({ id: patient.id, orgId: this.tenant.orgId }, { pushSubscription: null });
      }
    }

    // Kept short on purpose: Cyrillic SMS segments are only 70 chars (67 when
    // concatenated), and each segment is billed separately.
    const text = `${org.name}: запись ${info.label} ${info.when}${doctor}.${link ? ` Подтвердить/перенести: ${link}` : ''}`;
    const sent = await this.sms.sendForOrg(org.id, patient.phone, text);
    return sent === 'sent' ? 'sms' : sent === 'quota_exceeded' ? 'sms_quota_exceeded' : 'sms_failed';
  }
}
