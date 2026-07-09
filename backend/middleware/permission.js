const supabase = require('../config/supabase');

const checkPermission = (permissionKey) => async (req, res, next) => {
  try {
    let role = req.userRights;

    // For Supabase-authenticated users, look up their role from app_users.
    // Sub-users are stored with the OWNER's user_id, so query by email only.
    if (!role) {
      const { data: appUser } = await supabase
        .from('app_users')
        .select('rights, user_id')
        .eq('email', req.user?.email)
        .maybeSingle();
      if (appUser) {
        role = appUser.rights;
        // Fix req.userId so the matrix lookup uses the owner's userId (consistent with member-login path)
        req.userId = appUser.user_id;
      }
      // If still no role found, this is the company owner (Super Admin) — allow
      if (!role) return next();
    }

    console.log(`[permission] Checking ${permissionKey} for role "${role}" (user_id: ${req.userId})`);

    const { data: rows, error } = await supabase
      .from('user_matrix')
      .select('*')
      .eq('user_id', req.userId)
      .eq('role', role)
      .order('sort_order', { ascending: true })
      .limit(1);

    if (error) {
      console.error('[permission] DB error:', error);
      return res.status(500).json({ error: `Permission check failed: ${error.message}` });
    }

    const data = rows && rows[0];
    console.log(`[permission] Matrix row:`, data);

    // No matrix row for this role → treat as not permitted (safe default)
    if (!data) {
      return res.status(403).json({ error: `Your role "${role}" is not permitted to perform this action.` });
    }

    const value = data[permissionKey];
    if (value === 'No' || value == null) {
      return res.status(403).json({ error: `Your role "${role}" is not permitted to perform this action.` });
    }

    req.permissionValue = value;
    req.resolvedRole = role;
    next();
  } catch (err) {
    console.error('[permission] middleware error:', err);
    res.status(500).json({ error: `Permission check failed: ${err.message}` });
  }
};

module.exports = { checkPermission };
