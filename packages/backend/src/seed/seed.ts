import 'reflect-metadata';
import { AppDataSource } from '../database/data-source';
import {
  AppointmentStatus,
  BillingStatus,
  Channel,
  ConversationStatus,
  CreatedBy,
  KnowledgeSourceType,
  LeadStatus,
  MessageSenderType,
  UserRole,
} from '@ozimai/shared';
import { OrganizationEntity } from '../database/entities/organization.entity';
import { AppUserEntity } from '../database/entities/app-user.entity';
import { BranchEntity } from '../database/entities/branch.entity';
import { PractitionerEntity } from '../database/entities/practitioner.entity';
import { ServiceEntity } from '../database/entities/service.entity';
import { KnowledgeDocEntity } from '../database/entities/knowledge-doc.entity';
import { PatientEntity } from '../database/entities/patient.entity';
import { ConversationEntity } from '../database/entities/conversation.entity';
import { MessageEntity } from '../database/entities/message.entity';
import { AppointmentEntity } from '../database/entities/appointment.entity';

const ALL_DAYS_9_20: Record<number, [string, string]> = { 0: ['09:00', '20:00'], 1: ['09:00', '20:00'], 2: ['09:00', '20:00'], 3: ['09:00', '20:00'], 4: ['09:00', '20:00'], 5: ['09:00', '20:00'], 6: ['09:00', '20:00'] };

function tomorrowAt(h: number, m: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(h, m, 0, 0);
  return d;
}

async function main() {
  await AppDataSource.initialize();

  await AppDataSource.transaction(async (manager) => {
    const orgRepo = manager.getRepository(OrganizationEntity);
    const existing = await orgRepo.findOneBy({ name: 'Стоматология «Айгуль»' });
    if (existing) {
      // eslint-disable-next-line no-console
      console.log('Demo org already seeded, skipping. Org id:', existing.id);
      return;
    }

    const org = await orgRepo.save(
      orgRepo.create({
        name: 'Стоматология «Айгуль»',
        plan: 'start',
        locale: 'ru',
        billingStatus: BillingStatus.Trial,
        trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        aiName: 'Айым',
        aiTone: 'тёплый и прямой',
      }),
    );

    await manager.getRepository(AppUserEntity).save({
      orgId: org.id,
      email: 'owner@aigul.demo',
      displayName: 'Мадина',
      role: UserRole.Owner,
    });

    // RLS is FORCE-enabled on every table below, so the seed transaction needs the same
    // session variable TenantScopeInterceptor sets per-request in the real app.
    await manager.query('SELECT set_config($1, $2, true)', ['app.current_org_id', org.id]);

    const branch = await manager.getRepository(BranchEntity).save({ orgId: org.id, name: 'Алматы, Достык 89', address: 'г. Алматы, ул. Достык 89' });

    const [serikova, akhmetov] = await manager.getRepository(PractitionerEntity).save([
      { orgId: org.id, branchId: branch.id, name: 'Серикова', workingHours: ALL_DAYS_9_20 },
      { orgId: org.id, branchId: branch.id, name: 'Ахметов', workingHours: ALL_DAYS_9_20 },
    ]);

    const [cleaning, implant] = await manager.getRepository(ServiceEntity).save([
      { orgId: org.id, name: 'Профессиональная чистка', price: 25_000, durationMin: 60 },
      { orgId: org.id, name: 'Имплантация', price: 180_000, durationMin: 90 },
    ]);

    const now = new Date();
    await manager.getRepository(KnowledgeDocEntity).save([
      { orgId: org.id, question: 'Сколько стоит чистка?', answer: 'Профессиональная чистка — 25 000 ₸', sourceType: KnowledgeSourceType.Manual, version: 1, publishedAt: now },
      { orgId: org.id, question: 'Сколько стоит имплант?', answer: 'От 180 000 ₸, точная цена после осмотра', sourceType: KnowledgeSourceType.Manual, version: 1, publishedAt: now },
      { orgId: org.id, question: 'Часы работы клиники', answer: 'Ежедневно 09:00–20:00, включая выходные', sourceType: KnowledgeSourceType.Manual, version: 1, publishedAt: now },
      { orgId: org.id, question: 'Адрес клиники', answer: 'г. Алматы, ул. Достык 89', sourceType: KnowledgeSourceType.Manual, version: 1, publishedAt: now },
      { orgId: org.id, question: 'Принимаете ли детей?', answer: 'Да, с 4 лет, отдельный детский кабинет', sourceType: KnowledgeSourceType.Manual, version: 1, publishedAt: now },
    ]);

    const patientRepo = manager.getRepository(PatientEntity);
    const [timur, aliya, erzhan, newLead] = await patientRepo.save([
      { orgId: org.id, phone: '+7 701 234 5678', name: 'Тимур А.', leadStatus: LeadStatus.Lead, sourceChannel: Channel.WhatsApp, lastNote: 'Новый пациент · первое обращение' },
      { orgId: org.id, phone: '+7 707 555 1122', name: 'Алия К.', leadStatus: LeadStatus.Booked, sourceChannel: Channel.WhatsApp, lastNote: 'Постоянный пациент · 3 визита' },
      { orgId: org.id, phone: '+7 701 998 4432', name: 'Ержан Т.', leadStatus: LeadStatus.Lead, sourceChannel: Channel.WhatsApp, lastNote: 'Новый пациент · интересуется имплантацией' },
      { orgId: org.id, phone: '+7 700 111 2233', name: null, leadStatus: LeadStatus.Lead, sourceChannel: Channel.WhatsApp, lastNote: 'Контакт не сохранён' },
    ]);
    const [regular, planned1, planned2] = await patientRepo.save([
      { orgId: org.id, phone: '+7 705 000 0001', name: 'Постоянный пациент', leadStatus: LeadStatus.Booked, sourceChannel: Channel.WhatsApp },
      { orgId: org.id, phone: '+7 705 000 0002', name: 'Плановый пациент', leadStatus: LeadStatus.Booked, sourceChannel: Channel.WhatsApp },
      { orgId: org.id, phone: '+7 705 000 0003', name: 'Плановый пациент', leadStatus: LeadStatus.Booked, sourceChannel: Channel.WhatsApp },
    ]);

    const convRepo = manager.getRepository(ConversationEntity);
    const msgRepo = manager.getRepository(MessageEntity);

    const timurConv = await convRepo.save({ orgId: org.id, patientId: timur.id, channel: Channel.WhatsApp, status: ConversationStatus.Attention });
    await msgRepo.save([
      { orgId: org.id, conversationId: timurConv.id, senderType: MessageSenderType.Patient, text: 'Добрый вечер! Очень болит зуб, что мне выпить?' },
      { orgId: org.id, conversationId: timurConv.id, senderType: MessageSenderType.Ai, text: 'Понимаю, зубная боль — это неприятно. Обезболивающее посоветовать не могу, это решает врач. Могу записать вас: завтра свободно в 09:00 и 13:00.', aiMeta: { model: 'mock', latencyMs: 420 } },
      { orgId: org.id, conversationId: timurConv.id, senderType: MessageSenderType.Patient, text: 'А может, можно решить вопрос без визита?' },
      { orgId: org.id, conversationId: timurConv.id, senderType: MessageSenderType.Ai, text: 'Передаю ваш вопрос администратору клиники — ответят в течение часа.', aiMeta: { model: 'mock', latencyMs: 380, escalationReason: 'Медицинский вопрос вне компетенции AI' } },
    ]);

    const aliyaConv = await convRepo.save({ orgId: org.id, patientId: aliya.id, channel: Channel.WhatsApp, status: ConversationStatus.Ai });
    await msgRepo.save([
      { orgId: org.id, conversationId: aliyaConv.id, senderType: MessageSenderType.Patient, text: 'Сколько стоит чистка и можно ли завтра вечером?' },
      { orgId: org.id, conversationId: aliyaConv.id, senderType: MessageSenderType.Ai, text: 'Профессиональная чистка — 25 000 ₸. Завтра свободно 18:00 и 19:30. Записать вас?', aiMeta: { model: 'mock', latencyMs: 410 } },
      { orgId: org.id, conversationId: aliyaConv.id, senderType: MessageSenderType.Patient, text: 'Давайте на 18:00' },
      { orgId: org.id, conversationId: aliyaConv.id, senderType: MessageSenderType.Ai, text: 'Записала вас на завтра, 18:00, доктор Серикова.', aiMeta: { model: 'mock', latencyMs: 500 } },
    ]);

    const erzhanConv = await convRepo.save({ orgId: org.id, patientId: erzhan.id, channel: Channel.WhatsApp, status: ConversationStatus.Ai });
    await msgRepo.save([
      { orgId: org.id, conversationId: erzhanConv.id, senderType: MessageSenderType.Patient, text: 'Сколько стоит имплант зуба?' },
      { orgId: org.id, conversationId: erzhanConv.id, senderType: MessageSenderType.Ai, text: 'Имплантация под ключ — от 180 000 ₸, точная цена после осмотра. Хотите записаться на консультацию?', aiMeta: { model: 'mock', latencyMs: 390 } },
      { orgId: org.id, conversationId: erzhanConv.id, senderType: MessageSenderType.Patient, text: 'Подумаю, спасибо' },
    ]);

    const newConv = await convRepo.save({ orgId: org.id, patientId: newLead.id, channel: Channel.WhatsApp, status: ConversationStatus.Ai });
    await msgRepo.save([{ orgId: org.id, conversationId: newConv.id, senderType: MessageSenderType.Patient, text: 'Добрый вечер, вы сегодня работаете?' }]);

    await manager.getRepository(AppointmentEntity).save([
      { orgId: org.id, patientId: regular.id, practitionerId: serikova.id, serviceId: cleaning.id, slotStart: tomorrowAt(10, 0), status: AppointmentStatus.Booked, createdBy: CreatedBy.Human },
      { orgId: org.id, patientId: timur.id, practitionerId: serikova.id, serviceId: null, slotStart: tomorrowAt(11, 30), status: AppointmentStatus.Booked, createdBy: CreatedBy.Ai },
      { orgId: org.id, patientId: aliya.id, practitionerId: serikova.id, serviceId: cleaning.id, slotStart: tomorrowAt(18, 0), status: AppointmentStatus.Booked, createdBy: CreatedBy.Ai },
      { orgId: org.id, patientId: planned1.id, practitionerId: akhmetov.id, serviceId: implant.id, slotStart: tomorrowAt(9, 0), status: AppointmentStatus.Booked, createdBy: CreatedBy.Human },
      { orgId: org.id, patientId: planned2.id, practitionerId: akhmetov.id, serviceId: implant.id, slotStart: tomorrowAt(13, 0), status: AppointmentStatus.Booked, createdBy: CreatedBy.Human },
    ]);

    // eslint-disable-next-line no-console
    console.log('Seeded demo org:', org.id, '— log in with owner@aigul.demo (magic link).');
  });

  await AppDataSource.destroy();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
