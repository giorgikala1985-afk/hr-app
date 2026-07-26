-- Adds a "who created this" label to employee_units so the Journal page can
-- show it for Adjustment/Advance entries, same as order_log already does for
-- bot-created hire/fire/promotion events.

ALTER TABLE employee_units ADD COLUMN IF NOT EXISTS created_by_name TEXT;

NOTIFY pgrst, 'reload schema';
