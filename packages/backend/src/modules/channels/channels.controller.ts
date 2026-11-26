import { Body, Controller, ForbiddenException, Get, Headers, HttpCode, Logger, Post, Query, RawBodyRequest, Req } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Channel } from '@ozimai/shared';
import { Public } from '../../common/auth/public.decorator';
import { SystemTaskRunner } from '../../common/tenant/system-task-runner.service';
import { OrganizationEntity } from '../../database/entities/organization.entity';
import { OrchestratorService } from '../ai/orchestrator.service';
import { WhatsAppCloudAdapter } from './adapters/whatsapp-cloud.adapter';

@Controller('webhooks/whatsapp')
export class ChannelsController {
  private readonly logger = new Logger(ChannelsController.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly config: ConfigService,
    private readonly whatsapp: WhatsAppCloudAdapter,
    private readonly runner: SystemTaskRunner,
    private readonly orchestrator: OrchestratorService,
  ) {}

  @Public()
  @Get()
  verify(@Query('hub.mode') mode: string, @Query('hub.verify_token') token: string, @Query('hub.challenge') challenge: string) {
    const expected = this.config.get<string>('WHATSAPP_VERIFY_TOKEN');
    if (mode === 'subscribe' && expected && token === expected) {
      return challenge;
    }
    return 'forbidden';
  }

  @Public()
  @Post()
  @HttpCode(200)
  async receive(
    @Body() payload: unknown,
    @Req() req: RawBodyRequest<{ rawBody?: Buffer }>,
    @Headers('x-hub-signature-256') signature?: string,
  ) {
    // WhatsApp stays off until WHATSAPP_APP_SECRET is set: without it nothing
    // can prove a payload came from Meta, so inbound events are dropped.
    const secret = this.config.get<string>('WHATSAPP_APP_SECRET');
    if (!secret) return { ok: true };
    if (!WhatsAppWebhookSignature.isValid(secret, req.rawBody, signature)) {
      this.logger.warn('Rejected WhatsApp webhook with a missing or invalid X-Hub-Signature-256');
      throw new ForbiddenException('Invalid signature');
    }

    const inbound = this.whatsapp.parseInbound(payload);
    if (!inbound) return { ok: true };

    const org = await this.dataSource
      .getRepository(OrganizationEntity)
      .findOneBy({ whatsappPhoneNumberId: inbound.orgWhatsappPhoneNumberId });
    if (!org) {
      this.logger.warn(`Inbound WhatsApp message for unknown phone_number_id ${inbound.orgWhatsappPhoneNumberId}`);
      return { ok: true };
    }

    await this.runner.runAsOrg(org.id, () =>
      this.orchestrator.handleInboundMessage({
        phone: inbound.fromPhone,
        text: inbound.text,
        channel: Channel.WhatsApp,
        nameGuess: inbound.nameGuess,
      }),
    );
    return { ok: true };
  }
}

export const WhatsAppWebhookSignature = {
  /** Meta signs the raw request body: `sha256=<hex HMAC-SHA256 with the app secret>`. */
  isValid(secret: string, rawBody: Buffer | undefined, header: string | undefined): boolean {
    if (!rawBody || !header?.startsWith('sha256=')) return false;
    const expected = Buffer.from(createHmac('sha256', secret).update(rawBody).digest('hex'), 'hex');
    const given = Buffer.from(header.slice('sha256='.length), 'hex');
    return given.length === expected.length && timingSafeEqual(given, expected);
  },
};
