import { Injectable, Logger } from '@nestjs/common';
import { LlmCompletionRequest, LlmCompletionResult } from './providers/llm-provider.interface';
import { AnthropicProvider } from './providers/anthropic.provider';
import { MockProvider } from './providers/mock.provider';

export interface RoutedCompletion extends LlmCompletionResult {
  provider: string;
  usedFallback: boolean;
}

/**
 * Primary + fallback provider abstraction (ADR "снижает риск ценовой/
 * доступностной зависимости"). Today the fallback is the deterministic
 * MockProvider rather than a second vendor — swapping in a second real
 * vendor later is a one-line change here, nothing downstream (Orchestrator,
 * guardrails, tool execution) needs to know.
 */
@Injectable()
export class LlmRouterService {
  private readonly logger = new Logger(LlmRouterService.name);

  constructor(
    private readonly primary: AnthropicProvider,
    private readonly fallback: MockProvider,
  ) {}

  async complete(request: LlmCompletionRequest): Promise<RoutedCompletion> {
    if (this.primary.isConfigured) {
      try {
        const result = await this.primary.complete(request);
        return { ...result, provider: this.primary.name, usedFallback: false };
      } catch (err) {
        this.logger.warn(`Primary LLM provider failed, falling back to mock: ${err}`);
      }
    }
    const result = await this.fallback.complete(request);
    return { ...result, provider: this.fallback.name, usedFallback: true };
  }
}
