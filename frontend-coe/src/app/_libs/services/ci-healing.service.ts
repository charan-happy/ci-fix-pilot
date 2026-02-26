import { env } from 'env';

export type CiHealingRunStatus =
  | 'queued'
  | 'running'
  | 'fixed'
  | 'escalated'
  | 'aborted'
  | 'resolved';

export interface CiHealingRun {
  id: string;
  provider: string;
  repository: string;
  branch: string;
  commitSha: string;
  errorType?: string | null;
  errorSummary: string;
  status: CiHealingRunStatus;
  attemptCount: number;
  maxAttempts: number;
  prUrl?: string | null;
  prNumber?: number | null;
  prState?: 'none' | 'open' | 'merged' | 'closed';
  resolvedBy?: 'none' | 'ai' | 'human' | 'user';
  humanNote?: string | null;
  updatedAt: string;
}

export interface CiHealingAttempt {
  id: string;
  attemptNo: number;
  status: 'running' | 'failed' | 'succeeded';
  diagnosis: string | null;
  proposedFix: string | null;
  validationLog: string | null;
  failureReason: string | null;
  createdAt: string;
}

export interface CiHealingSummary {
  queued: number;
  running: number;
  fixed: number;
  escalated: number;
  resolved: number;
  aborted: number;
  total: number;
  aiSuccessRate: number;
}

export interface CiHealingEvent {
  id: string;
  runId: string;
  eventType: string;
  actor: string;
  message: string;
  payload: unknown;
  createdAt: string;
}

export interface CiHealingRepositoryMetric {
  repository: string;
  total: number;
  fixed: number;
  escalated: number;
  resolved: number;
  aborted: number;
  aiSuccessRate: number;
}

interface WrappedResponse<T> {
  data: T;
}

const API_BASE = env.NEXT_PUBLIC_BACKEND_API_URL;

function unwrap<T>(payload: WrappedResponse<T> | T): T {
  if (typeof payload === 'object' && payload !== null && 'data' in payload) {
    return (payload as WrappedResponse<T>).data;
  }

  return payload as T;
}

export async function getCiHealingSummary(): Promise<CiHealingSummary> {
  const response = await fetch(`${API_BASE}/ci-healing/metrics/summary`, {
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('Failed to fetch CI healing summary');
  }

  const payload = (await response.json()) as WrappedResponse<CiHealingSummary> | CiHealingSummary;
  return unwrap(payload);
}

export async function getCiHealingRuns(
  page = 1,
  pageSize = 20,
  repository?: string,
): Promise<{ data: CiHealingRun[]; total: number }> {
  const repositoryParam = repository ? `&repository=${encodeURIComponent(repository)}` : '';
  const response = await fetch(`${API_BASE}/ci-healing/runs?page=${page}&pageSize=${pageSize}${repositoryParam}`, {
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('Failed to fetch CI healing runs');
  }

  const payload = (await response.json()) as unknown;
  const unwrapped = unwrap(payload as WrappedResponse<unknown> | unknown) as unknown;

  if (Array.isArray(unwrapped)) {
    const runs = unwrapped as CiHealingRun[];
    return {
      data: runs,
      total: runs.length,
    };
  }

  if (
    typeof unwrapped === 'object' &&
    unwrapped !== null &&
    'data' in unwrapped &&
    Array.isArray((unwrapped as { data: unknown }).data)
  ) {
    const runs = (unwrapped as { data: CiHealingRun[] }).data;
    const totalValue = (unwrapped as { total?: unknown }).total;
    const total = typeof totalValue === 'number' ? totalValue : runs.length;

    return {
      data: runs,
      total,
    };
  }

  return {
    data: [],
    total: 0,
  };
}

export async function getCiHealingRunDetails(
  runId: string,
): Promise<{ run: CiHealingRun; attempts: CiHealingAttempt[]; events: CiHealingEvent[] } | null> {
  const response = await fetch(`${API_BASE}/ci-healing/runs/${runId}`, {
    cache: 'no-store',
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as
    | WrappedResponse<{ run: CiHealingRun; attempts: CiHealingAttempt[]; events: CiHealingEvent[] } | null>
    | { run: CiHealingRun; attempts: CiHealingAttempt[]; events: CiHealingEvent[] }
    | null;

  return unwrap(payload);
}

export async function getCiHealingRepositoryMetrics(): Promise<CiHealingRepositoryMetric[]> {
  const response = await fetch(`${API_BASE}/ci-healing/metrics/repositories`, {
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('Failed to fetch CI healing repository metrics');
  }

  const payload = (await response.json()) as
    | WrappedResponse<CiHealingRepositoryMetric[]>
    | CiHealingRepositoryMetric[];

  return unwrap(payload);
}
