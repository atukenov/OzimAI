/**
 * Wall-clock helpers for a clinic's time zone.
 *
 * Servers (Railway, Docker) run in UTC, so `Date#setHours` / `getDay` would
 * read a doctor's "09:00–18:00" as UTC and shift every slot by the zone's
 * offset (+5h for Kazakhstan). Everything that turns working hours into
 * instants, or instants into text for a patient, goes through here instead.
 */

export const DEFAULT_TIME_ZONE = 'Asia/Almaty';

export interface ZonedParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  /** 0=Sunday .. 6=Saturday, matching WorkingHours keys. */
  weekday: number;
}

const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const partsFormatters = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  let f = partsFormatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      weekday: 'short',
    });
    partsFormatters.set(timeZone, f);
  }
  return f;
}

export function zonedParts(date: Date, timeZone: string): ZonedParts {
  const map: Record<string, string> = {};
  for (const p of partsFormatter(timeZone).formatToParts(date)) map[p.type] = p.value;
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour) % 24,
    minute: Number(map.minute),
    weekday: WEEKDAYS[map.weekday] ?? 0,
  };
}

/** The UTC instant at which the clinic's wall clock reads the given local time. */
export function zonedTimeToUtc(year: number, month: number, day: number, hour: number, minute: number, timeZone: string): Date {
  const asUtc = Date.UTC(year, month - 1, day, hour, minute);
  // Two passes handle zones whose offset differs on either side of the instant (DST).
  let guess = asUtc;
  for (let i = 0; i < 2; i++) {
    const p = zonedParts(new Date(guess), timeZone);
    const shown = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
    guess += asUtc - shown;
  }
  return new Date(guess);
}

/** 'YYYY-MM-DD' of the instant on the clinic's calendar. */
export function localDateKey(date: Date, timeZone: string): string {
  const p = zonedParts(date, timeZone);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** Minutes since local midnight on the clinic's clock. */
export function localMinutes(date: Date, timeZone: string): number {
  const p = zonedParts(date, timeZone);
  return p.hour * 60 + p.minute;
}

export function parseHm(hm: string): number {
  const [h, m] = hm.split(':').map(Number);
  return h * 60 + (m || 0);
}

/** Local midnight of the clinic day that contains `date`, plus `days`. */
export function startOfLocalDay(date: Date, timeZone: string, days = 0): Date {
  const p = zonedParts(date, timeZone);
  const noonUtc = new Date(Date.UTC(p.year, p.month - 1, p.day + days, 12));
  return zonedTimeToUtc(noonUtc.getUTCFullYear(), noonUtc.getUTCMonth() + 1, noonUtc.getUTCDate(), 0, 0, timeZone);
}

/** Parses 'YYYY-MM-DD' as the clinic's local midnight. */
export function localDateToUtc(dateKey: string, timeZone: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey.trim());
  if (!m) return null;
  return zonedTimeToUtc(Number(m[1]), Number(m[2]), Number(m[3]), 0, 0, timeZone);
}

/** "28 ноября, 14:30" (or Kazakh) in the clinic's zone — what the patient sees. */
export function formatForPatient(date: Date, timeZone: string, locale: 'ru' | 'kk' = 'ru', withWeekday = false): string {
  return date.toLocaleString(locale === 'kk' ? 'kk-KZ' : 'ru-RU', {
    timeZone,
    ...(withWeekday ? { weekday: 'long' } : {}),
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}
