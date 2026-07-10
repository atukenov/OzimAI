import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import Redis from 'ioredis';
import { AppointmentStatus, CreatedBy, FreeSlot } from '@ozimai/shared';
import { REDIS_CLIENT } from '../../common/redis/redis.module';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { AuditService } from '../audit/audit.service';
import { AppointmentEntity } from '../../database/entities/appointment.entity';
import { PractitionerEntity } from '../../database/entities/practitioner.entity';

const SLOT_MINUTES = 30;
const ACTIVE_STATUSES = [AppointmentStatus.Held, AppointmentStatus.Booked, AppointmentStatus.Confirmed];

interface BookResult {
  ok: boolean;
  appointment?: AppointmentEntity;
  alternatives?: FreeSlot[];
  message: string;
}

@Injectable()
export class SchedulingService {
  private readonly logger = new Logger(SchedulingService.name);

  constructor(
    private readonly tenant: TenantContextService,
    private readonly audit: AuditService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async resolvePractitionerByName(name: string): Promise<PractitionerEntity | null> {
    const list = await this.tenant.repo(PractitionerEntity).find({ where: { orgId: this.tenant.orgId } });
    const needle = name.trim().toLowerCase();
    return (
      list.find((p) => p.name.toLowerCase() === needle) ??
      list.find((p) => p.name.toLowerCase().includes(needle) || needle.includes(p.name.toLowerCase())) ??
      null
    );
  }

  async getFreeSlots(opts: { practitionerId?: string; from?: Date; to?: Date } = {}): Promise<FreeSlot[]> {
    const practitioners = await this.tenant
      .repo(PractitionerEntity)
      .find({ where: opts.practitionerId ? { id: opts.practitionerId, orgId: this.tenant.orgId } : { orgId: this.tenant.orgId } });

    const from = opts.from ?? new Date();
    const to = opts.to ?? new Date(from.getTime() + 7 * 24 * 60 * 60 * 1000);

    const appointments = await this.tenant
      .repo(AppointmentEntity)
      .createQueryBuilder('a')
      .where('a.orgId = :orgId', { orgId: this.tenant.orgId })
      .andWhere('a.status IN (:...statuses)', { statuses: ACTIVE_STATUSES })
      .andWhere('a.slotStart BETWEEN :from AND :to', { from, to })
      .getMany();

    const occupied = new Set(appointments.map((a) => `${a.practitionerId}|${a.slotStart.toISOString()}`));

    const slots: FreeSlot[] = [];
    for (const practitioner of practitioners) {
      for (const slotStart of enumerateSlots(practitioner.workingHours, from, to)) {
        const key = `${practitioner.id}|${slotStart.toISOString()}`;
        if (!occupied.has(key)) {
          slots.push({ practitionerId: practitioner.id, practitionerName: practitioner.name, slotStart: slotStart.toISOString() });
        }
      }
    }
    return slots.sort((a, b) => a.slotStart.localeCompare(b.slotStart));
  }

  /**
   * Used by the AI tool `book_appointment`: the patient already agreed to a
   * specific slot returned by check_availability, so this books immediately
   * rather than going through the panel's separate hold→confirm flow.
   * Atomicity comes from a short Redis lock (fast-path serialization) backed
   * by the Postgres partial unique index on (practitioner_id, slot_start)
   * for statuses held/booked/confirmed — the real source of truth.
   */
  async bookDirect(params: {
    patientId: string;
    practitionerId: string;
    slotStart: Date;
    serviceId?: string | null;
    createdBy: CreatedBy;
  }): Promise<BookResult> {
    const lockKey = `lock:${this.tenant.orgId}:${params.practitionerId}:${params.slotStart.toISOString()}`;
    const lockToken = randomUUID();
    const acquired = await this.redis.set(lockKey, lockToken, 'PX', 10_000, 'NX');

    if (!acquired) {
      return { ok: false, alternatives: await this.nearbyAlternatives(params.practitionerId, params.slotStart), message: 'Slot is being booked by someone else' };
    }

    try {
      const repo = this.tenant.repo(AppointmentEntity);
      const appointment = repo.create({
        orgId: this.tenant.orgId,
        patientId: params.patientId,
        practitionerId: params.practitionerId,
        serviceId: params.serviceId ?? null,
        slotStart: params.slotStart,
        status: AppointmentStatus.Booked,
        createdBy: params.createdBy,
      });
      const saved = await repo.save(appointment);
      await this.audit.record({ actor: params.createdBy, action: 'appointment.book', entity: 'appointment', entityId: saved.id, after: saved });
      return { ok: true, appointment: saved, message: 'Booked' };
    } catch (err: any) {
      if (err?.code === '23505') {
        return { ok: false, alternatives: await this.nearbyAlternatives(params.practitionerId, params.slotStart), message: 'Slot just taken' };
      }
      throw err;
    } finally {
      await this.releaseLock(lockKey, lockToken);
    }
  }

  /** Panel manual booking flow: 5-minute reservation before the admin confirms. */
  async holdSlot(params: { practitionerId: string; patientId: string; slotStart: Date; serviceId?: string | null; ttlSec?: number }) {
    const ttlSec = params.ttlSec ?? 300;
    const lockKey = `hold:${this.tenant.orgId}:${params.practitionerId}:${params.slotStart.toISOString()}`;
    const lockToken = randomUUID();
    const acquired = await this.redis.set(lockKey, lockToken, 'PX', ttlSec * 1000, 'NX');
    if (!acquired) {
      return { ok: false as const, alternatives: await this.nearbyAlternatives(params.practitionerId, params.slotStart) };
    }
    try {
      const repo = this.tenant.repo(AppointmentEntity);
      const appointment = await repo.save(
        repo.create({
          orgId: this.tenant.orgId,
          patientId: params.patientId,
          practitionerId: params.practitionerId,
          serviceId: params.serviceId ?? null,
          slotStart: params.slotStart,
          status: AppointmentStatus.Held,
          createdBy: CreatedBy.Human,
          holdToken: lockToken,
        }),
      );
      return { ok: true as const, appointment };
    } catch (err: any) {
      await this.releaseLock(lockKey, lockToken);
      if (err?.code === '23505') {
        return { ok: false as const, alternatives: await this.nearbyAlternatives(params.practitionerId, params.slotStart) };
      }
      throw err;
    }
  }

  async confirmHold(appointmentId: string): Promise<AppointmentEntity> {
    const repo = this.tenant.repo(AppointmentEntity);
    const appt = await repo.findOneBy({ id: appointmentId, orgId: this.tenant.orgId });
    if (!appt) throw new NotFoundException('Appointment not found');
    appt.status = AppointmentStatus.Booked;
    const saved = await repo.save(appt);
    await this.audit.record({ actor: this.tenant.userId, action: 'appointment.confirm', entity: 'appointment', entityId: appt.id, after: saved });
    return saved;
  }

  async cancelAppointment(appointmentId: string, actor: string): Promise<AppointmentEntity> {
    const repo = this.tenant.repo(AppointmentEntity);
    const appt = await repo.findOneBy({ id: appointmentId, orgId: this.tenant.orgId });
    if (!appt) throw new NotFoundException('Appointment not found');
    const before = { status: appt.status };
    appt.status = AppointmentStatus.Cancelled;
    const saved = await repo.save(appt);
    await this.audit.record({ actor, action: 'appointment.cancel', entity: 'appointment', entityId: appt.id, before, after: { status: saved.status } });
    return saved;
  }

  async markNoShow(appointmentId: string): Promise<AppointmentEntity> {
    const repo = this.tenant.repo(AppointmentEntity);
    const appt = await repo.findOneBy({ id: appointmentId, orgId: this.tenant.orgId });
    if (!appt) throw new NotFoundException('Appointment not found');
    appt.status = AppointmentStatus.NoShow;
    return repo.save(appt);
  }

  listAppointments(params: { practitionerId?: string; from?: Date; to?: Date }) {
    const qb = this.tenant
      .repo(AppointmentEntity)
      .createQueryBuilder('a')
      .where('a.orgId = :orgId', { orgId: this.tenant.orgId });
    if (params.practitionerId) qb.andWhere('a.practitionerId = :pid', { pid: params.practitionerId });
    if (params.from) qb.andWhere('a.slotStart >= :from', { from: params.from });
    if (params.to) qb.andWhere('a.slotStart <= :to', { to: params.to });
    return qb.orderBy('a.slotStart', 'ASC').getMany();
  }

  /** Cron backstop: Redis TTL frees the lock but not the Postgres 'held' row. */
  async sweepExpiredHolds(): Promise<number> {
    const cutoff = new Date(Date.now() - 5 * 60 * 1000);
    const result = await this.tenant.manager
      .createQueryBuilder()
      .update(AppointmentEntity)
      .set({ status: AppointmentStatus.Cancelled })
      .where('status = :held', { held: AppointmentStatus.Held })
      .andWhere('createdAt < :cutoff', { cutoff })
      .execute();
    return result.affected ?? 0;
  }

  private async nearbyAlternatives(practitionerId: string, near: Date): Promise<FreeSlot[]> {
    const from = new Date(near.getTime() - 3 * 60 * 60 * 1000);
    const to = new Date(near.getTime() + 3 * 60 * 60 * 1000);
    const slots = await this.getFreeSlots({ practitionerId, from, to });
    return slots.slice(0, 3);
  }

  private async releaseLock(key: string, token: string): Promise<void> {
    // Only delete if we still own it (compare-and-delete), so a slower
    // caller can never release a lock acquired by someone else after expiry.
    const lua = `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end`;
    await this.redis.eval(lua, 1, key, token).catch((err) => this.logger.warn(`Lock release failed: ${err}`));
  }
}

function enumerateSlots(workingHours: Record<number, [string, string] | null>, from: Date, to: Date): Date[] {
  const slots: Date[] = [];
  const cursor = new Date(from);
  cursor.setSeconds(0, 0);
  // round up to next slot boundary
  const minutes = cursor.getMinutes();
  const remainder = minutes % SLOT_MINUTES;
  if (remainder !== 0) cursor.setMinutes(minutes + (SLOT_MINUTES - remainder));

  while (cursor <= to) {
    const dow = cursor.getDay();
    const hours = workingHours?.[dow];
    if (hours) {
      const [openH, openM] = hours[0].split(':').map(Number);
      const [closeH, closeM] = hours[1].split(':').map(Number);
      const dayOpen = new Date(cursor);
      dayOpen.setHours(openH, openM, 0, 0);
      const dayClose = new Date(cursor);
      dayClose.setHours(closeH, closeM, 0, 0);
      if (cursor >= dayOpen && cursor < dayClose && cursor >= from) {
        slots.push(new Date(cursor));
      }
    }
    cursor.setMinutes(cursor.getMinutes() + SLOT_MINUTES);
  }
  return slots;
}
