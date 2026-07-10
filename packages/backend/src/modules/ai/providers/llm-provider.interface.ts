export interface LlmToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>; // JSON schema
}

export interface LlmToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface LlmToolResult {
  toolCallId: string;
  content: string;
}

/** One turn in the conversation as seen by the LLM (patient/system turns are 'user', model turns are 'assistant'). */
export type LlmTurn =
  | { role: 'user'; text?: string; toolResults?: LlmToolResult[] }
  | { role: 'assistant'; text?: string; toolCalls?: LlmToolCall[] };

export interface LlmCompletionRequest {
  system: string;
  turns: LlmTurn[];
  tools: LlmToolDef[];
}

export interface LlmCompletionResult {
  text: string | null;
  toolCalls: LlmToolCall[];
  model: string;
}

export const LLM_PROVIDER = Symbol('LLM_PROVIDER');

export interface LlmProvider {
  readonly name: string;
  complete(request: LlmCompletionRequest): Promise<LlmCompletionResult>;
}
