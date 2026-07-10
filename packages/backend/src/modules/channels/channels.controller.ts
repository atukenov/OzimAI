import { Body, Controller, Get, HttpCode, Logger, Post, Query } from '@nestjs/common';
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
  async receive(@Body() payload: unknown) {
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
