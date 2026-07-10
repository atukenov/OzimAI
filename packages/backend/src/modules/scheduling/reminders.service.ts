import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AppointmentStatus } from '@ozimai/shared';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { SystemTaskRunner } from '../../common/tenant/system-task-runner.service';
import { ChannelAdapterRegistry } from '../channels/adapters/channel-adapter-registry.service';
import { AppointmentEntity } from '../../database/entities/appointment.entity';
import { PatientEntity } from '../../database/entities/patient.entity';
import { PractitionerEntity } from '../../database/entities/practitioner.entity';

const WINDOW_MIN = 15; // wider than the 5-min cron cadence so no appointment is skipped between runs

/**
 * Reminders are plain text ("reply CONFIRM/RESCHEDULE/CANCEL") rather than
 * WhatsApp's native interactive-button message type — that's a template
 * feature of the real Cloud API send call, addable later at the
 * WhatsAppCloudAdapter level without touching this service (FR-04 simplification).
 */
@Injectable()
export class RemindersService {
  private readonly logger = new Logger(RemindersService.name);

  constructor(
    private readonly runner: SystemTaskRunner,
    private readonly tenant: TenantContextService,
    private readonly channels: ChannelAdapterRegistry,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async dispatch() {
    await this.runner.forEachOrg(async () => {
      await this.sendWindow('reminded24hAt', 24 * 60);
      await this.sendWindow('reminded2hAt', 2 * 60);
    });
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

    for (const appt of due) {
      const patient = await this.tenant.repo(PatientEntity).findOneBy({ id: appt.patientId, orgId: this.tenant.orgId });
      const practitioner = await this.tenant.repo(PractitionerEntity).findOneBy({ id: appt.practitionerId, orgId: this.tenant.orgId });
      if (!patient) continue;

      const when = appt.slotStart.toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
      const label = minutesAhead >= 60 * 24 ? 'завтра' : 'скоро';
      const text = `Напоминаем: у вас запись ${label} (${when})${practitioner ? ` к ${practitioner.name}` : ''}. Ответьте "подтверждаю", "перенести" или "отменить".`;

      await this.channels.send(patient.sourceChannel, patient.phone, text);
      await repo.update({ id: appt.id }, { [field]: new Date() });
      this.logger.log(`Sent ${field} reminder for appointment ${appt.id}`);
    }
  }
}
