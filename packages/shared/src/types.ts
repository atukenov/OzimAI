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
} from './enums';

export interface OrganizationDto {
  id: string;
  name: string;
  plan: 'start' | 'growth' | 'business';
  locale: 'ru' | 'kk';
  billingStatus: BillingStatus;
  trialEndsAt: string | null;
  createdAt: string;
}

export interface AppUserDto {
  id: string;
  orgId: string;
  email: string;
  role: UserRole;
  displayName: string;
}

export interface BranchDto {
  id: string;
  orgId: string;
  name: string;
  address: string;
}

export interface WorkingHours {
  // 0=Sunday .. 6=Saturday, ["09:00","20:00"] or null if closed
  [dayOfWeek: number]: [string, string] | null;
}

export interface PractitionerDto {
  id: string;
  orgId: string;
  branchId: string;
  name: string;
  workingHours: WorkingHours;
}

export interface ServiceDto {
  id: string;
  orgId: string;
  name: string;
  price: number;
  durationMin: number;
  version: number;
}

export interface PatientDto {
  id: string;
  orgId: string;
  phone: string;
  name: string | null;
  leadStatus: LeadStatus;
  sourceChannel: Channel;
  lastNote: string | null;
  createdAt: string;
}

export interface AiMeta {
  model: string;
  latencyMs: number;
  escalationReason?: string;
  toolCalls?: { name: string; input: unknown; output: unknown }[];
}

export interface MessageDto {
  id: string;
  conversationId: string;
  senderType: MessageSenderType;
  text: string;
  createdAt: string;
  aiMeta?: AiMeta;
}

export interface ConversationDto {
  id: string;
  orgId: string;
  patientId: string;
  patientName: string;
  patientPhone: string;
  channel: Channel;
  status: ConversationStatus;
  lastMessagePreview: string;
  updatedAt: string;
}

export interface AppointmentDto {
  id: string;
  orgId: string;
  patientId: string;
  patientName: string;
  practitionerId: string;
  practitionerName: string;
  serviceId: string | null;
  slotStart: string;
  status: AppointmentStatus;
  createdBy: CreatedBy;
}

export interface FreeSlot {
  practitionerId: string;
  practitionerName: string;
  slotStart: string;
}

export interface KnowledgeDocDto {
  id: string;
  orgId: string;
  question: string;
  answer: string;
  sourceType: KnowledgeSourceType;
  version: number;
  publishedAt: string | null;
}

export interface WeeklyReportDto {
  weekLabel: string;
  weekStart: string;
  moneyFromAi: number;
  aiAppointments: number;
  noShowRate: number;
  noShowDelta: number;
  lostLeads: { patientName: string; reason: string }[];
}

export interface AuditLogDto {
  id: string;
  orgId: string;
  actor: string;
  action: string;
  entity: string;
  before: unknown;
  after: unknown;
  createdAt: string;
}
