import { Injectable, Logger } from '@nestjs/common';
import { Mailer } from './mailer.interface';

/**
 * Dev-mode mail transport: logs the magic link instead of sending real
 * email. Swap for an SMTP/API-based Mailer implementation (env-gated) when a
 * provider is chosen — AuthService only depends on the Mailer interface.
 */
@Injectable()
export class ConsoleMailerService implements Mailer {
  private readonly logger = new Logger('Mailer');

  async sendMagicLink(email: string, link: string): Promise<void> {
    this.logger.log(`Magic link for ${email}: ${link}`);
  }
}
