import { Module } from '@nestjs/common';
import { DeadLetterQueueModule } from '@dead-letter-queue/dead-letter-queue.module';
import { CiHealingModule } from '../../../ci-healing/ci-healing.module';
import { CiHealingProcessor } from './ci-healing.processor';

@Module({
  imports: [DeadLetterQueueModule, CiHealingModule],
  providers: [CiHealingProcessor],
})
export class CiHealingQueueModule {}
