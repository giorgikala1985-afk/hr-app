-- Per-role WhatsApp notification matrix for transfer events. Mirrors
-- user_matrix's shape (delete-all + reinsert on save from the frontend).
CREATE TABLE IF NOT EXISTS notification_matrix (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  role TEXT NOT NULL,
  transfer_submitted TEXT DEFAULT 'No',
  transfer_approved TEXT DEFAULT 'No',
  transfer_rejected TEXT DEFAULT 'No',
  transfer_partial TEXT DEFAULT 'No',
  transfer_wait TEXT DEFAULT 'No'
);

CREATE INDEX IF NOT EXISTS idx_notification_matrix_user_id ON notification_matrix(user_id);

-- Let a specific team member (app_users row) link their own WhatsApp number,
-- separate from the tenant-wide bot number. NULL app_user_id keeps meaning
-- "the company owner / bot's own number" (existing behavior, unchanged).
ALTER TABLE whatsapp_links ADD COLUMN IF NOT EXISTS app_user_id UUID REFERENCES app_users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS whatsapp_links_app_user_id_idx ON whatsapp_links(app_user_id);

NOTIFY pgrst, 'reload schema';
