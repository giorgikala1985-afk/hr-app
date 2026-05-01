-- Add approval workflow columns to accounting_transfers
ALTER TABLE accounting_transfers
  ADD COLUMN IF NOT EXISTS requester_name TEXT,
  ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS approved_amount NUMERIC,
  ADD COLUMN IF NOT EXISTS approver_name TEXT,
  ADD COLUMN IF NOT EXISTS approver_note TEXT;

-- Backfill existing rows so they aren't stuck pending
UPDATE accounting_transfers SET approval_status = 'approved' WHERE approval_status IS NULL;
