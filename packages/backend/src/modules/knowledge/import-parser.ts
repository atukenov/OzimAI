export interface ParsedEntry {
  question: string;
  answer: string;
}

const PRICE_SUFFIX = /(тг|тенге|kzt|₸)\.?$/i;
const DELIMITERS = [' - ', ' — ', '\t', ';', ',', ':'];

/**
 * Best-effort parser for the onboarding "upload your price list" step.
 * Supports plain text and CSV (both are just delimited lines at this point —
 * OCR of photographed price lists is out of scope for this pass, see plan).
 * Each line becomes one knowledge_doc draft, previewed before publish.
 */
export function parseKnowledgeImport(raw: string): ParsedEntry[] {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const entries: ParsedEntry[] = [];
  let pendingQuestion: string | null = null;

  for (const line of lines) {
    const qMatch = line.match(/^(?:в|q|вопрос)\s*[:\-]\s*(.+)$/i);
    const aMatch = line.match(/^(?:о|a|ответ)\s*[:\-]\s*(.+)$/i);
    if (qMatch) {
      pendingQuestion = qMatch[1].trim();
      continue;
    }
    if (aMatch && pendingQuestion) {
      entries.push({ question: pendingQuestion, answer: aMatch[1].trim() });
      pendingQuestion = null;
      continue;
    }

    const split = splitOnDelimiter(line);
    if (!split) continue;
    const [left, right] = split;

    const priceValue = parsePrice(right);
    if (priceValue !== null) {
      entries.push({ question: `Сколько стоит «${left}»?`, answer: `${left} — ${formatPrice(priceValue)} ₸` });
    } else {
      entries.push({ question: left, answer: right });
    }
  }

  return entries;
}

function splitOnDelimiter(line: string): [string, string] | null {
  for (const delim of DELIMITERS) {
    const idx = line.indexOf(delim);
    if (idx > 0 && idx < line.length - delim.length) {
      return [line.slice(0, idx).trim(), line.slice(idx + delim.length).trim()];
    }
  }
  return null;
}

function parsePrice(text: string): number | null {
  const withoutSuffix = text.replace(PRICE_SUFFIX, '').trim();
  // The whole remaining string must be numeric (digits + thousands
  // separators) — not just "contains digits somewhere". Stripping non-digit
  // characters unconditionally used to turn "Ежедневно 09:00-20:00" into
  // "09002000" (9 002 000 ₸!) by mashing the time range's digits together.
  if (!/^\d[\d\s.,]*$/.test(withoutSuffix)) return null;
  const cleaned = withoutSuffix.replace(/[\s.,]/g, '');
  const value = Number(cleaned);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function formatPrice(value: number): string {
  return value.toLocaleString('ru-RU');
}
