const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { authenticateUser } = require('../middleware/auth');

// Guard: if ADMIN_EMAILS is set, restrict to those emails; otherwise allow any authenticated user
const adminGuard = (req, res, next) => {
  const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
  if (adminEmails.length > 0 && !adminEmails.includes((req.user?.email || '').toLowerCase())) {
    return res.status(403).json({ error: 'Access denied.' });
  }
  next();
};

// GET /api/admin/companies
// Returns all registered auth users (= companies) with their stats
router.get('/companies', authenticateUser, adminGuard, async (req, res) => {
  try {
    // Fetch all auth users via admin API
    const { data: authData, error: authError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    if (authError) return res.status(500).json({ error: authError.message });

    const users = authData.users || [];

    // Get employee counts per user_id
    const { data: empRows } = await supabase
      .from('employees')
      .select('user_id');

    // Get app_users counts per user_id
    const { data: appUserRows } = await supabase
      .from('app_users')
      .select('user_id, name, email, rights');

    // Build lookup maps
    const empCount = {};
    (empRows || []).forEach(r => { empCount[r.user_id] = (empCount[r.user_id] || 0) + 1; });

    const appUserCount = {};
    (appUserRows || []).forEach(r => { appUserCount[r.user_id] = (appUserCount[r.user_id] || 0) + 1; });

    const companies = users.map(u => ({
      id: u.id,
      email: u.email,
      company_name: u.user_metadata?.company_name || null,
      company_id: u.user_metadata?.company_id || null,
      first_name: u.user_metadata?.first_name || null,
      last_name: u.user_metadata?.last_name || null,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at,
      confirmed: !!u.email_confirmed_at,
      employee_count: empCount[u.id] || 0,
      team_member_count: appUserCount[u.id] || 0,
    }));

    // Sort by created_at descending
    companies.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    res.json({ companies });
  } catch (err) {
    console.error('Admin companies error:', err);
    res.status(500).json({ error: 'Failed to fetch companies.' });
  }
});

// GET /api/admin/companies/:id
// Returns details for one company: their app_users and recent activity
router.get('/companies/:id', authenticateUser, adminGuard, async (req, res) => {
  try {
    const { id } = req.params;

    // Get auth user
    const { data: authData, error: authError } = await supabase.auth.admin.getUserById(id);
    if (authError) return res.status(404).json({ error: 'Company not found.' });

    const u = authData.user;

    // Parallel fetch
    const [empRes, appUsersRes, deptRes, posRes] = await Promise.all([
      supabase.from('employees').select('id, first_name, last_name, position, department, start_date').eq('user_id', id),
      supabase.from('app_users').select('id, name, email, phone, rights').eq('user_id', id),
      supabase.from('departments').select('id, name').eq('user_id', id),
      supabase.from('positions').select('id, name').eq('user_id', id),
    ]);

    res.json({
      company: {
        id: u.id,
        email: u.email,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
        confirmed: !!u.email_confirmed_at,
      },
      employees: empRes.data || [],
      app_users: appUsersRes.data || [],
      departments: deptRes.data || [],
      positions: posRes.data || [],
    });
  } catch (err) {
    console.error('Admin company detail error:', err);
    res.status(500).json({ error: 'Failed to fetch company details.' });
  }
});

// GET /api/admin/stats
// Platform-wide stats
router.get('/stats', authenticateUser, adminGuard, async (req, res) => {
  try {
    const { data: authData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    const totalCompanies = (authData?.users || []).length;

    const [empRes, appUserRes] = await Promise.all([
      supabase.from('employees').select('id', { count: 'exact', head: true }),
      supabase.from('app_users').select('id', { count: 'exact', head: true }),
    ]);

    res.json({
      total_companies: totalCompanies,
      total_employees: empRes.count || 0,
      total_app_users: appUserRes.count || 0,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stats.' });
  }
});

module.exports = router;
