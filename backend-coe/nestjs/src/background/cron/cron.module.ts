import { CronProcessor } from '@cron/cron.processor';
import { CronService } from '@cron/cron.service';
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { DeadLetterQueueModule } from '@dead-letter-queue/dead-letter-queue.module';

@Module({
  imports: [ScheduleModule.forRoot(), DeadLetterQueueModule],
  providers: [CronProcessor, CronService],
})
export class CronModule {}
