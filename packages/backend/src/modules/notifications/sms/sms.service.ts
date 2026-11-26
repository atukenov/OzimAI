import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SmsProvider } from './sms-provider.interface';
import { ConsoleSmsProvider } from './console-sms.provider';
import { MobizonSmsProvider } from './mobizon-sms.provider';

/**
 * Picks the SMS gateway from `SMS_PROVIDER` (mobizon | console). Adding
 * another gateway (SMSC.kz, Twilio, ...) = one more SmsProvider class and
 * one more entry in `providers` below.
 */
@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly providers: Record<string, SmsProvider>;

  constructor(
    private readonly config: ConfigService,
    console: ConsoleSmsProvider,
    mobizon: MobizonSmsProvider,
  ) {
    this.providers = { console, mobizon };
  }

  get provider(): SmsProvider {
    const name = (this.config.get<string>('SMS_PROVIDER') || 'console').toLowerCase();
    const provider = this.providers[name];
    if (!provider) {
      this.logger.warn(`Unknown SMS_PROVIDER "${name}", falling back to console`);
      return this.providers.console;
    }
    return provider;
  }

  async send(toPhone: string, text: string): Promise<boolean> {
    const digits = toPhone.replace(/\D/g, '');
    if (digits.length < 10) return false; // e.g. the "test-chat" pseudo-patient
    return this.provider.send(digits, text);
  }
}
