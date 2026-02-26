import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QueueName } from '@bg/constants/job.constant';
import { IDLQFailedJobData } from '@bg/interfaces/job.interface';

@Processor(QueueName.DEAD_LETTER)
export class DeadLetterProcessor extends WorkerHost {
  private readonly logger = new Logger(DeadLetterProcessor.name);

  async process(job: Job<IDLQFailedJobData, any, string>): Promise<any> {
    const logString_ = `Processing DLQ job ${job.id} from original queue: ${job.data.originalQueueName}. Original job ID: ${job.data.originalJobId}. Reason: ${job.data.failedReason}`;
    this.logger.error(logString_, 'DeadLetterProcessor');
    if (typeof job.log === 'function') job.log(logString_);

    // Here you could:
    // - Log to an external error tracking system (e.g., Sentry, LogRocket)
    // - Send a notification (e.g., Slack, email)
    // - Store in a database for easier querying/review
    // - If you want to automatically retry, you'd put that logic here (but typically DLQ is for manual intervention)

    // For now, we'll just log and consider it processed.
    return 'DLQ job processed for review';
  }

  @OnWorkerEvent('active')
  async onActive(job: Job) {
    this.logger.debug(`Job ${job.id} is now active`);
    if (typeof job.log === 'function') job.log(`Job ${job.id} is now active`);
  }

  @OnWorkerEvent('progress')
  async onProgress(job: Job) {
    this.logger.debug(`Job ${job.id} is ${job.progress}% complete`);
    if (typeof job.log === 'function') job.log(`Job ${job.id} is ${job.progress}% complete`);
  }

  @OnWorkerEvent('completed')
  async onCompleted(job: Job) {
    this.logger.debug(`Job ${job.id} has been completed`);
    if (typeof job.log === 'function') job.log(`Job ${job.id} has been completed`);
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job) {
    const logString_ = `Job ${job.id} has failed with reason: ${job.failedReason}`;
    this.logger.error(logString_);
    this.logger.error(job?.stacktrace);
    if (typeof job.log === 'function') job.log(logString_);
  }

  @OnWorkerEvent('stalled')
  async onStalled(job: Job) {
    this.logger.error(`Job ${job.id} has been stalled`);
    if (typeof job.log === 'function') job.log(`Job ${job.id} has been stalled`);
  }

  @OnWorkerEvent('error')
  async onError(job: Job, error: Error) {
    const logString_ = `Job ${job.id} has failed with worker error: ${error?.message}`;
    this.logger.error(logString_);
    if (typeof job.log === 'function') job.log(logString_);
  }
}
