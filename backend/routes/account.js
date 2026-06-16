const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase'); // service-role client
const { authenticateUser } = require('../middleware/auth');

function profileFromUser(u) {
  const m = u.user_metadata || {};
  return {
    id: u.id,
    email: u.email,
    first_name: m.first_name || null,
    last_name: m.last_name || null,
    phone: m.phone || null,
    company_name: m.company_name || null,
    company_id: m.company_id || null,
    created_at: u.created_at,
    last_sign_in_at: u.last_sign_in_at,
  };
}

// GET /api/account — the logged-in account's profile, plan and usage counts.
router.get('/', authenticateUser, async (req, res) => {
  try {
    const { data: authData, error } = await supabase.auth.admin.getUserById(req.userId);
    if (error || !authData?.user) return res.status(404).json({ error: 'Account not found.' });

    const [empRes, appUserRes, subRes] = await Promise.all([
      supabase.from('employees').select('id', { count: 'exact', head: true }).eq('user_id', req.userId),
      supabase.from('app_users').select('id', { count: 'exact', head: true }).eq('user_id', req.userId),
      supabase.from('subscriptions').select('*').eq('user_id', req.userId).maybeSingle(),
    ]);

    res.json({
      profile: profileFromUser(authData.user),
      counts: {
        employees: empRes.count || 0,
        team_members: appUserRes.count || 0,
      },
      subscription: subRes.data || null,
      is_owner: !req.appUserId,
    });
  } catch (err) {
    console.error('Account fetch error:', err);
    res.status(500).json({ error: err.message || 'Failed to load account.' });
  }
});

// PUT /api/account — edit profile fields (owner only). Writes to auth user_metadata.
router.put('/', authenticateUser, async (req, res) => {
  try {
    if (req.appUserId) {
      return res.status(403).json({ error: 'Only the account owner can edit the profile.' });
    }
    const { first_name, last_name, phone, company_name } = req.body;

    const { data: cur } = await supabase.auth.admin.getUserById(req.userId);
    const existing = cur?.user?.user_metadata || {};
    const merged = { ...existing };
    if (first_name !== undefined) merged.first_name = first_name;
    if (last_name !== undefined) merged.last_name = last_name;
    if (phone !== undefined) merged.phone = phone;
    if (company_name !== undefined) merged.company_name = company_name;

    const { data, error } = await supabase.auth.admin.updateUserById(req.userId, { user_metadata: merged });
    if (error) throw error;

    res.json({ profile: profileFromUser(data.user) });
  } catch (err) {
    console.error('Account update error:', err);
    res.status(500).json({ error: err.message || 'Failed to update account.' });
  }
});

module.exports = router;
