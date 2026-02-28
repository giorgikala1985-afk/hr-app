const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const supabase = require('../config/supabase');
const { sendSigningInvite } = require('../utils/mailer');

// GET all documents for user
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('user_id', req.userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ documents: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET document by sign token (public - no auth required)
router.get('/sign/:token', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('sign_token', req.params.token)
      .single();
    if (error || !data) return res.status(404).json({ error: 'Document not found' });
    res.json({ document: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create document
router.post('/', async (req, res) => {
  try {
    const { employee_id, employee_name, type, title, content } = req.body;
    const { data, error } = await supabase
      .from('documents')
      .insert([{ user_id: req.userId, employee_id, employee_name, type: type || 'hiring', title, content, status: 'draft' }])
      .select()
      .single();
    if (error) throw error;
    res.status(201).json({ document: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST send document - generate sign token and optionally email it
router.post('/:id/send', async (req, res) => {
  try {
    const token = crypto.randomBytes(32).toString('hex');
    const { data, error } = await supabase
      .from('documents')
      .update({ sign_token: token, status: 'sent' })
      .eq('id', req.params.id)
      .eq('user_id', req.userId)
      .select()
      .single();
    if (error) throw error;

    const origin = req.headers.origin || process.env.ALLOWED_ORIGINS?.split(',')[0] || 'http://localhost:3000';
    const sign_url = `${origin}/sign/${token}`;

    // Send email if recipient address provided
    const { email, employee_name } = req.body;
    if (email && process.env.SMTP_HOST) {
      try {
        await sendSigningInvite({
          toEmail: email,
          toName: employee_name || data.employee_name,
          signUrl: sign_url,
          companyName: process.env.COMPANY_NAME,
        });
      } catch (mailErr) {
        console.error('Email send failed:', mailErr.message);
        // Don't fail the request — sign token is already saved
      }
    }

    res.json({ document: data, sign_url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT sign document by token (public)
router.put('/sign/:token', async (req, res) => {
  try {
    const { signer_name } = req.body;
    const { data: existing } = await supabase
      .from('documents')
      .select('id, status')
      .eq('sign_token', req.params.token)
      .single();
    if (!existing) return res.status(404).json({ error: 'Document not found' });
    if (existing.status === 'signed') return res.status(400).json({ error: 'Already signed' });

    const { data, error } = await supabase
      .from('documents')
      .update({ status: 'signed', signer_name, signed_at: new Date().toISOString() })
      .eq('sign_token', req.params.token)
      .select()
      .single();
    if (error) throw error;
    res.json({ document: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE document
router.delete('/:id', async (req, res) => {
  try {
    const { error } = await supabase
      .from('documents')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.userId);
    if (error) throw error;
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
