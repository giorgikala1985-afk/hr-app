const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');

// GET all overtime rates for user
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('overtime_rates')
      .select('*')
      .eq('user_id', req.userId)
      .order('rate', { ascending: true });

    if (error) throw error;
    res.json({ overtime_rates: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create overtime rate
router.post('/', async (req, res) => {
  try {
    const { label, rate } = req.body;

    if (!label || !label.trim()) {
      return res.status(400).json({ error: 'Label is required' });
    }
    if (rate === undefined || rate === null || isNaN(parseFloat(rate))) {
      return res.status(400).json({ error: 'Rate is required and must be a number' });
    }

    const { data, error } = await supabase
      .from('overtime_rates')
      .insert({
        user_id: req.userId,
        label: label.trim(),
        rate: parseFloat(rate),
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ overtime_rate: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update overtime rate
router.put('/:id', async (req, res) => {
  try {
    const { label, rate } = req.body;

    if (!label || !label.trim()) {
      return res.status(400).json({ error: 'Label is required' });
    }
    if (rate === undefined || rate === null || isNaN(parseFloat(rate))) {
      return res.status(400).json({ error: 'Rate is required and must be a number' });
    }

    const { data, error } = await supabase
      .from('overtime_rates')
      .update({ label: label.trim(), rate: parseFloat(rate) })
      .eq('id', req.params.id)
      .eq('user_id', req.userId)
      .select()
      .single();

    if (error) throw error;
    res.json({ overtime_rate: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE overtime rate
router.delete('/:id', async (req, res) => {
  try {
    const { error } = await supabase
      .from('overtime_rates')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.userId);

    if (error) throw error;
    res.json({ message: 'Overtime rate deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
