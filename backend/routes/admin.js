const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { authenticateUser } = require('../middleware/auth');
const { createPayment } = require('../config/tbcpay');

// Normalize a subscription row to a compact summary for the admin UI.
function subSummary(s) {
  if (!s) return { status: 'none', amount: null, currency: 'GEL', plan: null, auto_charge: false, current_period_end: null };
  return {
    status: s.status || 'none',
    amount: s.amount,
    currency: s.currency || 'GEL',
    plan: s.plan || null,
    auto_charge: !!s.auto_charge,
    current_period_end: s.current_period_end || null,
    next_charge_date: s.next_charge_date || null,
    card_mask: s.card_mask || null,
  };
}

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

    // Subscriptions per user_id
    const { data: subRows } = await supabase.from('subscriptions').select('*');

    // Build lookup maps
    const empCount = {};
    (empRows || []).forEach(r => { empCount[r.user_id] = (empCount[r.user_id] || 0) + 1; });

    const appUserCount = {};
    (appUserRows || []).forEach(r => { appUserCount[r.user_id] = (appUserCount[r.user_id] || 0) + 1; });

    const subMap = {};
    (subRows || []).forEach(s => { subMap[s.user_id] = s; });

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
      subscription: subSummary(subMap[u.id]),
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
    const [empRes, appUsersRes, deptRes, posRes, subRes] = await Promise.all([
      supabase.from('employees').select('id, first_name, last_name, position, department, start_date').eq('user_id', id),
      supabase.from('app_users').select('id, name, email, phone, rights').eq('user_id', id),
      supabase.from('departments').select('id, name').eq('user_id', id),
      supabase.from('positions').select('id, name').eq('user_id', id),
      supabase.from('subscriptions').select('*').eq('user_id', id).maybeSingle(),
    ]);

    res.json({
      company: {
        id: u.id,
        email: u.email,
        company_name: u.user_metadata?.company_name || null,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
        confirmed: !!u.email_confirmed_at,
      },
      subscription: subSummary(subRes.data),
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

// PUT /api/admin/companies/:id/billing
// Set per-company price/plan/auto-charge and/or manually activate/extend.
// Body: { amount?, currency?, plan?, auto_charge?, status?, extendMonths? }
router.put('/companies/:id/billing', authenticateUser, adminGuard, async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, currency, plan, auto_charge, status, extendMonths } = req.body;

    const { data: existing } = await supabase
      .from('subscriptions').select('*').eq('user_id', id).maybeSingle();

    const update = { user_id: id, updated_at: new Date().toISOString() };
    if (amount !== undefined) update.amount = amount === null || amount === '' ? null : parseFloat(amount);
    if (currency !== undefined) update.currency = currency || 'GEL';
    if (plan !== undefined) update.plan = plan || null;
    if (auto_charge !== undefined) update.auto_charge = !!auto_charge;
    if (status !== undefined) update.status = status;

    // Manual activate / extend: push the period end out by N months.
    const months = Number(extendMonths);
    if (months && months > 0) {
      const now = new Date();
      const currentEnd = existing?.current_period_end ? new Date(existing.current_period_end) : null;
      const base = currentEnd && currentEnd > now ? currentEnd : now;
      const newEnd = new Date(base);
      newEnd.setMonth(newEnd.getMonth() + months);
      update.status = 'active';
      update.current_period_start = existing?.current_period_start || now.toISOString();
      update.current_period_end = newEnd.toISOString();
    }

    const { data, error } = await supabase
      .from('subscriptions')
      .upsert(update, { onConflict: 'user_id' })
      .select()
      .single();
    if (error) throw error;

    res.json({ subscription: subSummary(data) });
  } catch (err) {
    console.error('Admin billing update error:', err);
    res.status(500).json({ error: err.message || 'Failed to update billing.' });
  }
});

// POST /api/admin/companies/:id/payment-link
// Create a TBC payment link for the company's amount (admin sends it to them to pay).
// Body: { amount?, currency? }  (falls back to the saved subscription amount)
router.post('/companies/:id/payment-link', authenticateUser, adminGuard, async (req, res) => {
  try {
    const { id } = req.params;
    const { data: existing } = await supabase
      .from('subscriptions').select('*').eq('user_id', id).maybeSingle();

    const amount = parseFloat(req.body.amount ?? existing?.amount);
    const currency = req.body.currency || existing?.currency || 'GEL';
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Set a valid amount for this company first.' });
    }

    const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
    const callbackUrl = `${process.env.BACKEND_URL || 'http://localhost:5001'}/api/billing/callback`;

    const payment = await createPayment({
      amount,
      currency,
      returnUrl: `${FRONTEND_URL}/billing?success=true`,
      callbackUrl,
      merchantPaymentId: `adminsub_${id}_${Date.now()}`,
      description: 'Finpilot Subscription',
    });

    // Save amount/currency and the pending pay id; the shared /billing/callback
    // activates the subscription once TBC confirms payment.
    await supabase.from('subscriptions').upsert({
      user_id: id,
      amount,
      currency,
      status: 'pending',
      tbc_pay_id: payment.payId,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });

    const approvalLink = payment.links?.find(l => l.rel === 'approval_url');
    const url = approvalLink?.uri || null;
    if (!url) throw new Error('No approval URL returned from TBC.');

    res.json({ url, payId: payment.payId });
  } catch (err) {
    console.error('Admin payment-link error:', err);
    res.status(500).json({ error: err.message || 'Failed to create payment link.' });
  }
});

module.exports = router;
