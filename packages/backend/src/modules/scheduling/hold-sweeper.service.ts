import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SystemTaskRunner } from '../../common/tenant/system-task-runner.service';
import { SchedulingService } from './scheduling.service';
import { TEST_CHAT_PHONE } from './test-chat';

/** Frees abandoned 5-minute holds and old AI test-chat bookings so the slots become bookable again. */
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
      const test = await this.scheduling.sweepTestChatBookings(TEST_CHAT_PHONE);
      if (test > 0) this.logger.log(`Cancelled ${test} AI test-chat booking(s) for org ${orgId}`);
    });
  }
}
