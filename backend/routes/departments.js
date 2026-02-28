const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');

// GET all departments for user
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('departments')
      .select('*')
      .eq('user_id', req.userId)
      .order('name', { ascending: true });

    if (error) throw error;
    res.json({ departments: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create department
router.post('/', async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Department name is required' });
    }

    const { data, error } = await supabase
      .from('departments')
      .insert({
        user_id: req.userId,
        name: name.trim(),
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ department: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update department
router.put('/:id', async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Department name is required' });
    }

    const { data, error } = await supabase
      .from('departments')
      .update({ name: name.trim() })
      .eq('id', req.params.id)
      .eq('user_id', req.userId)
      .select()
      .single();

    if (error) throw error;
    res.json({ department: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE department
router.delete('/:id', async (req, res) => {
  try {
    const { error } = await supabase
      .from('departments')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.userId);

    if (error) throw error;
    res.json({ message: 'Department deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
