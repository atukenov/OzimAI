import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { LlmCompletionRequest, LlmCompletionResult, LlmProvider, LlmTurn } from './llm-provider.interface';

/**
 * Primary LLM provider (ADR "primary+fallback"). No-ops loudly if
 * ANTHROPIC_API_KEY is unset so LlmRouterService can fall back to
 * MockProvider — this is the "LLM provider unavailable" edge case from
 * 02 Product, exercised automatically rather than only in production.
 */
@Injectable()
export class AnthropicProvider implements LlmProvider {
  readonly name = 'anthropic';
  private readonly logger = new Logger(AnthropicProvider.name);
  private readonly client: Anthropic | null;
  private readonly model: string;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY');
    this.model = this.config.get<string>('LLM_MODEL') || 'claude-haiku-4-5';
    this.client = apiKey ? new Anthropic({ apiKey }) : null;
  }

  get isConfigured(): boolean {
    return this.client !== null;
  }

  async complete(request: LlmCompletionRequest): Promise<LlmCompletionResult> {
    if (!this.client) {
      throw new Error('AnthropicProvider not configured: ANTHROPIC_API_KEY is unset');
    }

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 500,
      system: request.system,
      tools: request.tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.inputSchema as Anthropic.Tool.InputSchema,
      })),
      messages: request.turns.map(toAnthropicMessage),
    });

    let text: string | null = null;
    const toolCalls: LlmCompletionResult['toolCalls'] = [];
    for (const block of response.content) {
      if (block.type === 'text') {
        text = (text ?? '') + block.text;
      } else if (block.type === 'tool_use') {
        toolCalls.push({ id: block.id, name: block.name, input: block.input as Record<string, unknown> });
      }
    }

    return { text, toolCalls, model: this.model };
  }
}

function toAnthropicMessage(turn: LlmTurn): Anthropic.MessageParam {
  if (turn.role === 'user') {
    const content: Array<Anthropic.TextBlockParam | Anthropic.ToolUseBlockParam | Anthropic.ToolResultBlockParam> = [];
    if (turn.text) content.push({ type: 'text', text: turn.text });
    for (const result of turn.toolResults ?? []) {
      content.push({ type: 'tool_result', tool_use_id: result.toolCallId, content: result.content });
    }
    return { role: 'user', content };
  }

  const content: Array<Anthropic.TextBlockParam | Anthropic.ToolUseBlockParam | Anthropic.ToolResultBlockParam> = [];
  if (turn.text) content.push({ type: 'text', text: turn.text });
  for (const call of turn.toolCalls ?? []) {
    content.push({ type: 'tool_use', id: call.id, name: call.name, input: call.input });
  }
  return { role: 'assistant', content };
}
