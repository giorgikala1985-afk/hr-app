const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');

// GET /api/users
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('app_users')
      .select('*')
      .eq('user_id', req.userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ users: data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/users
router.post('/', async (req, res) => {
  try {
    const { name, email, phone, rights } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required.' });
    const { data, error } = await supabase
      .from('app_users')
      .insert([{ user_id: req.userId, name, email: email || null, phone: phone || null, rights: rights || 'Member' }])
      .select()
      .single();
    if (error) throw error;
    res.status(201).json({ user: data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/users/:id
router.put('/:id', async (req, res) => {
  try {
    const { name, email, phone, rights } = req.body;
    const { data, error } = await supabase
      .from('app_users')
      .update({ name, email: email || null, phone: phone || null, rights })
      .eq('id', req.params.id)
      .eq('user_id', req.userId)
      .select()
      .single();
    if (error) throw error;
    res.json({ user: data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/users/:id
router.delete('/:id', async (req, res) => {
  try {
    const { error } = await supabase
      .from('app_users')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.userId);
    if (error) throw error;
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
