import { Controller, Get, Query } from '@nestjs/common';
import { ReportsService } from './reports.service';

@Controller('reports')
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  @Get('weekly')
  getWeekly(@Query('offset') offset?: string) {
    return this.service.getWeekly(offset ? Number(offset) : 0);
  }
}
