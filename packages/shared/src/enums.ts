export enum UserRole {
  Owner = 'owner',
  Admin = 'admin',
  Staff = 'staff',
}

export enum BillingStatus {
  Trial = 'trial',
  Active = 'active',
  PastDue = 'past_due',
  ReadOnly = 'read_only',
}

export enum ConversationStatus {
  Ai = 'ai',
  Attention = 'attention',
  Human = 'human',
}

export enum MessageSenderType {
  Patient = 'patient',
  Ai = 'ai',
  Admin = 'admin',
  System = 'system',
}

export enum AppointmentStatus {
  Held = 'held',
  Booked = 'booked',
  Confirmed = 'confirmed',
  NoShow = 'no_show',
  Cancelled = 'cancelled',
}

export enum CreatedBy {
  Ai = 'ai',
  Human = 'human',
}

export enum LeadStatus {
  Lead = 'lead',
  Booked = 'booked',
  Visited = 'visited',
  Lost = 'lost',
}

export enum Channel {
  WhatsApp = 'whatsapp',
  Instagram = 'instagram',
  DevMock = 'dev_mock',
}

export enum KnowledgeSourceType {
  Text = 'text',
  Csv = 'csv',
  Manual = 'manual',
}
