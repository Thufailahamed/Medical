-- Day 1: AI safety floor.
--
-- Generic counter table for AI guardrails. Two scopes use it today:
--   * user:<userId>:hour:<YYYY-MM-DD-HH>      — per-user rate limit on /ai/*
--   * anthropic:day:<YYYY-MM-DD>             — daily cap on Anthropic fallback calls
--
-- Composite primary key lets us UPSERT atomically (INSERT ... ON CONFLICT
-- DO UPDATE SET count = count + 1 RETURNING count). Old buckets are
-- auto-pruned by the cron; we keep 30 days here.
CREATE TABLE IF NOT EXISTS ai_counters (
  scope text PRIMARY KEY,
  count integer NOT NULL DEFAULT 0,
  updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_counters_updated
  ON ai_counters(updated_at);