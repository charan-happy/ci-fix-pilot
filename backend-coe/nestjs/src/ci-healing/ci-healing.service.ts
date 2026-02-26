import { AiService } from '@ai/ai.service';
import { RagService } from '@ai/rag/rag.service';
import { CiHealingQueue } from '@bg/queue/ci-healing/ci-healing.queue';
import { CiHealingRepository } from '@db/repositories/ci-healing/ci-healing.repository';
import { Injectable, Logger, MessageEvent } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { exec as execCallback } from 'child_process';
import { createHash, timingSafeEqual } from 'crypto';
import { EventEmitter } from 'events';
import { Observable } from 'rxjs';
import { promisify } from 'util';
import { CiHealingMetricsService } from './ci-healing-metrics.service';
import { CreateCiHealingWebhookDto } from './dto/create-ci-healing-webhook.dto';
import {
  CiHealingAttemptRecord,
  CiHealingRepositoryMetric,
  CiHealingRunAction,
  CiHealingRunRecord,
  CiHealingRunStatus,
  CiHealingSummary,
} from './interfaces/ci-healing.interface';

const execAsync = promisify(execCallback);

export interface IngestWebhookResult {
  runId: string;
  status: CiHealingRunStatus;
  deduplicated: boolean;
}

export interface SimilarFixMatch {
  title: string;
  score: number;
  snippet: string;
  source: string | null;
}

interface GenerateFixResult {
  success: boolean;
  diagnosis: string;
  proposedFix: string;
  validationLog: string;
  failureReason?: string;
  aiProvider: string;
  aiModel: string;
  similarFixMatches?: SimilarFixMatch[];
}

interface GitHubPullRequestResult {
  url: string;
  number: number;
  branch: string;
  state: 'open' | 'closed';
}

interface ContainerValidationResult {
  success: boolean;
  log: string;
  failureReason?: string;
}

interface AttemptWorkflowOutcome {
  result: GenerateFixResult;
  containerValidation?: ContainerValidationResult | undefined;
  usedLangGraph: boolean;
}

@Injectable()
export class CiHealingService {
  private readonly logger = new Logger(CiHealingService.name);
  private readonly streamEmitter = new EventEmitter();

  constructor(
    private readonly repository: CiHealingRepository,
    private readonly queue: CiHealingQueue,
    private readonly aiService: AiService,
    private readonly ragService: RagService,
    private readonly configService: ConfigService,
    private readonly ciMetrics: CiHealingMetricsService,
  ) {}

  async ingestWebhook(
    dto: CreateCiHealingWebhookDto,
    signature?: string,
  ): Promise<IngestWebhookResult> {
    if ((this.configService.get<string>('CI_HEALING_ENABLED') ?? 'true') !== 'true') {
      throw new Error('CI healing is disabled.');
    }

    this.verifySignatureIfConfigured(dto.errorLog, signature);

    const maxAttempts = this.getMaxAttempts();
    const aiConfig = this.resolveAiConfig();
    const errorSummary = this.summarizeError(dto.errorLog);
    const errorHash = this.computeErrorHash(dto.errorType, errorSummary);

    const existing = await this.repository.findByFingerprint(
      dto.repository,
      dto.commitSha,
      errorHash,
    );

    if (existing) {
      this.ciMetrics.recordWebhook(dto.provider, true);
      return {
        runId: existing.id,
        status: existing.status,
        deduplicated: true,
      };
    }

    const createRunData: {
      provider: string;
      repository: string;
      branch: string;
      commitSha: string;
      errorHash: string;
      errorSummary: string;
      maxAttempts: number;
      aiProvider: string;
      aiModel: string;
      pipelineUrl?: string;
      errorType?: string;
    } = {
      provider: dto.provider,
      repository: dto.repository,
      branch: dto.branch,
      commitSha: dto.commitSha,
      errorHash,
      errorSummary,
      maxAttempts,
      aiProvider: aiConfig.label,
      aiModel: aiConfig.model,
    };

    if (dto.pipelineUrl !== undefined) {
      createRunData.pipelineUrl = dto.pipelineUrl;
    }

    if (dto.errorType !== undefined) {
      createRunData.errorType = dto.errorType;
    }

    const run = await this.repository.createRun(createRunData);

    await this.recordEvent(run.id, 'run.created', 'system', `Run created for ${run.repository}.`, {
      provider: run.provider,
      repository: run.repository,
      branch: run.branch,
      commitSha: run.commitSha,
      errorType: dto.errorType,
      maxAttempts,
    });

    await this.queue.addProcessJob({ runId: run.id }, 1);
    await this.recordEvent(run.id, 'run.queued', 'system', 'Run queued for processing.');
    this.ciMetrics.recordWebhook(dto.provider, false);
    this.ciMetrics.recordRunStatus('queued', dto.provider);
    await this.notifySlack(`🔴 Pipeline failed for ${run.repository} (${run.commitSha.slice(0, 7)}). Agent queued run ${run.id}.`);

    return {
      runId: run.id,
      status: run.status,
      deduplicated: false,
    };
  }

  async processRun(runId: string): Promise<void> {
    const run = await this.repository.findRunById(runId);

    if (!run) {
      this.logger.warn(`Run not found: ${runId}`);
      return;
    }

    if (run.status === 'fixed' || run.status === 'escalated' || run.status === 'resolved') {
      this.logger.debug(`Run ${run.id} already terminal: ${run.status}`);
      return;
    }

    if (run.status === 'aborted') {
      this.logger.debug(`Run ${run.id} is aborted. Skipping processing.`);
      return;
    }

    const attemptNo = run.attemptCount + 1;

    if (attemptNo > run.maxAttempts) {
      await this.repository.updateRun(run.id, {
        status: 'escalated',
        resolvedBy: 'human',
        escalationReason: 'Retry limit exhausted before processing.',
      });
      await this.recordEvent(
        run.id,
        'run.escalated',
        'system',
        'Run escalated due to retry limit exhaustion.',
      );
      this.ciMetrics.recordRunStatus('escalated', run.provider);
      await this.notifySlack(`🚨 Run ${run.id} escalated. Max retries reached.`);
      return;
    }

    await this.repository.updateRun(run.id, {
      status: 'running',
      attemptCount: attemptNo,
    });
    this.ciMetrics.recordRunStatus('running', run.provider);

    await this.recordEvent(
      run.id,
      'attempt.started',
      'ai',
      `Attempt ${attemptNo} started.`,
      { attemptNo, maxAttempts: run.maxAttempts },
    );

    const attempt = await this.repository.createAttempt({
      runId: run.id,
      attemptNo,
      status: 'running',
    });

    await this.notifySlack(`🔧 Attempt ${attemptNo}/${run.maxAttempts} for ${run.repository} (${run.commitSha.slice(0, 7)}).`);

    const workflowOutcome = await this.runAttemptWorkflow(run, attemptNo);
    const result = workflowOutcome.result;

    if (workflowOutcome.containerValidation) {
      const containerValidation = workflowOutcome.containerValidation;
      await this.recordEvent(
        run.id,
        'attempt.container-validation',
        'system',
        containerValidation.success
          ? `Container validation passed for attempt ${attemptNo}.`
          : `Container validation failed for attempt ${attemptNo}.`,
        {
          attemptNo,
          success: containerValidation.success,
          log: containerValidation.log,
          reason: containerValidation.failureReason,
          orchestrator: workflowOutcome.usedLangGraph ? 'langgraph' : 'native',
        },
      );
    }

    await this.recordEvent(
      run.id,
      'attempt.thinking',
      'ai',
      `AI reasoning generated for attempt ${attemptNo}.`,
      {
        attemptNo,
        diagnosis: result.diagnosis,
        validationLog: result.validationLog,
        aiProvider: result.aiProvider,
        aiModel: result.aiModel,
        orchestrator: workflowOutcome.usedLangGraph ? 'langgraph' : 'native',
        similarFixMatches: result.similarFixMatches ?? [],
      },
    );

    if (result.success) {
      this.ciMetrics.recordAttempt('succeeded', run.provider);
      await this.repository.updateAttempt(attempt.id, {
        status: 'succeeded',
        diagnosis: result.diagnosis,
        proposedFix: result.proposedFix,
        validationLog: result.validationLog,
      });

      await this.storeAttemptInVectorMemory(run, attemptNo, result, 'succeeded');

      const runUpdate: {
        status: 'fixed';
        resolvedBy: 'ai';
        aiProvider: string;
        aiModel: string;
        prUrl?: string;
        prNumber?: number;
        prState?: 'open' | 'none';
        prBranch?: string;
      } = {
        status: 'fixed',
        resolvedBy: 'ai',
        aiProvider: result.aiProvider,
        aiModel: result.aiModel,
      };

      const prResult = await this.createProposalPullRequest(run, attemptNo, result);

      if (prResult) {
        runUpdate.prUrl = prResult.url;
        runUpdate.prNumber = prResult.number;
        runUpdate.prState = 'open';
        runUpdate.prBranch = prResult.branch;
      } else {
        runUpdate.prState = 'none';
      }

      await this.repository.updateRun(run.id, runUpdate);
      this.ciMetrics.recordRunStatus('fixed', run.provider);

      await this.recordEvent(
        run.id,
        'attempt.succeeded',
        'ai',
        `Attempt ${attemptNo} succeeded.${prResult ? ` PR #${prResult.number} opened.` : ''}`,
        {
          attemptNo,
          prUrl: prResult?.url,
          prNumber: prResult?.number,
        },
      );

      await this.notifySlack(
        `✅ Run ${run.id} fixed in attempt ${attemptNo}.${prResult ? ` PR #${prResult.number} opened.` : ' Proposed patch ready.'}`,
      );
      return;
    }

    const failedAttemptUpdate: {
      status: 'failed';
      diagnosis: string;
      proposedFix: string;
      validationLog: string;
      failureReason?: string | null;
    } = {
      status: 'failed',
      diagnosis: result.diagnosis,
      proposedFix: result.proposedFix,
      validationLog: result.validationLog,
    };

    if (result.failureReason !== undefined) {
      failedAttemptUpdate.failureReason = result.failureReason;
    }

    this.ciMetrics.recordAttempt('failed', run.provider);

    await this.repository.updateAttempt(attempt.id, failedAttemptUpdate);

    await this.storeAttemptInVectorMemory(run, attemptNo, result, 'failed');

    await this.recordEvent(
      run.id,
      'attempt.failed',
      'ai',
      `Attempt ${attemptNo} failed.`,
      {
        attemptNo,
        reason: result.failureReason,
      },
    );

    if (attemptNo >= run.maxAttempts) {
      await this.repository.updateRun(run.id, {
        status: 'escalated',
        resolvedBy: 'human',
        escalationReason: result.failureReason ?? 'All retries failed.',
      });
      await this.recordEvent(
        run.id,
        'run.escalated',
        'system',
        `Run escalated after ${run.maxAttempts} failed attempts.`,
      );
      this.ciMetrics.recordRunStatus('escalated', run.provider);
      await this.notifySlack(`🚨 Run ${run.id} escalated after ${run.maxAttempts} failed attempts.`);
      return;
    }

    await this.repository.updateRun(run.id, { status: 'queued' });
    this.ciMetrics.recordRunStatus('queued', run.provider);
    await this.queue.addProcessJob({ runId: run.id }, attemptNo + 1);
    await this.recordEvent(
      run.id,
      'run.requeued',
      'system',
      `Run re-queued for attempt ${attemptNo + 1}.`,
    );
    await this.notifySlack(
      `🔁 Attempt ${attemptNo} failed for run ${run.id}. Retrying (${attemptNo + 1}/${run.maxAttempts}).`,
    );
  }

  async listRuns(
    page: number,
    pageSize: number,
    status?: CiHealingRunStatus,
    repository?: string,
  ): Promise<{ data: CiHealingRunRecord[]; total: number }> {
    return this.repository.listRuns(page, pageSize, status, repository);
  }

  async getRunById(id: string): Promise<{
    run: CiHealingRunRecord;
    attempts: CiHealingAttemptRecord[];
    events: Awaited<ReturnType<CiHealingRepository['listEventsByRunId']>>;
  } | null> {
    const run = await this.repository.findRunById(id);

    if (!run) {
      return null;
    }

    const [attempts, events] = await Promise.all([
      this.repository.listAttemptsByRunId(id),
      this.repository.listEventsByRunId(id),
    ]);

    return { run, attempts, events };
  }

  async getRunMemoryInsights(id: string): Promise<{
    runId: string;
    repository: string;
    branch: string;
    commitSha: string;
    attempts: Array<{
      attemptNo: number;
      status: CiHealingAttemptRecord['status'];
      createdAt: Date;
      orchestrator: 'langgraph' | 'native' | 'unknown';
      similarFixMatches: SimilarFixMatch[];
    }>;
  } | null> {
    const run = await this.repository.findRunById(id);

    if (!run) {
      return null;
    }

    const [attempts, events] = await Promise.all([
      this.repository.listAttemptsByRunId(id),
      this.repository.listEventsByRunId(id),
    ]);

    const memoryByAttempt = new Map<number, {
      orchestrator: 'langgraph' | 'native' | 'unknown';
      similarFixMatches: SimilarFixMatch[];
    }>();

    for (const event of events) {
      if (event.eventType !== 'attempt.thinking') {
        continue;
      }

      const payload = event.payload as Record<string, unknown> | null;
      if (!payload) {
        continue;
      }

      const attemptNoRaw = payload['attemptNo'];
      if (typeof attemptNoRaw !== 'number') {
        continue;
      }

      const orchestratorRaw = payload['orchestrator'];
      const orchestrator: 'langgraph' | 'native' | 'unknown' =
        orchestratorRaw === 'langgraph' || orchestratorRaw === 'native'
          ? orchestratorRaw
          : 'unknown';

      const rawMatches = payload['similarFixMatches'];
      const similarFixMatches: SimilarFixMatch[] = Array.isArray(rawMatches)
        ? rawMatches
            .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
            .map((item) => ({
              title: typeof item['title'] === 'string' ? item['title'] : 'untitled-memory',
              score: typeof item['score'] === 'number' ? item['score'] : 0,
              snippet: typeof item['snippet'] === 'string' ? item['snippet'] : '',
              source: typeof item['source'] === 'string' ? item['source'] : null,
            }))
        : [];

      memoryByAttempt.set(attemptNoRaw, { orchestrator, similarFixMatches });
    }

    return {
      runId: run.id,
      repository: run.repository,
      branch: run.branch,
      commitSha: run.commitSha,
      attempts: attempts
        .slice()
        .sort((a, b) => a.attemptNo - b.attemptNo)
        .map((attempt) => {
          const memory = memoryByAttempt.get(attempt.attemptNo);
          return {
            attemptNo: attempt.attemptNo,
            status: attempt.status,
            createdAt: attempt.createdAt,
            orchestrator: memory?.orchestrator ?? 'unknown',
            similarFixMatches: memory?.similarFixMatches ?? [],
          };
        }),
    };
  }

  streamEvents(runId?: string): Observable<MessageEvent> {
    return new Observable<MessageEvent>((subscriber) => {
      subscriber.next({
        data: {
          type: 'stream.connected',
          runId: runId ?? null,
          timestamp: new Date().toISOString(),
        },
      });

      const onEvent = (event: {
        runId: string;
        eventType: string;
        actor: string;
        message: string;
        payload: unknown;
        createdAt: string;
      }) => {
        if (!runId || event.runId === runId) {
          subscriber.next({ data: event });
        }
      };

      this.streamEmitter.on('ci-healing-event', onEvent);

      const heartbeat = setInterval(() => {
        subscriber.next({
          data: {
            type: 'stream.heartbeat',
            runId: runId ?? null,
            timestamp: new Date().toISOString(),
          },
        });
      }, 15000);

      return () => {
        clearInterval(heartbeat);
        this.streamEmitter.off('ci-healing-event', onEvent);
      };
    });
  }

  async getSummary(): Promise<CiHealingSummary> {
    return this.repository.getSummary();
  }

  async getRepositoryMetrics(): Promise<CiHealingRepositoryMetric[]> {
    return this.repository.getRepositoryMetrics();
  }

  async applyRunAction(
    runId: string,
    action: CiHealingRunAction,
    note?: string,
  ): Promise<{ run: CiHealingRunRecord; message: string }> {
    const run = await this.repository.findRunById(runId);

    if (!run) {
      throw new Error('Run not found');
    }

    const normalizedNote = note?.trim();

    switch (action) {
      case 'approve': {
        if (run.prNumber && run.prState === 'open') {
          await this.mergeGitHubPr(run);
        }

        const updated = await this.repository.updateRun(run.id, {
          status: 'resolved',
          resolvedBy: 'human',
          prState: run.prNumber ? 'merged' : run.prState,
          humanNote: normalizedNote ?? run.humanNote,
        });

        if (!updated) {
          throw new Error('Failed to approve run');
        }

        await this.recordEvent(run.id, 'run.approved', 'human', 'Run approved by human reviewer.', {
          note: normalizedNote,
        });
        this.ciMetrics.recordHumanAction('approve');
        this.ciMetrics.recordRunStatus('resolved', run.provider);

        await this.notifySlack(
          `✅ Run ${run.id} approved by reviewer.${run.prNumber ? ` PR #${run.prNumber} merged.` : ''}`
        );

        return { run: updated, message: 'Run approved successfully.' };
      }

      case 'deny': {
        if (run.prNumber && run.prState === 'open') {
          await this.closeGitHubPr(run);
        }

        const denyUpdate: {
          status: 'escalated';
          resolvedBy: 'human';
          prState: typeof run.prState;
          escalationReason: string;
          humanNote?: string | null;
        } = {
          status: 'escalated',
          resolvedBy: 'human',
          prState: run.prNumber ? 'closed' : run.prState,
          escalationReason: normalizedNote ?? 'Rejected by human reviewer.',
        };

        if (normalizedNote !== undefined) {
          denyUpdate.humanNote = normalizedNote;
        }

        const updated = await this.repository.updateRun(run.id, denyUpdate);

        if (!updated) {
          throw new Error('Failed to deny run');
        }

        await this.recordEvent(run.id, 'run.denied', 'human', 'Run denied by human reviewer.', {
          note: normalizedNote,
        });
        this.ciMetrics.recordHumanAction('deny');
        this.ciMetrics.recordRunStatus('escalated', run.provider);

        await this.notifySlack(
          `⛔ Run ${run.id} denied by reviewer and escalated.${run.prNumber ? ` PR #${run.prNumber} closed.` : ''}`
        );

        return { run: updated, message: 'Run denied and escalated.' };
      }

      case 'abort': {
        if (run.prNumber && run.prState === 'open') {
          await this.closeGitHubPr(run);
        }

        const abortUpdate: {
          status: 'aborted';
          resolvedBy: 'human';
          prState: typeof run.prState;
          humanNote?: string | null;
        } = {
          status: 'aborted',
          resolvedBy: 'human',
          prState: run.prNumber ? 'closed' : run.prState,
        };

        if (normalizedNote !== undefined) {
          abortUpdate.humanNote = normalizedNote;
        }

        const updated = await this.repository.updateRun(run.id, abortUpdate);

        if (!updated) {
          throw new Error('Failed to abort run');
        }

        await this.recordEvent(run.id, 'run.aborted', 'human', 'Run aborted by human reviewer.', {
          note: normalizedNote,
        });
        this.ciMetrics.recordHumanAction('abort');
        this.ciMetrics.recordRunStatus('aborted', run.provider);

        await this.notifySlack(
          `🛑 Run ${run.id} aborted by reviewer.${run.prNumber ? ` PR #${run.prNumber} closed.` : ''}`
        );

        return { run: updated, message: 'Run aborted.' };
      }

      case 'human-fix': {
        const updated = await this.repository.updateRun(run.id, {
          status: 'resolved',
          resolvedBy: 'human',
          humanNote: normalizedNote ?? 'Resolved manually by human.',
        });

        if (!updated) {
          throw new Error('Failed to mark run as human-fixed');
        }

        await this.recordEvent(run.id, 'run.human-fixed', 'human', 'Run resolved manually by human.', {
          note: normalizedNote,
        });
        this.ciMetrics.recordHumanAction('human-fix');
        this.ciMetrics.recordRunStatus('resolved', run.provider);

        await this.notifySlack(`🧑‍💻 Run ${run.id} marked as human-fixed.`);

        return { run: updated, message: 'Run marked as resolved by human.' };
      }

      default:
        throw new Error(`Unsupported run action: ${action}`);
    }
  }

  private computeErrorHash(errorType: string | undefined, summary: string): string {
    return createHash('sha256')
      .update(`${errorType ?? 'unknown'}|${summary.toLowerCase()}`)
      .digest('hex');
  }

  private summarizeError(errorLog: string): string {
    const compact = errorLog
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .slice(0, 5)
      .join(' | ');

    return compact.slice(0, 1000);
  }

  private getMaxAttempts(): number {
    const raw = this.configService.get<string>('CI_HEALING_MAX_ATTEMPTS') ?? '3';
    const parsed = Number.parseInt(raw, 10);

    if (Number.isNaN(parsed) || parsed < 1) {
      return 3;
    }

    return Math.min(parsed, 5);
  }

  private resolveAiConfig(): {
    label: string;
    providerName: 'claude' | 'openai';
    model: string;
  } {
    const configured = (this.configService.get<string>('CI_HEALING_AI_PROVIDER') ?? 'anthropic').toLowerCase();

    if (configured === 'openai') {
      return {
        label: 'openai',
        providerName: 'openai',
        model: this.configService.get<string>('OPENAI_DEFAULT_MODEL') ?? 'gpt-4o',
      };
    }

    if (configured === 'gemini') {
      return {
        label: 'gemini',
        providerName: 'openai',
        model: this.configService.get<string>('GEMINI_DEFAULT_MODEL') ?? 'gemini-2.5-pro',
      };
    }

    if (configured === 'grok') {
      return {
        label: 'grok',
        providerName: 'openai',
        model: this.configService.get<string>('GROK_DEFAULT_MODEL') ?? 'grok-3',
      };
    }

    return {
      label: 'anthropic',
      providerName: 'claude',
      model:
        this.configService.get<string>('CLAUDE_DEFAULT_MODEL') ??
        'claude-sonnet-4-20250514',
    };
  }

  private async generateFixProposal(
    run: CiHealingRunRecord,
    attemptNo: number,
  ): Promise<GenerateFixResult> {
    const aiConfig = this.resolveAiConfig();
    const safeMode = (this.configService.get<string>('CI_HEALING_SAFE_MODE') ?? 'true') === 'true';
    const similarFixMatches = await this.fetchSimilarFixMatches(run.errorSummary);
    const similarContext = this.buildSimilarFixContext(similarFixMatches);

    try {
      const response = await this.aiService.chatCompletion({
        messages: [
          {
            role: 'system',
            content:
              'You are a senior CI debugging assistant. Diagnose the root cause and produce a concise fix strategy and a patch snippet.',
          },
          {
            role: 'user',
            content:
              `Repository: ${run.repository}\n` +
              `Branch: ${run.branch}\n` +
              `Commit: ${run.commitSha}\n` +
              `Attempt: ${attemptNo}\n` +
              `Error summary: ${run.errorSummary}\n` +
              `Similar past fixes:\n${similarContext}\n` +
              `Return format:\nDiagnosis:\nFix:\nValidation:`,
          },
        ],
        model: aiConfig.model,
        temperature: 0.1,
        maxTokens: 600,
      }, aiConfig.providerName);

      const content = response.data.content;
      const diagnosis = this.extractSection(content, 'Diagnosis');
      const fix = this.extractSection(content, 'Fix');
      const validation = this.extractSection(content, 'Validation');

      const success = diagnosis.length > 10 && fix.length > 10;

      return {
        success,
        diagnosis,
        proposedFix: safeMode ? `${fix}\n\n[SAFE_MODE] Patch generation only; no auto-push performed.` : fix,
        validationLog: validation || 'Validation pending in safe mode.',
        aiProvider: aiConfig.label,
        aiModel: response.model,
        similarFixMatches,
        ...(success
          ? {}
          : {
              failureReason:
                'Low-confidence AI output; diagnosis/fix did not meet acceptance threshold.',
            }),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown AI failure';

      return {
        success: false,
        diagnosis: 'AI provider unavailable or failed during diagnosis.',
        proposedFix: 'Fallback: require manual engineer review for this run.',
        validationLog: `Attempted model call failed: ${message}`,
        failureReason: message,
        aiProvider: aiConfig.label,
        aiModel: aiConfig.model,
        similarFixMatches,
      };
    }
  }

  private extractSection(content: string, section: 'Diagnosis' | 'Fix' | 'Validation'): string {
    const regex = new RegExp(`${section}:([\\s\\S]*?)(?:\\n[A-Z][a-z]+:|$)`, 'i');
    const match = content.match(regex);

    if (!match || !match[1]) {
      return section === 'Validation' ? '' : content.slice(0, 800);
    }

    return match[1].trim().slice(0, 3000);
  }

  private buildSimilarFixContext(similarFixMatches: SimilarFixMatch[]): string {
    if (!similarFixMatches.length) {
      return 'No similar fixes found in memory.';
    }

    return similarFixMatches
      .map((item, index) => {
        return `${index + 1}. [${item.title}] score=${item.score.toFixed(3)} :: ${item.snippet}`;
      })
      .join('\n');
  }

  private async fetchSimilarFixMatches(errorSummary: string): Promise<SimilarFixMatch[]> {
    try {
      const results = await this.ragService.search(errorSummary, 3, 0.65);
      if (!results.length) {
        return [];
      }

      return results
        .map((item) => {
          const title = item.document.title ?? 'untitled-memory';
          const snippet = item.chunk.content.slice(0, 220).replace(/\s+/g, ' ').trim();
          return {
            title,
            score: item.score,
            snippet,
            source: item.document.source ?? null,
          };
        });
    } catch (error) {
      this.logger.warn(`Failed to load similar fix context from pgvector memory: ${(error as Error).message}`);
      return [];
    }
  }

  private async storeAttemptInVectorMemory(
    run: CiHealingRunRecord,
    attemptNo: number,
    result: GenerateFixResult,
    status: 'succeeded' | 'failed',
  ): Promise<void> {
    try {
      const content = [
        `repository=${run.repository}`,
        `branch=${run.branch}`,
        `commit=${run.commitSha}`,
        `attempt=${attemptNo}`,
        `status=${status}`,
        `errorSummary=${run.errorSummary}`,
        `diagnosis=${result.diagnosis}`,
        `proposedFix=${result.proposedFix}`,
        `validationLog=${result.validationLog}`,
      ].join('\n\n');

      await this.ragService.ingestDocument({
        title: `ci-healing:${run.repository}:${run.id}:a${attemptNo}:${status}`,
        source: `ci-healing/${run.id}`,
        content,
        metadata: {
          runId: run.id,
          attemptNo,
          status,
          aiProvider: result.aiProvider,
          aiModel: result.aiModel,
          repository: run.repository,
          branch: run.branch,
        },
      });
    } catch (error) {
      this.logger.warn(`Failed to persist CI-healing memory in pgvector: ${(error as Error).message}`);
    }
  }

  private async runAttemptWorkflow(
    run: CiHealingRunRecord,
    attemptNo: number,
  ): Promise<AttemptWorkflowOutcome> {
    const langGraphEnabled =
      (this.configService.get<string>('CI_HEALING_LANGGRAPH_ENABLED') ?? 'true') === 'true';

    if (!langGraphEnabled) {
      return this.runAttemptWorkflowNative(run, attemptNo);
    }

    try {
      const dynamicImporter = new Function('moduleName', 'return import(moduleName)') as (
        moduleName: string,
      ) => Promise<unknown>;
      const langgraph: any = await dynamicImporter('@langchain/langgraph');

      const State = langgraph.Annotation.Root({
        generated: langgraph.Annotation.default(() => null),
        result: langgraph.Annotation.default(() => null),
        containerValidation: langgraph.Annotation.default(() => null),
      });

      const workflow = new langgraph.StateGraph(State)
        .addNode('generate', async () => {
          const generated = await this.generateFixProposal(run, attemptNo);
          return { generated, result: generated };
        })
        .addNode('validate', async (state: Record<string, unknown>) => {
          const generated = state['generated'] as GenerateFixResult | null;
          if (!generated || !generated.success) {
            return { result: generated };
          }

          const containerValidation = await this.validateInContainer(run, attemptNo, generated);

          if (!containerValidation.success) {
            return {
              containerValidation,
              result: {
                ...generated,
                success: false,
                validationLog:
                  `${generated.validationLog}\n\n[CONTAINER_VALIDATION_FAILED]\n${containerValidation.log}`.slice(0, 6000),
                failureReason:
                  containerValidation.failureReason ??
                  'Container validation failed before PR creation.',
              },
            };
          }

          return {
            containerValidation,
            result: {
              ...generated,
              validationLog:
                `${generated.validationLog}\n\n[CONTAINER_VALIDATION_PASSED]\n${containerValidation.log}`.slice(0, 6000),
            },
          };
        })
        .addEdge('__start__', 'generate')
        .addEdge('generate', 'validate')
        .addEdge('validate', '__end__')
        .compile();

      const finalState = await workflow.invoke({});
      const result = finalState.result as GenerateFixResult | null;
      const containerValidation = finalState.containerValidation as ContainerValidationResult | null;

      if (!result) {
        return this.runAttemptWorkflowNative(run, attemptNo);
      }

      return {
        result,
        containerValidation: containerValidation ?? undefined,
        usedLangGraph: true,
      };
    } catch (error) {
      this.logger.warn(
        `LangGraph workflow unavailable, falling back to native orchestrator: ${(error as Error).message}`,
      );
      return this.runAttemptWorkflowNative(run, attemptNo);
    }
  }

  private async runAttemptWorkflowNative(
    run: CiHealingRunRecord,
    attemptNo: number,
  ): Promise<AttemptWorkflowOutcome> {
    const generatedResult = await this.generateFixProposal(run, attemptNo);

    if (!generatedResult.success) {
      return {
        result: generatedResult,
        usedLangGraph: false,
      };
    }

    const containerValidation = await this.validateInContainer(run, attemptNo, generatedResult);

    if (!containerValidation.success) {
      return {
        result: {
          ...generatedResult,
          success: false,
          validationLog:
            `${generatedResult.validationLog}\n\n[CONTAINER_VALIDATION_FAILED]\n${containerValidation.log}`.slice(0, 6000),
          failureReason:
            containerValidation.failureReason ??
            'Container validation failed before PR creation.',
        },
        containerValidation,
        usedLangGraph: false,
      };
    }

    return {
      result: {
        ...generatedResult,
        validationLog:
          `${generatedResult.validationLog}\n\n[CONTAINER_VALIDATION_PASSED]\n${containerValidation.log}`.slice(0, 6000),
      },
      containerValidation,
      usedLangGraph: false,
    };
  }

  private async notifySlack(message: string): Promise<void> {
    const webhook = this.configService.get<string>('CI_HEALING_SLACK_WEBHOOK_URL');

    if (!webhook) {
      return;
    }

    try {
      await fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: message }),
      });
    } catch (error) {
      this.logger.warn(`Slack notification failed: ${(error as Error).message}`);
    }
  }

  private async recordEvent(
    runId: string,
    eventType: string,
    actor: string,
    message: string,
    payload?: unknown,
  ): Promise<void> {
    try {
      const createdEvent = await this.repository.createEvent({
        runId,
        eventType,
        actor,
        message,
        payload,
      });

      this.streamEmitter.emit('ci-healing-event', {
        runId: createdEvent.runId,
        eventType: createdEvent.eventType,
        actor: createdEvent.actor,
        message: createdEvent.message,
        payload: createdEvent.payload,
        createdAt: createdEvent.createdAt.toISOString(),
      });
    } catch (error) {
      this.logger.warn(`Failed to record event ${eventType} for run ${runId}: ${(error as Error).message}`);
    }
  }

  private async createProposalPullRequest(
    run: CiHealingRunRecord,
    attemptNo: number,
    result: GenerateFixResult,
  ): Promise<GitHubPullRequestResult | null> {
    const githubEnabled = (this.configService.get<string>('CI_HEALING_GITHUB_ENABLED') ?? 'false') === 'true';
    const token = this.configService.get<string>('GITHUB_TOKEN');

    if (!githubEnabled || !token) {
      return null;
    }

    const parsed = this.parseRepository(run.repository);
    if (!parsed) {
      return null;
    }

    const branchCheck = await this.ensureRunBranchStillAtFailingCommit(parsed, run);

    if (!branchCheck.ok) {
      await this.recordEvent(
        run.id,
        'pr.skipped',
        'system',
        `PR skipped for run ${run.id}: ${branchCheck.reason}`,
        {
          branch: run.branch,
          runCommit: run.commitSha,
          branchHeadSha: branchCheck.branchHeadSha,
        },
      );

      await this.notifySlack(`ℹ️ PR skipped for run ${run.id}: ${branchCheck.reason}`);
      return null;
    }

    const base = run.branch;
    const branch = `healops/${run.id.slice(0, 8)}-a${attemptNo}-${Date.now().toString().slice(-4)}`;

    const baseRef = await this.githubRequest<{ object: { sha: string } }>(
      `/repos/${parsed.owner}/${parsed.repo}/git/ref/heads/${base}`,
      'GET',
    );

    const baseSha = baseRef.object.sha;

    await this.githubRequest(
      `/repos/${parsed.owner}/${parsed.repo}/git/refs`,
      'POST',
      {
        ref: `refs/heads/${branch}`,
        sha: baseSha,
      },
    );

    const proposalPath = `.healops/proposals/${run.id}.md`;
    const proposalContent = this.buildProposalFile(run, attemptNo, result);

    await this.githubRequest(
      `/repos/${parsed.owner}/${parsed.repo}/contents/${encodeURIComponent(proposalPath)}`,
      'PUT',
      {
        message: `chore(healops): proposal for run ${run.id}`,
        content: Buffer.from(proposalContent, 'utf-8').toString('base64'),
        branch,
      },
    );

    const pr = await this.githubRequest<{ html_url: string; number: number; state: 'open' | 'closed'; head: { ref: string } }>(
      `/repos/${parsed.owner}/${parsed.repo}/pulls`,
      'POST',
      {
        title: `HealOps: Proposed CI fix for ${run.commitSha.slice(0, 8)}`,
        body:
          `Automated proposal generated by HealOps.\n\n` +
          `- Run ID: ${run.id}\n` +
          `- Attempt: ${attemptNo}\n` +
          `- AI Provider: ${result.aiProvider}\n` +
          `- Base Branch: ${base}\n\n` +
          `Please review the proposal file at \`${proposalPath}\` before merge.`,
        head: branch,
        base,
      },
    );

    await this.recordEvent(
      run.id,
      'pr.opened',
      'system',
      `PR #${pr.number} opened for run ${run.id}.`,
      {
        prUrl: pr.html_url,
        prNumber: pr.number,
        branch,
      },
    );
    this.ciMetrics.recordPrAction('opened');

    await this.notifySlack(`✅ Run ${run.id} generated PR #${pr.number}: ${pr.html_url}`);

    return {
      url: pr.html_url,
      number: pr.number,
      branch: pr.head.ref,
      state: pr.state,
    };
  }

  private async ensureRunBranchStillAtFailingCommit(
    parsed: { owner: string; repo: string },
    run: CiHealingRunRecord,
  ): Promise<{ ok: boolean; reason: string; branchHeadSha?: string }> {
    try {
      const branchRef = await this.githubRequest<{ object: { sha: string } }>(
        `/repos/${parsed.owner}/${parsed.repo}/git/ref/heads/${encodeURIComponent(run.branch)}`,
        'GET',
      );

      const branchHeadSha = branchRef.object.sha;

      if (branchHeadSha !== run.commitSha) {
        return {
          ok: false,
          reason:
            `branch ${run.branch} moved from ${run.commitSha.slice(0, 7)} to ${branchHeadSha.slice(0, 7)}; waiting for latest failure context before PR`,
          branchHeadSha,
        };
      }

      return {
        ok: true,
        reason: 'branch head matches failing commit',
        branchHeadSha,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to read branch head';
      return {
        ok: false,
        reason: `unable to validate branch head before PR: ${message}`,
      };
    }
  }

  private async mergeGitHubPr(run: CiHealingRunRecord): Promise<void> {
    if (!run.prNumber) {
      return;
    }

    const token = this.configService.get<string>('GITHUB_TOKEN');
    if (!token) {
      return;
    }

    const parsed = this.parseRepository(run.repository);
    if (!parsed) {
      return;
    }

    await this.githubRequest(
      `/repos/${parsed.owner}/${parsed.repo}/pulls/${run.prNumber}/merge`,
      'PUT',
      {
        commit_title: `HealOps merge for run ${run.id}`,
        merge_method: 'squash',
      },
    );

    await this.recordEvent(
      run.id,
      'pr.merged',
      'human',
      `PR #${run.prNumber} merged for run ${run.id}.`,
      {
        prNumber: run.prNumber,
      },
    );
    this.ciMetrics.recordPrAction('merged');

    await this.notifySlack(`✅ PR #${run.prNumber} merged for run ${run.id}.`);
  }

  private async closeGitHubPr(run: CiHealingRunRecord): Promise<void> {
    if (!run.prNumber) {
      return;
    }

    const token = this.configService.get<string>('GITHUB_TOKEN');
    if (!token) {
      return;
    }

    const parsed = this.parseRepository(run.repository);
    if (!parsed) {
      return;
    }

    await this.githubRequest(
      `/repos/${parsed.owner}/${parsed.repo}/pulls/${run.prNumber}`,
      'PATCH',
      {
        state: 'closed',
      },
    );

    await this.recordEvent(
      run.id,
      'pr.closed',
      'human',
      `PR #${run.prNumber} closed for run ${run.id}.`,
      {
        prNumber: run.prNumber,
      },
    );
    this.ciMetrics.recordPrAction('closed');

    await this.notifySlack(`ℹ️ PR #${run.prNumber} closed for run ${run.id}.`);
  }

  private parseRepository(repository: string): { owner: string; repo: string } | null {
    const [owner, repo] = repository.split('/');

    if (!owner || !repo) {
      return null;
    }

    return {
      owner,
      repo,
    };
  }

  private async githubRequest<T = unknown>(
    path: string,
    method: 'GET' | 'POST' | 'PUT' | 'PATCH',
    body?: Record<string, unknown>,
  ): Promise<T> {
    const token = this.configService.get<string>('GITHUB_TOKEN');
    if (!token) {
      throw new Error('GITHUB_TOKEN is required for GitHub operations.');
    }

    const response = await fetch(`https://api.github.com${path}`, {
      method,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GitHub API ${method} ${path} failed (${response.status}): ${errorText}`);
    }

    if (response.status === 204) {
      return {} as T;
    }

    return (await response.json()) as T;
  }

  private buildProposalFile(
    run: CiHealingRunRecord,
    attemptNo: number,
    result: GenerateFixResult,
  ): string {
    return [
      '# HealOps Proposal',
      '',
      `- Run ID: ${run.id}`,
      `- Repository: ${run.repository}`,
      `- Branch: ${run.branch}`,
      `- Commit: ${run.commitSha}`,
      `- Attempt: ${attemptNo}`,
      `- AI Provider: ${result.aiProvider}`,
      `- AI Model: ${result.aiModel}`,
      '',
      '## Error Summary',
      run.errorSummary,
      '',
      '## Diagnosis',
      result.diagnosis,
      '',
      '## Proposed Fix',
      result.proposedFix,
      '',
      '## Validation',
      result.validationLog,
      '',
      '_Generated by HealOps self-healing agent._',
      '',
    ].join('\n');
  }

  private async validateInContainer(
    run: CiHealingRunRecord,
    attemptNo: number,
    result: GenerateFixResult,
  ): Promise<ContainerValidationResult> {
    const required =
      (this.configService.get<string>('CI_HEALING_CONTAINER_VALIDATION_REQUIRED') ?? 'true') ===
      'true';

    if (!required) {
      return {
        success: true,
        log: 'Container validation disabled by CI_HEALING_CONTAINER_VALIDATION_REQUIRED=false.',
      };
    }

    const command = this.configService
      .get<string>('CI_HEALING_CONTAINER_VALIDATE_COMMAND')
      ?.trim();

    if (!command) {
      this.ciMetrics.recordContainerValidation(false);
      return {
        success: false,
        log: 'No container validation command configured.',
        failureReason:
          'CI_HEALING_CONTAINER_VALIDATE_COMMAND is required when container validation is enabled.',
      };
    }

    const timeoutRaw = this.configService.get<string>('CI_HEALING_CONTAINER_VALIDATE_TIMEOUT_MS') ?? '900000';
    const timeoutMs = Number.parseInt(timeoutRaw, 10);
    const effectiveTimeout = Number.isNaN(timeoutMs) || timeoutMs <= 0 ? 900000 : timeoutMs;
    const workdir =
      this.configService.get<string>('CI_HEALING_CONTAINER_VALIDATE_WORKDIR')?.trim() || process.cwd();

    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: workdir,
        timeout: effectiveTimeout,
        maxBuffer: 10 * 1024 * 1024,
      });

      const combinedOutput = [stdout, stderr].filter(Boolean).join('\n').trim();
      this.ciMetrics.recordContainerValidation(true);

      return {
        success: true,
        log: [
          `command: ${command}`,
          `workdir: ${workdir}`,
          `run: ${run.id}`,
          `attempt: ${attemptNo}`,
          `ai_provider: ${result.aiProvider}`,
          combinedOutput || 'Container validation completed with no output.',
        ]
          .join('\n')
          .slice(0, 6000),
      };
    } catch (error) {
      const execError = error as Error & {
        stdout?: string;
        stderr?: string;
        code?: number;
        signal?: string;
      };

      const output = [execError.stdout, execError.stderr].filter(Boolean).join('\n').trim();
      this.ciMetrics.recordContainerValidation(false);

      return {
        success: false,
        failureReason:
          execError.message ||
          `Container validation command failed for run ${run.id} attempt ${attemptNo}.`,
        log: [
          `command: ${command}`,
          `workdir: ${workdir}`,
          `run: ${run.id}`,
          `attempt: ${attemptNo}`,
          `exit_code: ${execError.code ?? 'unknown'}`,
          `signal: ${execError.signal ?? 'none'}`,
          output || 'No command output captured.',
        ]
          .join('\n')
          .slice(0, 6000),
      };
    }
  }

  private verifySignatureIfConfigured(payload: string, signature?: string): void {
    const secret = this.configService.get<string>('CI_HEALING_WEBHOOK_SECRET');

    if (!secret) {
      return;
    }

    if (!signature) {
      throw new Error('Missing webhook signature');
    }

    const expected = createHash('sha256').update(`${secret}:${payload}`).digest('hex');

    const expectedBuffer = Buffer.from(expected, 'utf-8');
    const incomingBuffer = Buffer.from(signature, 'utf-8');

    if (
      expectedBuffer.length !== incomingBuffer.length ||
      !timingSafeEqual(expectedBuffer, incomingBuffer)
    ) {
      throw new Error('Invalid webhook signature');
    }
  }
}
