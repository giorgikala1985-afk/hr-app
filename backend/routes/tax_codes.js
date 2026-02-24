const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');

// GET all tax codes for user
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('tax_codes')
      .select('*')
      .eq('user_id', req.userId)
      .order('code', { ascending: true });

    if (error) throw error;
    res.json({ tax_codes: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create tax code
router.post('/', async (req, res) => {
  try {
    const { code } = req.body;

    if (!code || !String(code).trim()) {
      return res.status(400).json({ error: 'Tax code is required' });
    }

    const { data, error } = await supabase
      .from('tax_codes')
      .insert({
        user_id: req.userId,
        code: String(code).trim(),
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ tax_code: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update tax code
router.put('/:id', async (req, res) => {
  try {
    const { code } = req.body;

    if (!code || !String(code).trim()) {
      return res.status(400).json({ error: 'Tax code is required' });
    }

    const { data, error } = await supabase
      .from('tax_codes')
      .update({ code: String(code).trim() })
      .eq('id', req.params.id)
      .eq('user_id', req.userId)
      .select()
      .single();

    if (error) throw error;
    res.json({ tax_code: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE tax code
router.delete('/:id', async (req, res) => {
  try {
    const { error } = await supabase
      .from('tax_codes')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.userId);

    if (error) throw error;
    res.json({ message: 'Tax code deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
