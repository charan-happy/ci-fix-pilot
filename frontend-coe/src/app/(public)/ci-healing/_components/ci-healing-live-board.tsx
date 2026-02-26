'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CiHealingActions } from '@/app/(public)/ci-healing/_components/ci-healing-actions';

type CiHealingRunStatus = 'queued' | 'running' | 'fixed' | 'escalated' | 'aborted' | 'resolved';

interface CiHealingRun {
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

interface WrappedResponse<T> {
  data: T;
}

interface DashboardPayload {
  summary: CiHealingSummary;
  repositoryMetrics: CiHealingRepositoryMetric[];
  runs: CiHealingRun[];
  selectedRunId: string | null;
  selectedRunDetails: CiHealingRunDetails | null;
}

interface StreamControlMessage {
  type: 'stream.connected' | 'stream.heartbeat';
  runId: string | null;
  timestamp: string;
}

interface StreamCiHealingEventMessage {
  id?: string;
  runId: string;
  eventType: string;
  actor: string;
  message: string;
  payload: unknown;
  createdAt: string;
}

function badgeVariant(status: CiHealingRunStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'fixed') return 'default';
  if (status === 'escalated') return 'destructive';
  if (status === 'running') return 'secondary';
  return 'outline';
}

function attemptBadgeVariant(status: 'running' | 'failed' | 'succeeded'): 'default' | 'secondary' | 'destructive' {
  if (status === 'succeeded') return 'default';
  if (status === 'failed') return 'destructive';
  return 'secondary';
}

function eventBadgeVariant(eventType: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  const normalizedType = eventType.toLowerCase();
  if (normalizedType.includes('failed') || normalizedType.includes('error') || normalizedType.includes('escalate')) {
    return 'destructive';
  }
  if (normalizedType.includes('result') || normalizedType.includes('succeed') || normalizedType.includes('fixed')) {
    return 'default';
  }
  if (normalizedType.includes('decision') || normalizedType.includes('thinking')) {
    return 'secondary';
  }
  return 'outline';
}

function shortSha(sha: string): string {
  return sha.slice(0, 8);
}

function formatClock(dateString: string): string {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '--:--:--';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}

function formatDurationFromSeconds(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return '0s';
  if (totalSeconds < 60) return `${Math.round(totalSeconds)}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.round(totalSeconds % 60);
  return `${minutes}m ${seconds}s`;
}

function estimateRunDurationSeconds(events: CiHealingEvent[], updatedAt: string): number {
  const timestamps = events
    .map((event) => new Date(event.createdAt).getTime())
    .filter((value) => Number.isFinite(value));

  if (timestamps.length > 1) {
    return Math.max(0, (Math.max(...timestamps) - Math.min(...timestamps)) / 1000);
  }

  const updatedTimestamp = new Date(updatedAt).getTime();
  if (!Number.isFinite(updatedTimestamp) || timestamps.length === 0) {
    return 0;
  }

  return Math.max(0, (updatedTimestamp - timestamps[0]!) / 1000);
}

function stringifyPayload(payload: unknown): string | null {
  if (payload === null || payload === undefined) return null;
  if (typeof payload === 'string') return payload.trim().length > 0 ? payload : null;
  if (typeof payload === 'number' || typeof payload === 'boolean') return String(payload);
  if (typeof payload === 'object') {
    try {
      return JSON.stringify(payload, null, 2);
    } catch {
      return null;
    }
  }
  return null;
}

function unwrap<T>(payload: WrappedResponse<T> | T): T {
  if (typeof payload === 'object' && payload !== null && 'data' in payload) {
    return (payload as WrappedResponse<T>).data;
  }
  return payload as T;
}

function isStreamCiHealingEventMessage(payload: unknown): payload is StreamCiHealingEventMessage {
  if (!payload || typeof payload !== 'object') {
    return false;
  }

  const candidate = payload as Record<string, unknown>;

  return (
    typeof candidate['runId'] === 'string' &&
    typeof candidate['eventType'] === 'string' &&
    typeof candidate['actor'] === 'string' &&
    typeof candidate['message'] === 'string' &&
    typeof candidate['createdAt'] === 'string'
  );
}

function readRunStatusFromPayload(payload: unknown): CiHealingRunStatus | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const rawStatus = (payload as Record<string, unknown>)['status'];
  if (
    rawStatus === 'queued' ||
    rawStatus === 'running' ||
    rawStatus === 'fixed' ||
    rawStatus === 'escalated' ||
    rawStatus === 'aborted' ||
    rawStatus === 'resolved'
  ) {
    return rawStatus;
  }

  return null;
}

async function fetchDashboard(runId?: string | null): Promise<DashboardPayload> {
  const query = runId ? `?runId=${encodeURIComponent(runId)}` : '';
  const response = await fetch(`/api/ci-healing/dashboard${query}`, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error('Failed to fetch live dashboard data');
  }

  const payload = (await response.json()) as
    | WrappedResponse<DashboardPayload>
    | { success?: boolean; data?: DashboardPayload };

  if ('success' in payload && payload.success === true && payload.data) {
    return payload.data;
  }

  return unwrap(payload as WrappedResponse<DashboardPayload> | DashboardPayload);
}

export function CiHealingLiveBoard() {
  const [summary, setSummary] = useState<CiHealingSummary | null>(null);
  const [repositoryMetrics, setRepositoryMetrics] = useState<CiHealingRepositoryMetric[]>([]);
  const [runs, setRuns] = useState<CiHealingRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [selectedRunDetails, setSelectedRunDetails] = useState<CiHealingRunDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLiveConnected, setIsLiveConnected] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

  const selectedRunDuration = useMemo(() => {
    if (!selectedRunDetails) return '0s';
    return formatDurationFromSeconds(
      estimateRunDurationSeconds(selectedRunDetails.events, selectedRunDetails.run.updatedAt),
    );
  }, [selectedRunDetails]);

  const refreshDashboard = useCallback(async (preserveSelectionId?: string | null) => {
    try {
      setIsRefreshing(true);
      setErrorMessage(null);

      const data = await fetchDashboard(preserveSelectionId ?? selectedRunId);

      setSummary(data.summary);
      setRepositoryMetrics(data.repositoryMetrics);
      setRuns(data.runs);
      setSelectedRunId(data.selectedRunId);
      setSelectedRunDetails(data.selectedRunDetails);

      setLastUpdatedAt(new Date());
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to refresh dashboard');
    } finally {
      setIsRefreshing(false);
      setIsLoading(false);
    }
  }, [selectedRunId]);

  const selectRun = useCallback(async (runId: string) => {
    setSelectedRunId(runId);
    const data = await fetchDashboard(runId);
    setSummary(data.summary);
    setRepositoryMetrics(data.repositoryMetrics);
    setRuns(data.runs);
    setSelectedRunDetails(data.selectedRunDetails);
    setLastUpdatedAt(new Date());
  }, []);

  useEffect(() => {
    void refreshDashboard();
  }, [refreshDashboard]);

  useEffect(() => {
    const backendApiBase = process.env.NEXT_PUBLIC_BACKEND_API_URL;
    if (!backendApiBase) {
      setIsLiveConnected(false);
      return;
    }

    const streamUrl = selectedRunId
      ? `${backendApiBase}/ci-healing/stream?runId=${encodeURIComponent(selectedRunId)}`
      : `${backendApiBase}/ci-healing/stream`;

    const eventSource = new EventSource(streamUrl);

    eventSource.onopen = () => {
      setIsLiveConnected(true);
    };

    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as StreamControlMessage | StreamCiHealingEventMessage;

        if ('type' in payload) {
          if (payload.type === 'stream.connected') {
            setIsLiveConnected(true);
          }

          return;
        }

        if (!isStreamCiHealingEventMessage(payload)) {
          return;
        }

        const incomingEventId = payload.id ?? `${payload.runId}-${payload.eventType}-${payload.createdAt}`;
        const normalizedEvent: CiHealingEvent = {
          id: incomingEventId,
          eventType: payload.eventType,
          actor: payload.actor,
          message: payload.message,
          payload: payload.payload,
          createdAt: payload.createdAt,
        };

        setLastUpdatedAt(new Date());

        setRuns((currentRuns) => {
          const index = currentRuns.findIndex((run) => run.id === payload.runId);
          if (index === -1) {
            return currentRuns;
          }

          const updatedRun = {
            ...currentRuns[index],
            updatedAt: payload.createdAt,
            status: readRunStatusFromPayload(payload.payload) ?? currentRuns[index]!.status,
          };

          const nextRuns = [...currentRuns];
          nextRuns.splice(index, 1);
          nextRuns.unshift(updatedRun);
          return nextRuns;
        });

        setSelectedRunDetails((currentDetails) => {
          if (!currentDetails || currentDetails.run.id !== payload.runId) {
            return currentDetails;
          }

          if (currentDetails.events.some((item) => item.id === incomingEventId)) {
            return currentDetails;
          }

          const updatedStatus = readRunStatusFromPayload(payload.payload);

          return {
            ...currentDetails,
            run: {
              ...currentDetails.run,
              status: updatedStatus ?? currentDetails.run.status,
              updatedAt: payload.createdAt,
            },
            events: [normalizedEvent, ...currentDetails.events],
          };
        });

        void refreshDashboard(selectedRunId);
      } catch {
        void refreshDashboard(selectedRunId);
      }
    };

    eventSource.onerror = () => {
      setIsLiveConnected(false);
    };

    return () => {
      setIsLiveConnected(false);
      eventSource.close();
    };
  }, [refreshDashboard, selectedRunId]);

  const totalWorkers = 3;

  return (
    <div className="container mx-auto py-6">
      <Card className="overflow-hidden border">
        <CardHeader className="border-b pb-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <CardTitle className="text-2xl">🚀 PatchPilot</CardTitle>
              <CardDescription>Autonomous Self-Healing CI/CD</CardDescription>
            </div>

            <div className="flex items-center gap-2">
              <div className="text-muted-foreground flex items-center gap-2 text-xs">
                <span
                  className={`inline-flex h-2.5 w-2.5 rounded-full ${
                    isRefreshing
                      ? 'bg-primary animate-pulse'
                      : isLiveConnected
                        ? 'bg-emerald-500'
                        : 'bg-amber-500'
                  }`}
                />
                <span>{isRefreshing ? 'Syncing…' : isLiveConnected ? 'Live Stream' : 'Reconnecting…'}</span>
                <span>•</span>
                <span>
                  {lastUpdatedAt ? `Updated ${formatClock(lastUpdatedAt.toISOString())}` : 'Waiting for first sync'}
                  {selectedRunId ? ' · scoped' : ' · all-runs'}
                </span>
              </div>
              <Badge variant="secondary">{summary?.running ?? 0} Active</Badge>
              <Badge variant="outline">{summary?.queued ?? 0} Queued</Badge>
              <Badge variant="outline">{totalWorkers} Workers</Badge>
              <Button asChild variant="outline" size="sm">
                <Link href="/">Dashboard</Link>
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 md:p-6">
          {errorMessage ? (
            <div className="mb-4 rounded-md border border-destructive/50 px-3 py-2 text-sm text-destructive">
              {errorMessage}
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
            <Card className="xl:col-span-3">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-sm tracking-wide uppercase">Healing Jobs</CardTitle>
                  <Button size="sm" variant="secondary" onClick={() => void refreshDashboard(selectedRunId)}>
                    Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[560px] pr-2">
                  <div className="space-y-3">
                    {runs.map((run) => (
                      <button
                        key={run.id}
                        type="button"
                        onClick={() => void selectRun(run.id)}
                        className={`w-full rounded-lg border p-3 text-left transition hover:border-primary/70 ${selectedRunId === run.id ? 'border-primary' : ''}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-semibold">{run.repository}</p>
                          <Badge variant={badgeVariant(run.status)} className="uppercase">
                            {run.status}
                          </Badge>
                        </div>
                        <p className="text-muted-foreground mt-1 text-xs">
                          {run.errorType ?? 'workflow_failure'} · {run.attemptCount}/{run.maxAttempts} attempts
                        </p>
                        <p className="text-muted-foreground mt-1 text-xs">
                          {run.branch} · {shortSha(run.commitSha)}
                        </p>
                      </button>
                    ))}

                    {!isLoading && runs.length === 0 ? (
                      <p className="text-muted-foreground text-sm">No CI healing jobs found.</p>
                    ) : null}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            <Card className="xl:col-span-6">
              <CardHeader className="pb-3">
                {!selectedRunDetails ? (
                  <>
                    <CardTitle className="text-lg">Run details</CardTitle>
                    <CardDescription>No active run selected yet.</CardDescription>
                  </>
                ) : (
                  <>
                    <CardTitle className="text-lg">{selectedRunDetails.run.repository}</CardTitle>
                    <CardDescription>
                      Job ID: {selectedRunDetails.run.id.slice(0, 8)} · {selectedRunDetails.run.branch} · {shortSha(selectedRunDetails.run.commitSha)}
                    </CardDescription>
                  </>
                )}
              </CardHeader>

              <CardContent>
                {!selectedRunDetails ? (
                  <p className="text-muted-foreground text-sm">{isLoading ? 'Loading runs…' : 'No run details available yet.'}</p>
                ) : (
                  <div className="space-y-4">
                    <CiHealingActions runId={selectedRunDetails.run.id} />

                    <div className="rounded-lg border p-3">
                      <p className="text-sm font-medium">Error Summary</p>
                      <p className="text-muted-foreground mt-1 text-sm">{selectedRunDetails.run.errorSummary}</p>
                      <p className="text-muted-foreground mt-2 text-xs">
                        provider: {selectedRunDetails.run.provider} · resolver: {selectedRunDetails.run.resolvedBy ?? 'none'}
                        {selectedRunDetails.run.prNumber ? ` · PR #${selectedRunDetails.run.prNumber}` : ''}
                        {selectedRunDetails.run.prState ? ` · ${selectedRunDetails.run.prState}` : ''}
                      </p>
                    </div>

                    <div className="space-y-3">
                      {selectedRunDetails.attempts.map((attempt) => (
                        <div key={attempt.id} className="rounded-lg border p-3">
                          <div className="mb-2 flex items-center justify-between">
                            <p className="text-sm font-semibold">Attempt #{attempt.attemptNo}</p>
                            <Badge variant={attemptBadgeVariant(attempt.status)}>{attempt.status}</Badge>
                          </div>

                          {attempt.diagnosis ? (
                            <div className="mb-2 rounded-md border p-2">
                              <p className="mb-1 text-xs font-medium uppercase tracking-wide">Diagnosis</p>
                              <p className="text-muted-foreground text-sm whitespace-pre-wrap">{attempt.diagnosis}</p>
                            </div>
                          ) : null}

                          {attempt.proposedFix ? (
                            <div className="mb-2 rounded-md border p-2">
                              <p className="mb-1 text-xs font-medium uppercase tracking-wide">Proposed fix</p>
                              <p className="text-muted-foreground text-sm whitespace-pre-wrap">{attempt.proposedFix}</p>
                            </div>
                          ) : null}

                          {attempt.validationLog ? (
                            <div className="rounded-md border p-2">
                              <p className="mb-1 text-xs font-medium uppercase tracking-wide">Validation output</p>
                              <pre className="text-muted-foreground max-h-36 overflow-auto text-xs whitespace-pre-wrap">
                                {attempt.validationLog}
                              </pre>
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>

                    <div>
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold">Agent Thinking Timeline</p>
                        <Badge variant="outline">live</Badge>
                      </div>
                      <ScrollArea className="h-[340px] pr-2">
                        <div className="space-y-2">
                          {selectedRunDetails.events.map((event) => {
                            const payloadText = stringifyPayload(event.payload);

                            return (
                              <div key={event.id} className="rounded-lg border p-3">
                                <div className="mb-1 flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    <Badge variant={eventBadgeVariant(event.eventType)}>{event.eventType}</Badge>
                                    <Badge variant="outline" className="max-w-[160px] truncate">
                                      {event.actor}
                                    </Badge>
                                  </div>
                                  <span className="text-muted-foreground text-xs">{formatClock(event.createdAt)}</span>
                                </div>

                                <p className="text-sm">{event.message}</p>

                                {payloadText ? (
                                  <pre className="bg-muted/40 text-muted-foreground mt-2 max-h-48 overflow-auto rounded-md border p-2 text-xs whitespace-pre-wrap">
                                    {payloadText}
                                  </pre>
                                ) : null}
                              </div>
                            );
                          })}

                          {selectedRunDetails.events.length === 0 ? (
                            <p className="text-muted-foreground text-sm">No timeline events available.</p>
                          ) : null}
                        </div>
                      </ScrollArea>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="space-y-4 xl:col-span-3">
              <div className="grid grid-cols-2 gap-3">
                <Card>
                  <CardHeader className="space-y-1 p-4">
                    <CardTitle className="text-3xl font-semibold">{summary?.fixed ?? 0}</CardTitle>
                    <CardDescription className="text-xs uppercase tracking-wide">Auto-Fixed</CardDescription>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="space-y-1 p-4">
                    <CardTitle className="text-3xl font-semibold">{summary?.aiSuccessRate ?? 0}%</CardTitle>
                    <CardDescription className="text-xs uppercase tracking-wide">Fix Rate</CardDescription>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="space-y-1 p-4">
                    <CardTitle className="text-3xl font-semibold">{selectedRunDuration}</CardTitle>
                    <CardDescription className="text-xs uppercase tracking-wide">Run Time</CardDescription>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="space-y-1 p-4">
                    <CardTitle className="text-3xl font-semibold">{summary?.escalated ?? 0}</CardTitle>
                    <CardDescription className="text-xs uppercase tracking-wide">Escalated</CardDescription>
                  </CardHeader>
                </Card>
              </div>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm uppercase tracking-wide">All Repos — Live Board</CardTitle>
                  <CardDescription className="text-xs">Realtime push stream updates</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {repositoryMetrics.map((metric) => (
                      <div key={metric.repository} className="rounded-lg border p-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-medium">{metric.repository}</p>
                          <Badge variant={metric.aiSuccessRate >= 80 ? 'default' : 'secondary'}>
                            {metric.aiSuccessRate}%
                          </Badge>
                        </div>
                        <p className="text-muted-foreground mt-1 text-xs">
                          fixed: {metric.fixed} · escalated: {metric.escalated} · total: {metric.total}
                        </p>
                      </div>
                    ))}

                    {repositoryMetrics.length === 0 ? (
                      <p className="text-muted-foreground text-sm">No repository metrics yet.</p>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
