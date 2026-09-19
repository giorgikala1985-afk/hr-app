-- Handover orders (Documents > Orders > Handover) previously lived only in
-- browser localStorage with no backend record at all -- this table gives
-- them a real, cross-device home. Tenant isolation is enforced at the app
-- layer (every query filters by user_id), matching the rest of this schema.
CREATE TABLE IF NOT EXISTS handover_orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  from_employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  to_employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  handover_date DATE,
  items TEXT,
  notes TEXT,
  created_by_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_handover_orders_user_id ON handover_orders(user_id);

ALTER TABLE handover_orders DISABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
