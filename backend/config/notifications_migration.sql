-- Add requester_email to transfers for notification routing
ALTER TABLE accounting_transfers ADD COLUMN IF NOT EXISTS requester_email TEXT;

-- Notifications table
CREATE TABLE IF NOT EXISTS app_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  recipient_email text NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  reference_id text,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_app_notifications_lookup
  ON app_notifications (user_id, recipient_email, is_read, created_at DESC);

NOTIFY pgrst, 'reload schema';
