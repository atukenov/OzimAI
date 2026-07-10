import { Body, Controller, Post } from '@nestjs/common';
import { Channel } from '@ozimai/shared';
import { OrchestratorService } from '../ai/orchestrator.service';
import { SimulateInboundDto } from './dto/simulate-inbound.dto';

/**
 * QA harness: drives the exact same OrchestratorService.handleInboundMessage
 * path a real WhatsApp webhook would, without needing a WhatsApp account —
 * used by the Dialogues screen's "simulate inbound message" dev affordance.
 */
@Controller('dev/simulate-inbound')
export class DevChannelController {
  constructor(private readonly orchestrator: OrchestratorService) {}

  @Post()
  simulate(@Body() dto: SimulateInboundDto) {
    return this.orchestrator.handleInboundMessage({
      phone: dto.phone,
      text: dto.text,
      channel: Channel.DevMock,
      nameGuess: dto.nameGuess,
    });
  }
}
