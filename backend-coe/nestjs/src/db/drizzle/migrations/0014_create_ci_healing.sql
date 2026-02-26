-- ─── CI Healing Runs ──────────────────────────────────────────────────────

CREATE TABLE ci_healing_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider VARCHAR(50) NOT NULL DEFAULT 'generic',
  repository VARCHAR(500) NOT NULL,
  branch VARCHAR(255) NOT NULL,
  commit_sha VARCHAR(100) NOT NULL,
  pipeline_url TEXT,
  error_hash VARCHAR(128) NOT NULL,
  error_type VARCHAR(100),
  error_summary TEXT NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'queued',
  attempt_count INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 3,
  pr_url TEXT,
  escalation_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_ci_healing_runs_dedupe
  ON ci_healing_runs(repository, commit_sha, error_hash);
CREATE INDEX idx_ci_healing_runs_status ON ci_healing_runs(status);
CREATE INDEX idx_ci_healing_runs_updated_at ON ci_healing_runs(updated_at);

-- ─── CI Healing Attempts ──────────────────────────────────────────────────

CREATE TABLE ci_healing_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES ci_healing_runs(id) ON DELETE CASCADE,
  attempt_no INT NOT NULL,
  status VARCHAR(30) NOT NULL,
  diagnosis TEXT,
  proposed_fix TEXT,
  validation_log TEXT,
  failure_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_ci_healing_attempts_run_attempt
  ON ci_healing_attempts(run_id, attempt_no);
CREATE INDEX idx_ci_healing_attempts_status ON ci_healing_attempts(status);
