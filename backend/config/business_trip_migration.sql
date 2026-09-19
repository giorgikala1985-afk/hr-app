-- Business Trip orders (Documents > Orders > Business Trip) previously lived
-- only in browser localStorage -- destination, dates, per-diem, and every
-- cost receipt (as base64 file data) existed nowhere but the browser that
-- created them. These two tables give them a real, cross-device home.
-- Tenant isolation is enforced at the app layer (every query filters by
-- user_id), matching the rest of this schema.
CREATE TABLE IF NOT EXISTS business_trip_orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  group_id TEXT,
  group_name TEXT,
  from_date DATE,
  to_date DATE,
  country_code TEXT,
  country_name TEXT,
  city_name TEXT,
  per_diem NUMERIC,
  amount NUMERIC,
  days INTEGER,
  notes TEXT,
  created_by_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS business_trip_costs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  trip_id UUID NOT NULL REFERENCES business_trip_orders(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount NUMERIC,
  file_name TEXT,
  file_type TEXT,
  file_data TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_business_trip_orders_user_id ON business_trip_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_business_trip_costs_trip_id ON business_trip_costs(trip_id);

ALTER TABLE business_trip_orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE business_trip_costs DISABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
