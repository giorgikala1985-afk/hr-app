-- Records real hire/fire/promotion events so they can be shown in the
-- Journal page regardless of which channel created them (Telegram, WhatsApp,
-- or future non-browser sources). The web app's own Orders.js tabs still
-- keep their separate localStorage-based paper trail for now — this table
-- exists specifically to make bot-originated events visible there too.

CREATE TABLE IF NOT EXISTS order_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'hiring' | 'firing' | 'promotion'
  payload JSONB NOT NULL,
  source TEXT DEFAULT 'bot',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS order_log_user_id_idx ON order_log(user_id);
CREATE INDEX IF NOT EXISTS order_log_type_idx ON order_log(type);

NOTIFY pgrst, 'reload schema';
