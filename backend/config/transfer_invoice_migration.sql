-- Add invoice_raw column to accounting_transfers
-- Stores the raw rendered invoice image (base64 JPEG + mimeType) for CFO-side AI extraction
-- Run this in your Supabase SQL editor

ALTER TABLE accounting_transfers
  ADD COLUMN IF NOT EXISTS invoice_raw JSONB DEFAULT NULL;
