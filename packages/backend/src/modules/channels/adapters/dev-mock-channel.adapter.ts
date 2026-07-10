import { Injectable, Logger } from '@nestjs/common';
import { Channel } from '@ozimai/shared';
import { ChannelAdapter } from './channel-adapter.interface';

/**
 * Default channel with no external dependency: logs outbound sends instead
 * of calling a real WhatsApp account. Used by the seeded demo org and by
 * `POST /dev/simulate-inbound`, which drives the exact same Orchestrator
 * path a real WhatsApp webhook would — the whole product is demoable with
 * zero external accounts.
 */
@Injectable()
export class DevMockChannelAdapter implements ChannelAdapter {
  readonly channel = Channel.DevMock;
  private readonly logger = new Logger('DevMockChannel');
  readonly outbox: { toPhone: string; text: string; at: Date }[] = [];

  async sendMessage(toPhone: string, text: string): Promise<void> {
    this.outbox.push({ toPhone, text, at: new Date() });
    this.logger.log(`-> ${toPhone}: ${text}`);
  }
}
