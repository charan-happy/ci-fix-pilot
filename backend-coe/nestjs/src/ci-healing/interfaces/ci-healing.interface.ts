export type CiHealingRunStatus =
  | 'queued'
  | 'running'
  | 'fixed'
  | 'escalated'
  | 'aborted'
  | 'resolved';

export type CiHealingPrState = 'none' | 'open' | 'merged' | 'closed';

export type CiHealingResolvedBy = 'none' | 'ai' | 'human' | 'user';

export type CiHealingAttemptStatus = 'running' | 'failed' | 'succeeded';

export type CiHealingRunAction = 'approve' | 'deny' | 'abort' | 'human-fix';

export interface CiHealingRunRecord {
  id: string;
  provider: string;
  repository: string;
  branch: string;
  commitSha: string;
  pipelineUrl: string | null;
  errorHash: string;
  errorType: string | null;
  errorSummary: string;
  status: CiHealingRunStatus;
  attemptCount: number;
  maxAttempts: number;
  prUrl: string | null;
  prNumber: number | null;
  prState: CiHealingPrState;
  prBranch: string | null;
  aiProvider: string;
  aiModel: string | null;
  resolvedBy: CiHealingResolvedBy;
  humanNote: string | null;
  escalationReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CiHealingAttemptRecord {
  id: string;
  runId: string;
  attemptNo: number;
  status: CiHealingAttemptStatus;
  diagnosis: string | null;
  proposedFix: string | null;
  validationLog: string | null;
  failureReason: string | null;
  createdAt: Date;
}

export interface CiHealingEventRecord {
  id: string;
  runId: string;
  eventType: string;
  actor: string;
  message: string;
  payload: unknown;
  createdAt: Date;
}

export interface CreateCiHealingRunData {
  provider: string;
  repository: string;
  branch: string;
  commitSha: string;
  pipelineUrl?: string;
  errorHash: string;
  errorType?: string;
  errorSummary: string;
  maxAttempts: number;
  aiProvider?: string;
  aiModel?: string;
}

export interface CreateCiHealingAttemptData {
  runId: string;
  attemptNo: number;
  status: CiHealingAttemptStatus;
  diagnosis?: string;
  proposedFix?: string;
  validationLog?: string;
  failureReason?: string;
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

export interface CiHealingRepositoryMetric {
  repository: string;
  total: number;
  fixed: number;
  escalated: number;
  resolved: number;
  aborted: number;
  aiSuccessRate: number;
}
