// Defense-in-depth: the system prompt already forbids medical advice and
// tells the model to write plain text, but neither is guaranteed — this is
// the pre-response-to-patient backstop from ADR-02.

export function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/`(.*?)`/g, '$1')
    .replace(/^#{1,6}\s*/gm, '')
    .trim();
}

// Phrases that look like the model is dispensing medical advice despite the
// system prompt — catches leakage even when the model didn't call escalate.
const MEDICAL_LEAK_RE =
  /(примите|выпейте|принимайте|рекомендую (принять|выпить)|можно выпить|обезболивающ\w*\s+(типа|например|как|в виде))/i;

export function containsMedicalAdviceLeak(text: string): boolean {
  return MEDICAL_LEAK_RE.test(text);
}
