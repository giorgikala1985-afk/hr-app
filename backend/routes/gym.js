const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
// ===================== GYM PLANS =====================

// GET /api/gym/plans
router.get('/plans', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('gym_plans')
      .select('*')
      .eq('user_id', req.userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ plans: data || [] });
  } catch (error) {
    console.error('Get gym plans error:', error);
    res.status(500).json({ error: 'Failed to fetch gym plans' });
  }
});

// POST /api/gym/plans
router.post('/plans', async (req, res) => {
  try {
    const { name, provider, price } = req.body;

    if (!name || !provider || price === undefined) {
      return res.status(400).json({ error: 'Name, provider, and price are required' });
    }

    const { data, error } = await supabase
      .from('gym_plans')
      .insert({
        user_id: req.userId,
        name: name.trim(),
        provider: provider.trim(),
        price: parseFloat(price),
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ message: 'Gym plan created', plan: data });
  } catch (error) {
    console.error('Create gym plan error:', error);
    res.status(500).json({ error: 'Failed to create gym plan' });
  }
});

// PUT /api/gym/plans/:id
router.put('/plans/:id', async (req, res) => {
  try {
    const { name, provider, price } = req.body;

    if (!name || !provider || price === undefined) {
      return res.status(400).json({ error: 'Name, provider, and price are required' });
    }

    const { data, error } = await supabase
      .from('gym_plans')
      .update({
        name: name.trim(),
        provider: provider.trim(),
        price: parseFloat(price),
      })
      .eq('id', req.params.id)
      .eq('user_id', req.userId)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Plan not found' });

    res.json({ message: 'Gym plan updated', plan: data });
  } catch (error) {
    console.error('Update gym plan error:', error);
    res.status(500).json({ error: 'Failed to update gym plan' });
  }
});

// DELETE /api/gym/plans/:id
router.delete('/plans/:id', async (req, res) => {
  try {
    const { error } = await supabase
      .from('gym_plans')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.userId);

    if (error) throw error;
    res.json({ message: 'Gym plan deleted' });
  } catch (error) {
    console.error('Delete gym plan error:', error);
    res.status(500).json({ error: 'Failed to delete gym plan' });
  }
});

// ===================== GYM ASSIGNMENTS =====================

// GET /api/gym/assignments
router.get('/assignments', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('gym_assignments')
      .select(`
        id,
        start_date,
        created_at,
        employee_id,
        plan_id,
        employees ( id, first_name, last_name, position ),
        gym_plans ( id, name, provider, price )
      `)
      .eq('user_id', req.userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ assignments: data || [] });
  } catch (error) {
    console.error('Get gym assignments error:', error);
    res.status(500).json({ error: 'Failed to fetch gym assignments' });
  }
});

// POST /api/gym/assignments
router.post('/assignments', async (req, res) => {
  try {
    const { employee_id, plan_id, start_date } = req.body;

    if (!employee_id || !plan_id || !start_date) {
      return res.status(400).json({ error: 'Employee, plan, and start date are required' });
    }

    // Verify employee belongs to user
    const { data: emp } = await supabase
      .from('employees')
      .select('id')
      .eq('id', employee_id)
      .eq('user_id', req.userId)
      .single();

    if (!emp) return res.status(404).json({ error: 'Employee not found' });

    // Verify plan belongs to user
    const { data: plan } = await supabase
      .from('gym_plans')
      .select('id')
      .eq('id', plan_id)
      .eq('user_id', req.userId)
      .single();

    if (!plan) return res.status(404).json({ error: 'Plan not found' });

    const { data, error } = await supabase
      .from('gym_assignments')
      .insert({
        user_id: req.userId,
        employee_id,
        plan_id,
        start_date,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(400).json({ error: 'Employee is already assigned to this plan' });
      }
      throw error;
    }

    res.status(201).json({ message: 'Employee assigned to gym plan', assignment: data });
  } catch (error) {
    console.error('Create gym assignment error:', error);
    res.status(500).json({ error: 'Failed to assign employee' });
  }
});

// DELETE /api/gym/assignments/:id
router.delete('/assignments/:id', async (req, res) => {
  try {
    const { error } = await supabase
      .from('gym_assignments')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.userId);

    if (error) throw error;
    res.json({ message: 'Assignment removed' });
  } catch (error) {
    console.error('Delete gym assignment error:', error);
    res.status(500).json({ error: 'Failed to remove assignment' });
  }
});

module.exports = router;
