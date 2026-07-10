import { Injectable } from '@nestjs/common';
import { AppointmentStatus, CreatedBy, LeadStatus, WeeklyReportDto } from '@ozimai/shared';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { AppointmentEntity } from '../../database/entities/appointment.entity';
import { ServiceEntity } from '../../database/entities/service.entity';
import { PatientEntity } from '../../database/entities/patient.entity';

@Injectable()
export class ReportsService {
  constructor(private readonly tenant: TenantContextService) {}

  /** weekOffset 0 = current week (Mon-Sun), negative = prior weeks. */
  async getWeekly(weekOffset = 0): Promise<WeeklyReportDto> {
    const { start, end, label } = weekRange(weekOffset);
    const { start: prevStart, end: prevEnd } = weekRange(weekOffset - 1);

    const [current, previous, lostPatients] = await Promise.all([
      this.tenant
        .repo(AppointmentEntity)
        .createQueryBuilder('a')
        .where('a.orgId = :orgId', { orgId: this.tenant.orgId })
        .andWhere('a.slotStart BETWEEN :start AND :end', { start, end })
        .getMany(),
      this.tenant
        .repo(AppointmentEntity)
        .createQueryBuilder('a')
        .where('a.orgId = :orgId', { orgId: this.tenant.orgId })
        .andWhere('a.slotStart BETWEEN :start AND :end', { start: prevStart, end: prevEnd })
        .getMany(),
      this.tenant
        .repo(PatientEntity)
        .createQueryBuilder('p')
        .where('p.orgId = :orgId', { orgId: this.tenant.orgId })
        .andWhere('p.leadStatus = :status', { status: LeadStatus.Lost })
        .andWhere('p.updatedAt BETWEEN :start AND :end', { start, end })
        .getMany(),
    ]);

    const services = await this.tenant.repo(ServiceEntity).find({ where: { orgId: this.tenant.orgId } });
    const priceById = new Map(services.map((s) => [s.id, s.price]));

    const aiAppointments = current.filter((a) => a.createdBy === CreatedBy.Ai && a.status !== AppointmentStatus.Cancelled);
    const moneyFromAi = aiAppointments.reduce((sum, a) => sum + (a.serviceId ? priceById.get(a.serviceId) ?? 0 : 0), 0);

    const noShowRate = rate(current);
    const prevNoShowRate = rate(previous);

    return {
      weekLabel: label,
      weekStart: start.toISOString(),
      moneyFromAi,
      aiAppointments: aiAppointments.length,
      noShowRate,
      noShowDelta: noShowRate - prevNoShowRate,
      lostLeads: lostPatients.map((p) => ({ patientName: p.name ?? p.phone, reason: p.lastNote ?? 'Причина не указана' })),
    };
  }
}

function rate(appointments: AppointmentEntity[]): number {
  const relevant = appointments.filter((a) => [AppointmentStatus.NoShow, AppointmentStatus.Confirmed, AppointmentStatus.Booked].includes(a.status));
  if (!relevant.length) return 0;
  const noShows = relevant.filter((a) => a.status === AppointmentStatus.NoShow).length;
  return noShows / relevant.length;
}

function weekRange(offset: number): { start: Date; end: Date; label: string } {
  const now = new Date();
  const dayOfWeek = (now.getDay() + 6) % 7; // Monday = 0
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(now.getDate() - dayOfWeek + offset * 7);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  const fmt = (d: Date) => d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
  return { start: monday, end: sunday, label: `${fmt(monday)} – ${fmt(sunday)}` };
}
