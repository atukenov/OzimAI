import { Injectable, Logger } from '@nestjs/common';
import { SmsProvider } from './sms-provider.interface';

/** Zero-config fallback: logs instead of sending, so local dev and demos cost nothing. */
@Injectable()
export class ConsoleSmsProvider implements SmsProvider {
  readonly name = 'console';
  readonly isConfigured = true;
  private readonly logger = new Logger('ConsoleSms');
  readonly outbox: { toPhone: string; text: string; at: Date }[] = [];

  async send(toPhone: string, text: string): Promise<boolean> {
    this.outbox.push({ toPhone, text, at: new Date() });
    this.logger.log(`SMS -> ${toPhone}: ${text}`);
    return true;
  }
}
