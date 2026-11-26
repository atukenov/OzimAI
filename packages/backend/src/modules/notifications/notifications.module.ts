import { Global, Module } from '@nestjs/common';
import { ConsoleSmsProvider } from './sms/console-sms.provider';
import { MobizonSmsProvider } from './sms/mobizon-sms.provider';
import { SmsService } from './sms/sms.service';
import { WebPushService } from './web-push.service';

/** Out-of-conversation notifications (reminders) for channels that can't carry them, e.g. web chat. */
@Global()
@Module({
  providers: [ConsoleSmsProvider, MobizonSmsProvider, SmsService, WebPushService],
  exports: [SmsService, WebPushService, ConsoleSmsProvider],
})
export class NotificationsModule {}
