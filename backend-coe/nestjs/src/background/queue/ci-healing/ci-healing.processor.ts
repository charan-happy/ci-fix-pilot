import { JobName, QueueName } from '@bg/constants/job.constant';
import { DeadLetterQueueService } from '@dead-letter-queue/dead-letter-queue.service';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { CiHealingService } from '../../../ci-healing/ci-healing.service';

interface CiHealingProcessJob {
  runId: string;
}

@Processor(QueueName.CI_HEALING, {
  concurrency: 3,
  drainDelay: 300,
  stalledInterval: 300000,
  maxStalledCount: 2,
})
export class CiHealingProcessor extends WorkerHost {
  private readonly logger = new Logger(CiHealingProcessor.name);

  constructor(
    private readonly ciHealingService: CiHealingService,
    private readonly dlqService: DeadLetterQueueService,
  ) {
    super();
  }

  async process(job: Job<CiHealingProcessJob, unknown, string>): Promise<void> {
    if (job.name !== JobName.CI_HEALING_PROCESS) {
      throw new Error(`Unknown CI healing job name: ${job.name}`);
    }

    await this.ciHealingService.processRun(job.data.runId);
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job) {
    const failedReason = job.failedReason ?? 'Unknown processing failure';
    this.logger.error(`CI healing job ${job.id} failed: ${failedReason}`);

    await this.dlqService.addFailedJobToDLQ({
      originalQueueName: QueueName.CI_HEALING,
      originalJobId: job.id ?? '',
      originalJobName: job.name,
      originalJobData: job.data,
      failedReason,
      stacktrace: job.stacktrace,
      timestamp: Date.now(),
    });
  }
}
