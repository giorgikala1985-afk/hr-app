-- Links a WhatsApp number to a Finpilot account, and holds short-lived
-- pending actions awaiting a YES/NO confirmation from the user in chat.
-- Mirrors telegram_migration.sql's telegram_links / telegram_pending_actions.

CREATE TABLE IF NOT EXISTS whatsapp_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wa_id TEXT UNIQUE, -- the linked WhatsApp phone number (E.164, no "+"), once confirmed
  wa_name TEXT,       -- WhatsApp profile display name, if provided
  link_code TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'linked'
  code_expires_at TIMESTAMPTZ,
  linked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS whatsapp_links_user_id_idx ON whatsapp_links(user_id);
CREATE INDEX IF NOT EXISTS whatsapp_links_wa_id_idx ON whatsapp_links(wa_id);
CREATE INDEX IF NOT EXISTS whatsapp_links_link_code_idx ON whatsapp_links(link_code);

CREATE TABLE IF NOT EXISTS whatsapp_pending_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wa_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  action_payload JSONB NOT NULL,
  summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS whatsapp_pending_actions_wa_id_idx ON whatsapp_pending_actions(wa_id);

NOTIFY pgrst, 'reload schema';
