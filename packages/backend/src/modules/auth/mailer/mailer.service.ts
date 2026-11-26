import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Mailer } from './mailer.interface';

/**
 * Sends the 4-digit login code. With RESEND_API_KEY set it goes out through
 * Resend's HTTP API (no SDK needed); without it the code is only logged,
 * which is fine for local dev and refused in production.
 */
@Injectable()
export class MailerService implements Mailer {
  private readonly logger = new Logger('Mailer');

  constructor(private readonly config: ConfigService) {}

  get isLive(): boolean {
    return Boolean(this.config.get<string>('RESEND_API_KEY'));
  }

  async sendLoginCode(email: string, code: string): Promise<void> {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    if (!apiKey) {
      this.logger.log(`Login code for ${email}: ${code}`);
      return;
    }
    const from = this.config.get<string>('MAIL_FROM') || 'OzimAI <noreply@ozimai.kz>';
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [email],
        subject: `Код входа в OzimAI: ${code}`,
        text: `Ваш код входа в OzimAI: ${code}\n\nКод действует 10 минут. Если вы не запрашивали вход, просто проигнорируйте это письмо.`,
        html:
          `<div style="font-family:system-ui,sans-serif;font-size:16px;color:#111">` +
          `<p>Ваш код входа в OzimAI:</p>` +
          `<p style="font-size:32px;font-weight:700;letter-spacing:8px;margin:16px 0">${code}</p>` +
          `<p style="color:#666;font-size:14px">Код действует 10 минут. Если вы не запрашивали вход, просто проигнорируйте это письмо.</p></div>`,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      this.logger.error(`Resend send failed: HTTP ${res.status} ${body.slice(0, 300)}`);
      throw new ServiceUnavailableException('Не удалось отправить письмо, попробуйте ещё раз');
    }
  }
}
