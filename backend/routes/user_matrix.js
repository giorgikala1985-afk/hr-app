const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');

// GET /api/user-matrix
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('user_matrix')
      .select('*')
      .eq('user_id', req.userId)
      .order('sort_order', { ascending: true });
    if (error) throw error;
    res.json({ rows: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/user-matrix
router.put('/', async (req, res) => {
  try {
    const { rows } = req.body;
    const { error: delErr } = await supabase
      .from('user_matrix')
      .delete()
      .eq('user_id', req.userId);
    if (delErr) throw delErr;

    if (rows && rows.length > 0) {
      const inserts = rows.map((r, i) => ({
        user_id: req.userId,
        sort_order: i,
        role: r.role,
        description: r.description || '',
        initiate_transfer: r.initiate_transfer || 'No',
        approve_transfer: r.approve_transfer || 'No',
        reject_transfer: r.reject_transfer || 'No',
        view_transactions: r.view_transactions || 'No',
        cancel_transaction: r.cancel_transaction || 'No',
        set_limits: r.set_limits || 'No',
        manage_users: r.manage_users || 'No',
        audit_reports: r.audit_reports || 'No',
        transfer_limit: r.transfer_limit || 'N/A',
      }));
      const { error: insErr } = await supabase.from('user_matrix').insert(inserts);
      if (insErr) throw insErr;
    }

    res.json({ message: 'Saved' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
