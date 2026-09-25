-- Promotion orders (Documents > Orders > Promotion) previously lived only in
-- browser localStorage -- the actual salary/position change was already
-- saved for real (via salary_changes + employees), but the order record
-- itself (old/new position, old/new salary, effective date, notes) never
-- crossed devices. This table gives it a real, cross-device home. Tenant
-- isolation is enforced at the app layer (every query filters by user_id),
-- matching the rest of this schema.
CREATE TABLE IF NOT EXISTS promotion_orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  old_position TEXT,
  new_position TEXT,
  old_salary NUMERIC,
  new_salary NUMERIC,
  effective_date DATE,
  notes TEXT,
  salary_change_id UUID,
  created_by_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_promotion_orders_user_id ON promotion_orders(user_id);

ALTER TABLE promotion_orders DISABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
