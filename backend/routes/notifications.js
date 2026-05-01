const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');

// GET all notifications for current user
router.get('/', async (req, res) => {
  try {
    const email = req.user?.email;
    if (!email) return res.json({ notifications: [], unread: 0 });
    const { data, error } = await supabase
      .from('app_notifications')
      .select('*')
      .eq('user_id', req.userId)
      .eq('recipient_email', email)
      .order('created_at', { ascending: false })
      .limit(30);
    if (error) throw error;
    const notifications = data || [];
    const unread = notifications.filter(n => !n.is_read).length;
    res.json({ notifications, unread });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Mark all as read — must be before /:id/read to avoid route collision
router.put('/read-all', async (req, res) => {
  try {
    const email = req.user?.email;
    if (!email) return res.json({ ok: true });
    await supabase
      .from('app_notifications')
      .update({ is_read: true })
      .eq('user_id', req.userId)
      .eq('recipient_email', email)
      .eq('is_read', false);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Mark one as read
router.put('/:id/read', async (req, res) => {
  try {
    const email = req.user?.email;
    await supabase
      .from('app_notifications')
      .update({ is_read: true })
      .eq('id', req.params.id)
      .eq('user_id', req.userId)
      .eq('recipient_email', email);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Debug: show all notifications for this tenant + approver/main email lookup
router.get('/debug', async (req, res) => {
  try {
    const supabaseAdmin = require('../config/supabase');
    // All notifications for this tenant
    const { data: allNotifs } = await supabaseAdmin.from('app_notifications')
      .select('*').eq('user_id', req.userId).order('created_at', { ascending: false }).limit(20);

    // All transfers with requester_email
    const { data: transfers } = await supabaseAdmin.from('accounting_transfers')
      .select('id, client_name, requester_name, requester_email, approval_status')
      .eq('user_id', req.userId).order('created_at', { ascending: false }).limit(5);

    // User matrix approve rows
    const { data: matrix } = await supabaseAdmin.from('user_matrix')
      .select('role, approve_transfer').eq('user_id', req.userId);

    // App users
    const { data: appUsers } = await supabaseAdmin.from('app_users')
      .select('name, email, rights').eq('user_id', req.userId);

    // Main user email via admin API
    const result = await supabaseAdmin.auth.admin.getUserById(req.userId);
    const mainEmail = result?.data?.user?.email || null;

    res.json({
      currentUserEmail: req.user?.email,
      mainUserEmail: mainEmail,
      allNotifications: allNotifs || [],
      recentTransfers: transfers || [],
      userMatrix: matrix || [],
      appUsers: appUsers || [],
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
