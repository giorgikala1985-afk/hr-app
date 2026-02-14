const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { authenticateUser } = require('../middleware/auth');

router.use(authenticateUser);

// GET /api/holidays?year=2025
router.get('/', async (req, res) => {
  try {
    const { year } = req.query;

    let query = supabase
      .from('holidays')
      .select('*')
      .eq('user_id', req.userId)
      .order('date', { ascending: true });

    if (year) {
      query = query.gte('date', `${year}-01-01`).lte('date', `${year}-12-31`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching holidays:', error);
      return res.status(500).json({ error: 'Failed to fetch holidays' });
    }

    res.json({ holidays: data || [] });
  } catch (error) {
    console.error('Get holidays error:', error);
    res.status(500).json({ error: 'An error occurred while fetching holidays' });
  }
});

// POST /api/holidays
router.post('/', async (req, res) => {
  try {
    const { date, name } = req.body;

    if (!date || !name) {
      return res.status(400).json({ error: 'Date and name are required' });
    }

    const { data, error } = await supabase
      .from('holidays')
      .insert({
        user_id: req.userId,
        date,
        name: name.trim()
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating holiday:', error);
      return res.status(500).json({ error: 'Failed to create holiday' });
    }

    res.status(201).json({ message: 'Holiday added successfully', holiday: data });
  } catch (error) {
    console.error('Create holiday error:', error);
    res.status(500).json({ error: 'An error occurred while creating holiday' });
  }
});

// PUT /api/holidays/:id
router.put('/:id', async (req, res) => {
  try {
    const { date, name } = req.body;

    if (!date || !name) {
      return res.status(400).json({ error: 'Date and name are required' });
    }

    const { data, error } = await supabase
      .from('holidays')
      .update({ date, name: name.trim() })
      .eq('id', req.params.id)
      .eq('user_id', req.userId)
      .select()
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Holiday not found' });
    }

    res.json({ message: 'Holiday updated successfully', holiday: data });
  } catch (error) {
    console.error('Update holiday error:', error);
    res.status(500).json({ error: 'An error occurred while updating holiday' });
  }
});

// DELETE /api/holidays/:id
router.delete('/:id', async (req, res) => {
  try {
    const { error } = await supabase
      .from('holidays')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.userId);

    if (error) {
      console.error('Error deleting holiday:', error);
      return res.status(500).json({ error: 'Failed to delete holiday' });
    }

    res.json({ message: 'Holiday deleted successfully' });
  } catch (error) {
    console.error('Delete holiday error:', error);
    res.status(500).json({ error: 'An error occurred while deleting holiday' });
  }
});

module.exports = router;
