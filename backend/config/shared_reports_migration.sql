-- Lets a user share a FinBot-generated chart with a specific teammate.
-- The chart is stored as a snapshot (the same JSON the [CHART] block already
-- produces) rather than a live query, so the recipient sees exactly what was
-- shared regardless of their own data-source permissions.

CREATE TABLE IF NOT EXISTS shared_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, -- tenant scope
  title TEXT,
  bot_name TEXT,
  chart_data JSONB NOT NULL,
  shared_by_name TEXT,
  shared_by_email TEXT,
  shared_with_email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS shared_reports_user_id_idx ON shared_reports(user_id);
CREATE INDEX IF NOT EXISTS shared_reports_shared_with_idx ON shared_reports(shared_with_email);

NOTIFY pgrst, 'reload schema';
