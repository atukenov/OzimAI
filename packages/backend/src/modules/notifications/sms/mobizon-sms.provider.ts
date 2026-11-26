import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SmsProvider } from './sms-provider.interface';

/**
 * Mobizon (mobizon.kz) — local Kazakhstan SMS gateway.
 * API: POST https://<domain>/service/message/sendsmsmessage?output=json&api=v1&apiKey=...
 * with form fields `recipient`, `text` and optional `from` (registered alpha name).
 * Response `{ code: 0, data: { messageId, ... } }` on success.
 */
@Injectable()
export class MobizonSmsProvider implements SmsProvider {
  readonly name = 'mobizon';
  private readonly logger = new Logger('MobizonSms');

  constructor(private readonly config: ConfigService) {}

  get isConfigured(): boolean {
    return Boolean(this.config.get<string>('MOBIZON_API_KEY'));
  }

  async send(toPhone: string, text: string): Promise<boolean> {
    const apiKey = this.config.get<string>('MOBIZON_API_KEY');
    if (!apiKey) {
      this.logger.warn(`Mobizon not configured — would have sent to ${toPhone}: ${text}`);
      return false;
    }
    const domain = this.config.get<string>('MOBIZON_API_DOMAIN') || 'api.mobizon.kz';
    const url = `https://${domain}/service/message/sendsmsmessage?output=json&api=v1&apiKey=${encodeURIComponent(apiKey)}`;
    const body = new URLSearchParams({ recipient: toPhone, text });
    const sender = this.config.get<string>('SMS_SENDER');
    if (sender) body.set('from', sender);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'cache-control': 'no-cache' },
        body,
      });
      const json = (await res.json().catch(() => null)) as { code?: number; message?: string } | null;
      if (!res.ok || !json || json.code !== 0) {
        this.logger.error(`Mobizon send failed: HTTP ${res.status} code=${json?.code} ${json?.message ?? ''}`);
        return false;
      }
      return true;
    } catch (err) {
      this.logger.error(`Mobizon send error: ${(err as Error).message}`);
      return false;
    }
  }
}
