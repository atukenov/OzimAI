import { Channel } from '@ozimai/shared';

export interface NormalizedInboundMessage {
  orgWhatsappPhoneNumberId?: string;
  fromPhone: string;
  text: string;
  nameGuess?: string;
}

export interface ChannelAdapter {
  readonly channel: Channel;
  /** Deliver the AI/admin reply to the patient on this channel. */
  sendMessage(toPhone: string, text: string, orgWhatsappPhoneNumberId?: string): Promise<void>;
  /** Parse a provider-specific webhook payload into our normalized shape (webhook-based channels only). */
  parseInbound?(payload: unknown): NormalizedInboundMessage | null;
}
