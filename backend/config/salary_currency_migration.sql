-- Add salary_currency and mobile_number columns to employees table
-- Run this in your Supabase SQL editor

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employees' AND column_name = 'salary_currency'
  ) THEN
    ALTER TABLE employees ADD COLUMN salary_currency TEXT DEFAULT 'GEL';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employees' AND column_name = 'mobile_number'
  ) THEN
    ALTER TABLE employees ADD COLUMN mobile_number TEXT;
  END IF;
END $$;
