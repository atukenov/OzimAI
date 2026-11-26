import { BadRequestException, Body, Controller, Delete, Get, Headers, HttpCode, Ip, Param, Post, Query } from '@nestjs/common';
import { Public } from '../../common/auth/public.decorator';
import { PushSubscriptionDto, SendWebChatMessageDto, StartWebChatDto } from './dto/webchat.dto';
import { RateLimiter } from './rate-limiter';
import { WebChatService } from './webchat.service';

/**
 * Public API for the embeddable widget and the hosted `/c/<slug>` page.
 * No panel JWT: visitors get their own web chat token (see WebChatTokenService).
 */
@Public()
@Controller('public/chat/:slug')
export class WebChatController {
  private readonly startLimiter = new RateLimiter(10, 60 * 60_000); // 10 new sessions / IP / hour
  private readonly sendLimiter = new RateLimiter(15, 60_000); // 15 messages / IP / minute
  private readonly orgLimiter = new RateLimiter(300, 60_000); // 300 messages / clinic / minute (LLM cost cap)

  constructor(private readonly service: WebChatService) {}

  @Get()
  info(@Param('slug') slug: string) {
    return this.service.info(slug);
  }

  @Post('session')
  start(@Param('slug') slug: string, @Body() dto: StartWebChatDto, @Ip() ip: string) {
    this.startLimiter.hit(ip);
    return this.service.start(slug, dto.name, dto.phone);
  }

  @Get('messages')
  messages(@Param('slug') slug: string, @Headers('authorization') auth: string | undefined, @Query('after') after?: string) {
    return this.service.messages(slug, auth, after);
  }

  @Post('messages')
  @HttpCode(200)
  send(@Param('slug') slug: string, @Headers('authorization') auth: string | undefined, @Body() dto: SendWebChatMessageDto, @Ip() ip: string) {
    const text = dto.text.trim();
    if (!text) throw new BadRequestException('Пустое сообщение');
    this.sendLimiter.hit(ip);
    this.orgLimiter.hit(slug);
    return this.service.send(slug, auth, text);
  }

  @Post('push-subscription')
  @HttpCode(200)
  subscribe(@Param('slug') slug: string, @Headers('authorization') auth: string | undefined, @Body() dto: PushSubscriptionDto) {
    return this.service.savePushSubscription(slug, auth, { endpoint: dto.endpoint, keys: dto.keys });
  }

  @Delete('push-subscription')
  unsubscribe(@Param('slug') slug: string, @Headers('authorization') auth: string | undefined) {
    return this.service.savePushSubscription(slug, auth, null);
  }
}
