import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { In } from 'typeorm';
import Redis from 'ioredis';
import { AppointmentStatus, CreatedBy, FreeSlot } from '@ozimai/shared';
import { REDIS_CLIENT } from '../../common/redis/redis.module';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { AuditService } from '../audit/audit.service';
import { AppointmentEntity } from '../../database/entities/appointment.entity';
import { PractitionerEntity } from '../../database/entities/practitioner.entity';
import { OrganizationEntity } from '../../database/entities/organization.entity';
import { ServiceEntity } from '../../database/entities/service.entity';
import { DEFAULT_TIME_ZONE } from './clinic-time';
import { BusyInterval, DEFAULT_DURATION_MINUTES, freeStarts, overlapsAny } from './slot-engine';

const DAY_MS = 24 * 60 * 60 * 1000;
const ACTIVE_STATUSES = [AppointmentStatus.Held, AppointmentStatus.Booked, AppointmentStatus.Confirmed];
const ACTIVE_BOOKED = [AppointmentStatus.Booked, AppointmentStatus.Confirmed];
/** Test-chat bookings are cancelled this long after creation. */
const TEST_BOOKING_TTL_MIN = 60;

export interface SlotSearch {
  practitionerId?: string;
  practitionerIds?: string[];
  from?: Date;
  to?: Date;
  durationMin?: number;
  /** Clinic-local 'HH:MM' window for start times. */
  timeFrom?: string;
  timeTo?: string;
  excludeAppointmentId?: string;
}

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
    private readonly config: ConfigService,
  ) {}

  /** The clinic's IANA zone; slots and patient-facing times use its wall clock. */
  async timeZone(): Promise<string> {
    const org = await this.tenant.manager.getRepository(OrganizationEntity).findOneBy({ id: this.tenant.orgId });
    return org?.timeZone || this.config.get<string>('CLINIC_TIMEZONE') || DEFAULT_TIME_ZONE;
  }

  async listPractitioners(): Promise<PractitionerEntity[]> {
    return this.tenant.repo(PractitionerEntity).find({ where: { orgId: this.tenant.orgId }, order: { name: 'ASC' } });
  }

  async resolvePractitionerByName(name: string): Promise<PractitionerEntity | null> {
    const list = await this.listPractitioners();
    const needle = name.trim().toLowerCase();
    if (!needle) return null;
    return (
      list.find((p) => p.name.toLowerCase() === needle) ??
      list.find((p) => p.name.toLowerCase().includes(needle) || needle.includes(p.name.toLowerCase())) ??
      null
    );
  }

  /** Practitioners whose specialty mentions the word, e.g. "ортодонт" matches "Ортодонтия". */
  async resolvePractitionersBySpecialty(specialty: string): Promise<PractitionerEntity[]> {
    const needle = specialty.trim().toLowerCase().slice(0, 6);
    if (!needle) return [];
    const list = await this.listPractitioners();
    return list.filter((p) => (p.specialty ?? '').toLowerCase().includes(needle));
  }

  async resolveServiceByName(name: string): Promise<ServiceEntity | null> {
    const needle = name.trim().toLowerCase();
    if (!needle) return null;
    const list = await this.tenant.repo(ServiceEntity).find({ where: { orgId: this.tenant.orgId } });
    return (
      list.find((s) => s.name.toLowerCase() === needle) ??
      list.find((s) => s.name.toLowerCase().includes(needle) || needle.includes(s.name.toLowerCase())) ??
      null
    );
  }

  async getFreeSlots(opts: SlotSearch = {}): Promise<FreeSlot[]> {
    const timeZone = await this.timeZone();
    const ids = opts.practitionerIds ?? (opts.practitionerId ? [opts.practitionerId] : null);
    const practitioners = ids
      ? await this.tenant.repo(PractitionerEntity).find({ where: { id: In(ids), orgId: this.tenant.orgId } })
      : await this.listPractitioners();

    const from = opts.from ?? new Date();
    const to = opts.to ?? new Date(from.getTime() + 7 * DAY_MS);
    const busy = await this.busyByPractitioner(practitioners.map((p) => p.id), from, to, opts.excludeAppointmentId);

    const slots: FreeSlot[] = [];
    for (const practitioner of practitioners) {
      const starts = freeStarts(practitioner, busy.get(practitioner.id) ?? [], {
        from,
        to,
        durationMin: opts.durationMin ?? DEFAULT_DURATION_MINUTES,
        timeZone,
        timeFrom: opts.timeFrom,
        timeTo: opts.timeTo,
      });
      for (const start of starts) {
        slots.push({ practitionerId: practitioner.id, practitionerName: practitioner.name, slotStart: start.toISOString() });
      }
    }
    return slots.sort((a, b) => a.slotStart.localeCompare(b.slotStart));
  }

  /**
   * Used by the AI tools: the patient already agreed to a slot returned by
   * check_availability, so this books immediately rather than going through
   * the panel's hold→confirm flow. A per-practitioner Redis lock serializes
   * bookings so the overlap check (visits have different lengths) and the
   * insert happen as one step; the Postgres partial unique index on
   * (practitioner_id, slot_start) stays as the last-resort backstop.
   * AI bookings must also fit the schedule (hours, break, days off).
   */
  async bookDirect(params: {
    patientId: string;
    practitionerId: string;
    slotStart: Date;
    serviceId?: string | null;
    durationMin?: number;
    createdBy: CreatedBy;
    /** Ignore this appointment when checking overlaps (rescheduling). */
    excludeAppointmentId?: string;
  }): Promise<BookResult> {
    const durationMin = params.durationMin ?? (await this.serviceDuration(params.serviceId));
    const lockKey = `lock:${this.tenant.orgId}:${params.practitionerId}`;
    const lockToken = randomUUID();
    const acquired = await this.acquireLock(lockKey, lockToken, 10_000);

    if (!acquired) {
      return { ok: false, alternatives: await this.nearbyAlternatives(params.practitionerId, params.slotStart, durationMin), message: 'Slot is being booked by someone else' };
    }

    try {
      // The AI must stay inside the schedule; an admin may book off-hours, but never on top of another visit.
      const fits =
        params.createdBy === CreatedBy.Ai
          ? (
              await this.getFreeSlots({
                practitionerId: params.practitionerId,
                from: params.slotStart,
                to: params.slotStart,
                durationMin,
                excludeAppointmentId: params.excludeAppointmentId,
              })
            ).length > 0
          : !overlapsAny(
              params.slotStart,
              durationMin,
              (await this.busyByPractitioner([params.practitionerId], params.slotStart, params.slotStart, params.excludeAppointmentId)).get(params.practitionerId) ?? [],
            );
      if (!fits) {
        return { ok: false, alternatives: await this.nearbyAlternatives(params.practitionerId, params.slotStart, durationMin, params.excludeAppointmentId), message: 'Slot not free' };
      }

      const repo = this.tenant.repo(AppointmentEntity);
      const appointment = repo.create({
        orgId: this.tenant.orgId,
        patientId: params.patientId,
        practitionerId: params.practitionerId,
        serviceId: params.serviceId ?? null,
        slotStart: params.slotStart,
        durationMin,
        status: AppointmentStatus.Booked,
        createdBy: params.createdBy,
      });
      const saved = await repo.save(appointment);
      await this.audit.record({ actor: params.createdBy, action: 'appointment.book', entity: 'appointment', entityId: saved.id, after: saved });
      return { ok: true, appointment: saved, message: 'Booked' };
    } catch (err: any) {
      if (err?.code === '23505') {
        return { ok: false, alternatives: await this.nearbyAlternatives(params.practitionerId, params.slotStart, durationMin), message: 'Slot just taken' };
      }
      throw err;
    } finally {
      await this.releaseLock(lockKey, lockToken);
    }
  }

  /** The patient's own upcoming active visits (what the AI may confirm, move or cancel). */
  listUpcomingForPatient(patientId: string): Promise<AppointmentEntity[]> {
    return this.tenant
      .repo(AppointmentEntity)
      .createQueryBuilder('a')
      .where('a.orgId = :orgId', { orgId: this.tenant.orgId })
      .andWhere('a.patientId = :patientId', { patientId })
      .andWhere('a.status IN (:...statuses)', { statuses: [AppointmentStatus.Booked, AppointmentStatus.Confirmed] })
      .andWhere('a.slotStart >= :now', { now: new Date() })
      .orderBy('a.slotStart', 'ASC')
      .getMany();
  }

  /** Loads an upcoming appointment only if it belongs to this patient. */
  async findPatientAppointment(patientId: string, appointmentId: string): Promise<AppointmentEntity | null> {
    if (!/^[0-9a-f-]{36}$/i.test(appointmentId)) return null;
    const appt = await this.tenant.repo(AppointmentEntity).findOneBy({ id: appointmentId, orgId: this.tenant.orgId, patientId });
    if (!appt || !ACTIVE_BOOKED.includes(appt.status) || appt.slotStart < new Date()) return null;
    return appt;
  }

  async confirmByPatient(patientId: string, appointmentId: string): Promise<AppointmentEntity | null> {
    const appt = await this.findPatientAppointment(patientId, appointmentId);
    if (!appt) return null;
    appt.status = AppointmentStatus.Confirmed;
    const saved = await this.tenant.repo(AppointmentEntity).save(appt);
    await this.audit.record({ actor: 'patient', action: 'appointment.confirm_by_patient', entity: 'appointment', entityId: appt.id });
    return saved;
  }

  async cancelByPatient(patientId: string, appointmentId: string): Promise<AppointmentEntity | null> {
    const appt = await this.findPatientAppointment(patientId, appointmentId);
    if (!appt) return null;
    return this.cancelAppointment(appt.id, 'patient');
  }

  /** Books the new time first and only then frees the old one, so a failed move loses nothing. */
  async rescheduleByPatient(params: {
    patientId: string;
    appointmentId: string;
    slotStart: Date;
    practitionerId?: string;
  }): Promise<{ ok: boolean; appointment?: AppointmentEntity; alternatives?: FreeSlot[]; notFound?: boolean }> {
    const old = await this.findPatientAppointment(params.patientId, params.appointmentId);
    if (!old) return { ok: false, notFound: true };
    const result = await this.bookDirect({
      patientId: params.patientId,
      practitionerId: params.practitionerId ?? old.practitionerId,
      slotStart: params.slotStart,
      serviceId: old.serviceId,
      durationMin: old.durationMin,
      createdBy: CreatedBy.Ai,
      excludeAppointmentId: old.id,
    });
    if (!result.ok) return { ok: false, alternatives: result.alternatives };
    await this.cancelAppointment(old.id, 'patient');
    await this.audit.record({ actor: 'patient', action: 'appointment.reschedule', entity: 'appointment', entityId: result.appointment!.id, before: { id: old.id, slotStart: old.slotStart } });
    return { ok: true, appointment: result.appointment };
  }

  /** Panel manual booking flow: 5-minute reservation before the admin confirms. */
  async holdSlot(params: { practitionerId: string; patientId: string; slotStart: Date; serviceId?: string | null; ttlSec?: number }) {
    const ttlSec = params.ttlSec ?? 300;
    const durationMin = await this.serviceDuration(params.serviceId);
    // Admins may book outside working hours, but never on top of another visit.
    const lockKey = `lock:${this.tenant.orgId}:${params.practitionerId}`;
    const lockToken = randomUUID();
    if (!(await this.acquireLock(lockKey, lockToken, 10_000))) {
      return { ok: false as const, alternatives: await this.nearbyAlternatives(params.practitionerId, params.slotStart, durationMin) };
    }
    try {
      const busy = await this.busyByPractitioner([params.practitionerId], params.slotStart, params.slotStart);
      if (overlapsAny(params.slotStart, durationMin, busy.get(params.practitionerId) ?? [])) {
        return { ok: false as const, alternatives: await this.nearbyAlternatives(params.practitionerId, params.slotStart, durationMin) };
      }
      const repo = this.tenant.repo(AppointmentEntity);
      const appointment = await repo.save(
        repo.create({
          orgId: this.tenant.orgId,
          patientId: params.patientId,
          practitionerId: params.practitionerId,
          serviceId: params.serviceId ?? null,
          slotStart: params.slotStart,
          durationMin,
          status: AppointmentStatus.Held,
          createdBy: CreatedBy.Human,
          holdToken: lockToken,
        }),
      );
      return { ok: true as const, appointment };
    } catch (err: any) {
      if (err?.code === '23505') {
        return { ok: false as const, alternatives: await this.nearbyAlternatives(params.practitionerId, params.slotStart, durationMin) };
      }
      throw err;
    } finally {
      await this.releaseLock(lockKey, lockToken);
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

  /**
   * Bookings made in the panel's AI test chat are real (so admins can test
   * the whole flow) but must not keep blocking the real calendar.
   */
  async sweepTestChatBookings(testPhone: string): Promise<number> {
    const cutoff = new Date(Date.now() - TEST_BOOKING_TTL_MIN * 60 * 1000);
    const result = await this.tenant.manager
      .createQueryBuilder()
      .update(AppointmentEntity)
      .set({ status: AppointmentStatus.Cancelled })
      .where('status IN (:...statuses)', { statuses: ACTIVE_STATUSES })
      .andWhere('createdAt < :cutoff', { cutoff })
      .andWhere('patient_id IN (SELECT id FROM patient WHERE phone = :phone)', { phone: testPhone })
      .execute();
    return result.affected ?? 0;
  }

  private async nearbyAlternatives(practitionerId: string, near: Date, durationMin: number, excludeAppointmentId?: string): Promise<FreeSlot[]> {
    const from = new Date(Math.max(near.getTime() - 3 * 60 * 60 * 1000, Date.now()));
    const to = new Date(near.getTime() + 3 * 60 * 60 * 1000);
    let slots = await this.getFreeSlots({ practitionerId, from, to, durationMin, excludeAppointmentId });
    if (!slots.length) slots = await this.getFreeSlots({ practitionerId, from: new Date(Math.max(near.getTime(), Date.now())), durationMin, excludeAppointmentId });
    return slots.slice(0, 3);
  }

  private async serviceDuration(serviceId?: string | null): Promise<number> {
    if (!serviceId) return DEFAULT_DURATION_MINUTES;
    const service = await this.tenant.repo(ServiceEntity).findOneBy({ id: serviceId, orgId: this.tenant.orgId });
    return service?.durationMin ?? DEFAULT_DURATION_MINUTES;
  }

  /** Active visits as [start, end) per practitioner; looks a day back so long visits that started earlier still count. */
  private async busyByPractitioner(practitionerIds: string[], from: Date, to: Date, excludeAppointmentId?: string): Promise<Map<string, BusyInterval[]>> {
    const map = new Map<string, BusyInterval[]>();
    if (!practitionerIds.length) return map;
    const qb = this.tenant
      .repo(AppointmentEntity)
      .createQueryBuilder('a')
      .where('a.orgId = :orgId', { orgId: this.tenant.orgId })
      .andWhere('a.practitionerId IN (:...ids)', { ids: practitionerIds })
      .andWhere('a.status IN (:...statuses)', { statuses: ACTIVE_STATUSES })
      .andWhere('a.slotStart BETWEEN :from AND :to', { from: new Date(from.getTime() - DAY_MS), to: new Date(to.getTime() + DAY_MS) });
    if (excludeAppointmentId) qb.andWhere('a.id <> :exclude', { exclude: excludeAppointmentId });
    for (const a of await qb.getMany()) {
      const list = map.get(a.practitionerId) ?? [];
      list.push({ start: a.slotStart, end: new Date(a.slotStart.getTime() + (a.durationMin || DEFAULT_DURATION_MINUTES) * 60_000) });
      map.set(a.practitionerId, list);
    }
    return map;
  }

  /** Short retry: two patients booking the same doctor at once should both get an answer, not a false "busy". */
  private async acquireLock(key: string, token: string, ttlMs: number): Promise<boolean> {
    for (let i = 0; i < 20; i++) {
      if (await this.redis.set(key, token, 'PX', ttlMs, 'NX')) return true;
      await new Promise((r) => setTimeout(r, 100));
    }
    return false;
  }

  private async releaseLock(key: string, token: string): Promise<void> {
    // Only delete if we still own it (compare-and-delete), so a slower
    // caller can never release a lock acquired by someone else after expiry.
    const lua = `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end`;
    await this.redis.eval(lua, 1, key, token).catch((err) => this.logger.warn(`Lock release failed: ${err}`));
  }
}
