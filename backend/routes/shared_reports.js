const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { resolveUserName } = require('../services/userIdentity');

// POST /api/shared-reports — share a chart snapshot with one or more teammates.
router.post('/', async (req, res) => {
  try {
    const { title, botName, chartData, recipientIds } = req.body;
    if (!chartData) return res.status(400).json({ error: 'chartData is required.' });
    if (!Array.isArray(recipientIds) || recipientIds.length === 0) {
      return res.status(400).json({ error: 'Select at least one teammate to share with.' });
    }

    // Resolve recipient emails from app_users, scoped to this account — never
    // trust a client-supplied email directly, only ids that belong to this tenant.
    const { data: recipients, error: recError } = await supabase
      .from('app_users')
      .select('email')
      .eq('user_id', req.userId)
      .in('id', recipientIds);
    if (recError) throw recError;
    if (!recipients || recipients.length === 0) {
      return res.status(400).json({ error: 'No valid recipients found.' });
    }

    const shared_by_name = await resolveUserName(req);
    const shared_by_email = req.user?.email || null;

    const rows = recipients.map(r => ({
      user_id: req.userId,
      title: title || null,
      bot_name: botName || null,
      chart_data: chartData,
      shared_by_name,
      shared_by_email,
      shared_with_email: r.email,
    }));

    const { data, error } = await supabase.from('shared_reports').insert(rows).select();
    if (error) throw error;
    res.status(201).json({ reports: data });
  } catch (err) {
    console.error('Share report error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/shared-reports — reports shared with the current user.
router.get('/', async (req, res) => {
  try {
    const email = req.user?.email;
    if (!email) return res.json({ reports: [] });
    const { data, error } = await supabase
      .from('shared_reports')
      .select('*')
      .eq('user_id', req.userId)
      .eq('shared_with_email', email)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ reports: data || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/shared-reports/:id — recipient removes it from their own list.
router.delete('/:id', async (req, res) => {
  try {
    const email = req.user?.email;
    const { error } = await supabase
      .from('shared_reports')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.userId)
      .eq('shared_with_email', email);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
