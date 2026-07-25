const express = require('express');
const router = express.Router();
const axios = require('axios');
const supabase = require('../config/supabase');
const { authenticateUser } = require('../middleware/auth');
const { runFinBotChat } = require('../services/finbotChat');
const { createEmployeeRecord, setEmployeeEndDate, createEmployeeUnit, recordSalaryChange, updateEmployeePosition } = require('../services/employeeService');
const { createTransferRecord } = require('../services/transferService');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TG_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

// Action types the Telegram channel knows how to actually execute after
// confirmation. The shared system prompt (services/finbotChat.js) also lets
// the model suggest "advance" for the web FinBots UI — that one isn't wired
// up here yet, so we tell the user to use the app instead.
const EXECUTABLE_TYPES = new Set(['hire', 'firing', 'transfer', 'promotion', 'adjusting']);

async function sendMessage(chatId, text) {
  if (!BOT_TOKEN) { console.error('[telegram] TELEGRAM_BOT_TOKEN not configured'); return; }
  try {
    await axios.post(`${TG_API}/sendMessage`, { chat_id: chatId, text });
  } catch (err) {
    console.error('[telegram] sendMessage error:', err.response?.data || err.message);
  }
}

function summarizeAction(action) {
  switch (action.type) {
    case 'hire':
      return `📋 Hire: ${action.firstName || ''} ${action.lastName || ''} as ${action.position || '-'}, salary ${action.salary ?? '-'} ${action.salaryCurrency || 'GEL'}, starting ${action.startDate || '-'}.`;
    case 'firing':
      return `📋 Terminate: ${action.employeeName || '-'}, end date ${action.endDate || '-'}. Reason: ${action.reason || '-'}`;
    case 'transfer':
      return `📋 Transfer: ${action.amount ?? '-'} GEL to ${action.clientName || '-'}, due ${action.dueDate || '-'}.${action.description ? ` Note: ${action.description}` : ''}`;
    case 'promotion':
      return `📋 Promote: ${action.employeeName || '-'} to ${action.newPosition || '-'}, salary ${action.oldSalary ?? '-'} → ${action.newSalary ?? '-'}, effective ${action.effectiveDate || '-'}.`;
    case 'advance':
      return `📋 Advance payment: ${action.employeeName || '-'}, ${action.totalAmount ?? '-'} ${action.currency || 'GEL'} over ${action.numMonths || '-'} month(s) starting ${action.startMonth || '-'}.`;
    case 'adjusting':
      return `📋 ${action.unitType || 'Adjustment'}: ${action.employeeName || '-'}, ${action.amount ?? '-'} ${action.currency || 'GEL'}.`;
    default:
      return `📋 ${action.type}`;
  }
}

async function executeAction(userId, action, chatId) {
  try {
    if (action.type === 'hire') {
      await createEmployeeRecord(userId, {
        first_name: action.firstName, last_name: action.lastName,
        personal_id: action.personalId, birthdate: action.birthdate,
        position: action.position, salary: action.salary,
        salary_currency: action.salaryCurrency, start_date: action.startDate,
        department: action.department,
      });
      await sendMessage(chatId, `✅ Hired ${action.firstName} ${action.lastName}.`);
    } else if (action.type === 'firing') {
      await setEmployeeEndDate(userId, action.employeeId, action.endDate);
      await sendMessage(chatId, `✅ ${action.employeeName || 'Employee'} terminated, end date ${action.endDate}.`);
    } else if (action.type === 'transfer') {
      await createTransferRecord(userId, 'Telegram Bot', null, {
        client_name: action.clientName, agent_id: action.agentId || null,
        amount: action.amount, due_date: action.dueDate,
        description: action.description, iban: action.iban,
      });
      await sendMessage(chatId, `✅ Transfer of ${action.amount} GEL to ${action.clientName} submitted for approval.`);
    } else if (action.type === 'promotion') {
      if (action.newPosition) await updateEmployeePosition(userId, action.employeeId, action.newPosition);
      if (action.newSalary != null) {
        await recordSalaryChange(userId, action.employeeId, {
          salary: action.newSalary, effective_date: action.effectiveDate, note: action.notes,
        });
      }
      await sendMessage(chatId, `✅ ${action.employeeName || 'Employee'} promoted${action.newPosition ? ` to ${action.newPosition}` : ''}${action.newSalary != null ? `, salary now ${action.newSalary}` : ''}.`);
    } else if (action.type === 'adjusting') {
      await createEmployeeUnit(userId, action.employeeId, {
        type: action.unitType, amount: action.amount,
        date: new Date().toISOString().slice(0, 10),
        currency: action.currency || 'GEL', include_in_salary: true,
      });
      await sendMessage(chatId, `✅ ${action.unitType || 'Adjustment'} of ${action.amount} ${action.currency || 'GEL'} recorded for ${action.employeeName || 'employee'}.`);
    }
  } catch (err) {
    console.error('[telegram] executeAction error:', err.message);
    await sendMessage(chatId, `❌ Failed: ${err.message}`);
  }
}

// POST /api/telegram/link-code — generate a one-time code the user sends to
// the bot to link their Telegram chat to their Finpilot account.
router.post('/link-code', authenticateUser, async (req, res) => {
  try {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const code_expires_at = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    // Clear this user's previous unused codes so only the newest is valid.
    await supabase.from('telegram_links').delete().eq('user_id', req.userId).eq('status', 'pending');
    await supabase.from('telegram_links').insert({ user_id: req.userId, link_code: code, status: 'pending', code_expires_at });

    res.json({ code, botUsername: process.env.TELEGRAM_BOT_USERNAME || null, expiresAt: code_expires_at });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/telegram/status — is this account currently linked?
router.get('/status', authenticateUser, async (req, res) => {
  try {
    const { data } = await supabase.from('telegram_links')
      .select('telegram_username, linked_at').eq('user_id', req.userId).eq('status', 'linked').maybeSingle();
    res.json({ linked: !!data, telegramUsername: data?.telegram_username || null, linkedAt: data?.linked_at || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/telegram/link — unlink this account's Telegram chat.
router.delete('/link', authenticateUser, async (req, res) => {
  try {
    await supabase.from('telegram_links').delete().eq('user_id', req.userId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/telegram/webhook — Telegram calls this directly (no user session).
// Auth: Telegram's `X-Telegram-Bot-Api-Secret-Token` header, set via setWebhook's
// secret_token param, compared against TELEGRAM_WEBHOOK_SECRET.
router.post('/webhook', async (req, res) => {
  // Ack immediately so Telegram doesn't retry; everything below is fire-and-forget.
  res.sendStatus(200);

  try {
    const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (expectedSecret && req.headers['x-telegram-bot-api-secret-token'] !== expectedSecret) {
      console.warn('[telegram] webhook: bad secret token');
      return;
    }

    const msg = req.body?.message;
    if (!msg || !msg.text) return;
    const chatId = msg.chat.id;
    const text = msg.text.trim();

    if (text === '/start') {
      await sendMessage(chatId, "Welcome to Finpilot! To connect your account, open Settings → Telegram in the app to get a 6-digit code, then send it here as:\n/link 123456");
      return;
    }

    const linkMatch = text.match(/^\/link\s+(\d{6})$/);
    if (linkMatch) {
      const code = linkMatch[1];
      const { data: row } = await supabase.from('telegram_links')
        .select('*').eq('link_code', code).eq('status', 'pending').maybeSingle();
      if (!row || new Date(row.code_expires_at) < new Date()) {
        await sendMessage(chatId, '❌ That code is invalid or expired. Generate a new one from Settings → Telegram in the app.');
        return;
      }
      await supabase.from('telegram_links').update({
        chat_id: chatId, status: 'linked', linked_at: new Date().toISOString(),
        telegram_username: msg.from?.username || null, link_code: null,
      }).eq('id', row.id);
      await sendMessage(chatId, '✅ Connected! You can now ask me to hire, fire, or initiate a transfer — e.g. "fire John Doe, last day Aug 1, reason: resignation".');
      return;
    }

    if (text === '/cancel') {
      await supabase.from('telegram_pending_actions').delete().eq('chat_id', chatId);
      await sendMessage(chatId, 'Cancelled any pending action.');
      return;
    }

    const { data: link } = await supabase.from('telegram_links')
      .select('*').eq('chat_id', chatId).eq('status', 'linked').maybeSingle();
    if (!link) {
      await sendMessage(chatId, "This chat isn't linked to a Finpilot account yet. Open Settings → Telegram in the app to get a code, then send it here as /link 123456.");
      return;
    }
    const userId = link.user_id;

    const { data: pending } = await supabase.from('telegram_pending_actions')
      .select('*').eq('chat_id', chatId).order('created_at', { ascending: false }).limit(1).maybeSingle();

    if (pending && new Date(pending.expires_at) > new Date()) {
      const lower = text.toLowerCase();
      if (['yes', 'y', 'confirm'].includes(lower)) {
        await supabase.from('telegram_pending_actions').delete().eq('id', pending.id);
        await executeAction(userId, pending.action_payload, chatId);
        return;
      }
      if (['no', 'n', 'cancel'].includes(lower)) {
        await supabase.from('telegram_pending_actions').delete().eq('id', pending.id);
        await sendMessage(chatId, 'Cancelled.');
        return;
      }
      await sendMessage(chatId, `You have a pending action awaiting confirmation:\n\n${pending.summary}\n\nReply YES to confirm, NO to cancel, or /cancel to discard it and send a new message.`);
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
    if (cleanText) await sendMessage(chatId, cleanText);

    if (actionMatch) {
      let action;
      try { action = JSON.parse(actionMatch[1]); } catch { action = null; }
      if (action?.type && !EXECUTABLE_TYPES.has(action.type)) {
        await sendMessage(chatId, `"${action.type}" orders aren't supported via Telegram yet — please use the Finpilot web app for this one.`);
      } else if (action?.type) {
        const summary = summarizeAction(action);
        const expires_at = new Date(Date.now() + 10 * 60 * 1000).toISOString();
        await supabase.from('telegram_pending_actions').insert({
          chat_id: chatId, user_id: userId, action_type: action.type, action_payload: action, summary, expires_at,
        });
        await sendMessage(chatId, `${summary}\n\nReply YES to confirm or NO to cancel.`);
      }
    }
  } catch (err) {
    console.error('[telegram] webhook error:', err.message);
  }
});

module.exports = router;
