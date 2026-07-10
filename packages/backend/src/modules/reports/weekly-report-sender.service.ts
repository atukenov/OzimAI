import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SystemTaskRunner } from '../../common/tenant/system-task-runner.service';
import { ReportsService } from './reports.service';

/**
 * FR-07 (weekly WhatsApp report to the owner). Sending to the owner's own
 * WhatsApp number isn't wired up — app_user has no phone field yet (only
 * patient contacts do) — so this logs the generated report text instead of
 * delivering it. The report data itself (GET /reports/weekly) is real and
 * is what the panel's Reports screen renders.
 */
@Injectable()
export class WeeklyReportSenderService {
  private readonly logger = new Logger(WeeklyReportSenderService.name);

  constructor(
    private readonly runner: SystemTaskRunner,
    private readonly reports: ReportsService,
  ) {}

  @Cron('0 8 * * 1') // Monday 08:00
  async sendWeeklyReports() {
    await this.runner.forEachOrg(async (orgId) => {
      const report = await this.reports.getWeekly(-1);
      this.logger.log(
        `[weekly report] org=${orgId} ${report.weekLabel}: ₸${report.moneyFromAi} от AI, ${report.aiAppointments} записей, неявки ${(report.noShowRate * 100).toFixed(0)}%`,
      );
    });
  }
}
