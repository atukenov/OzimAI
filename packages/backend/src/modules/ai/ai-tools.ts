import { AI_TOOL_NAMES } from '@ozimai/shared';
import { LlmToolDef } from './providers/llm-provider.interface';

export const AI_TOOL_DEFS: LlmToolDef[] = [
  {
    name: 'check_availability',
    description: 'Вернуть свободные слоты у врачей клиники. doctor необязателен — если не указан, вернутся слоты всех врачей.',
    inputSchema: {
      type: 'object',
      properties: { doctor: { type: 'string', description: 'Имя врача, необязательно' } },
    },
  },
  {
    name: 'book_appointment',
    description: 'Забронировать слот для пациента. time должен быть точным значением ISO-времени из результата check_availability.',
    inputSchema: {
      type: 'object',
      properties: {
        doctor: { type: 'string', description: 'Имя врача' },
        time: { type: 'string', description: 'ISO datetime, ровно как вернул check_availability' },
        patientName: { type: 'string', description: 'Имя пациента' },
      },
      required: ['doctor', 'time', 'patientName'],
    },
  },
  {
    name: 'escalate',
    description:
      'Передать вопрос администратору-человеку, когда нельзя ответить самостоятельно: медицинский вопрос, вопрос вне базы знаний, агрессия/спам.',
    inputSchema: {
      type: 'object',
      properties: { reason: { type: 'string' } },
      required: ['reason'],
    },
  },
];

export type { AiToolName } from '@ozimai/shared';
export { AI_TOOL_NAMES };
