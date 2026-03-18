const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');

// GET all fitpass records
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('fitpass_list')
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
      amount: parseFloat(r.amount),
      period: r.period || null,
      note: r.note ? String(r.note).trim() : null,
    }));
    const { data, error } = await supabase.from('fitpass_list').insert(rows).select();
    if (error) throw error;
    res.status(201).json({ inserted: data.length, records: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update record
router.put('/:id', async (req, res) => {
  try {
    const { name, last_name, personal_id, amount, period, note } = req.body;
    const { data, error } = await supabase
      .from('fitpass_list')
      .update({ name, last_name, personal_id, amount: parseFloat(amount), period: period || null, note: note || null })
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
      .from('fitpass_list')
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
