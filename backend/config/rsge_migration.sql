-- RS.ge Integration Tables
-- Run this in your Supabase SQL editor

-- 1. Employee Registration History
CREATE TABLE IF NOT EXISTS rs_employee_registrations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  employee_id UUID NOT NULL,
  personal_id TEXT NOT NULL,
  action TEXT NOT NULL, -- 'register' or 'deregister'
  rs_response JSONB,
  status TEXT DEFAULT 'pending', -- 'registered', 'deregistered', 'failed'
  action_date TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(employee_id, action)
);

ALTER TABLE rs_employee_registrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own rs registrations"
  ON rs_employee_registrations FOR ALL
  USING (auth.uid() = user_id);

-- 2. Tax Declarations
CREATE TABLE IF NOT EXISTS rs_declarations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  type TEXT NOT NULL DEFAULT 'salary', -- 'salary', 'vat', etc.
  period TEXT NOT NULL, -- YYYY-MM
  employee_count INTEGER DEFAULT 0,
  total_gross NUMERIC(12,2) DEFAULT 0,
  total_tax NUMERIC(12,2) DEFAULT 0,
  total_pension NUMERIC(12,2) DEFAULT 0,
  rs_declaration_id TEXT,
  status TEXT DEFAULT 'draft', -- 'draft', 'submitted', 'accepted', 'rejected'
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE rs_declarations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own rs declarations"
  ON rs_declarations FOR ALL
  USING (auth.uid() = user_id);

-- 3. Waybills (ზედნადები)
CREATE TABLE IF NOT EXISTS rs_waybills (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  rs_waybill_id TEXT,
  buyer_tin TEXT,
  buyer_name TEXT,
  start_address TEXT,
  end_address TEXT,
  driver_name TEXT,
  vehicle_plate TEXT,
  total_amount NUMERIC(12,2) DEFAULT 0,
  item_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'saved', -- 'saved', 'active', 'closed', 'deleted'
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE rs_waybills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own rs waybills"
  ON rs_waybills FOR ALL
  USING (auth.uid() = user_id);

-- 4. E-Invoices (ელექტრონული ანგარიშ-ფაქტურა)
CREATE TABLE IF NOT EXISTS rs_einvoices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  rs_invoice_id TEXT,
  local_invoice_id UUID, -- link to accounting_invoices
  buyer_tin TEXT,
  buyer_name TEXT,
  invoice_date TEXT,
  total_amount NUMERIC(12,2) DEFAULT 0,
  total_vat NUMERIC(12,2) DEFAULT 0,
  item_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'created', -- 'created', 'sent', 'confirmed', 'deleted'
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE rs_einvoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own rs einvoices"
  ON rs_einvoices FOR ALL
  USING (auth.uid() = user_id);

-- 5. Add rs_invoice_id column to accounting_invoices (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounting_invoices' AND column_name = 'rs_invoice_id'
  ) THEN
    ALTER TABLE accounting_invoices ADD COLUMN rs_invoice_id TEXT;
  END IF;
END $$;
