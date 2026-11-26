import { AI_TOOL_NAMES } from '@ozimai/shared';
import { LlmToolDef } from './providers/llm-provider.interface';

export const AI_TOOL_DEFS: LlmToolDef[] = [
  {
    name: 'check_availability',
    description:
      'Свободные слоты клиники. Все поля необязательны. Передавай date, если пациент назвал день ("завтра", "в субботу" — переведи в YYYY-MM-DD по текущей дате), и timeFrom/timeTo, если назвал время ("после 15:00" → timeFrom "15:00"). service — услуга (учитывается её длительность), specialty — специальность врача, doctor — имя врача.',
    inputSchema: {
      type: 'object',
      properties: {
        doctor: { type: 'string', description: 'Имя врача/мастера' },
        specialty: { type: 'string', description: 'Специальность, например "ортодонт"' },
        service: { type: 'string', description: 'Название услуги из списка услуг' },
        date: { type: 'string', description: 'День визита, YYYY-MM-DD (время клиники)' },
        timeFrom: { type: 'string', description: 'Не раньше, HH:MM' },
        timeTo: { type: 'string', description: 'Не позже, HH:MM' },
      },
    },
  },
  {
    name: 'book_appointment',
    description: 'Записать пациента на слот. time — точное ISO-значение из результата check_availability. service — та же услуга, что в check_availability.',
    inputSchema: {
      type: 'object',
      properties: {
        doctor: { type: 'string', description: 'Имя врача' },
        time: { type: 'string', description: 'ISO datetime, ровно как вернул check_availability' },
        patientName: { type: 'string', description: 'Имя пациента' },
        service: { type: 'string', description: 'Название услуги, если известно' },
      },
      required: ['doctor', 'time', 'patientName'],
    },
  },
  {
    name: 'list_my_appointments',
    description: 'Предстоящие записи этого пациента с их id. Вызывай перед подтверждением, переносом или отменой.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'confirm_appointment',
    description: 'Пациент подтверждает, что придёт. appointmentId из list_my_appointments.',
    inputSchema: {
      type: 'object',
      properties: { appointmentId: { type: 'string' } },
      required: ['appointmentId'],
    },
  },
  {
    name: 'reschedule_appointment',
    description:
      'Перенести запись пациента на новое время. Сначала list_my_appointments, затем check_availability (с той же услугой), согласуй время с пациентом и передай точное ISO-время.',
    inputSchema: {
      type: 'object',
      properties: {
        appointmentId: { type: 'string' },
        time: { type: 'string', description: 'ISO datetime из check_availability' },
        doctor: { type: 'string', description: 'Новый врач, если пациент хочет сменить врача' },
      },
      required: ['appointmentId', 'time'],
    },
  },
  {
    name: 'cancel_appointment',
    description: 'Отменить запись пациента. Только после явного согласия пациента. appointmentId из list_my_appointments.',
    inputSchema: {
      type: 'object',
      properties: { appointmentId: { type: 'string' } },
      required: ['appointmentId'],
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
