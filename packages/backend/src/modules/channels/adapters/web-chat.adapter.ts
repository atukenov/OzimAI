import { Injectable } from '@nestjs/common';
import { Channel } from '@ozimai/shared';
import { ChannelAdapter } from './channel-adapter.interface';

/**
 * Web chat (embeddable widget + hosted `/c/<slug>` page).
 *
 * Delivery is pull-based: every AI and admin reply is already persisted by
 * DialoguesService.appendMessage, and the widget fetches new messages for
 * its own session from `/api/public/chat/...`. So "sending" is a no-op here.
 * This keeps the channel stateless across Railway restarts/replicas and
 * means admin takeover replies reach the visitor with no extra wiring.
 */
@Injectable()
export class WebChatAdapter implements ChannelAdapter {
  readonly channel = Channel.Web;

  async sendMessage(): Promise<void> {
    // intentionally empty — see class comment
  }
}
