import { WorkingHours } from '@ozimai/shared';
import { parseHm, startOfLocalDay, zonedParts, zonedTimeToUtc, localDateKey } from './clinic-time';

export const SLOT_STEP_MINUTES = 30;
export const DEFAULT_DURATION_MINUTES = 30;

export interface PractitionerSchedule {
  workingHours: WorkingHours;
  /** Daily break, e.g. ["13:00","14:00"]; null = no break. */
  breakTime?: [string, string] | null;
  /** Local dates ('YYYY-MM-DD') the practitioner does not work: vacation, sick days. */
  daysOff?: string[] | null;
}

export interface BusyInterval {
  start: Date;
  end: Date;
}

export interface SlotQuery {
  from: Date;
  to: Date;
  durationMin: number;
  timeZone: string;
  /** Only starts at or after this local time ('HH:MM'). */
  timeFrom?: string;
  /** Only starts at or before this local time ('HH:MM'). */
  timeTo?: string;
  stepMin?: number;
}

/**
 * Free start times for one practitioner: the whole visit [start, start+duration)
 * must fit inside working hours, miss the daily break and every busy interval,
 * and fall on a working day. Pure, so it is unit-tested without a database.
 */
export function freeStarts(schedule: PractitionerSchedule, busy: BusyInterval[], q: SlotQuery): Date[] {
  const step = q.stepMin ?? SLOT_STEP_MINUTES;
  const duration = Math.max(q.durationMin || DEFAULT_DURATION_MINUTES, 5);
  const daysOff = new Set(schedule.daysOff ?? []);
  const brk = schedule.breakTime ? [parseHm(schedule.breakTime[0]), parseHm(schedule.breakTime[1])] : null;
  const windowFrom = q.timeFrom ? parseHm(q.timeFrom) : null;
  const windowTo = q.timeTo ? parseHm(q.timeTo) : null;

  const out: Date[] = [];
  for (let day = startOfLocalDay(q.from, q.timeZone); day <= q.to; day = startOfLocalDay(day, q.timeZone, 1)) {
    if (daysOff.has(localDateKey(day, q.timeZone))) continue;
    const p = zonedParts(day, q.timeZone);
    const hours = schedule.workingHours?.[p.weekday];
    if (!hours) continue;
    const open = parseHm(hours[0]);
    const close = parseHm(hours[1]);

    for (let t = open; t + duration <= close; t += step) {
      if (windowFrom !== null && t < windowFrom) continue;
      if (windowTo !== null && t > windowTo) continue;
      if (brk && t < brk[1] && t + duration > brk[0]) continue;
      const start = zonedTimeToUtc(p.year, p.month, p.day, Math.floor(t / 60), t % 60, q.timeZone);
      if (start < q.from || start > q.to) continue;
      const end = new Date(start.getTime() + duration * 60_000);
      if (busy.some((b) => start < b.end && end > b.start)) continue;
      out.push(start);
    }
  }
  return out;
}

/** True when [start, start+duration) collides with any busy interval. */
export function overlapsAny(start: Date, durationMin: number, busy: BusyInterval[]): boolean {
  const end = new Date(start.getTime() + durationMin * 60_000);
  return busy.some((b) => start < b.end && end > b.start);
}
