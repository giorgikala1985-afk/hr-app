const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');

// GET /api/requests
router.get('/', async (req, res) => {
  try {
    const { status, type } = req.query;

    let query = supabase
      .from('requests')
      .select('*')
      .eq('user_id', req.userId)
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);
    if (type) query = query.eq('type', type);

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    res.json({ requests: data || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/requests
router.post('/', async (req, res) => {
  try {
    const { title, type, priority, description } = req.body;
    if (!title || !type) return res.status(400).json({ error: 'Title and type are required.' });

    const { data, error } = await supabase
      .from('requests')
      .insert({
        user_id: req.userId,
        title: title.trim(),
        type,
        priority: priority || 'medium',
        description: description?.trim() || null,
        status: 'pending',
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json({ request: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/requests/:id
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, type, priority, description, status, response_note } = req.body;

    const { data: existing, error: fetchErr } = await supabase
      .from('requests')
      .select('user_id')
      .eq('id', id)
      .single();

    if (fetchErr || !existing) return res.status(404).json({ error: 'Request not found.' });

    const patch = { updated_at: new Date().toISOString() };
    if (title !== undefined) patch.title = title.trim();
    if (type !== undefined) patch.type = type;
    if (priority !== undefined) patch.priority = priority;
    if (description !== undefined) patch.description = description?.trim() || null;
    if (status !== undefined) patch.status = status;
    if (response_note !== undefined) patch.response_note = response_note?.trim() || null;

    const { data, error } = await supabase
      .from('requests')
      .update(patch)
      .eq('id', id)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json({ request: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/requests/:id
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data: existing } = await supabase
      .from('requests')
      .select('user_id')
      .eq('id', id)
      .eq('user_id', req.userId)
      .single();

    if (!existing) return res.status(404).json({ error: 'Request not found.' });

    const { error } = await supabase.from('requests').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
