import { Injectable } from '@nestjs/common';
import { and, desc, eq, sql } from 'drizzle-orm';
import { DBService } from '@db/db.service';
import { ciHealingAttempts, ciHealingEvents, ciHealingRuns } from '@db/drizzle/schema';
import {
  CiHealingAttemptRecord,
  CiHealingEventRecord,
  CiHealingPrState,
  CiHealingRepositoryMetric,
  CiHealingResolvedBy,
  CiHealingRunRecord,
  CiHealingRunStatus,
  CiHealingSummary,
  CreateCiHealingAttemptData,
  CreateCiHealingRunData,
} from '../../../ci-healing/interfaces/ci-healing.interface';

@Injectable()
export class CiHealingRepository {
  constructor(private readonly dbService: DBService) {}

  async findByFingerprint(
    repository: string,
    commitSha: string,
    errorHash: string,
  ): Promise<CiHealingRunRecord | null> {
    const [row] = await this.dbService.db
      .select()
      .from(ciHealingRuns)
      .where(
        and(
          eq(ciHealingRuns.repository, repository),
          eq(ciHealingRuns.commitSha, commitSha),
          eq(ciHealingRuns.errorHash, errorHash),
        ),
      );

    if (!row) {
      return null;
    }

    return this.mapRun(row);
  }

  async createRun(data: CreateCiHealingRunData): Promise<CiHealingRunRecord> {
    const values: {
      provider: string;
      repository: string;
      branch: string;
      commitSha: string;
      errorHash: string;
      errorSummary: string;
      status: 'queued';
      maxAttempts: number;
      aiProvider: string;
      pipelineUrl?: string;
      errorType?: string;
      aiModel?: string;
    } = {
      provider: data.provider,
      repository: data.repository,
      branch: data.branch,
      commitSha: data.commitSha,
      errorHash: data.errorHash,
      errorSummary: data.errorSummary,
      status: 'queued',
      maxAttempts: data.maxAttempts,
      aiProvider: data.aiProvider ?? 'anthropic',
    };

    if (data.pipelineUrl !== undefined) {
      values.pipelineUrl = data.pipelineUrl;
    }

    if (data.errorType !== undefined) {
      values.errorType = data.errorType;
    }

    if (data.aiModel !== undefined) {
      values.aiModel = data.aiModel;
    }

    const [row] = await this.dbService.db
      .insert(ciHealingRuns)
      .values(values)
      .returning();

    if (!row) {
      throw new Error('Failed to create ci healing run');
    }

    return this.mapRun(row);
  }

  async findRunById(id: string): Promise<CiHealingRunRecord | null> {
    const [row] = await this.dbService.db
      .select()
      .from(ciHealingRuns)
      .where(eq(ciHealingRuns.id, id));

    if (!row) {
      return null;
    }

    return this.mapRun(row);
  }

  async updateRun(
    id: string,
    data: Partial<{
      status: CiHealingRunStatus;
      attemptCount: number;
      prUrl: string | null;
      prNumber: number | null;
      prState: CiHealingPrState;
      prBranch: string | null;
      aiProvider: string;
      aiModel: string | null;
      resolvedBy: CiHealingResolvedBy;
      humanNote: string | null;
      escalationReason: string | null;
      errorSummary: string;
    }>,
  ): Promise<CiHealingRunRecord | null> {
    const setValues: Record<string, unknown> = {
      updatedAt: sql`now()`,
    };

    if (data.status !== undefined) {
      setValues['status'] = data.status;
    }
    if (data.attemptCount !== undefined) {
      setValues['attemptCount'] = data.attemptCount;
    }
    if (data.prUrl !== undefined) {
      setValues['prUrl'] = data.prUrl;
    }
    if (data.prNumber !== undefined) {
      setValues['prNumber'] = data.prNumber;
    }
    if (data.prState !== undefined) {
      setValues['prState'] = data.prState;
    }
    if (data.prBranch !== undefined) {
      setValues['prBranch'] = data.prBranch;
    }
    if (data.aiProvider !== undefined) {
      setValues['aiProvider'] = data.aiProvider;
    }
    if (data.aiModel !== undefined) {
      setValues['aiModel'] = data.aiModel;
    }
    if (data.resolvedBy !== undefined) {
      setValues['resolvedBy'] = data.resolvedBy;
    }
    if (data.humanNote !== undefined) {
      setValues['humanNote'] = data.humanNote;
    }
    if (data.escalationReason !== undefined) {
      setValues['escalationReason'] = data.escalationReason;
    }
    if (data.errorSummary !== undefined) {
      setValues['errorSummary'] = data.errorSummary;
    }

    const [row] = await this.dbService.db
      .update(ciHealingRuns)
      .set(setValues as Partial<typeof ciHealingRuns.$inferInsert>)
      .where(eq(ciHealingRuns.id, id))
      .returning();

    if (!row) {
      return null;
    }

    return this.mapRun(row);
  }

  async listRuns(
    page: number,
    pageSize: number,
    status?: CiHealingRunStatus,
    repository?: string,
  ): Promise<{ data: CiHealingRunRecord[]; total: number }> {
    const offset = (page - 1) * pageSize;

    const whereCondition =
      status && repository
        ? and(eq(ciHealingRuns.status, status), eq(ciHealingRuns.repository, repository))
        : status
          ? eq(ciHealingRuns.status, status)
          : repository
            ? eq(ciHealingRuns.repository, repository)
            : undefined;

    const countQuery = this.dbService.db
      .select({ count: sql<number>`count(*)::int` })
      .from(ciHealingRuns);

    const listQuery = this.dbService.db
      .select()
      .from(ciHealingRuns)
      .orderBy(desc(ciHealingRuns.updatedAt))
      .limit(pageSize)
      .offset(offset);

    const [countRows, rows] = whereCondition
      ? await Promise.all([
          countQuery.where(whereCondition),
          listQuery.where(whereCondition),
        ])
      : await Promise.all([countQuery, listQuery]);

    return {
      data: rows.map((row: typeof ciHealingRuns.$inferSelect) => this.mapRun(row)),
      total: countRows[0]?.count ?? 0,
    };
  }

  async createAttempt(data: CreateCiHealingAttemptData): Promise<CiHealingAttemptRecord> {
    const [row] = await this.dbService.db
      .insert(ciHealingAttempts)
      .values({
        runId: data.runId,
        attemptNo: data.attemptNo,
        status: data.status,
        diagnosis: data.diagnosis,
        proposedFix: data.proposedFix,
        validationLog: data.validationLog,
        failureReason: data.failureReason,
      })
      .returning();

    if (!row) {
      throw new Error('Failed to create ci healing attempt');
    }

    return this.mapAttempt(row);
  }

  async updateAttempt(
    id: string,
    data: Partial<{
      status: 'running' | 'failed' | 'succeeded';
      diagnosis: string | null;
      proposedFix: string | null;
      validationLog: string | null;
      failureReason: string | null;
    }>,
  ): Promise<CiHealingAttemptRecord | null> {
    const setValues: Record<string, unknown> = {};

    if (data.status !== undefined) {
      setValues['status'] = data.status;
    }
    if (data.diagnosis !== undefined) {
      setValues['diagnosis'] = data.diagnosis;
    }
    if (data.proposedFix !== undefined) {
      setValues['proposedFix'] = data.proposedFix;
    }
    if (data.validationLog !== undefined) {
      setValues['validationLog'] = data.validationLog;
    }
    if (data.failureReason !== undefined) {
      setValues['failureReason'] = data.failureReason;
    }

    const [row] = await this.dbService.db
      .update(ciHealingAttempts)
      .set(setValues as Partial<typeof ciHealingAttempts.$inferInsert>)
      .where(eq(ciHealingAttempts.id, id))
      .returning();

    if (!row) {
      return null;
    }

    return this.mapAttempt(row);
  }

  async listAttemptsByRunId(runId: string): Promise<CiHealingAttemptRecord[]> {
    const rows = await this.dbService.db
      .select()
      .from(ciHealingAttempts)
      .where(eq(ciHealingAttempts.runId, runId))
      .orderBy(desc(ciHealingAttempts.attemptNo));

    return rows.map((row: typeof ciHealingAttempts.$inferSelect) => this.mapAttempt(row));
  }

  async createEvent(data: {
    runId: string;
    eventType: string;
    actor: string;
    message: string;
    payload?: unknown;
  }): Promise<CiHealingEventRecord> {
    const values: {
      runId: string;
      eventType: string;
      actor: string;
      message: string;
      payload?: unknown;
    } = {
      runId: data.runId,
      eventType: data.eventType,
      actor: data.actor,
      message: data.message,
    };

    if (data.payload !== undefined) {
      values.payload = data.payload;
    }

    const [row] = await this.dbService.db
      .insert(ciHealingEvents)
      .values(values)
      .returning();

    if (!row) {
      throw new Error('Failed to create ci healing event');
    }

    return this.mapEvent(row);
  }

  async listEventsByRunId(runId: string): Promise<CiHealingEventRecord[]> {
    const rows = await this.dbService.db
      .select()
      .from(ciHealingEvents)
      .where(eq(ciHealingEvents.runId, runId))
      .orderBy(desc(ciHealingEvents.createdAt));

    return rows.map((row: typeof ciHealingEvents.$inferSelect) => this.mapEvent(row));
  }

  async getSummary(): Promise<CiHealingSummary> {
    const [queued, running, fixed, escalated, resolved, aborted] = await Promise.all([
      this.countByStatus('queued'),
      this.countByStatus('running'),
      this.countByStatus('fixed'),
      this.countByStatus('escalated'),
      this.countByStatus('resolved'),
      this.countByStatus('aborted'),
    ]);

    const total = queued + running + fixed + escalated + resolved + aborted;
    const denominator = fixed + escalated + aborted;
    const aiSuccessRate =
      denominator > 0 ? Number(((fixed / denominator) * 100).toFixed(2)) : 0;

    return {
      queued,
      running,
      fixed,
      escalated,
      resolved,
      aborted,
      total,
      aiSuccessRate,
    };
  }

  async getRepositoryMetrics(): Promise<CiHealingRepositoryMetric[]> {
    const rows = await this.dbService.db
      .select({
        repository: ciHealingRuns.repository,
        status: ciHealingRuns.status,
        count: sql<number>`count(*)::int`,
      })
      .from(ciHealingRuns)
      .groupBy(ciHealingRuns.repository, ciHealingRuns.status);

    const metricsMap = new Map<string, CiHealingRepositoryMetric>();

    for (const row of rows) {
      const repository = row.repository;
      const status = row.status as CiHealingRunStatus;
      const count = row.count;

      const existing = metricsMap.get(repository) ?? {
        repository,
        total: 0,
        fixed: 0,
        escalated: 0,
        resolved: 0,
        aborted: 0,
        aiSuccessRate: 0,
      };

      existing.total += count;

      if (status === 'fixed') {
        existing.fixed += count;
      }

      if (status === 'escalated') {
        existing.escalated += count;
      }

      if (status === 'resolved') {
        existing.resolved += count;
      }

      if (status === 'aborted') {
        existing.aborted += count;
      }

      metricsMap.set(repository, existing);
    }

    const metrics = Array.from(metricsMap.values()).map((item) => {
      const denominator = item.fixed + item.escalated + item.aborted;
      return {
        ...item,
        aiSuccessRate:
          denominator > 0 ? Number(((item.fixed / denominator) * 100).toFixed(2)) : 0,
      };
    });

    return metrics.sort((a, b) => b.total - a.total);
  }

  private async countByStatus(status: CiHealingRunStatus): Promise<number> {
    const [row] = await this.dbService.db
      .select({ count: sql<number>`count(*)::int` })
      .from(ciHealingRuns)
      .where(eq(ciHealingRuns.status, status));

    return row?.count ?? 0;
  }

  private mapRun(row: typeof ciHealingRuns.$inferSelect): CiHealingRunRecord {
    return {
      id: row.id,
      provider: row.provider,
      repository: row.repository,
      branch: row.branch,
      commitSha: row.commitSha,
      pipelineUrl: row.pipelineUrl,
      errorHash: row.errorHash,
      errorType: row.errorType,
      errorSummary: row.errorSummary,
      status: row.status as CiHealingRunStatus,
      attemptCount: row.attemptCount,
      maxAttempts: row.maxAttempts,
      prUrl: row.prUrl,
      prNumber: row.prNumber,
      prState: row.prState as CiHealingPrState,
      prBranch: row.prBranch,
      aiProvider: row.aiProvider,
      aiModel: row.aiModel,
      resolvedBy: row.resolvedBy as CiHealingResolvedBy,
      humanNote: row.humanNote,
      escalationReason: row.escalationReason,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private mapAttempt(row: typeof ciHealingAttempts.$inferSelect): CiHealingAttemptRecord {
    return {
      id: row.id,
      runId: row.runId,
      attemptNo: row.attemptNo,
      status: row.status as 'running' | 'failed' | 'succeeded',
      diagnosis: row.diagnosis,
      proposedFix: row.proposedFix,
      validationLog: row.validationLog,
      failureReason: row.failureReason,
      createdAt: row.createdAt,
    };
  }

  private mapEvent(row: typeof ciHealingEvents.$inferSelect): CiHealingEventRecord {
    return {
      id: row.id,
      runId: row.runId,
      eventType: row.eventType,
      actor: row.actor,
      message: row.message,
      payload: row.payload,
      createdAt: row.createdAt,
    };
  }
}
