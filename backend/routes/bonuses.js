const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');

// GET all bonuses for user
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('bonuses')
      .select('*')
      .eq('user_id', req.userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ bonuses: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create bonus
router.post('/', async (req, res) => {
  try {
    const { employee_id, employee_name, amount, reason, note, date } = req.body;
    if (!employee_id || !amount || !reason) {
      return res.status(400).json({ error: 'employee_id, amount, and reason are required' });
    }
    const { data, error } = await supabase
      .from('bonuses')
      .insert([{
        user_id: req.userId,
        employee_id,
        employee_name,
        amount: parseFloat(amount),
        reason,
        note: note || null,
        date: date || null,
      }])
      .select()
      .single();
    if (error) throw error;
    res.status(201).json({ bonus: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE bonus
router.delete('/:id', async (req, res) => {
  try {
    const { error } = await supabase
      .from('bonuses')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.userId);
    if (error) throw error;
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
