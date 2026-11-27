import { OrganizationEntity } from '../../database/entities/organization.entity';
import { KnowledgeDocEntity } from '../../database/entities/knowledge-doc.entity';
import { PractitionerEntity } from '../../database/entities/practitioner.entity';
import { ServiceEntity } from '../../database/entities/service.entity';
import { DEFAULT_TIME_ZONE, localDateKey } from '../scheduling/clinic-time';

export interface PromptContext {
  knowledge: KnowledgeDocEntity[];
  practitioners: PractitionerEntity[];
  services: ServiceEntity[];
  now: Date;
}

/**
 * Same template as the design prototype's buildSystemPrompt(), driven by
 * real per-org data instead of a hardcoded clinic. Knowledge is injected
 * directly (see knowledge-doc.entity.ts for why, at MVP scale) rather than
 * retrieved via embedding search. The current clinic-local date is included
 * so "завтра" / "в субботу" can be turned into a real date.
 */
export function buildSystemPrompt(org: OrganizationEntity, ctx: PromptContext): string {
  const aiName = org.aiName || 'Айым';
  const timeZone = org.timeZone || DEFAULT_TIME_ZONE;
  const kb = ctx.knowledge.length
    ? ctx.knowledge.map((k) => `- ${k.question} → ${k.answer}`).join('\n')
    : '(база знаний пока пуста — эскалируй любой вопрос по фактам или ценам)';
  const doctors = ctx.practitioners.length
    ? ctx.practitioners.map((p) => `- ${p.name}${p.specialty ? ` — ${p.specialty}` : ''}`).join('\n')
    : '(врачи не добавлены)';
  const services = ctx.services.length
    ? ctx.services.map((s) => `- ${s.name}: ${s.durationMin} мин, ${s.price.toLocaleString('ru-RU')} ₸`).join('\n')
    : '(список услуг не заполнен — записывай на стандартный приём)';

  const nowText = ctx.now.toLocaleString('ru-RU', {
    timeZone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return [
    `Ты — ${aiName}, AI-администратор клиники «${org.name}» в Казахстане. Отвечай коротко, тепло и по-человечески, максимум 2-3 предложения. Пиши на языке пациента (русский или казахский).`,
    ...(org.aiTone ? [`Тон общения: ${org.aiTone}.`] : []),
    `Сейчас в клинике: ${nowText} (дата ${localDateKey(ctx.now, timeZone)}). Все времена называй по времени клиники.`,
    '',
    'ВРАЧИ:',
    doctors,
    '',
    'УСЛУГИ (длительность и цена):',
    services,
    '',
    'БАЗА ЗНАНИЙ (единственный источник фактов и цен):',
    kb,
    '',
    'ЖЁСТКИЕ ПРАВИЛА:',
    '1. Никогда не давай медицинских советов, не называй лекарства, не ставь диагнозы и не советуй, что делать при боли/симптомах. При любом медицинском вопросе вызови tool escalate — не отвечай на него сам.',
    '2. Называй только цены и факты из базы знаний и списка услуг выше. Если чего-то там нет — вызови escalate, не придумывай.',
    '3. Запись: узнай услугу (если пациент её назвал) и удобный день/время, вызови check_availability с service, date, timeFrom/timeTo, specialty или doctor. Предложи 1-2 времени. После согласия вызови book_appointment с точным значением time из результата и той же услугой.',
    '4. Никогда не подтверждай запись, перенос или отмену словами, не вызвав соответствующий tool и не получив успешный результат.',
    '5. Если пациент пишет «подтверждаю», «перенести», «отменить» или спрашивает о своей записи — вызови list_my_appointments, затем confirm_appointment, reschedule_appointment (после check_availability) или cancel_appointment. Перед отменой переспроси, уверен ли пациент.',
    '6. Если пациент просит врача или специальность, которых нет в списке, скажи об этом и предложи доступных врачей или escalate.',
    '7. Пиши обычным текстом без markdown — никаких звёздочек, решёток или других символов разметки.',
  ]
    .join('\n');
}
