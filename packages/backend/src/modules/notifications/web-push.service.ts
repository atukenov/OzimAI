import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as webpush from 'web-push';
import { WebPushSubscription } from '../../database/entities/patient.entity';

export type PushResult = 'sent' | 'not_configured' | 'gone' | 'failed';

/**
 * Standard Web Push (VAPID) — works in Chrome/Edge/Firefox/Android and in
 * iOS 16.4+ for pages added to the home screen. No Firebase project needed;
 * Chrome routes these through FCM under the hood anyway.
 * Generate keys once with `npx web-push generate-vapid-keys`.
 */
@Injectable()
export class WebPushService {
  private readonly logger = new Logger(WebPushService.name);
  private configured = false;

  constructor(private readonly config: ConfigService) {
    const publicKey = this.config.get<string>('VAPID_PUBLIC_KEY');
    const privateKey = this.config.get<string>('VAPID_PRIVATE_KEY');
    if (publicKey && privateKey) {
      webpush.setVapidDetails(this.config.get<string>('VAPID_SUBJECT') || 'mailto:support@ozimai.kz', publicKey, privateKey);
      this.configured = true;
    }
  }

  get publicKey(): string | null {
    return this.configured ? (this.config.get<string>('VAPID_PUBLIC_KEY') ?? null) : null;
  }

  async send(subscription: WebPushSubscription, payload: { title: string; body: string; url?: string }): Promise<PushResult> {
    if (!this.configured) return 'not_configured';
    try {
      await webpush.sendNotification(subscription, JSON.stringify(payload), { TTL: 6 * 60 * 60 });
      return 'sent';
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) return 'gone'; // browser unsubscribed — caller should forget it
      this.logger.error(`Web push failed: ${status ?? ''} ${(err as Error).message}`);
      return 'failed';
    }
  }
}
