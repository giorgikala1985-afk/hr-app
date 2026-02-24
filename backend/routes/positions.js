const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');

// GET all positions for user
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('positions')
      .select('*')
      .eq('user_id', req.userId)
      .order('name', { ascending: true });

    if (error) throw error;
    res.json({ positions: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create position
router.post('/', async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Position name is required' });
    }

    const { data, error } = await supabase
      .from('positions')
      .insert({
        user_id: req.userId,
        name: name.trim(),
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ position: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update position
router.put('/:id', async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Position name is required' });
    }

    const { data, error } = await supabase
      .from('positions')
      .update({ name: name.trim() })
      .eq('id', req.params.id)
      .eq('user_id', req.userId)
      .select()
      .single();

    if (error) throw error;
    res.json({ position: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE position
router.delete('/:id', async (req, res) => {
  try {
    const { error } = await supabase
      .from('positions')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.userId);

    if (error) throw error;
    res.json({ message: 'Position deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
