-- Add iban and invoice_number columns to accounting_transfers
-- Run this in your Supabase SQL editor

ALTER TABLE accounting_transfers
  ADD COLUMN IF NOT EXISTS iban TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS invoice_number TEXT DEFAULT NULL;
