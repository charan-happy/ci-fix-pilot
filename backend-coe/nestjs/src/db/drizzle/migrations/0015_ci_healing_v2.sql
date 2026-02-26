-- ─── CI Healing v2 fields ───────────────────────────────────────────────

ALTER TABLE ci_healing_runs
  ADD COLUMN IF NOT EXISTS pr_number INT,
  ADD COLUMN IF NOT EXISTS pr_state VARCHAR(30) NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS pr_branch VARCHAR(255),
  ADD COLUMN IF NOT EXISTS ai_provider VARCHAR(50) NOT NULL DEFAULT 'anthropic',
  ADD COLUMN IF NOT EXISTS ai_model VARCHAR(100),
  ADD COLUMN IF NOT EXISTS resolved_by VARCHAR(30) NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS human_note TEXT;

CREATE TABLE IF NOT EXISTS ci_healing_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES ci_healing_runs(id) ON DELETE CASCADE,
  event_type VARCHAR(100) NOT NULL,
  actor VARCHAR(30) NOT NULL DEFAULT 'system',
  message TEXT NOT NULL,
  payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ci_healing_events_run_id
  ON ci_healing_events(run_id);
CREATE INDEX IF NOT EXISTS idx_ci_healing_events_event_type
  ON ci_healing_events(event_type);
CREATE INDEX IF NOT EXISTS idx_ci_healing_events_created_at
  ON ci_healing_events(created_at);
