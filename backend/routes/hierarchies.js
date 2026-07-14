const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');

// GET / — list all hierarchies for this company
router.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('hierarchies')
    .select('*')
    .eq('user_id', req.userId)
    .order('created_at', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ hierarchies: data || [] });
});

// POST / — create new hierarchy
router.post('/', async (req, res) => {
  const { name, nodes = [], edges = [] } = req.body;
  const { data, error } = await supabase
    .from('hierarchies')
    .insert({ user_id: req.userId, name: name || 'My Hierarchy', nodes, edges })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ hierarchy: data });
});

// PUT /:id — update (name, nodes, edges — send only what changed)
router.put('/:id', async (req, res) => {
  const { name, nodes, edges } = req.body;
  const patch = { updated_at: new Date().toISOString() };
  if (name  !== undefined) patch.name  = name;
  if (nodes !== undefined) patch.nodes = nodes;
  if (edges !== undefined) patch.edges = edges;

  const { data, error } = await supabase
    .from('hierarchies')
    .update(patch)
    .eq('id', req.params.id)
    .eq('user_id', req.userId)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ hierarchy: data });
});

// DELETE /:id — delete hierarchy
router.delete('/:id', async (req, res) => {
  const { error } = await supabase
    .from('hierarchies')
    .delete()
    .eq('id', req.params.id)
    .eq('user_id', req.userId);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

module.exports = router;
