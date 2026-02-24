const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
// ===================== INSURANCE PLANS =====================

// GET /api/insurance/plans
router.get('/plans', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('insurance_plans')
      .select('*')
      .eq('user_id', req.userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ plans: data || [] });
  } catch (error) {
    console.error('Get insurance plans error:', error);
    res.status(500).json({ error: 'Failed to fetch insurance plans' });
  }
});

// POST /api/insurance/plans
router.post('/plans', async (req, res) => {
  try {
    const { provider, plan_name, coverage_type, premium } = req.body;

    if (!provider || !plan_name || !coverage_type || premium === undefined) {
      return res.status(400).json({ error: 'Provider, plan name, coverage type, and premium are required' });
    }

    const { data, error } = await supabase
      .from('insurance_plans')
      .insert({
        user_id: req.userId,
        provider: provider.trim(),
        plan_name: plan_name.trim(),
        coverage_type: coverage_type.trim(),
        premium: parseFloat(premium),
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ message: 'Insurance plan created', plan: data });
  } catch (error) {
    console.error('Create insurance plan error:', error);
    res.status(500).json({ error: 'Failed to create insurance plan' });
  }
});

// PUT /api/insurance/plans/:id
router.put('/plans/:id', async (req, res) => {
  try {
    const { provider, plan_name, coverage_type, premium } = req.body;

    if (!provider || !plan_name || !coverage_type || premium === undefined) {
      return res.status(400).json({ error: 'Provider, plan name, coverage type, and premium are required' });
    }

    const { data, error } = await supabase
      .from('insurance_plans')
      .update({
        provider: provider.trim(),
        plan_name: plan_name.trim(),
        coverage_type: coverage_type.trim(),
        premium: parseFloat(premium),
      })
      .eq('id', req.params.id)
      .eq('user_id', req.userId)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Plan not found' });

    res.json({ message: 'Insurance plan updated', plan: data });
  } catch (error) {
    console.error('Update insurance plan error:', error);
    res.status(500).json({ error: 'Failed to update insurance plan' });
  }
});

// DELETE /api/insurance/plans/:id
router.delete('/plans/:id', async (req, res) => {
  try {
    const { error } = await supabase
      .from('insurance_plans')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.userId);

    if (error) throw error;
    res.json({ message: 'Insurance plan deleted' });
  } catch (error) {
    console.error('Delete insurance plan error:', error);
    res.status(500).json({ error: 'Failed to delete insurance plan' });
  }
});

// ===================== INSURANCE ASSIGNMENTS =====================

// GET /api/insurance/assignments
router.get('/assignments', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('insurance_assignments')
      .select(`
        id,
        start_date,
        created_at,
        employee_id,
        plan_id,
        employees ( id, first_name, last_name, position ),
        insurance_plans ( id, provider, plan_name, coverage_type, premium )
      `)
      .eq('user_id', req.userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ assignments: data || [] });
  } catch (error) {
    console.error('Get insurance assignments error:', error);
    res.status(500).json({ error: 'Failed to fetch insurance assignments' });
  }
});

// POST /api/insurance/assignments
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
      .from('insurance_plans')
      .select('id')
      .eq('id', plan_id)
      .eq('user_id', req.userId)
      .single();

    if (!plan) return res.status(404).json({ error: 'Plan not found' });

    const { data, error } = await supabase
      .from('insurance_assignments')
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

    res.status(201).json({ message: 'Employee assigned to insurance plan', assignment: data });
  } catch (error) {
    console.error('Create insurance assignment error:', error);
    res.status(500).json({ error: 'Failed to assign employee' });
  }
});

// DELETE /api/insurance/assignments/:id
router.delete('/assignments/:id', async (req, res) => {
  try {
    const { error } = await supabase
      .from('insurance_assignments')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.userId);

    if (error) throw error;
    res.json({ message: 'Assignment removed' });
  } catch (error) {
    console.error('Delete insurance assignment error:', error);
    res.status(500).json({ error: 'Failed to remove assignment' });
  }
});

module.exports = router;
