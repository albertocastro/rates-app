-- Refi Radar Initial Schema
-- Run this migration in Vercel Postgres console or via CLI

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (Auth.js compatible)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT,
  email TEXT NOT NULL UNIQUE,
  email_verified TIMESTAMP,
  image TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Auth.js Accounts table
CREATE TABLE IF NOT EXISTS accounts (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_account_id TEXT NOT NULL,
  refresh_token TEXT,
  access_token TEXT,
  expires_at INTEGER,
  token_type TEXT,
  scope TEXT,
  id_token TEXT,
  session_state TEXT,
  PRIMARY KEY (provider, provider_account_id)
);

-- Auth.js Sessions table
CREATE TABLE IF NOT EXISTS sessions (
  session_token TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires TIMESTAMP NOT NULL
);

-- Auth.js Verification Tokens table
CREATE TABLE IF NOT EXISTS verification_tokens (
  identifier TEXT NOT NULL,
  token TEXT NOT NULL,
  expires TIMESTAMP NOT NULL,
  PRIMARY KEY (identifier, token)
);

-- Onboarding Profiles
CREATE TABLE IF NOT EXISTS onboarding_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  loan_balance DECIMAL(12, 2) NOT NULL,
  current_rate DECIMAL(5, 4) NOT NULL,
  remaining_term_months INTEGER NOT NULL,
  expected_time_in_home_years INTEGER NOT NULL,
  closing_cost_dollars DECIMAL(10, 2),
  closing_cost_percent DECIMAL(5, 4),
  benchmark_rate_threshold DECIMAL(5, 4),
  break_even_months_threshold INTEGER,
  email_alerts_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Monitor Sessions
CREATE TABLE IF NOT EXISTS monitor_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'stopped', 'error')),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP,
  last_check_at TIMESTAMP,
  last_success_at TIMESTAMP,
  last_error TEXT,
  cooldown_until TIMESTAMP,
  threshold_version INTEGER NOT NULL DEFAULT 1,
  active_workflow_id TEXT,
  trigger_metadata JSONB
);

CREATE INDEX IF NOT EXISTS monitor_sessions_user_id_idx ON monitor_sessions(user_id);

-- Rate Snapshots
CREATE TABLE IF NOT EXISTS rate_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  series TEXT NOT NULL,
  snapshot_date TIMESTAMP NOT NULL,
  value DECIMAL(5, 4) NOT NULL,
  fetched_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS rate_snapshots_series_date_idx ON rate_snapshots(series, snapshot_date);

-- Evaluation Runs
CREATE TABLE IF NOT EXISTS evaluation_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES monitor_sessions(id) ON DELETE CASCADE,
  ran_at TIMESTAMP NOT NULL DEFAULT NOW(),
  outcome TEXT NOT NULL CHECK (outcome IN ('triggered', 'not_triggered', 'error')),
  computed_metrics JSONB,
  triggered_reason TEXT,
  notified_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS evaluation_runs_session_id_idx ON evaluation_runs(session_id);

-- Alert Events
CREATE TABLE IF NOT EXISTS alert_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES monitor_sessions(id) ON DELETE CASCADE,
  dedupe_key TEXT NOT NULL UNIQUE,
  sent_at TIMESTAMP NOT NULL DEFAULT NOW(),
  subject TEXT NOT NULL,
  body_preview TEXT,
  email_id TEXT
);

CREATE INDEX IF NOT EXISTS alert_events_session_id_idx ON alert_events(session_id);
CREATE UNIQUE INDEX IF NOT EXISTS alert_events_dedupe_key_idx ON alert_events(dedupe_key);

-- Helper function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for onboarding_profiles updated_at
DROP TRIGGER IF EXISTS update_onboarding_profiles_updated_at ON onboarding_profiles;
CREATE TRIGGER update_onboarding_profiles_updated_at
    BEFORE UPDATE ON onboarding_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
