import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { KnowledgeService } from './knowledge.service';
import { ImportKnowledgeDto, PublishKnowledgeDto, UpsertKnowledgeDto } from './dto/knowledge.dto';

@Controller('knowledge')
export class KnowledgeController {
  constructor(private readonly service: KnowledgeService) {}

  @Get()
  list() {
    return this.service.list();
  }

  @Post('import')
  importDraft(@Body() dto: ImportKnowledgeDto) {
    return this.service.importDraft(dto.raw, dto.sourceType);
  }

  @Post('publish')
  publish(@Body() dto: PublishKnowledgeDto) {
    return this.service.publish(dto.ids);
  }

  @Post()
  create(@Body() dto: UpsertKnowledgeDto) {
    return this.service.createManual(dto.question, dto.answer);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpsertKnowledgeDto) {
    return this.service.update(id, dto.question, dto.answer);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
