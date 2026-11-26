import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Tiny fixed-window in-memory limiter for the public (unauthenticated) web
 * chat endpoints — every message costs an LLM call, so they must not be
 * free to hammer. Per-instance only; fine for a single Railway service.
 */
export class RateLimiter {
  private readonly hits = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  hit(key: string): void {
    const now = Date.now();
    const entry = this.hits.get(key);
    if (!entry || entry.resetAt <= now) {
      this.hits.set(key, { count: 1, resetAt: now + this.windowMs });
      if (this.hits.size > 10_000) this.sweep(now);
      return;
    }
    entry.count += 1;
    if (entry.count > this.limit) {
      throw new HttpException('Слишком много сообщений, попробуйте через минуту', HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  private sweep(now: number) {
    for (const [key, entry] of this.hits) if (entry.resetAt <= now) this.hits.delete(key);
  }
}
