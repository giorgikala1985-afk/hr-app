-- Links a Telegram chat to a Datum account, and holds short-lived
-- pending actions awaiting a YES/NO confirmation from the user in chat.

CREATE TABLE IF NOT EXISTS telegram_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chat_id BIGINT UNIQUE,
  telegram_username TEXT,
  link_code TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'linked'
  code_expires_at TIMESTAMPTZ,
  linked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS telegram_links_user_id_idx ON telegram_links(user_id);
CREATE INDEX IF NOT EXISTS telegram_links_chat_id_idx ON telegram_links(chat_id);
CREATE INDEX IF NOT EXISTS telegram_links_link_code_idx ON telegram_links(link_code);

CREATE TABLE IF NOT EXISTS telegram_pending_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id BIGINT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  action_payload JSONB NOT NULL,
  summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS telegram_pending_actions_chat_id_idx ON telegram_pending_actions(chat_id);

NOTIFY pgrst, 'reload schema';
