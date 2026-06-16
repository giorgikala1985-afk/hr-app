-- Subscriptions / billing table for Finpilot (per-company billing + admin controls).
-- The table did not exist yet, so this creates it with all columns the app uses.
-- Run this in your Supabase SQL editor.

CREATE TABLE IF NOT EXISTS subscriptions (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  status               text NOT NULL DEFAULT 'none',   -- none | pending | active | expired | failed | canceled
  amount               numeric,
  currency             text DEFAULT 'GEL',
  plan                 text,
  tbc_pay_id           text,
  current_period_start timestamptz,
  current_period_end   timestamptz,
  -- Auto-charge (Phase 2)
  auto_charge          boolean DEFAULT false,
  tbc_recurring_id     text,
  card_mask            text,
  next_charge_date     date,
  created_at           timestamptz DEFAULT now(),
  updated_at           timestamptz DEFAULT now()
);

-- If the table already existed (partial), make sure the newer columns are present.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='subscriptions' AND column_name='amount') THEN
    ALTER TABLE subscriptions ADD COLUMN amount NUMERIC; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='subscriptions' AND column_name='currency') THEN
    ALTER TABLE subscriptions ADD COLUMN currency TEXT DEFAULT 'GEL'; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='subscriptions' AND column_name='plan') THEN
    ALTER TABLE subscriptions ADD COLUMN plan TEXT; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='subscriptions' AND column_name='auto_charge') THEN
    ALTER TABLE subscriptions ADD COLUMN auto_charge BOOLEAN DEFAULT false; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='subscriptions' AND column_name='tbc_recurring_id') THEN
    ALTER TABLE subscriptions ADD COLUMN tbc_recurring_id TEXT; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='subscriptions' AND column_name='card_mask') THEN
    ALTER TABLE subscriptions ADD COLUMN card_mask TEXT; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='subscriptions' AND column_name='next_charge_date') THEN
    ALTER TABLE subscriptions ADD COLUMN next_charge_date DATE; END IF;
END $$;

-- RLS on; all app access is via the backend using the service-role key (which bypasses RLS).
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
