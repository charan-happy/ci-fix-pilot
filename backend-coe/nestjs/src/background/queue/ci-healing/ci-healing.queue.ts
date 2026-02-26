import { JobName, QueueName } from '@bg/constants/job.constant';
import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';

interface CiHealingProcessJob {
  runId: string;
}

@Injectable()
export class CiHealingQueue {
  private readonly logger = new Logger(CiHealingQueue.name);

  constructor(@InjectQueue(QueueName.CI_HEALING) private readonly ciHealingQueue: Queue) {}

  async addProcessJob(data: CiHealingProcessJob, attemptNo: number): Promise<void> {
    this.logger.debug(`Adding CI healing process job for run ${data.runId}, attempt ${attemptNo}`);

    await this.ciHealingQueue.add(JobName.CI_HEALING_PROCESS, data, {
      jobId: `${data.runId}:attempt:${attemptNo}`,
      attempts: 1,
      removeOnComplete: true,
      removeOnFail: false,
      delay: attemptNo > 1 ? 10_000 : 0,
    });
  }
}
