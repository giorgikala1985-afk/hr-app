const axios = require('axios');

const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const API_VERSION = process.env.WHATSAPP_API_VERSION || 'v20.0';
const GRAPH_API = `https://graph.facebook.com/${API_VERSION}/${PHONE_NUMBER_ID}/messages`;

// Sends a free-form WhatsApp text message. Per Meta's rules this only
// succeeds if the recipient messaged the business number within the last
// 24 hours — outside that window a pre-approved template message is
// required instead. Used both for bot chat replies and, now, notifications.
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

module.exports = { sendMessage };
