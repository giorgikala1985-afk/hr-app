const express = require('express');
const router = express.Router();
const axios = require('axios');
const crypto = require('crypto');
const supabase = require('../config/supabase');
const { authenticateUser } = require('../middleware/auth');
const { runFinBotChat } = require('../services/finbotChat');
const { EXECUTABLE_TYPES, summarizeAction, executeAction } = require('../services/botActions');

const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const API_VERSION = process.env.WHATSAPP_API_VERSION || 'v20.0';
const GRAPH_API = `https://graph.facebook.com/${API_VERSION}/${PHONE_NUMBER_ID}/messages`;

async function sendMessage(waId, text) {
  if (!ACCESS_TOKEN || !PHONE_NUMBER_ID) { console.error('[whatsapp] WHATSAPP_ACCESS_TOKEN / WHATSAPP_PHONE_NUMBER_ID not configured'); return; }
  try {
    await axios.post(GRAPH_API, {
      messaging_product: 'whatsapp',
      to: waId,
      type: 'text',
      text: { body: text },
    }, { headers: { Authorization: `Bearer ${ACCESS_TOKEN}` } });
  } catch (err) {
    console.error('[whatsapp] sendMessage error:', err.response?.data || err.message);
  }
}

// POST /api/whatsapp/link-code — generate a one-time code the user sends to
// the business WhatsApp number to link their chat to their Finpilot account.
router.post('/link-code', authenticateUser, async (req, res) => {
  try {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const code_expires_at = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    await supabase.from('whatsapp_links').delete().eq('user_id', req.userId).eq('status', 'pending');
    await supabase.from('whatsapp_links').insert({ user_id: req.userId, link_code: code, status: 'pending', code_expires_at });

    res.json({ code, businessNumber: process.env.WHATSAPP_DISPLAY_NUMBER || null, expiresAt: code_expires_at });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/whatsapp/status — is this account currently linked?
router.get('/status', authenticateUser, async (req, res) => {
  try {
    const { data } = await supabase.from('whatsapp_links')
      .select('wa_id, wa_name, linked_at').eq('user_id', req.userId).eq('status', 'linked').maybeSingle();
    res.json({ linked: !!data, waId: data?.wa_id || null, waName: data?.wa_name || null, linkedAt: data?.linked_at || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/whatsapp/link — unlink this account's WhatsApp number.
router.delete('/link', authenticateUser, async (req, res) => {
  try {
    await supabase.from('whatsapp_links').delete().eq('user_id', req.userId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/whatsapp/webhook — Meta's one-time subscription verification handshake.
router.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

// POST /api/whatsapp/webhook — Meta calls this directly (no user session).
// Auth: verifies the X-Hub-Signature-256 header (HMAC-SHA256 of the raw body
// using the Meta App Secret) rather than a simple shared-secret header, since
// that's what WhatsApp Cloud API actually sends.
router.post('/webhook', async (req, res) => {
  res.sendStatus(200); // ack immediately; everything below is fire-and-forget

  try {
    const appSecret = process.env.WHATSAPP_APP_SECRET;
    if (appSecret) {
      const signature = req.headers['x-hub-signature-256'];
      const expected = 'sha256=' + crypto.createHmac('sha256', appSecret).update(req.rawBody || Buffer.alloc(0)).digest('hex');
      if (!signature || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
        console.warn('[whatsapp] webhook: bad signature');
        return;
      }
    }

    const value = req.body?.entry?.[0]?.changes?.[0]?.value;
    const msg = value?.messages?.[0];
    if (!msg || msg.type !== 'text') return; // ignore delivery/status callbacks + non-text messages

    const waId = msg.from;
    const text = msg.text.body.trim();
    const contactName = value.contacts?.[0]?.profile?.name || null;

    if (/^(hi|hello|start|help)$/i.test(text)) {
      await sendMessage(waId, "Welcome to Finpilot! To connect your account, open Settings → WhatsApp in the app to get a 6-digit code, then send it here as:\nlink 123456");
      return;
    }

    const linkMatch = text.match(/^\/?link\s+(\d{6})$/i);
    if (linkMatch) {
      const code = linkMatch[1];
      const { data: row } = await supabase.from('whatsapp_links')
        .select('*').eq('link_code', code).eq('status', 'pending').maybeSingle();
      if (!row || new Date(row.code_expires_at) < new Date()) {
        await sendMessage(waId, '❌ That code is invalid or expired. Generate a new one from Settings → WhatsApp in the app.');
        return;
      }
      await supabase.from('whatsapp_links').update({
        wa_id: waId, status: 'linked', linked_at: new Date().toISOString(),
        wa_name: contactName, link_code: null,
      }).eq('id', row.id);
      await sendMessage(waId, '✅ Connected! You can now ask me to hire, fire, promote, adjust, or initiate a transfer — e.g. "fire John Doe, last day Aug 1, reason: resignation".');
      return;
    }

    if (/^\/?cancel$/i.test(text)) {
      await supabase.from('whatsapp_pending_actions').delete().eq('wa_id', waId);
      await sendMessage(waId, 'Cancelled any pending action.');
      return;
    }

    const { data: link } = await supabase.from('whatsapp_links')
      .select('*').eq('wa_id', waId).eq('status', 'linked').maybeSingle();
    if (!link) {
      await sendMessage(waId, "This number isn't linked to a Finpilot account yet. Open Settings → WhatsApp in the app to get a code, then send it here as: link 123456");
      return;
    }
    const userId = link.user_id;

    const { data: pending } = await supabase.from('whatsapp_pending_actions')
      .select('*').eq('wa_id', waId).order('created_at', { ascending: false }).limit(1).maybeSingle();

    if (pending && new Date(pending.expires_at) > new Date()) {
      const lower = text.toLowerCase();
      if (['yes', 'y', 'confirm'].includes(lower)) {
        await supabase.from('whatsapp_pending_actions').delete().eq('id', pending.id);
        await executeAction(userId, pending.action_payload, (t) => sendMessage(waId, t));
        return;
      }
      if (['no', 'n', 'cancel'].includes(lower)) {
        await supabase.from('whatsapp_pending_actions').delete().eq('id', pending.id);
        await sendMessage(waId, 'Cancelled.');
        return;
      }
      await sendMessage(waId, `You have a pending action awaiting confirmation:\n\n${pending.summary}\n\nReply YES to confirm, NO to cancel, or "cancel" to discard it and send a new message.`);
      return;
    }

    const { answer } = await runFinBotChat({
      userId,
      dataSources: ['employees', 'coagents'],
      messages: [{ role: 'user', content: text }],
      botName: 'Finpilot Assistant',
    });

    const actionMatch = answer.match(/\[ORDER_ACTION\]([\s\S]*?)\[\/ORDER_ACTION\]/);
    const cleanText = answer.replace(/\[ORDER_ACTION\][\s\S]*?\[\/ORDER_ACTION\]/, '').replace(/\[CHART\][\s\S]*?\[\/CHART\]/, '').trim();
    if (cleanText) await sendMessage(waId, cleanText);

    if (actionMatch) {
      let action;
      try { action = JSON.parse(actionMatch[1]); } catch { action = null; }
      if (action?.type && !EXECUTABLE_TYPES.has(action.type)) {
        await sendMessage(waId, `"${action.type}" orders aren't supported via WhatsApp yet — please use the Finpilot web app for this one.`);
      } else if (action?.type) {
        const summary = summarizeAction(action);
        const expires_at = new Date(Date.now() + 10 * 60 * 1000).toISOString();
        await supabase.from('whatsapp_pending_actions').insert({
          wa_id: waId, user_id: userId, action_type: action.type, action_payload: action, summary, expires_at,
        });
        await sendMessage(waId, `${summary}\n\nReply YES to confirm or NO to cancel.`);
      }
    }
  } catch (err) {
    console.error('[whatsapp] webhook error:', err.message);
  }
});

module.exports = router;
