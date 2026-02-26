import { CronModule } from '@cron/cron.module';
import { EmailQueueModule } from '@email-queue/email-queue.module';
import { NotificationQueueModule } from '@notification-queue/notification-queue.module';
import { DeadLetterQueueModule } from '@dead-letter-queue/dead-letter-queue.module';
import { WebhookQueueModule } from './queue/webhook/webhook-queue.module';
import { CiHealingQueueModule } from './queue/ci-healing/ci-healing-queue.module';
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QUEUE_LIST } from '@bg/constants/job.constant';

@Module({
  imports: [
    BullModule.registerQueue(...QUEUE_LIST.map(name => ({ name }))),
    EmailQueueModule,
    NotificationQueueModule,
    WebhookQueueModule,
    CiHealingQueueModule,
    DeadLetterQueueModule,
    CronModule,
  ],
})
export class BackgroundModule {}
