import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { WeeklyReportSenderService } from './weekly-report-sender.service';

@Module({
  controllers: [ReportsController],
  providers: [ReportsService, WeeklyReportSenderService],
  exports: [ReportsService],
})
export class ReportsModule {}
