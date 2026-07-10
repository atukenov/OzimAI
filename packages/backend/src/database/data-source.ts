import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { join } from 'node:path';
import { OrganizationEntity } from './entities/organization.entity';
import { AppUserEntity } from './entities/app-user.entity';
import { BranchEntity } from './entities/branch.entity';
import { PractitionerEntity } from './entities/practitioner.entity';
import { ServiceEntity } from './entities/service.entity';
import { PatientEntity } from './entities/patient.entity';
import { ConversationEntity } from './entities/conversation.entity';
import { MessageEntity } from './entities/message.entity';
import { AppointmentEntity } from './entities/appointment.entity';
import { KnowledgeDocEntity } from './entities/knowledge-doc.entity';
import { AuditLogEntity } from '../modules/audit/audit-log.entity';
import { SnakeNamingStrategy } from './snake-naming.strategy';

config({ path: join(__dirname, '../../../../.env') });

export const entities = [
  OrganizationEntity,
  AppUserEntity,
  BranchEntity,
  PractitionerEntity,
  ServiceEntity,
  PatientEntity,
  ConversationEntity,
  MessageEntity,
  AppointmentEntity,
  KnowledgeDocEntity,
  AuditLogEntity,
];

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL || 'postgres://ozimai:ozimai_dev@localhost:5432/ozimai',
  entities,
  migrations: [join(__dirname, 'migrations/*.{ts,js}')],
  namingStrategy: new SnakeNamingStrategy(),
  synchronize: false,
  logging: false,
});
