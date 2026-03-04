const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');

router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase.from('stock_locations').select('*').eq('user_id', req.userId).order('name', { ascending: true });
    if (error) throw error;
    res.json({ locations: data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { name, add_date, area, address } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });
    const { data, error } = await supabase.from('stock_locations').insert([{ user_id: req.userId, name: name.trim(), add_date: add_date || null, area: area || null, address: address || null }]).select().single();
    if (error) throw error;
    res.status(201).json({ location: data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const { name, add_date, area, address } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });
    const { data, error } = await supabase.from('stock_locations').update({ name: name.trim(), add_date: add_date || null, area: area || null, address: address || null }).eq('id', req.params.id).eq('user_id', req.userId).select().single();
    if (error) throw error;
    res.json({ location: data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const { error } = await supabase.from('stock_locations').delete().eq('id', req.params.id).eq('user_id', req.userId);
    if (error) throw error;
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
