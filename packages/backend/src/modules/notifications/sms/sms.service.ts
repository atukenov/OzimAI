import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { SmsProvider } from './sms-provider.interface';
import { ConsoleSmsProvider } from './console-sms.provider';
import { MobizonSmsProvider } from './mobizon-sms.provider';
import { smsPeriod, smsSegments } from './sms-quota';

export type OrgSmsResult = 'sent' | 'failed' | 'quota_exceeded';

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
    @InjectDataSource() private readonly dataSource: DataSource,
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

  get timeZone(): string {
    return this.config.get<string>('CLINIC_TIMEZONE') || 'Asia/Almaty';
  }

  async send(toPhone: string, text: string): Promise<boolean> {
    const digits = toPhone.replace(/\D/g, '');
    if (digits.length < 10) return false; // e.g. the "test-chat" pseudo-patient
    return this.provider.send(digits, text);
  }

  /**
   * Sends on behalf of a clinic, within its monthly allowance (default 500
   * segments). The counter is reserved atomically before sending and given
   * back if the gateway fails. The console provider costs nothing and is
   * not counted.
   */
  async sendForOrg(orgId: string, toPhone: string, text: string): Promise<OrgSmsResult> {
    if (toPhone.replace(/\D/g, '').length < 10) return 'failed';
    if (this.provider.name === 'console') return (await this.send(toPhone, text)) ? 'sent' : 'failed';

    const segments = smsSegments(text);
    const period = smsPeriod(new Date(), this.timeZone);
    const result: unknown = await this.dataSource.query(
      `UPDATE organization
          SET sms_used = (CASE WHEN sms_period = $2 THEN sms_used ELSE 0 END) + $3,
              sms_period = $2
        WHERE id = $1
          AND (CASE WHEN sms_period = $2 THEN sms_used ELSE 0 END) + $3 <= sms_monthly_limit
      RETURNING sms_used`,
      [orgId, period, segments],
    );
    // TypeORM's postgres driver returns [rows, rowCount] for UPDATE ... RETURNING.
    const rows = Array.isArray(result) && Array.isArray(result[0]) ? result[0] : result;
    if (!Array.isArray(rows) || rows.length === 0) {
      this.logger.warn(`SMS quota exhausted for org ${orgId} (${period}); skipped SMS to ${toPhone}`);
      return 'quota_exceeded';
    }

    if (await this.send(toPhone, text)) return 'sent';
    await this.dataSource.query(`UPDATE organization SET sms_used = GREATEST(sms_used - $3, 0) WHERE id = $1 AND sms_period = $2`, [
      orgId,
      period,
      segments,
    ]);
    return 'failed';
  }
}
