import { Module } from '@nestjs/common';
import { SchedulingController } from './scheduling.controller';
import { SchedulingService } from './scheduling.service';
import { HoldSweeperService } from './hold-sweeper.service';
import { RemindersService } from './reminders.service';

@Module({
  controllers: [SchedulingController],
  providers: [SchedulingService, HoldSweeperService, RemindersService],
  exports: [SchedulingService],
})
export class SchedulingModule {}
