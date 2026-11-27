import { Injectable } from '@nestjs/common';
import { AppointmentStatus, CreatedBy, FreeSlot } from '@ozimai/shared';
import { SchedulingService } from '../scheduling/scheduling.service';
import { CrmService } from '../crm/crm.service';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { PractitionerEntity } from '../../database/entities/practitioner.entity';
import { ServiceEntity } from '../../database/entities/service.entity';
import { formatForPatient, localDateToUtc, startOfLocalDay } from '../scheduling/clinic-time';
import { DEFAULT_DURATION_MINUTES } from '../scheduling/slot-engine';
import { LlmToolCall } from './providers/llm-provider.interface';

export interface ToolExecutionContext {
  patientId: string;
  timeZone: string;
  locale: 'ru' | 'kk';
}

export interface ToolExecutionOutcome {
  toolCallId: string;
  toolName: string;
  content: string;
  escalated?: { reason: string };
  booked?: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_SLOTS_SHOWN = 6;
const MAX_SLOTS_PER_DOCTOR = 3;
const HM_RE = /^([01]?\d|2[0-3]):[0-5]\d$/;

/**
 * Executes the AI's tool calls against real data. Tool results are read by the
 * model, not the patient, so they carry exact ISO times and ids alongside the
 * human-readable clinic-local time the model should repeat to the patient.
 */
@Injectable()
export class ToolExecutorService {
  constructor(
    private readonly scheduling: SchedulingService,
    private readonly crm: CrmService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(call: LlmToolCall, ctx: ToolExecutionContext): Promise<ToolExecutionOutcome> {
    const reply = (content: string, extra: Partial<ToolExecutionOutcome> = {}): ToolExecutionOutcome => ({
      toolCallId: call.id,
      toolName: call.name,
      content,
      ...extra,
    });
    const input = (call.input ?? {}) as Record<string, unknown>;
    const str = (k: string) => String(input[k] ?? '').trim();

    switch (call.name) {
      case 'check_availability':
        return reply(await this.checkAvailability(str, ctx));
      case 'book_appointment': {
        const res = await this.bookAppointment(str, ctx);
        return reply(res.content, { booked: res.booked });
      }
      case 'list_my_appointments':
        return reply(await this.listMine(ctx));
      case 'confirm_appointment': {
        const appt = await this.scheduling.confirmByPatient(ctx.patientId, str('appointmentId'));
        return reply(appt ? `Запись подтверждена: ${this.human(appt.slotStart, ctx)}.` : 'Запись не найдена. Вызови list_my_appointments и возьми id оттуда.');
      }
      case 'cancel_appointment': {
        const appt = await this.scheduling.cancelByPatient(ctx.patientId, str('appointmentId'));
        return reply(appt ? `Запись на ${this.human(appt.slotStart, ctx)} отменена.` : 'Запись не найдена. Вызови list_my_appointments и возьми id оттуда.');
      }
      case 'reschedule_appointment':
        return reply(await this.reschedule(str, ctx));
      case 'escalate': {
        const reason = str('reason') || 'Не указана';
        return reply(`Передано администратору. Причина: ${reason}`, { escalated: { reason } });
      }
      default:
        return reply('Неизвестный инструмент.');
    }
  }

  private async checkAvailability(str: (k: string) => string, ctx: ToolExecutionContext): Promise<string> {
    const doctor = str('doctor');
    const specialty = str('specialty');
    const serviceName = str('service');

    let practitioners: PractitionerEntity[];
    if (doctor) {
      const p = await this.scheduling.resolvePractitionerByName(doctor);
      if (!p) return `Врача «${doctor}» нет в клинике. Врачи: ${await this.doctorList()}.`;
      practitioners = [p];
    } else if (specialty) {
      practitioners = await this.scheduling.resolvePractitionersBySpecialty(specialty);
      if (!practitioners.length) return `Врача со специальностью «${specialty}» нет. Врачи: ${await this.doctorList()}. Если подходящего нет — escalate.`;
    } else {
      practitioners = await this.scheduling.listPractitioners();
    }
    if (!practitioners.length) return 'В клинике пока не добавлены врачи — вызови escalate.';

    const service = serviceName ? await this.scheduling.resolveServiceByName(serviceName) : null;
    const durationMin = service?.durationMin ?? DEFAULT_DURATION_MINUTES;
    const timeFrom = HM_RE.test(str('timeFrom')) ? str('timeFrom') : undefined;
    const timeTo = HM_RE.test(str('timeTo')) ? str('timeTo') : undefined;

    const now = new Date();
    const dayStart = str('date') ? localDateToUtc(str('date'), ctx.timeZone) : null;
    const search = (from: Date, to: Date, anyTime = false) =>
      this.scheduling.getFreeSlots({
        practitionerIds: practitioners.map((p) => p.id),
        from,
        to,
        durationMin,
        ...(anyTime ? {} : { timeFrom, timeTo }),
      });

    let slots: FreeSlot[] = [];
    let note = '';
    if (dayStart) {
      const dayEnd = new Date(startOfLocalDay(dayStart, ctx.timeZone, 1).getTime() - 1);
      const from = new Date(Math.max(dayStart.getTime(), now.getTime()));
      if (dayEnd >= now) {
        slots = await search(from, dayEnd);
        if (!slots.length && (timeFrom || timeTo)) {
          slots = await search(from, dayEnd, true);
          if (slots.length) note = `В это время ${str('date')} занято, но в тот же день свободно: `;
        }
      }
      if (!slots.length) {
        const next = new Date(Math.max(dayEnd.getTime() + 1, now.getTime()));
        slots = await search(next, new Date(next.getTime() + 7 * DAY_MS));
        note = `На ${str('date')} свободного времени нет. Ближайшие варианты: `;
      }
      if (!slots.length) return `Ни ${str('date')}, ни в следующие 7 дней свободного времени по этому запросу нет. Предложи другое время дня, другого врача или escalate.`;
    } else {
      slots = await search(now, new Date(now.getTime() + 14 * DAY_MS));
      if (!slots.length && (timeFrom || timeTo)) {
        slots = await search(now, new Date(now.getTime() + 14 * DAY_MS), true);
        if (slots.length) note = 'В это время дня свободного нет, но есть другое время: ';
      }
      if (!slots.length) return 'Свободного времени в ближайшие две недели нет. Предложи передать вопрос администратору (escalate).';
    }

    const byId = new Map(practitioners.map((p) => [p.id, p]));
    const perDoctor = new Map<string, number>();
    const picked: FreeSlot[] = [];
    for (const s of slots) {
      const n = perDoctor.get(s.practitionerId) ?? 0;
      if (n >= MAX_SLOTS_PER_DOCTOR) continue;
      perDoctor.set(s.practitionerId, n + 1);
      picked.push(s);
      if (picked.length >= MAX_SLOTS_SHOWN) break;
    }

    const lines = picked.map((s) => {
      const p = byId.get(s.practitionerId);
      const spec = p?.specialty ? ` (${p.specialty})` : '';
      return `${s.practitionerName}${spec} — time=${s.slotStart} — ${formatForPatient(new Date(s.slotStart), ctx.timeZone, ctx.locale, true)}`;
    });
    const svc = service ? `Услуга «${service.name}», ${service.durationMin} мин. ` : serviceName ? `Услуга «${serviceName}» не найдена в списке — уточни у пациента или escalate. ` : '';
    return `${svc}${note}\n${lines.join(';\n')}\nПредложи пациенту 1-2 варианта, называя время по-человечески.`;
  }

  private async bookAppointment(str: (k: string) => string, ctx: ToolExecutionContext): Promise<{ content: string; booked?: boolean }> {
    const doctor = str('doctor');
    const patientName = str('patientName') || undefined;
    const service = str('service') ? await this.scheduling.resolveServiceByName(str('service')) : null;
    const durationMin = service?.durationMin ?? DEFAULT_DURATION_MINUTES;

    const slotStart = new Date(str('time'));
    if (Number.isNaN(slotStart.getTime())) {
      return { content: 'Не удалось распознать время. Возьми точное значение time из check_availability.' };
    }
    if (slotStart < new Date()) return { content: 'Это время уже прошло. Вызови check_availability заново.' };

    let practitioner = doctor ? await this.scheduling.resolvePractitionerByName(doctor) : null;
    if (!practitioner) {
      const candidates = await this.scheduling.getFreeSlots({ from: slotStart, to: slotStart, durationMin });
      if (candidates[0]) practitioner = await this.scheduling.resolvePractitionerByName(candidates[0].practitionerName);
    }
    if (!practitioner) return { content: 'Не удалось определить врача для этого времени. Вызови check_availability заново.' };

    if (patientName) {
      const patient = await this.crm.get(ctx.patientId);
      await this.crm.upsertByPhone(patient.phone, patientName, patient.sourceChannel);
    }

    const result = await this.scheduling.bookDirect({
      patientId: ctx.patientId,
      practitionerId: practitioner.id,
      slotStart,
      serviceId: service?.id ?? null,
      durationMin,
      createdBy: CreatedBy.Ai,
    });

    if (result.ok) {
      const svc = service ? ` (${service.name})` : '';
      return { content: `Записано: ${patientName ?? 'пациент'} к ${practitioner.name}${svc} на ${this.human(slotStart, ctx)}.`, booked: true };
    }
    return { content: this.alternativesText('Это время уже занято или вне графика врача.', result.alternatives, ctx) };
  }

  private async reschedule(str: (k: string) => string, ctx: ToolExecutionContext): Promise<string> {
    const slotStart = new Date(str('time'));
    if (Number.isNaN(slotStart.getTime()) || slotStart < new Date()) {
      return 'Неверное время. Возьми точное значение time из check_availability.';
    }
    const doctor = str('doctor');
    const practitioner = doctor ? await this.scheduling.resolvePractitionerByName(doctor) : null;
    const result = await this.scheduling.rescheduleByPatient({
      patientId: ctx.patientId,
      appointmentId: str('appointmentId'),
      slotStart,
      practitionerId: practitioner?.id,
    });
    if (result.notFound) return 'Запись не найдена. Вызови list_my_appointments и возьми id оттуда.';
    if (result.ok) return `Запись перенесена на ${this.human(slotStart, ctx)}. Старое время освобождено.`;
    return this.alternativesText('Новое время занято или вне графика, запись осталась на прежнем времени.', result.alternatives, ctx);
  }

  private async listMine(ctx: ToolExecutionContext): Promise<string> {
    const appts = await this.scheduling.listUpcomingForPatient(ctx.patientId);
    if (!appts.length) return 'У пациента нет предстоящих записей.';
    const doctors = new Map((await this.scheduling.listPractitioners()).map((p) => [p.id, p.name]));
    const serviceIds = appts.map((a) => a.serviceId).filter(Boolean) as string[];
    const services = serviceIds.length
      ? new Map((await this.tenant.repo(ServiceEntity).findBy(serviceIds.map((id) => ({ id, orgId: this.tenant.orgId })))).map((s) => [s.id, s.name]))
      : new Map<string, string>();
    return appts
      .map((a) => {
        const svc = a.serviceId && services.get(a.serviceId) ? `, ${services.get(a.serviceId)}` : '';
        const status = a.status === AppointmentStatus.Confirmed ? 'подтверждена' : 'ждёт подтверждения';
        return `appointmentId=${a.id}: ${doctors.get(a.practitionerId) ?? 'врач'}${svc} — ${this.human(a.slotStart, ctx)} (${status})`;
      })
      .join('; ');
  }

  private alternativesText(prefix: string, alternatives: FreeSlot[] | undefined, ctx: ToolExecutionContext): string {
    const alt = (alternatives ?? []).map((s) => `${s.practitionerName} — time=${s.slotStart} — ${this.human(new Date(s.slotStart), ctx)}`).join(';\n');
    return alt ? `${prefix} Свободно рядом:\n${alt}\nПредложи пациенту одно из этих времён.` : `${prefix} Рядом свободного нет — вызови check_availability на другой день.`;
  }

  private async doctorList(): Promise<string> {
    const list = await this.scheduling.listPractitioners();
    return list.map((p) => (p.specialty ? `${p.name} (${p.specialty})` : p.name)).join(', ') || 'не добавлены';
  }

  private human(date: Date, ctx: ToolExecutionContext): string {
    return formatForPatient(date, ctx.timeZone, ctx.locale, true);
  }
}
