const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');

// GET /api/notification-matrix
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('notification_matrix')
      .select('*')
      .eq('user_id', req.userId)
      .order('sort_order', { ascending: true });
    if (error) throw error;
    res.json({ rows: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/notification-matrix — wholesale replace, same pattern as /api/user-matrix.
router.put('/', async (req, res) => {
  try {
    const { rows } = req.body;
    const { error: delErr } = await supabase
      .from('notification_matrix')
      .delete()
      .eq('user_id', req.userId);
    if (delErr) throw delErr;

    if (rows && rows.length > 0) {
      const inserts = rows.map((r, i) => ({
        user_id: req.userId,
        sort_order: i,
        role: r.role,
        transfer_submitted: r.transfer_submitted || 'No',
        transfer_approved: r.transfer_approved || 'No',
        transfer_rejected: r.transfer_rejected || 'No',
        transfer_partial: r.transfer_partial || 'No',
        transfer_wait: r.transfer_wait || 'No',
      }));
      const { error: insErr } = await supabase.from('notification_matrix').insert(inserts);
      if (insErr) throw insErr;
    }

    res.json({ message: 'Saved' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
