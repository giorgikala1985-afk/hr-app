-- TBC Bank Integration Tables
-- Run this in your Supabase SQL editor

-- 1. TBC Bank Settings (company IBAN, config per user)
CREATE TABLE IF NOT EXISTS tbc_bank_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  company_iban TEXT NOT NULL,
  company_name TEXT,
  default_currency TEXT DEFAULT 'GEL',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

ALTER TABLE tbc_bank_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own bank settings"
  ON tbc_bank_settings FOR ALL
  USING (auth.uid() = user_id);

-- 2. Salary Payments (bulk payment history)
CREATE TABLE IF NOT EXISTS salary_payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  month TEXT NOT NULL,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  employee_count INTEGER NOT NULL DEFAULT 0,
  tbc_payment_id TEXT,
  status TEXT DEFAULT 'initiated',
  payment_details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE salary_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own salary payments"
  ON salary_payments FOR ALL
  USING (auth.uid() = user_id);

-- 3. Add tbc_payment_id column to accounting_invoices (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounting_invoices' AND column_name = 'tbc_payment_id'
  ) THEN
    ALTER TABLE accounting_invoices ADD COLUMN tbc_payment_id TEXT;
  END IF;
END $$;
