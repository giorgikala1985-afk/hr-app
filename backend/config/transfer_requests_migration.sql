-- Transfer approval requests table
-- Run this in your Supabase SQL editor

CREATE TABLE IF NOT EXISTS transfer_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  requester_name TEXT NOT NULL,
  amount NUMERIC(14, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'GEL',
  recipient_name TEXT NOT NULL,
  recipient_account TEXT,
  description TEXT,
  approval_status TEXT NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  rejection_reason TEXT,
  approved_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transfer_requests_user_id ON transfer_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_transfer_requests_status ON transfer_requests(approval_status);
