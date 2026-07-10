import { Global, Module } from '@nestjs/common';
import { DevMockChannelAdapter } from './adapters/dev-mock-channel.adapter';
import { WhatsAppCloudAdapter } from './adapters/whatsapp-cloud.adapter';
import { ChannelAdapterRegistry } from './adapters/channel-adapter-registry.service';

/**
 * Standalone and global on purpose: both AiModule (to deliver replies) and
 * DialoguesModule (to deliver admin manual replies) need outbound sending,
 * and this module must not depend on either of them to avoid a module
 * import cycle (Channels webhook -> Ai -> Dialogues -> Channels).
 */
@Global()
@Module({
  providers: [DevMockChannelAdapter, WhatsAppCloudAdapter, ChannelAdapterRegistry],
  exports: [DevMockChannelAdapter, WhatsAppCloudAdapter, ChannelAdapterRegistry],
})
export class ChannelAdapterModule {}
