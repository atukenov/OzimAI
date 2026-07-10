import { Injectable } from '@nestjs/common';
import { CreatedBy } from '@ozimai/shared';
import { SchedulingService } from '../scheduling/scheduling.service';
import { CrmService } from '../crm/crm.service';
import { LlmToolCall } from './providers/llm-provider.interface';

export interface ToolExecutionContext {
  patientId: string;
}

export interface ToolExecutionOutcome {
  toolCallId: string;
  toolName: string;
  content: string;
  escalated?: { reason: string };
  booked?: boolean;
}

const DATE_FMT: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' };

@Injectable()
export class ToolExecutorService {
  constructor(
    private readonly scheduling: SchedulingService,
    private readonly crm: CrmService,
  ) {}

  async execute(call: LlmToolCall, ctx: ToolExecutionContext): Promise<ToolExecutionOutcome> {
    switch (call.name) {
      case 'check_availability':
        return this.checkAvailability(call);
      case 'book_appointment':
        return this.bookAppointment(call, ctx);
      case 'escalate':
        return this.escalate(call);
      default:
        return { toolCallId: call.id, toolName: call.name, content: 'Неизвестный инструмент.' };
    }
  }

  private async checkAvailability(call: LlmToolCall): Promise<ToolExecutionOutcome> {
    const doctor = String(call.input.doctor ?? '').trim();
    const practitioner = doctor ? await this.scheduling.resolvePractitionerByName(doctor) : null;
    const slots = await this.scheduling.getFreeSlots({ practitionerId: practitioner?.id });
    const top = slots.slice(0, 3);
    if (!top.length) {
      return { toolCallId: call.id, toolName: call.name, content: 'Свободных слотов в ближайшее время нет.' };
    }
    const content = top.map((s) => `${s.practitionerName} — ${s.slotStart} (${formatHuman(s.slotStart)})`).join('; ');
    return { toolCallId: call.id, toolName: call.name, content };
  }

  private async bookAppointment(call: LlmToolCall, ctx: ToolExecutionContext): Promise<ToolExecutionOutcome> {
    const doctor = String(call.input.doctor ?? '').trim();
    const timeRaw = String(call.input.time ?? '');
    const patientName = String(call.input.patientName ?? '').trim() || undefined;

    const slotStart = new Date(timeRaw);
    if (Number.isNaN(slotStart.getTime())) {
      return { toolCallId: call.id, toolName: call.name, content: 'Не удалось распознать время — уточните у администратора.' };
    }

    let practitioner = doctor ? await this.scheduling.resolvePractitionerByName(doctor) : null;
    if (!practitioner) {
      const candidates = await this.scheduling.getFreeSlots({});
      const match = candidates.find((s) => s.slotStart === slotStart.toISOString());
      if (match) practitioner = await this.scheduling.resolvePractitionerByName(match.practitionerName);
    }
    if (!practitioner) {
      return { toolCallId: call.id, toolName: call.name, content: 'Не удалось определить врача для этого времени.' };
    }

    if (patientName) {
      const patient = await this.crm.get(ctx.patientId);
      await this.crm.upsertByPhone(patient.phone, patientName, patient.sourceChannel);
    }

    const result = await this.scheduling.bookDirect({
      patientId: ctx.patientId,
      practitionerId: practitioner.id,
      slotStart,
      createdBy: CreatedBy.Ai,
    });

    if (result.ok) {
      const content = `Записано: ${patientName ?? 'пациент'} к ${practitioner.name} на ${formatHuman(slotStart.toISOString())}.`;
      return { toolCallId: call.id, toolName: call.name, content, booked: true };
    }

    const alt = (result.alternatives ?? []).map((s) => `${s.practitionerName} — ${formatHuman(s.slotStart)}`).join('; ');
    const content = alt
      ? `Этот слот уже занят. Свободно рядом: ${alt}. Предложите пациенту одно из этих времён.`
      : 'Этот слот уже занят, и свободных рядом нет — уточните другой день.';
    return { toolCallId: call.id, toolName: call.name, content };
  }

  private async escalate(call: LlmToolCall): Promise<ToolExecutionOutcome> {
    const reason = String(call.input.reason ?? 'Не указана');
    return {
      toolCallId: call.id,
      toolName: call.name,
      content: `Передано администратору. Причина: ${reason}`,
      escalated: { reason },
    };
  }
}

function formatHuman(iso: string): string {
  return new Date(iso).toLocaleString('ru-RU', DATE_FMT);
}
