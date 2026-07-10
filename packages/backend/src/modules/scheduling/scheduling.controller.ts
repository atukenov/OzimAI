import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CreatedBy } from '@ozimai/shared';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtPayload } from '../../common/auth/jwt-payload.interface';
import { SchedulingService } from './scheduling.service';
import { FreeSlotsQueryDto, HoldSlotDto } from './dto/scheduling.dto';

@Controller('appointments')
export class SchedulingController {
  constructor(private readonly service: SchedulingService) {}

  @Get('free-slots')
  freeSlots(@Query() query: FreeSlotsQueryDto) {
    return this.service.getFreeSlots({
      practitionerId: query.practitionerId,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
    });
  }

  @Get()
  list(@Query() query: FreeSlotsQueryDto) {
    return this.service.listAppointments({
      practitionerId: query.practitionerId,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
    });
  }

  @Post('hold')
  hold(@Body() dto: HoldSlotDto) {
    return this.service.holdSlot({
      practitionerId: dto.practitionerId,
      patientId: dto.patientId,
      slotStart: new Date(dto.slotStart),
      serviceId: dto.serviceId,
      ttlSec: dto.ttlSec,
    });
  }

  @Post(':id/confirm')
  confirm(@Param('id') id: string) {
    return this.service.confirmHold(id);
  }

  @Post(':id/cancel')
  cancel(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.cancelAppointment(id, user.sub);
  }

  @Post(':id/no-show')
  noShow(@Param('id') id: string) {
    return this.service.markNoShow(id);
  }

  @Post('book-direct')
  bookDirect(@Body() dto: HoldSlotDto) {
    return this.service.bookDirect({
      patientId: dto.patientId,
      practitionerId: dto.practitionerId,
      slotStart: new Date(dto.slotStart),
      serviceId: dto.serviceId,
      createdBy: CreatedBy.Human,
    });
  }
}
