import { QueueName } from '@bg/constants/job.constant';
import { Injectable, Logger } from '@nestjs/common';
import { OnQueueEvent, QueueEventsHost, QueueEventsListener } from '@nestjs/bullmq';

@Injectable()
@QueueEventsListener(QueueName.CI_HEALING)
export class CiHealingQueueEvents extends QueueEventsHost {
  private readonly logger = new Logger(CiHealingQueueEvents.name);

  @OnQueueEvent('completed')
  onCompleted(job: { jobId: string }) {
    this.logger.debug(`CI healing job completed: ${job.jobId}`);
  }

  @OnQueueEvent('failed')
  onFailed(job: { jobId: string; failedReason?: string }) {
    this.logger.warn(`CI healing job failed: ${job.jobId} (${job.failedReason ?? 'unknown'})`);
  }
}
