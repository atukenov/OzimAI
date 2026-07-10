import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { LlmCompletionRequest, LlmCompletionResult, LlmProvider, LlmTurn } from './llm-provider.interface';

const MEDICAL_RE = /(бол[ьи]|выпить|таблетк|лекарств|антибиотик|температур|диагноз|что делать|как лечить)/i;
const BOOKING_INTENT_RE = /(запиш|записать|записаться|хочу приём|хочу на приём)/i;
const CONFIRM_RE = /(давайте|хорошо|подходит|согласен|согласна|устраивает|да[,.]?\s*(на|к|в)?\s)/i;
const TIME_RE = /\d{1,2}[:.]\d{2}/;
const NAME_RE = /зовут\s+([А-ЯЁ][а-яё]+)/i;
const PRICE_RE = /(сколько стоит|цена|стоимост)/i;

interface OfferedSlot {
  doctor: string;
  iso: string;
  human: string;
}

/**
 * Deterministic fallback used whenever AnthropicProvider is unconfigured or
 * errors. Not a language model — a small heuristic state machine that still
 * exercises the same tool-calling contract (check_availability /
 * book_appointment / escalate) so the product is fully demoable and the
 * guardrail test suite has a stable, free, always-available target.
 */
@Injectable()
export class MockProvider implements LlmProvider {
  readonly name = 'mock';

  async complete(request: LlmCompletionRequest): Promise<LlmCompletionResult> {
    const lastTurn = request.turns[request.turns.length - 1];

    // Continuing after a tool call: summarize the tool result in plain text.
    if (lastTurn?.role === 'user' && lastTurn.toolResults?.length) {
      const priorAssistant = [...request.turns].reverse().find((t) => t.role === 'assistant');
      const calledTool = priorAssistant?.role === 'assistant' ? priorAssistant.toolCalls?.[0]?.name : undefined;
      const resultText = lastTurn.toolResults[0].content;

      if (calledTool === 'escalate') {
        return { text: 'Передаю ваш вопрос администратору клиники — ответят в течение часа.', toolCalls: [], model: this.name };
      }
      if (calledTool === 'check_availability') {
        return { text: `Свободное время: ${resultText}. Какое вам подходит?`, toolCalls: [], model: this.name };
      }
      return { text: resultText, toolCalls: [], model: this.name };
    }

    const text = lastTurn?.role === 'user' ? lastTurn.text ?? '' : '';

    if (MEDICAL_RE.test(text)) {
      return {
        text: null,
        toolCalls: [{ id: randomUUID(), name: 'escalate', input: { reason: 'Медицинский вопрос вне компетенции AI' } }],
        model: this.name,
      };
    }

    // Already offered slots earlier in this conversation, and the patient is
    // now picking one — this is the second half of the booking flow
    // (system prompt rule 3: check_availability, then book_appointment).
    const offered = findOfferedSlots(request.turns);
    if (offered.length && (TIME_RE.test(text) || CONFIRM_RE.test(text))) {
      const requestedTime = normalizeTime(text.match(TIME_RE)?.[0]);
      const mentionedDoctor = offered.find((s) => text.toLowerCase().includes(s.doctor.toLowerCase()));
      const chosen =
        offered.find((s) => (!requestedTime || s.human.includes(requestedTime)) && (!mentionedDoctor || s === mentionedDoctor)) ??
        mentionedDoctor ??
        offered[0];
      const patientName = text.match(NAME_RE)?.[1] ?? 'Пациент';

      return {
        text: null,
        toolCalls: [{ id: randomUUID(), name: 'book_appointment', input: { doctor: chosen.doctor, time: chosen.iso, patientName } }],
        model: this.name,
      };
    }

    if (BOOKING_INTENT_RE.test(text)) {
      const doctorMatch = text.match(/(?:к|у)\s+([А-ЯЁ][а-яё]+)/i);
      return {
        text: null,
        toolCalls: [{ id: randomUUID(), name: 'check_availability', input: doctorMatch ? { doctor: doctorMatch[1] } : {} }],
        model: this.name,
      };
    }

    if (PRICE_RE.test(text)) {
      const kbLine = findKnowledgeLine(request.system, text);
      if (kbLine) {
        return { text: kbLine, toolCalls: [], model: this.name };
      }
    }

    // Unknown territory: never guess (FR-02) — escalate.
    return {
      text: null,
      toolCalls: [{ id: randomUUID(), name: 'escalate', input: { reason: 'Вопрос не покрыт базой знаний' } }],
      model: this.name,
    };
  }
}

// Generic query words ("сколько", "стоит"...) match almost every price
// question and every KB line about a price — excluding them forces a match
// on the actual product/topic being asked about, not just the question shape.
const STOPWORDS = new Set(['сколько', 'стоит', 'стоимость', 'стоимост', 'цена', 'цену', 'можно', 'нужно', 'сегодня', 'завтра']);

function findKnowledgeLine(system: string, question: string): string | null {
  const words = question
    .toLowerCase()
    .replace(/[^a-zа-яё0-9\s]/gi, '')
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOPWORDS.has(w));
  if (!words.length) return null;

  const lines = system.split('\n').filter((l) => l.trim().startsWith('-'));
  for (const line of lines) {
    const lower = line.toLowerCase();
    if (words.some((w) => lower.includes(w))) {
      const answer = line.split('→')[1]?.trim();
      return answer ? answer : line.replace(/^- /, '').trim();
    }
  }
  return null;
}

/**
 * check_availability's tool output looks like
 * "Серикова — 2026-07-10T07:00:00.000Z (10 июля в 12:00); Ахметов — ...ISO... (...)"
 * — scan backward for the most recent one so a follow-up message like
 * "Давайте к Серикова в 12:00" can be resolved to the exact ISO slot instead
 * of a bare, unparseable "12:00" string.
 */
function findOfferedSlots(turns: LlmTurn[]): OfferedSlot[] {
  const SLOT_RE = /([А-ЯЁ][а-яё]+)\s*—\s*(\S+)\s*\(([^)]+)\)/g;
  for (let i = turns.length - 1; i >= 0; i--) {
    const turn = turns[i];
    // Real single-request loop: the raw check_availability tool output.
    const toolContent = turn.role === 'user' ? turn.toolResults?.[0]?.content : undefined;
    // Cross-request history (test-chat, or any persisted-message replay):
    // only the assistant's rendered "Свободное время: ..." text survives.
    const assistantText = turn.role === 'assistant' ? turn.text : undefined;
    const source = toolContent ?? assistantText;
    if (!source) continue;
    const matches = [...source.matchAll(SLOT_RE)];
    if (matches.length) {
      return matches.map((m) => ({ doctor: m[1].trim(), iso: m[2].trim(), human: m[3].trim() }));
    }
  }
  return [];
}

function normalizeTime(raw: string | undefined): string | null {
  if (!raw) return null;
  return raw.replace('.', ':');
}
