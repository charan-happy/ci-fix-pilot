import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  BadRequestException,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Query,
  Sse,
  MessageEvent,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Public } from '@auth/decorators/public.decorator';
import { RouteNames } from '@common/route-names';
import { Observable } from 'rxjs';
import { CiHealingActionDto } from './dto/ci-healing-action.dto';
import { CreateCiHealingWebhookDto } from './dto/create-ci-healing-webhook.dto';
import { CiHealingService } from './ci-healing.service';
import { CiHealingRunAction, CiHealingRunStatus } from './interfaces/ci-healing.interface';

@Public()
@Controller({ path: RouteNames.CI_HEALING, version: '1' })
@ApiTags('CI Healing')
export class CiHealingController {
  constructor(private readonly ciHealingService: CiHealingService) {}

  @Post('webhook')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Ingest CI failure webhook and enqueue healing run' })
  async ingestWebhook(
    @Body() dto: CreateCiHealingWebhookDto,
    @Headers('x-ci-signature') signature?: string,
  ) {
    const result = await this.ciHealingService.ingestWebhook(dto, signature);
    return result;
  }

  @Sse('stream')
  @ApiOperation({ summary: 'Realtime CI-healing events stream (SSE)' })
  @ApiQuery({ name: 'runId', required: false, type: String })
  stream(@Query('runId') runId?: string): Observable<MessageEvent> {
    return this.ciHealingService.streamEvents(runId);
  }

  @Get('runs')
  @ApiOperation({ summary: 'List CI healing runs' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, enum: ['queued', 'running', 'fixed', 'escalated', 'aborted', 'resolved'] })
  @ApiQuery({ name: 'repository', required: false, type: String })
  async listRuns(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(20), ParseIntPipe) pageSize: number,
    @Query('status') status?: CiHealingRunStatus,
    @Query('repository') repository?: string,
  ) {
    return this.ciHealingService.listRuns(page, pageSize, status, repository);
  }

  @Get('runs/:id')
  @ApiOperation({ summary: 'Get run details and attempt timeline' })
  async getRun(@Param('id', ParseUUIDPipe) id: string) {
    return this.ciHealingService.getRunById(id);
  }

  @Get('runs/:id/memory')
  @ApiOperation({ summary: 'Get per-attempt memory hits used during diagnosis' })
  async getRunMemory(@Param('id', ParseUUIDPipe) id: string) {
    return this.ciHealingService.getRunMemoryInsights(id);
  }

  @Get('metrics/summary')
  @ApiOperation({ summary: 'Get CI healing run summary counts' })
  async summary() {
    return this.ciHealingService.getSummary();
  }

  @Get('metrics/repositories')
  @ApiOperation({ summary: 'Get repository-wise CI healing metrics' })
  async repositoryMetrics() {
    return this.ciHealingService.getRepositoryMetrics();
  }

  @Post('runs/:id/actions/:action')
  @ApiOperation({ summary: 'Apply human action on a run (approve/deny/abort/human-fix)' })
  async applyAction(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('action') action: string,
    @Body() dto: CiHealingActionDto,
  ) {
    const supportedActions: CiHealingRunAction[] = ['approve', 'deny', 'abort', 'human-fix'];

    if (!supportedActions.includes(action as CiHealingRunAction)) {
      throw new BadRequestException(`Unsupported action: ${action}`);
    }

    return this.ciHealingService.applyRunAction(id, action as CiHealingRunAction, dto.note);
  }
}
