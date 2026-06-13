-- Add contact_name column to accounting_agents (Coagents) table
-- Run this in your Supabase SQL editor

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounting_agents' AND column_name = 'contact_name'
  ) THEN
    ALTER TABLE accounting_agents ADD COLUMN contact_name TEXT;
  END IF;
END $$;
