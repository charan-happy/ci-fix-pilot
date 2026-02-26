import { Injectable, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QueueName } from '@bg/constants/job.constant';
import { BullBoardModule } from '@bull-board/nestjs';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { CiHealingQueueEvents } from './ci-healing-queue.events';
import { CiHealingQueue } from './ci-healing.queue';

@Injectable()
export class CiHealingQueueConfig {
  static getQueueConfig() {
    return BullModule.registerQueue({
      name: QueueName.CI_HEALING,
      streams: {
        events: {
          maxLen: 1000,
        },
      },
      defaultJobOptions: {
        removeOnFail: false,
        removeOnComplete: {
          age: 24 * 3600,
        },
      },
    });
  }

  static getQueueUIConfig() {
    return BullBoardModule.forFeature({
      name: QueueName.CI_HEALING,
      adapter: BullMQAdapter,
      options: {
        readOnlyMode: process.env['NODE_ENV'] === 'production' || false,
        displayName: 'CI Healing Queue',
        description: 'Queue for self-healing CI runs',
      },
    });
  }
}

@Module({
  imports: [CiHealingQueueConfig.getQueueConfig(), CiHealingQueueConfig.getQueueUIConfig()],
  providers: [CiHealingQueueEvents, CiHealingQueue],
  exports: [CiHealingQueue],
})
export class CiHealingQueueUIModule {}
