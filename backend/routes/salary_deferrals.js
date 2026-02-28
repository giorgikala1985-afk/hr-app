const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');

// POST /api/salary-deferrals - create a deferral
router.post('/', async (req, res) => {
  try {
    const { employee_id, month, deferred_amount } = req.body;
    if (!employee_id || !month || deferred_amount == null) {
      return res.status(400).json({ error: 'employee_id, month, and deferred_amount are required' });
    }
    const { data, error } = await supabase
      .from('salary_deferrals')
      .upsert([{ user_id: req.userId, employee_id, month, deferred_amount: parseFloat(deferred_amount) }], { onConflict: 'user_id,employee_id,month' })
      .select()
      .single();
    if (error) throw error;
    res.status(201).json({ deferral: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/salary-deferrals/:employee_id/:month - remove a deferral
router.delete('/:employee_id/:month', async (req, res) => {
  try {
    const { error } = await supabase
      .from('salary_deferrals')
      .delete()
      .eq('user_id', req.userId)
      .eq('employee_id', req.params.employee_id)
      .eq('month', req.params.month);
    if (error) throw error;
    res.json({ message: 'Deferral removed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
