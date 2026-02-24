const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');

// GET all unit types for user
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('unit_types')
      .select('*')
      .eq('user_id', req.userId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    res.json({ unit_types: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create unit type
router.post('/', async (req, res) => {
  try {
    const { name, direction } = req.body;

    if (!name || !direction) {
      return res.status(400).json({ error: 'Name and direction are required' });
    }

    if (!['deduction', 'addition'].includes(direction)) {
      return res.status(400).json({ error: 'Direction must be "deduction" or "addition"' });
    }

    const { data, error } = await supabase
      .from('unit_types')
      .insert({
        user_id: req.userId,
        name: name.trim(),
        direction,
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ unit_type: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update unit type
router.put('/:id', async (req, res) => {
  try {
    const { name, direction } = req.body;

    if (!name || !direction) {
      return res.status(400).json({ error: 'Name and direction are required' });
    }

    const { data, error } = await supabase
      .from('unit_types')
      .update({ name: name.trim(), direction })
      .eq('id', req.params.id)
      .eq('user_id', req.userId)
      .select()
      .single();

    if (error) throw error;
    res.json({ unit_type: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE unit type
router.delete('/:id', async (req, res) => {
  try {
    const { error } = await supabase
      .from('unit_types')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.userId);

    if (error) throw error;
    res.json({ message: 'Unit type deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
