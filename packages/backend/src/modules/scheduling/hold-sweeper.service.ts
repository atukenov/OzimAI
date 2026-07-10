import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SystemTaskRunner } from '../../common/tenant/system-task-runner.service';
import { SchedulingService } from './scheduling.service';

/** Frees abandoned 5-minute holds so the slot becomes bookable again. */
@Injectable()
export class HoldSweeperService {
  private readonly logger = new Logger(HoldSweeperService.name);

  constructor(
    private readonly runner: SystemTaskRunner,
    private readonly scheduling: SchedulingService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async sweep() {
    await this.runner.forEachOrg(async (orgId) => {
      const freed = await this.scheduling.sweepExpiredHolds();
      if (freed > 0) this.logger.log(`Freed ${freed} expired hold(s) for org ${orgId}`);
    });
  }
}
