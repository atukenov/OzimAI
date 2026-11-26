/** Pure helpers for the per-clinic monthly SMS allowance. */

const GSM7 = /^[A-Za-z0-9 \r\n@£$¥èéùìòÇØøÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ!"#¤%&'()*+,\-./:;<=>?¡ÄÖÑÜ§¿äöñüà]*$/;

/** Billable segments: Latin (GSM-7) 160 / 153 per part, Cyrillic (UCS-2) 70 / 67 per part. */
export function smsSegments(text: string): number {
  const gsm = GSM7.test(text);
  const single = gsm ? 160 : 70;
  const multi = gsm ? 153 : 67;
  const len = [...text].length;
  if (len <= single) return 1;
  return Math.ceil(len / multi);
}

/** 'YYYY-MM' of `now` in the clinic's timezone. */
export function smsPeriod(now: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit' }).formatToParts(now);
  const y = parts.find((p) => p.type === 'year')!.value;
  const m = parts.find((p) => p.type === 'month')!.value;
  return `${y}-${m}`;
}

export function usedThisMonth(org: { smsUsed: number; smsPeriod: string | null }, period: string): number {
  return org.smsPeriod === period ? org.smsUsed : 0;
}
