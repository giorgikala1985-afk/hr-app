const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');

// ── PURCHASES ──────────────────────────────────────────
router.get('/purchases', async (req, res) => {
  try {
    const { data, error } = await supabase.from('accounting_purchases').select('*').eq('user_id', req.userId).order('date', { ascending: false });
    if (error) throw error;
    res.json({ records: data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/purchases', async (req, res) => {
  try {
    const { vendor, description, amount, currency, category, date } = req.body;
    const { data, error } = await supabase.from('accounting_purchases').insert([{ user_id: req.userId, vendor, description, amount: parseFloat(amount), currency, category, date }]).select().single();
    if (error) throw error;
    res.status(201).json({ record: data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/purchases/:id', async (req, res) => {
  try {
    const { vendor, description, amount, currency, category, date } = req.body;
    const { data, error } = await supabase.from('accounting_purchases').update({ vendor, description, amount: parseFloat(amount), currency, category, date }).eq('id', req.params.id).eq('user_id', req.userId).select().single();
    if (error) throw error;
    res.json({ record: data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/purchases/:id', async (req, res) => {
  try {
    const { error } = await supabase.from('accounting_purchases').delete().eq('id', req.params.id).eq('user_id', req.userId);
    if (error) throw error;
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── SALES ──────────────────────────────────────────────
router.get('/sales', async (req, res) => {
  try {
    const { data, error } = await supabase.from('accounting_sales').select('*').eq('user_id', req.userId).order('date', { ascending: false });
    if (error) throw error;
    res.json({ records: data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/sales', async (req, res) => {
  try {
    const { client, description, amount, currency, category, date } = req.body;
    const { data, error } = await supabase.from('accounting_sales').insert([{ user_id: req.userId, client, description, amount: parseFloat(amount), currency, category, date }]).select().single();
    if (error) throw error;
    res.status(201).json({ record: data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/sales/:id', async (req, res) => {
  try {
    const { client, description, amount, currency, category, date } = req.body;
    const { data, error } = await supabase.from('accounting_sales').update({ client, description, amount: parseFloat(amount), currency, category, date }).eq('id', req.params.id).eq('user_id', req.userId).select().single();
    if (error) throw error;
    res.json({ record: data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/sales/:id', async (req, res) => {
  try {
    const { error } = await supabase.from('accounting_sales').delete().eq('id', req.params.id).eq('user_id', req.userId);
    if (error) throw error;
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── INVOICES ───────────────────────────────────────────
router.get('/invoices', async (req, res) => {
  try {
    const { data, error } = await supabase.from('accounting_invoices').select('*').eq('user_id', req.userId).order('date', { ascending: false });
    if (error) throw error;
    res.json({ records: data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/invoices', async (req, res) => {
  try {
    const { client, client_email, invoice_number, date, due_date, currency, status, notes, items, total } = req.body;
    const { data, error } = await supabase.from('accounting_invoices').insert([{ user_id: req.userId, client, client_email, invoice_number, date, due_date: due_date || null, currency, status, notes, items, total: parseFloat(total) }]).select().single();
    if (error) throw error;
    res.status(201).json({ record: data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/invoices/:id', async (req, res) => {
  try {
    const { client, client_email, invoice_number, date, due_date, currency, status, notes, items, total } = req.body;
    const { data, error } = await supabase.from('accounting_invoices').update({ client, client_email, invoice_number, date, due_date: due_date || null, currency, status, notes, items, total: parseFloat(total) }).eq('id', req.params.id).eq('user_id', req.userId).select().single();
    if (error) throw error;
    res.json({ record: data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/invoices/:id', async (req, res) => {
  try {
    const { error } = await supabase.from('accounting_invoices').delete().eq('id', req.params.id).eq('user_id', req.userId);
    if (error) throw error;
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── TRANSACTIONS ───────────────────────────────────────
// suggest must come before /:id to avoid param collision
router.get('/transactions/suggest', async (req, res) => {
  try {
    const { client } = req.query;
    if (!client) return res.json({ suggestion: null });
    const { data, error } = await supabase
      .from('accounting_transactions')
      .select('item_type')
      .eq('user_id', req.userId)
      .eq('client', client)
      .order('created_at', { ascending: false });
    if (error) throw error;
    if (!data || data.length === 0) return res.json({ suggestion: null });
    const counts = {};
    data.forEach(r => { counts[r.item_type] = (counts[r.item_type] || 0) + 1; });
    const suggestion = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
    res.json({ suggestion });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/transactions', async (req, res) => {
  try {
    const { data, error } = await supabase.from('accounting_transactions').select('*').eq('user_id', req.userId).order('date', { ascending: false });
    if (error) throw error;
    res.json({ records: data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/transactions', async (req, res) => {
  try {
    const { date, client, item_type, amount, note } = req.body;
    const { data, error } = await supabase.from('accounting_transactions').insert([{ user_id: req.userId, date, client, item_type, amount: parseFloat(amount), note }]).select().single();
    if (error) throw error;
    res.status(201).json({ record: data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/transactions/:id', async (req, res) => {
  try {
    const { date, client, item_type, amount, note } = req.body;
    const { data, error } = await supabase.from('accounting_transactions').update({ date, client, item_type, amount: parseFloat(amount), note }).eq('id', req.params.id).eq('user_id', req.userId).select().single();
    if (error) throw error;
    res.json({ record: data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/transactions/:id', async (req, res) => {
  try {
    const { error } = await supabase.from('accounting_transactions').delete().eq('id', req.params.id).eq('user_id', req.userId);
    if (error) throw error;
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── AGENTS ─────────────────────────────────────────────
router.get('/agents', async (req, res) => {
  try {
    const { data, error } = await supabase.from('accounting_agents').select('*').eq('user_id', req.userId).order('name', { ascending: true });
    if (error) throw error;
    res.json({ records: data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/agents', async (req, res) => {
  try {
    const { name, type, add_date, account_number, address, phone } = req.body;
    const { data, error } = await supabase.from('accounting_agents').insert([{ user_id: req.userId, name, type, add_date: add_date || null, account_number, address, phone }]).select().single();
    if (error) throw error;
    res.status(201).json({ record: data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/agents/:id', async (req, res) => {
  try {
    const { name, type, add_date, account_number, address, phone } = req.body;
    const { data, error } = await supabase.from('accounting_agents').update({ name, type, add_date: add_date || null, account_number, address, phone }).eq('id', req.params.id).eq('user_id', req.userId).select().single();
    if (error) throw error;
    res.json({ record: data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/agents/:id', async (req, res) => {
  try {
    const { error } = await supabase.from('accounting_agents').delete().eq('id', req.params.id).eq('user_id', req.userId);
    if (error) throw error;
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── BOOKKEEPING ACCOUNTS ───────────────────────────────
router.get('/bookkeeping-accounts', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('bookkeeping_accounts')
      .select('*')
      .eq('user_id', req.userId)
      .order('code', { ascending: true });
    if (error) throw error;
    res.json({ accounts: data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/bookkeeping-accounts', async (req, res) => {
  try {
    const { code, name, type } = req.body;
    const { data, error } = await supabase
      .from('bookkeeping_accounts')
      .insert([{ user_id: req.userId, code: code || null, name, type }])
      .select().single();
    if (error) throw error;
    res.status(201).json({ account: data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/bookkeeping-accounts/:id', async (req, res) => {
  try {
    const { code, name, type } = req.body;
    const { data, error } = await supabase
      .from('bookkeeping_accounts')
      .update({ code: code || null, name, type })
      .eq('id', req.params.id)
      .eq('user_id', req.userId)
      .select().single();
    if (error) throw error;
    res.json({ account: data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/bookkeeping-accounts/:id', async (req, res) => {
  try {
    const { error } = await supabase
      .from('bookkeeping_accounts')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.userId);
    if (error) throw error;
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── BOOKKEEPING ────────────────────────────────────────
router.get('/bookkeeping', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('bookkeeping_entries')
      .select('*')
      .eq('user_id', req.userId)
      .order('date', { ascending: false })
      .order('created_at', { ascending: true });
    if (error) throw error;
    res.json({ entries: data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/bookkeeping', async (req, res) => {
  try {
    const { transaction_id, date, description, account, debit, credit } = req.body;
    const { data, error } = await supabase
      .from('bookkeeping_entries')
      .insert([{ user_id: req.userId, transaction_id, date, description, account, debit: parseFloat(debit) || 0, credit: parseFloat(credit) || 0 }])
      .select()
      .single();
    if (error) throw error;
    res.status(201).json({ entry: data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/bookkeeping/bulk', async (req, res) => {
  try {
    const { entries } = req.body;
    const rows = entries.map(e => ({
      user_id: req.userId,
      transaction_id: e.transaction_id,
      date: e.date,
      description: e.description,
      account: e.account,
      debit: parseFloat(e.debit) || 0,
      credit: parseFloat(e.credit) || 0,
    }));
    const { data, error } = await supabase.from('bookkeeping_entries').insert(rows).select();
    if (error) throw error;
    res.status(201).json({ entries: data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/bookkeeping/:id', async (req, res) => {
  try {
    const { date, description, account, debit, credit } = req.body;
    const { data, error } = await supabase
      .from('bookkeeping_entries')
      .update({ date, description, account, debit: parseFloat(debit) || 0, credit: parseFloat(credit) || 0 })
      .eq('id', req.params.id)
      .eq('user_id', req.userId)
      .select()
      .single();
    if (error) throw error;
    res.json({ entry: data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/bookkeeping/transaction/:transaction_id', async (req, res) => {
  try {
    const { error } = await supabase
      .from('bookkeeping_entries')
      .delete()
      .eq('transaction_id', req.params.transaction_id)
      .eq('user_id', req.userId);
    if (error) throw error;
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/bookkeeping/:id', async (req, res) => {
  try {
    const { error } = await supabase
      .from('bookkeeping_entries')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.userId);
    if (error) throw error;
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
