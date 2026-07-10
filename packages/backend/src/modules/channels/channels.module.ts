import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { ChannelsController } from './channels.controller';
import { DevChannelController } from './dev-channel.controller';

@Module({
  imports: [AiModule],
  controllers: [ChannelsController, DevChannelController],
})
export class ChannelsModule {}
