-- Recurring / auto-send invoices.
-- Run this in your Supabase SQL editor.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='accounting_invoices' AND column_name='recurrence') THEN
    ALTER TABLE accounting_invoices ADD COLUMN recurrence TEXT DEFAULT 'none';   -- none | daily | weekly | monthly
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='accounting_invoices' AND column_name='auto_send') THEN
    ALTER TABLE accounting_invoices ADD COLUMN auto_send BOOLEAN DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='accounting_invoices' AND column_name='recurring_active') THEN
    ALTER TABLE accounting_invoices ADD COLUMN recurring_active BOOLEAN DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='accounting_invoices' AND column_name='next_run') THEN
    ALTER TABLE accounting_invoices ADD COLUMN next_run DATE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='accounting_invoices' AND column_name='recurring_source_id') THEN
    ALTER TABLE accounting_invoices ADD COLUMN recurring_source_id UUID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='accounting_invoices' AND column_name='last_sent_at') THEN
    ALTER TABLE accounting_invoices ADD COLUMN last_sent_at TIMESTAMPTZ;
  END IF;
END $$;
