import { Body, Controller, Post } from '@nestjs/common';
import { OrchestratorService } from './orchestrator.service';
import { TestChatDto } from './dto/test-chat.dto';

@Controller('ai')
export class AiController {
  constructor(private readonly orchestrator: OrchestratorService) {}

  @Post('test-chat')
  async testChat(@Body() dto: TestChatDto) {
    const result = await this.orchestrator.runTestChat(dto.history, dto.message);
    return {
      reply: result.reply,
      escalated: result.escalated,
      provider: result.provider,
      usedFallback: result.usedFallback,
      toolCalls: result.toolCalls,
    };
  }
}
