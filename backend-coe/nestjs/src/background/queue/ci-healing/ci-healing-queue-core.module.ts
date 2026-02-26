import { Module } from '@nestjs/common';
import { CiHealingQueueConfig } from './ci-healing-queue-ui.module';
import { CiHealingQueueEvents } from './ci-healing-queue.events';
import { CiHealingQueue } from './ci-healing.queue';

@Module({
  imports: [CiHealingQueueConfig.getQueueConfig()],
  providers: [CiHealingQueueEvents, CiHealingQueue],
  exports: [CiHealingQueue],
})
export class CiHealingQueueCoreModule {}
