/**
 * Normalize a KZ/RU phone typed by a web visitor to the digits-only
 * international form WhatsApp uses (`77011234567`), so the same person is
 * one CRM patient across channels. Returns null when it can't be a phone.
 */
export function normalizePhone(input: string): string | null {
  let digits = input.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('8')) digits = `7${digits.slice(1)}`; // 8 701 ... -> 7 701 ...
  if (digits.length === 10 && digits.startsWith('7')) digits = `7${digits}`; // 701 ... -> 7 701 ...
  if (digits.length < 11 || digits.length > 15) return null;
  return digits;
}
