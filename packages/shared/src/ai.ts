// Function-calling tool contracts shared between the backend Orchestrator
// (which implements them for real) and any client that wants to reason about
// the same shapes (e.g. displaying tool calls in the test-chat UI).

export interface CheckAvailabilityInput {
  doctor?: string;
  specialty?: string;
  service?: string;
  /** Clinic-local date 'YYYY-MM-DD'. */
  date?: string;
  /** Clinic-local 'HH:MM' window for the start time. */
  timeFrom?: string;
  timeTo?: string;
}

export interface CheckAvailabilityResult {
  slots: { practitionerId: string; practitionerName: string; slotStart: string }[];
}

export interface BookAppointmentInput {
  doctor: string;
  time: string; // ISO datetime
  patientName: string;
  service?: string;
}

export interface AppointmentRefInput {
  appointmentId: string;
}

export interface RescheduleAppointmentInput {
  appointmentId: string;
  time: string; // ISO datetime from check_availability
  doctor?: string;
}

export interface BookAppointmentResult {
  ok: boolean;
  appointmentId?: string;
  message: string;
  alternatives?: { practitionerName: string; slotStart: string }[];
}

export interface EscalateInput {
  reason: string;
}

export interface EscalateResult {
  ok: true;
  message: string;
}

export const AI_TOOL_NAMES = [
  'check_availability',
  'book_appointment',
  'list_my_appointments',
  'confirm_appointment',
  'reschedule_appointment',
  'cancel_appointment',
  'escalate',
] as const;
export type AiToolName = (typeof AI_TOOL_NAMES)[number];
