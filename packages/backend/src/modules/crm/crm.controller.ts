import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { Channel } from '@ozimai/shared';
import { CrmService } from './crm.service';
import { UpdateLeadStatusDto, UpdateNoteDto, CreatePatientDto } from './dto/patient.dto';

@Controller('patients')
export class CrmController {
  constructor(private readonly service: CrmService) {}

  @Get()
  list() {
    return this.service.list();
  }

  /** Find-or-create by phone — used by the Calendar's manual/walk-in booking flow. */
  @Post()
  create(@Body() dto: CreatePatientDto) {
    return this.service.upsertByPhone(dto.phone, dto.name ?? null, Channel.WhatsApp);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.get(id);
  }

  @Patch(':id/lead-status')
  setStatus(@Param('id') id: string, @Body() dto: UpdateLeadStatusDto) {
    return this.service.setLeadStatus(id, dto.status);
  }

  @Patch(':id/note')
  setNote(@Param('id') id: string, @Body() dto: UpdateNoteDto) {
    return this.service.setNote(id, dto.note);
  }
}
