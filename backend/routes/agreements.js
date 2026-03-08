const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');

// GET all agreements for user (optionally filter by employee_id)
router.get('/', async (req, res) => {
  try {
    let query = supabase
      .from('agreements')
      .select('*')
      .eq('user_id', req.userId)
      .order('created_at', { ascending: false });
    if (req.query.employee_id) {
      query = query.eq('employee_id', req.query.employee_id);
    }
    const { data, error } = await query;
    if (error) throw error;
    res.json({ agreements: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create agreement
router.post('/', async (req, res) => {
  try {
    const { title, type, party_name, start_date, end_date, amount, currency, status, notes, employee_id } = req.body;
    const { data, error } = await supabase
      .from('agreements')
      .insert([{
        user_id: req.userId,
        employee_id: employee_id || null,
        title,
        type: type || 'Employment',
        party_name,
        start_date: start_date || null,
        end_date: end_date || null,
        amount: amount ? Number(amount) : null,
        currency: currency || 'GEL',
        status: status || 'active',
        notes
      }])
      .select()
      .single();
    if (error) throw error;
    res.status(201).json({ agreement: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update agreement
router.put('/:id', async (req, res) => {
  try {
    const { title, type, party_name, start_date, end_date, amount, currency, status, notes } = req.body;
    const { data, error } = await supabase
      .from('agreements')
      .update({
        title,
        type,
        party_name,
        start_date: start_date || null,
        end_date: end_date || null,
        amount: amount ? Number(amount) : null,
        currency,
        status,
        notes
      })
      .eq('id', req.params.id)
      .eq('user_id', req.userId)
      .select()
      .single();
    if (error) throw error;
    res.json({ agreement: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE agreement
router.delete('/:id', async (req, res) => {
  try {
    const { error } = await supabase
      .from('agreements')
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
