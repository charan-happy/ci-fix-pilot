import { Module } from '@nestjs/common';
import { AiModule } from '@ai/ai.module';
import { RagModule } from '@ai/rag/rag.module';
import { CiHealingController } from './ci-healing.controller';
import { CiHealingService } from './ci-healing.service';
import { CiHealingQueueCoreModule } from '@bg/queue/ci-healing/ci-healing-queue-core.module';
import { CiHealingMetricsService } from './ci-healing-metrics.service';

@Module({
  imports: [AiModule, RagModule, CiHealingQueueCoreModule],
  controllers: [CiHealingController],
  providers: [CiHealingService, CiHealingMetricsService],
  exports: [CiHealingService],
})
export class CiHealingModule {}
