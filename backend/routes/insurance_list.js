const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');

// GET all insurance records
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('insurance_list')
      .select('*')
      .eq('user_id', req.userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ records: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST bulk insert
router.post('/bulk', async (req, res) => {
  try {
    const { records } = req.body;
    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ error: 'No records provided' });
    }
    const rows = records.map((r) => ({
      user_id: req.userId,
      name: String(r.name).trim(),
      last_name: String(r.last_name).trim(),
      personal_id: String(r.personal_id).trim(),
      amount1: parseFloat(r.amount1),
      amount2: r.amount2 ? parseFloat(r.amount2) : null,
      date: r.date,
    }));
    const { data, error } = await supabase.from('insurance_list').insert(rows).select();
    if (error) throw error;
    res.status(201).json({ inserted: data.length, records: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update record
router.put('/:id', async (req, res) => {
  try {
    const { name, last_name, personal_id, amount1, amount2, date } = req.body;
    const { data, error } = await supabase
      .from('insurance_list')
      .update({ name, last_name, personal_id, amount1: parseFloat(amount1), amount2: amount2 ? parseFloat(amount2) : null, date })
      .eq('id', req.params.id)
      .eq('user_id', req.userId)
      .select()
      .single();
    if (error) throw error;
    res.json({ record: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE record
router.delete('/:id', async (req, res) => {
  try {
    const { error } = await supabase
      .from('insurance_list')
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
