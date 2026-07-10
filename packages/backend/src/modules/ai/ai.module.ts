import { Module } from '@nestjs/common';
import { CrmModule } from '../crm/crm.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { SchedulingModule } from '../scheduling/scheduling.module';
import { DialoguesModule } from '../dialogues/dialogues.module';
import { AiController } from './ai.controller';
import { OrchestratorService } from './orchestrator.service';
import { LlmRouterService } from './llm-router.service';
import { AnthropicProvider } from './providers/anthropic.provider';
import { MockProvider } from './providers/mock.provider';
import { ToolExecutorService } from './tool-executor.service';

@Module({
  imports: [CrmModule, KnowledgeModule, SchedulingModule, DialoguesModule],
  controllers: [AiController],
  providers: [OrchestratorService, LlmRouterService, AnthropicProvider, MockProvider, ToolExecutorService],
  exports: [OrchestratorService],
})
export class AiModule {}
