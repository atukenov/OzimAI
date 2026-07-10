import { Injectable } from '@nestjs/common';
import { Channel } from '@ozimai/shared';
import { ChannelAdapter } from './channel-adapter.interface';
import { DevMockChannelAdapter } from './dev-mock-channel.adapter';
import { WhatsAppCloudAdapter } from './whatsapp-cloud.adapter';

@Injectable()
export class ChannelAdapterRegistry {
  private readonly adapters: Map<Channel, ChannelAdapter>;

  constructor(devMock: DevMockChannelAdapter, whatsapp: WhatsAppCloudAdapter) {
    this.adapters = new Map<Channel, ChannelAdapter>([
      [Channel.DevMock, devMock],
      [Channel.WhatsApp, whatsapp],
    ]);
  }

  get(channel: Channel): ChannelAdapter {
    const adapter = this.adapters.get(channel);
    if (!adapter) throw new Error(`No channel adapter registered for ${channel}`);
    return adapter;
  }

  async send(channel: Channel, toPhone: string, text: string, orgWhatsappPhoneNumberId?: string): Promise<void> {
    await this.get(channel).sendMessage(toPhone, text, orgWhatsappPhoneNumberId);
  }
}
