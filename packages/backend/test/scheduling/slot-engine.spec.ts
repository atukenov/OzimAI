import { freeStarts } from '../../src/modules/scheduling/slot-engine';
import { formatForPatient, localDateToUtc, zonedTimeToUtc } from '../../src/modules/scheduling/clinic-time';

const TZ = 'Asia/Almaty'; // UTC+5
const weekdays = (open: string, close: string) => ({ 1: [open, close], 2: [open, close], 3: [open, close], 4: [open, close], 5: [open, close], 6: null, 0: null }) as any;

// Monday 1 Dec 2025, clinic-local
const monday = localDateToUtc('2025-12-01', TZ)!;
const dayEnd = new Date(monday.getTime() + 24 * 3600_000 - 1);
const at = (h: number, m = 0) => zonedTimeToUtc(2025, 12, 1, h, m, TZ);
const hm = (d: Date) => formatForPatient(d, TZ).slice(-5);

describe('slot engine (pure, no database)', () => {
  it('reads working hours on the clinic clock, whatever the server time zone', () => {
    const starts = freeStarts({ workingHours: weekdays('09:00', '11:00') }, [], { from: monday, to: dayEnd, durationMin: 30, timeZone: TZ });
    expect(starts.map(hm)).toEqual(['09:00', '09:30', '10:00', '10:30']);
    expect(starts[0].toISOString()).toBe('2025-12-01T04:00:00.000Z');
  });

  it('a long visit must fit before closing and blocks every slot it covers', () => {
    const sched = { workingHours: weekdays('09:00', '12:00') };
    const ninety = freeStarts(sched, [], { from: monday, to: dayEnd, durationMin: 90, timeZone: TZ });
    expect(ninety.map(hm)).toEqual(['09:00', '09:30', '10:00', '10:30']);

    const busy = [{ start: at(9, 0), end: at(10, 30) }]; // an implant 09:00-10:30
    const thirty = freeStarts(sched, busy, { from: monday, to: dayEnd, durationMin: 30, timeZone: TZ });
    expect(thirty.map(hm)).toEqual(['10:30', '11:00', '11:30']);
  });

  it('skips the daily break and days off', () => {
    const sched = { workingHours: weekdays('12:00', '15:00'), breakTime: ['13:00', '14:00'] as [string, string] };
    expect(freeStarts(sched, [], { from: monday, to: dayEnd, durationMin: 60, timeZone: TZ }).map(hm)).toEqual(['12:00', '14:00']);
    expect(freeStarts({ ...sched, daysOff: ['2025-12-01'] }, [], { from: monday, to: dayEnd, durationMin: 30, timeZone: TZ })).toEqual([]);
  });

  it('filters by the time window the patient asked for ("after 15:00")', () => {
    const starts = freeStarts({ workingHours: weekdays('09:00', '18:00') }, [], {
      from: monday,
      to: dayEnd,
      durationMin: 30,
      timeZone: TZ,
      timeFrom: '15:00',
    });
    expect(starts.map(hm)).toEqual(['15:00', '15:30', '16:00', '16:30', '17:00', '17:30']);
  });

  it('closed days produce nothing', () => {
    const sunday = localDateToUtc('2025-11-30', TZ)!;
    const end = new Date(sunday.getTime() + 24 * 3600_000 - 1);
    expect(freeStarts({ workingHours: weekdays('09:00', '18:00') }, [], { from: sunday, to: end, durationMin: 30, timeZone: TZ })).toEqual([]);
  });
});
