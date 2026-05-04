const express = require('express');
const router = express.Router();
const fs = require('fs');
const os = require('os');
const path = require('path');
const supabase = require('../config/supabase');
const OpenAI = require('openai');
const pdfParse = require('pdf-parse');
const { checkPermission } = require('../middleware/permission');
const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

const INVOICE_PROMPT = `You are an invoice analysis expert. Extract the following information in JSON format ONLY (no markdown, no explanation):
{
  "payee": "name of the company or person to pay",
  "bank_name": "bank name if visible",
  "account_number": "bank account number or IBAN if visible",
  "swift_bic": "SWIFT/BIC code if visible",
  "amount": "numeric amount to pay (just the number)",
  "currency": "currency code e.g. USD, EUR, GEL",
  "due_date": "payment due date in YYYY-MM-DD format",
  "invoice_date": "invoice date in YYYY-MM-DD format",
  "invoice_number": "invoice number or reference",
  "description": "brief description of what is being paid for",
  "notes": "any other important payment instructions"
}
If a field is not found, use null. Return only valid JSON.`;

// ── INVOICE SCANNER ─────────────────────────────────────
router.post('/invoices/scan', async (req, res) => {
  try {
    if (!openai) return res.status(500).json({ error: 'OpenAI API key not configured.' });
    const { data, mimeType } = req.body;
    if (!data) return res.status(400).json({ error: 'No file data provided.' });

    let messages;

    if (mimeType === 'application/pdf') {
      const buffer = Buffer.from(data, 'base64');

      // Try text extraction first
      let pdfText = '';
      try {
        const pdf = await pdfParse(buffer);
        pdfText = pdf.text ? pdf.text.trim() : '';
      } catch (e) {
        console.error('pdf-parse error:', e.message);
      }

      if (pdfText) {
        messages = [{ role: 'user', content: `${INVOICE_PROMPT}\n\nInvoice text:\n${pdfText}` }];
      } else {
        // Scanned PDF — render to image with puppeteer
        let puppeteer;
        try { puppeteer = require('puppeteer'); } catch { puppeteer = require('puppeteer-core'); }
        const tmpPath = path.join(os.tmpdir(), `inv_${Date.now()}.pdf`);
        fs.writeFileSync(tmpPath, buffer);
        let browser;
        try {
          browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
          });
          const page = await browser.newPage();
          await page.setViewport({ width: 1240, height: 1754, deviceScaleFactor: 1.5 });
          await page.goto(`file://${tmpPath}`, { waitUntil: 'networkidle0', timeout: 20000 });
          await new Promise(r => setTimeout(r, 1000));
          const screenshot = await page.screenshot({ type: 'jpeg', quality: 90 });
          messages = [{
            role: 'user',
            content: [
              { type: 'text', text: INVOICE_PROMPT },
              { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${screenshot.toString('base64')}` } },
            ],
          }];
        } finally {
          if (browser) await browser.close().catch(() => {});
          try { fs.unlinkSync(tmpPath); } catch {}
        }
      }
    } else {
      // Image — send directly to GPT-4o vision
      const imageType = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(mimeType)
        ? mimeType : 'image/jpeg';
      messages = [{
        role: 'user',
        content: [
          { type: 'text', text: INVOICE_PROMPT },
          { type: 'image_url', image_url: { url: `data:${imageType};base64,${data}` } },
        ],
      }];
    }

    const response = await openai.chat.completions.create({ model: 'gpt-4o', messages, max_tokens: 1000 });
    const rawText = response.choices[0].message.content.trim();
    const jsonText = rawText.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      return res.status(500).json({ error: 'AI returned an unexpected response. Please try again.' });
    }

    res.json({ result: parsed });
  } catch (err) {
    console.error('Invoice scan error:', err.message);
    res.status(500).json({ error: err.message || 'Failed to analyze invoice.' });
  }
});

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
    const { client, product, description, amount, currency, category, date } = req.body;
    const { data, error } = await supabase.from('accounting_sales').insert([{ user_id: req.userId, client, product, description, amount: parseFloat(amount), currency, category, date }]).select().single();
    if (error) throw error;
    res.status(201).json({ record: data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/sales/:id', async (req, res) => {
  try {
    const { client, product, description, amount, currency, category, date } = req.body;
    const { data, error } = await supabase.from('accounting_sales').update({ client, product, description, amount: parseFloat(amount), currency, category, date }).eq('id', req.params.id).eq('user_id', req.userId).select().single();
    if (error) throw error;
    res.json({ record: data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/sales/bulk', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids array is required and must not be empty' });
    }
    const { error } = await supabase.from('accounting_sales').delete().in('id', ids).eq('user_id', req.userId);
    if (error) throw error;
    res.json({ message: `${ids.length} sales deleted` });
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
    const { client, client_email, invoice_number, date, due_date, currency, status, notes, account_number, items, total } = req.body;
    const { data, error } = await supabase.from('accounting_invoices').insert([{ user_id: req.userId, client, client_email, invoice_number, date, due_date: due_date || null, currency, status, notes, account_number: account_number || null, items, total: parseFloat(total) }]).select().single();
    if (error) throw error;
    res.status(201).json({ record: data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/invoices/:id', async (req, res) => {
  try {
    const { client, client_email, invoice_number, date, due_date, currency, status, notes, account_number, items, total } = req.body;
    const { data, error } = await supabase.from('accounting_invoices').update({ client, client_email, invoice_number, date, due_date: due_date || null, currency, status, notes, account_number: account_number || null, items, total: parseFloat(total) }).eq('id', req.params.id).eq('user_id', req.userId).select().single();
    if (error) throw error;
    res.json({ record: data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/invoices/bulk', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids array is required and must not be empty' });
    }
    const { error } = await supabase.from('accounting_invoices').delete().in('id', ids).eq('user_id', req.userId);
    if (error) throw error;
    res.json({ message: `${ids.length} invoices deleted` });
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

router.delete('/transactions/bulk', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids array is required and must not be empty' });
    }
    const { error } = await supabase.from('accounting_transactions').delete().in('id', ids).eq('user_id', req.userId);
    if (error) throw error;
    res.json({ message: `${ids.length} transactions deleted` });
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

router.post('/agents/bulk', async (req, res) => {
  try {
    const { records } = req.body;
    if (!Array.isArray(records) || records.length === 0) return res.status(400).json({ error: 'No records provided' });
    const rows = records.map(r => ({
      user_id: req.userId,
      name: r.name,
      type: r.type || 'Other',
      add_date: r.add_date || null,
      account_number: r.account_number || null,
      address: r.address || null,
      phone: r.phone || null,
    }));
    const { data, error } = await supabase.from('accounting_agents').insert(rows).select();
    if (error) throw error;
    res.status(201).json({ inserted: data.length });
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
    const { code, name, type, account_geo } = req.body;
    const { data, error } = await supabase
      .from('bookkeeping_accounts')
      .insert([{ user_id: req.userId, code: code || null, name, type, account_geo: account_geo || null }])
      .select().single();
    if (error) throw error;
    res.status(201).json({ account: data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/bookkeeping-accounts/bulk', async (req, res) => {
  try {
    const { accounts } = req.body;
    const rows = accounts.map(a => ({
      user_id: req.userId,
      code: a.code || null,
      name: a.name,
      type: a.type || 'Asset',
      account_geo: a.account_geo || null,
    }));
    const { data, error } = await supabase.from('bookkeeping_accounts').insert(rows).select();
    if (error) throw error;
    res.status(201).json({ accounts: data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/bookkeeping-accounts/:id', async (req, res) => {
  try {
    const { code, name, type, account_geo } = req.body;
    const { data, error } = await supabase
      .from('bookkeeping_accounts')
      .update({ code: code || null, name, type, account_geo: account_geo || null })
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
      agent_id: e.agent_id || null,
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

// ── STOCK ──────────────────────────────────────────────
router.get('/stock', async (req, res) => {
  try {
    const { data, error } = await supabase.from('accounting_stock').select('*').eq('user_id', req.userId).order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ records: data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/stock', async (req, res) => {
  try {
    const { sku, name, stock_name, move_in_date, move_in_qty, move_in_price, move_out_date, move_out_qty, move_out_price } = req.body;
    const { data, error } = await supabase.from('accounting_stock').insert([{
      user_id: req.userId, sku, name, stock_name,
      move_in_date: move_in_date || null, move_in_qty: move_in_qty ? parseFloat(move_in_qty) : null, move_in_price: move_in_price ? parseFloat(move_in_price) : null,
      move_out_date: move_out_date || null, move_out_qty: move_out_qty ? parseFloat(move_out_qty) : null, move_out_price: move_out_price ? parseFloat(move_out_price) : null,
    }]).select().single();
    if (error) throw error;
    res.status(201).json({ record: data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/stock/:id', async (req, res) => {
  try {
    const { sku, name, stock_name, move_in_date, move_in_qty, move_in_price, move_out_date, move_out_qty, move_out_price } = req.body;
    const { data, error } = await supabase.from('accounting_stock').update({
      sku, name, stock_name,
      move_in_date: move_in_date || null, move_in_qty: move_in_qty ? parseFloat(move_in_qty) : null, move_in_price: move_in_price ? parseFloat(move_in_price) : null,
      move_out_date: move_out_date || null, move_out_qty: move_out_qty ? parseFloat(move_out_qty) : null, move_out_price: move_out_price ? parseFloat(move_out_price) : null,
    }).eq('id', req.params.id).eq('user_id', req.userId).select().single();
    if (error) throw error;
    res.json({ record: data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/stock/:id', async (req, res) => {
  try {
    const { error } = await supabase.from('accounting_stock').delete().eq('id', req.params.id).eq('user_id', req.userId);
    if (error) throw error;
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── TRANSFERS ───────────────────────────────────────────
router.get('/transfers', async (req, res) => {
  try {
    const { data, error } = await supabase.from('accounting_transfers').select('*').eq('user_id', req.userId).order('due_date', { ascending: true });
    if (error) throw error;
    res.json({ records: data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Resolve a friendly display name for the current user (for requester/approver labels)
async function resolveUserName(req) {
  const email = req.user?.email;
  if (!email) return 'Unknown';
  const { data: appUser } = await supabase
    .from('app_users')
    .select('name')
    .eq('email', email)
    .maybeSingle();
  return appUser?.name || email;
}

// ── Notification helpers ─────────────────────────────────
async function createNotifications(user_id, recipient_emails, type, title, body, reference_id) {
  try {
    const unique = [...new Set((recipient_emails || []).filter(Boolean))];
    if (unique.length === 0) return;
    await supabase.from('app_notifications').insert(
      unique.map(email => ({ user_id, recipient_email: email, type, title, body: body || null, reference_id: reference_id || null }))
    );
  } catch (err) { console.error('createNotifications error:', err.message); }
}

async function getApproverEmails(user_id) {
  try {
    const { data: matrixRows } = await supabase.from('user_matrix')
      .select('role').eq('user_id', user_id).neq('approve_transfer', 'No');
    const roles = [...new Set((matrixRows || []).map(r => r.role).filter(Boolean))];
    if (roles.length === 0) return [];
    const { data: users } = await supabase.from('app_users')
      .select('email').eq('user_id', user_id).in('rights', roles);
    return (users || []).map(u => u.email).filter(Boolean);
  } catch { return []; }
}

async function getMainUserEmail(user_id) {
  try {
    const result = await supabase.auth.admin.getUserById(user_id);
    const email = result?.data?.user?.email || null;
    console.log('[notif] getMainUserEmail:', email);
    return email;
  } catch (err) {
    console.error('[notif] getMainUserEmail failed:', err.message);
    return null;
  }
}

const APPROVAL_TITLES = {
  approved: 'Transfer Approved ✅',
  rejected: 'Transfer Rejected ❌',
  partial:  'Partial Approval ½',
  wait:     'Transfer On Hold ⏸',
};

router.post('/transfers', checkPermission('initiate_transfer'), async (req, res) => {
  try {
    const { client_name, agent_id, amount, due_date, description, status, invoice_raw, iban, invoice_number, auto_approved } = req.body;
    const requester_name = await resolveUserName(req);
    const requester_email = req.user?.email || null;
    const { data, error } = await supabase.from('accounting_transfers').insert([{
      user_id: req.userId, client_name, agent_id: agent_id || null,
      amount: parseFloat(amount), due_date, description,
      iban: iban || null, invoice_number: invoice_number || null,
      status: status || 'normal',
      requester_name,
      requester_email,
      approval_status: auto_approved ? 'approved' : 'pending',
      invoice_raw: invoice_raw || null,
    }]).select().single();
    if (error) throw error;

    // Notify all approvers (and main user) except the requester
    const [approverEmails, mainEmail] = await Promise.all([
      getApproverEmails(req.userId),
      getMainUserEmail(req.userId),
    ]);
    const recipients = [...new Set([...approverEmails, mainEmail])].filter(e => e && e !== requester_email);
    console.log('[notif] transfer submitted — requester:', requester_email, '| approvers:', approverEmails, '| main:', mainEmail, '| recipients:', recipients);
    await createNotifications(
      req.userId, recipients, 'transfer_submitted',
      '📤 New Transfer Request',
      `${requester_name} submitted a transfer for ${client_name} — ${parseFloat(amount).toLocaleString()}`,
      data.id
    );

    res.status(201).json({ record: data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/transfers/:id', checkPermission('initiate_transfer'), async (req, res) => {
  try {
    const { client_name, agent_id, amount, due_date, description, status, requester_name, invoice_raw, iban, invoice_number } = req.body;
    const patch = { client_name, agent_id: agent_id || null, amount: parseFloat(amount), due_date, description, status };
    if (requester_name !== undefined) patch.requester_name = requester_name || null;
    if (invoice_raw !== undefined) patch.invoice_raw = invoice_raw || null;
    if (iban !== undefined) patch.iban = iban || null;
    if (invoice_number !== undefined) patch.invoice_number = invoice_number || null;
    const { data, error } = await supabase.from('accounting_transfers').update(patch).eq('id', req.params.id).eq('user_id', req.userId).select().single();
    if (error) throw error;
    res.json({ record: data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/transfers/:id', checkPermission('initiate_transfer'), async (req, res) => {
  try {
    const { data: existing, error: fetchErr } = await supabase
      .from('accounting_transfers')
      .select('approval_status')
      .eq('id', req.params.id)
      .eq('user_id', req.userId)
      .single();
    if (fetchErr || !existing) return res.status(404).json({ error: 'Not found' });
    const blocked = ['approved', 'rejected', 'partial'];
    if (blocked.includes(existing.approval_status)) {
      return res.status(400).json({ error: 'Decided transfers cannot be deleted — archive them instead' });
    }
    const { error } = await supabase.from('accounting_transfers').delete().eq('id', req.params.id).eq('user_id', req.userId);
    if (error) throw error;
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Approval actions on a transfer row
async function applyTransferAction(req, res, patch) {
  try {
    const approver_name = await resolveUserName(req);

    // Fetch requester info before update for notification
    const { data: existing } = await supabase
      .from('accounting_transfers')
      .select('requester_email, client_name, amount')
      .eq('id', req.params.id)
      .eq('user_id', req.userId)
      .single();

    const { data, error } = await supabase
      .from('accounting_transfers')
      .update({ ...patch, approver_name })
      .eq('id', req.params.id)
      .eq('user_id', req.userId)
      .select()
      .single();
    if (error) throw error;

    // Notify the requester
    if (existing?.requester_email) {
      const title = APPROVAL_TITLES[patch.approval_status] || 'Transfer Updated';
      const noteStr = patch.approver_note ? ` — ${patch.approver_note}` : '';
      const body = `Your transfer for ${existing.client_name} (${existing.amount})${noteStr}`;
      await createNotifications(req.userId, [existing.requester_email], `transfer_${patch.approval_status}`, title, body, req.params.id);
    }

    res.json({ record: data });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

router.post('/transfers/:id/approve', checkPermission('approve_transfer'), async (req, res) => {
  await applyTransferAction(req, res, { approval_status: 'approved', approver_note: null, approved_amount: null });
});

router.post('/transfers/:id/reject', checkPermission('reject_transfer'), async (req, res) => {
  const { note } = req.body || {};
  await applyTransferAction(req, res, { approval_status: 'rejected', approver_note: note || null });
});

router.post('/transfers/:id/partial', checkPermission('approve_transfer'), async (req, res) => {
  const { approved_amount, note } = req.body || {};
  if (approved_amount == null || isNaN(parseFloat(approved_amount))) {
    return res.status(400).json({ error: 'approved_amount is required' });
  }
  await applyTransferAction(req, res, { approval_status: 'partial', approved_amount: parseFloat(approved_amount), approver_note: note || null });
});

router.post('/transfers/:id/wait', checkPermission('approve_transfer'), async (req, res) => {
  const { note } = req.body || {};
  await applyTransferAction(req, res, { approval_status: 'wait', approver_note: note || null });
});

router.post('/transfers/:id/archive', async (req, res) => {
  try {
    const { data: existing, error: fetchErr } = await supabase
      .from('accounting_transfers')
      .select('approval_status')
      .eq('id', req.params.id)
      .eq('user_id', req.userId)
      .single();
    if (fetchErr || !existing) return res.status(404).json({ error: 'Not found' });
    const allowed = ['approved', 'rejected', 'partial'];
    if (!allowed.includes(existing.approval_status)) {
      return res.status(400).json({ error: 'Only decided transfers (approved/rejected/partial) can be archived' });
    }
    const { data, error } = await supabase
      .from('accounting_transfers')
      .update({ approval_status: 'archived' })
      .eq('id', req.params.id)
      .eq('user_id', req.userId)
      .select()
      .single();
    if (error) throw error;
    res.json({ record: data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── TRANSFER APPROVAL REQUESTS ──────────────────────────
router.get('/transfer-requests', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('transfer_requests')
      .select('*')
      .eq('user_id', req.userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ requests: data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/transfer-requests', checkPermission('initiate_transfer'), async (req, res) => {
  try {
    const { requester_name, amount, currency, recipient_name, recipient_account, description } = req.body;
    if (!requester_name || !amount || !recipient_name) {
      return res.status(400).json({ error: 'Requester name, amount and recipient are required.' });
    }
    const { data, error } = await supabase
      .from('transfer_requests')
      .insert([{
        user_id: req.userId,
        requester_name: requester_name.trim(),
        amount: parseFloat(amount),
        currency: currency || 'GEL',
        recipient_name: recipient_name.trim(),
        recipient_account: recipient_account ? recipient_account.trim() : null,
        description: description ? description.trim() : null,
        approval_status: 'pending',
      }])
      .select()
      .single();
    if (error) throw error;
    res.status(201).json({ request: data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/transfer-requests/:id/approve', checkPermission('approve_transfer'), async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('transfer_requests')
      .update({ approval_status: 'approved', approved_at: new Date().toISOString(), rejection_reason: null })
      .eq('id', req.params.id)
      .eq('user_id', req.userId)
      .select()
      .single();
    if (error) throw error;
    res.json({ request: data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/transfer-requests/:id/reject', checkPermission('reject_transfer'), async (req, res) => {
  try {
    const { reason } = req.body;
    const { data, error } = await supabase
      .from('transfer_requests')
      .update({ approval_status: 'rejected', rejected_at: new Date().toISOString(), rejection_reason: reason || null })
      .eq('id', req.params.id)
      .eq('user_id', req.userId)
      .select()
      .single();
    if (error) throw error;
    res.json({ request: data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/transfer-requests/:id', async (req, res) => {
  try {
    const { error } = await supabase
      .from('transfer_requests')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.userId);
    if (error) throw error;
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
