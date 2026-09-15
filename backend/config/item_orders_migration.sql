-- Item Orders: track recurring item purchases per company, so a rolling
-- average of the last 4 "common" orders can forecast the next order's
-- expected date and quantity. Tenant isolation is enforced at the app layer
-- (every query filters by user_id), matching the rest of this schema, so RLS
-- is disabled here rather than left half-configured.
CREATE TABLE IF NOT EXISTS item_orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  agent_id UUID REFERENCES accounting_agents(id) ON DELETE SET NULL,
  company_name TEXT,
  order_date DATE NOT NULL,
  item_name TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  is_common BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_item_orders_user_id ON item_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_item_orders_item_name ON item_orders(user_id, item_name);

ALTER TABLE item_orders DISABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
