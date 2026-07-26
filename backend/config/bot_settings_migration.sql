-- Per-channel control center: which data sources the Telegram/WhatsApp bot
-- is allowed to pull from when answering questions or suggesting actions.
-- One row per (user_id, channel) — applies to every chat linked to that
-- account on that channel.

CREATE TABLE IF NOT EXISTS bot_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel TEXT NOT NULL, -- 'telegram' | 'whatsapp'
  data_sources JSONB NOT NULL DEFAULT '["employees","coagents"]',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, channel)
);

CREATE INDEX IF NOT EXISTS bot_settings_user_id_idx ON bot_settings(user_id);

NOTIFY pgrst, 'reload schema';
