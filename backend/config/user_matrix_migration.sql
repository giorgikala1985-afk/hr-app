-- User permission matrix table
CREATE TABLE IF NOT EXISTS user_matrix (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  role TEXT NOT NULL,
  description TEXT DEFAULT '',
  initiate_transfer TEXT DEFAULT 'No',
  approve_transfer TEXT DEFAULT 'No',
  reject_transfer TEXT DEFAULT 'No',
  view_transactions TEXT DEFAULT 'No',
  cancel_transaction TEXT DEFAULT 'No',
  set_limits TEXT DEFAULT 'No',
  manage_users TEXT DEFAULT 'No',
  audit_reports TEXT DEFAULT 'No',
  transfer_limit TEXT DEFAULT 'N/A'
);

CREATE INDEX IF NOT EXISTS idx_user_matrix_user_id ON user_matrix(user_id);
