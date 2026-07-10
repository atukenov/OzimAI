// Function-calling tool contracts shared between the backend Orchestrator
// (which implements them for real) and any client that wants to reason about
// the same shapes (e.g. displaying tool calls in the test-chat UI).

export interface CheckAvailabilityInput {
  doctor?: string;
}

export interface CheckAvailabilityResult {
  slots: { practitionerId: string; practitionerName: string; slotStart: string }[];
}

export interface BookAppointmentInput {
  doctor: string;
  time: string; // ISO datetime
  patientName: string;
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

export const AI_TOOL_NAMES = ['check_availability', 'book_appointment', 'escalate'] as const;
export type AiToolName = (typeof AI_TOOL_NAMES)[number];
