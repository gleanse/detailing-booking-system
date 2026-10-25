ALTER TABLE users
  ADD COLUMN IF NOT EXISTS active_session_id TEXT,
  ADD COLUMN IF NOT EXISTS active_session_expires TIMESTAMPTZ;