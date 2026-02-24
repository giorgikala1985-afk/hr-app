const axios = require('axios');

const BASE_URL = process.env.TBC_API_BASE_URL || 'https://api.tbcbank.ge/v1';
const API_KEY = process.env.TBC_API_KEY;
const CLIENT_ID = process.env.TBC_CLIENT_ID;
const CLIENT_SECRET = process.env.TBC_CLIENT_SECRET;

let cachedToken = null;
let tokenExpiresAt = 0;

async function getAccessToken() {
  // Return cached token if still valid (with 5 min buffer)
  if (cachedToken && Date.now() < tokenExpiresAt - 5 * 60 * 1000) {
    return cachedToken;
  }

  const response = await axios.post(
    `${BASE_URL}/tpay/access-token`,
    new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    }).toString(),
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        apikey: API_KEY,
      },
    }
  );

  cachedToken = response.data.access_token;
  // Token valid for ~24h (86400 seconds)
  tokenExpiresAt = Date.now() + (response.data.expires_in || 86400) * 1000;

  return cachedToken;
}

async function createPayment({ amount, currency, returnUrl, callbackUrl, merchantPaymentId, description }) {
  const token = await getAccessToken();

  const response = await axios.post(
    `${BASE_URL}/tpay/payments`,
    {
      amount: {
        currency: currency || 'GEL',
        total: amount,
        subTotal: amount,
        tax: 0,
        shipping: 0,
      },
      returnurl: returnUrl,
      callbackUrl: callbackUrl,
      merchantPaymentId: merchantPaymentId,
      language: 'EN',
      description: description || 'HR Manager Subscription',
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: API_KEY,
        'Content-Type': 'application/json',
      },
    }
  );

  return response.data;
}

async function getPaymentDetails(payId) {
  const token = await getAccessToken();

  const response = await axios.get(
    `${BASE_URL}/tpay/payments/${payId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: API_KEY,
      },
    }
  );

  return response.data;
}

module.exports = { getAccessToken, createPayment, getPaymentDetails };
