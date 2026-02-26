import { NextRequest, NextResponse } from 'next/server';

import { env } from 'env';

type WrappedResponse<T> = {
  data: T;
};

interface CiHealingRun {
  id: string;
  provider: string;
  repository: string;
  branch: string;
  commitSha: string;
  errorType?: string | null;
  errorSummary: string;
  status: 'queued' | 'running' | 'fixed' | 'escalated' | 'aborted' | 'resolved';
  attemptCount: number;
  maxAttempts: number;
  prUrl?: string | null;
  prNumber?: number | null;
  prState?: 'none' | 'open' | 'merged' | 'closed';
  resolvedBy?: 'none' | 'ai' | 'human' | 'user';
  updatedAt: string;
}

interface CiHealingAttempt {
  id: string;
  attemptNo: number;
  status: 'running' | 'failed' | 'succeeded';
  diagnosis: string | null;
  proposedFix: string | null;
  validationLog: string | null;
  createdAt: string;
}

interface CiHealingEvent {
  id: string;
  eventType: string;
  actor: string;
  message: string;
  payload: unknown;
  createdAt: string;
}

interface CiHealingSummary {
  queued: number;
  running: number;
  fixed: number;
  escalated: number;
  resolved: number;
  aborted: number;
  aiSuccessRate: number;
}

interface CiHealingRepositoryMetric {
  repository: string;
  total: number;
  fixed: number;
  escalated: number;
  aiSuccessRate: number;
}

interface CiHealingRunDetails {
  run: CiHealingRun;
  attempts: CiHealingAttempt[];
  events: CiHealingEvent[];
}

function unwrap<T>(payload: WrappedResponse<T> | T): T {
  if (typeof payload === 'object' && payload !== null && 'data' in payload) {
    return (payload as WrappedResponse<T>).data;
  }

  return payload as T;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Failed request: ${url}`);
  }

  const payload = (await response.json()) as WrappedResponse<T> | T;
  return unwrap(payload);
}

function normalizeRuns(payload: unknown): CiHealingRun[] {
  if (Array.isArray(payload)) {
    return payload as CiHealingRun[];
  }

  if (typeof payload === 'object' && payload !== null && 'data' in payload) {
    const data = (payload as { data: unknown }).data;
    if (Array.isArray(data)) {
      return data as CiHealingRun[];
    }
  }

  return [];
}

export async function GET(request: NextRequest) {
  try {
    const requestedRunId = request.nextUrl.searchParams.get('runId');

    const [summary, repositoryMetrics, rawRuns] = await Promise.all([
      fetchJson<CiHealingSummary>(`${env.NEXT_PUBLIC_BACKEND_API_URL}/ci-healing/metrics/summary`),
      fetchJson<CiHealingRepositoryMetric[]>(`${env.NEXT_PUBLIC_BACKEND_API_URL}/ci-healing/metrics/repositories`),
      fetchJson<unknown>(`${env.NEXT_PUBLIC_BACKEND_API_URL}/ci-healing/runs?page=1&pageSize=20`),
    ]);

    const runs = normalizeRuns(rawRuns);
    const selectedRunId =
      requestedRunId && runs.some((run) => run.id === requestedRunId)
        ? requestedRunId
        : (runs[0]?.id ?? null);

    const selectedRunDetails = selectedRunId
      ? await fetchJson<CiHealingRunDetails | null>(`${env.NEXT_PUBLIC_BACKEND_API_URL}/ci-healing/runs/${selectedRunId}`)
      : null;

    return NextResponse.json({
      success: true,
      data: {
        summary,
        repositoryMetrics,
        runs,
        selectedRunId,
        selectedRunDetails,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load dashboard data',
      },
      { status: 502 },
    );
  }
}
