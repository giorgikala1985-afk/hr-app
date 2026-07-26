const supabase = require('../config/supabase');

// Resolve a friendly display name for the currently authenticated request
// (for "who did this" labels — requester/approver on transfers, created_by on
// employee units, etc). Sub-users have a name in app_users; the account
// owner doesn't (no app_users row), so falls back to their raw email.
async function resolveUserName(req) {
  const email = req.user?.email;
  if (!email) return 'Unknown';
  const { data: appUser } = await supabase
    .from('app_users')
    .select('name')
    .eq('email', email)
    .maybeSingle();
  return appUser?.name || email;
}

module.exports = { resolveUserName };
