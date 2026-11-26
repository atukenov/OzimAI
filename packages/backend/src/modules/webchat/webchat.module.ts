import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { CrmModule } from '../crm/crm.module';
import { WebChatController } from './webchat.controller';
import { WebChatService } from './webchat.service';
import { WebChatTokenService } from './webchat-token.service';

@Module({
  imports: [AiModule, CrmModule],
  controllers: [WebChatController],
  providers: [WebChatService, WebChatTokenService],
})
export class WebChatModule {}
