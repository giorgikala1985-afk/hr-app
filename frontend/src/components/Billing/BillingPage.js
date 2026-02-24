import React, { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import './Billing.css';

function BillingPage() {
  const { t } = useLanguage();
  const { subscription, subscriptionLoading, refreshSubscription } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const success = searchParams.get('success');

  useEffect(() => {
    if (success) {
      refreshSubscription();
    }
  }, [success, refreshSubscription]);

  if (subscriptionLoading) {
    return <div className="loading-screen">{t('billing.loading')}</div>;
  }

  const isActive = subscription?.status === 'active'
    && subscription?.current_period_end
    && new Date(subscription.current_period_end) > new Date();

  const periodEnd = subscription?.current_period_end
    ? new Date(subscription.current_period_end).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null;

  const daysLeft = subscription?.current_period_end
    ? Math.max(0, Math.ceil((new Date(subscription.current_period_end) - new Date()) / (1000 * 60 * 60 * 24)))
    : 0;

  return (
    <div className="billing-container">
      <div className="billing-card">
        <h1>{t('billing.title')}</h1>

        {success && (
          <div className="alert alert-success">
            {t('billing.paymentSuccess')}
          </div>
        )}

        <div className="subscription-status">
          <div className="status-row">
            <span className="status-label">{t('billing.status')}</span>
            <span className={`status-badge ${isActive ? 'active' : 'inactive'}`}>
              {isActive ? t('billing.active') : (subscription?.status || t('billing.noSubscription'))}
            </span>
          </div>

          {periodEnd && (
            <div className="status-row">
              <span className="status-label">{t('billing.accessUntil')}</span>
              <span className="status-value">{periodEnd}</span>
            </div>
          )}

          {isActive && (
            <div className="status-row">
              <span className="status-label">{t('billing.daysRemaining')}</span>
              <span className="status-value">{t('billing.days').replace('{count}', daysLeft)}</span>
            </div>
          )}
        </div>

        {!isActive && (
          <button
            onClick={() => navigate('/subscribe')}
            className="btn btn-primary"
          >
            {subscription ? t('billing.renewSubscription') : t('billing.subscribeNow')}
          </button>
        )}
      </div>
    </div>
  );
}

export default BillingPage;
