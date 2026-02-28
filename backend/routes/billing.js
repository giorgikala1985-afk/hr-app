const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { authenticateUser } = require('../middleware/auth');
const { createPayment, getPaymentDetails } = require('../config/tbcpay');
const crypto = require('crypto');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const SUBSCRIPTION_PRICE = parseFloat(process.env.SUBSCRIPTION_PRICE_GEL || '29.99');
const SUBSCRIPTION_DAYS = 30;

// Get current subscription status (authenticated)
router.get('/subscription', authenticateUser, async (req, res) => {
  try {
    const { data: subscription, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', req.userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    // Check if subscription has expired
    if (subscription && subscription.status === 'active' && subscription.current_period_end) {
      if (new Date(subscription.current_period_end) < new Date()) {
        // Mark as expired
        await supabase
          .from('subscriptions')
          .update({ status: 'expired', updated_at: new Date().toISOString() })
          .eq('user_id', req.userId);
        subscription.status = 'expired';
      }
    }

    res.json({ subscription: subscription || null });
  } catch (error) {
    console.error('Get subscription error:', error);
    res.status(500).json({ error: 'Failed to get subscription status' });
  }
});

// Create TBC payment for subscription (authenticated)
router.post('/create-payment', authenticateUser, async (req, res) => {
  try {
    const merchantPaymentId = `sub_${req.userId}_${Date.now()}`;
    const callbackUrl = `${process.env.BACKEND_URL || 'http://localhost:5001'}/api/billing/callback`;

    const payment = await createPayment({
      amount: SUBSCRIPTION_PRICE,
      currency: 'GEL',
      returnUrl: `${FRONTEND_URL}/billing?success=true`,
      callbackUrl: callbackUrl,
      merchantPaymentId: merchantPaymentId,
      description: 'Finpilot Monthly Sub',
    });

    // Upsert a pending subscription record
    const { error } = await supabase
      .from('subscriptions')
      .upsert({
        user_id: req.userId,
        status: 'pending',
        tbc_pay_id: payment.payId,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    if (error) throw error;

    // Find the redirect URL from TBC response
    const approvalLink = payment.links?.find(link => link.rel === 'approval_url');
    const redirectUrl = approvalLink?.uri || null;

    if (!redirectUrl) {
      throw new Error('No approval URL returned from TBC');
    }

    res.json({ url: redirectUrl, payId: payment.payId });
  } catch (error) {
    console.error('Create payment error:', error);
    res.status(500).json({ error: 'Failed to create payment' });
  }
});

// TBC payment callback (public — called by TBC servers)
router.post('/callback', async (req, res) => {
  try {
    const { PayId, Status } = req.body;

    if (!PayId) {
      return res.status(400).json({ error: 'Missing PayId' });
    }

    // Verify payment status with TBC
    const paymentDetails = await getPaymentDetails(PayId);

    if (!paymentDetails) {
      return res.status(400).json({ error: 'Payment not found' });
    }

    // Find subscription by tbc_pay_id
    const { data: subscription, error: findError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('tbc_pay_id', PayId)
      .single();

    if (findError) {
      console.error('Subscription lookup error:', findError);
      return res.status(404).json({ error: 'Subscription not found for this payment' });
    }

    // Check if payment was successful
    const isSuccessful = paymentDetails.status === 'Succeeded' || paymentDetails.status === 'Confirmed';

    if (isSuccessful) {
      const now = new Date();
      const periodEnd = new Date(now.getTime() + SUBSCRIPTION_DAYS * 24 * 60 * 60 * 1000);

      const { error: updateError } = await supabase
        .from('subscriptions')
        .update({
          status: 'active',
          current_period_start: now.toISOString(),
          current_period_end: periodEnd.toISOString(),
          updated_at: now.toISOString(),
        })
        .eq('tbc_pay_id', PayId);

      if (updateError) throw updateError;
    } else {
      await supabase
        .from('subscriptions')
        .update({
          status: 'failed',
          updated_at: new Date().toISOString(),
        })
        .eq('tbc_pay_id', PayId);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Callback error:', error);
    res.status(500).json({ error: 'Callback processing failed' });
  }
});

module.exports = router;
