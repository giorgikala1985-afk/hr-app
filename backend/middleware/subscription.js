const supabase = require('../config/supabase');

const requireSubscription = async (req, res, next) => {
  try {
    const { data: subscription, error } = await supabase
      .from('subscriptions')
      .select('status, current_period_end')
      .eq('user_id', req.userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    const isActive = subscription
      && subscription.status === 'active'
      && new Date(subscription.current_period_end) > new Date();

    if (!isActive) {
      return res.status(403).json({
        error: 'Active subscription required',
        code: 'SUBSCRIPTION_REQUIRED',
      });
    }

    next();
  } catch (error) {
    console.error('Subscription check error:', error);
    res.status(500).json({ error: 'Failed to verify subscription' });
  }
};

module.exports = { requireSubscription };
