import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Channel } from '@ozimai/shared';
import { ChannelAdapter, NormalizedInboundMessage } from './channel-adapter.interface';

/**
 * Meta WhatsApp Cloud API (the "official BSP" channel from 06 Engineering).
 * Activates the moment WHATSAPP_ACCESS_TOKEN/WHATSAPP_PHONE_NUMBER_ID are
 * set — not exercised against a real WABA in this pass (no account
 * available), but the webhook/send shapes match Meta's documented API so
 * wiring in real credentials later needs no code changes here.
 */
@Injectable()
export class WhatsAppCloudAdapter implements ChannelAdapter {
  readonly channel = Channel.WhatsApp;
  private readonly logger = new Logger('WhatsAppCloudAdapter');

  constructor(private readonly config: ConfigService) {}

  get isConfigured(): boolean {
    return Boolean(this.config.get<string>('WHATSAPP_ACCESS_TOKEN') && this.config.get<string>('WHATSAPP_PHONE_NUMBER_ID'));
  }

  async sendMessage(toPhone: string, text: string, orgWhatsappPhoneNumberId?: string): Promise<void> {
    const token = this.config.get<string>('WHATSAPP_ACCESS_TOKEN');
    const phoneNumberId = orgWhatsappPhoneNumberId || this.config.get<string>('WHATSAPP_PHONE_NUMBER_ID');
    if (!token || !phoneNumberId) {
      this.logger.warn(`WhatsApp not configured — would have sent to ${toPhone}: ${text}`);
      return;
    }

    const res = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to: toPhone, type: 'text', text: { body: text } }),
    });
    if (!res.ok) {
      this.logger.error(`WhatsApp send failed: ${res.status} ${await res.text()}`);
    }
  }

  /** Meta's webhook payload shape: entry[].changes[].value.messages[]. */
  parseInbound(payload: unknown): NormalizedInboundMessage | null {
    try {
      const body = payload as any;
      const value = body?.entry?.[0]?.changes?.[0]?.value;
      const message = value?.messages?.[0];
      if (!message) return null;
      return {
        orgWhatsappPhoneNumberId: value?.metadata?.phone_number_id,
        fromPhone: message.from,
        text: message.text?.body ?? '',
        nameGuess: value?.contacts?.[0]?.profile?.name,
      };
    } catch {
      return null;
    }
  }
}
