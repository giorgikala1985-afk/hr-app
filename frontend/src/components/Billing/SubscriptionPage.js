import React, { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import api from '../../services/api';
import './Billing.css';

function SubscriptionPage() {
  const { t } = useLanguage();
  const { subscription, subscriptionLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchParams] = useSearchParams();
  const canceled = searchParams.get('canceled');

  const handleSubscribe = async () => {
    try {
      setLoading(true);
      setError('');
      const { data } = await api.post('/billing/create-payment');
      window.location.href = data.url;
    } catch (err) {
      setError(t('sub.paymentFailed'));
      setLoading(false);
    }
  };

  if (subscriptionLoading) {
    return <div className="loading-screen">{t('billing.loading')}</div>;
  }

  if (subscription?.status === 'active' && new Date(subscription.current_period_end) > new Date()) {
    return (
      <div className="billing-container">
        <div className="billing-card">
          <h2>{t('sub.alreadySubscribed')}</h2>
          <p>{t('sub.activeSubscription')}</p>
          <Link to="/" className="btn btn-primary">{t('sub.goToDashboard')}</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="billing-container">
      <div className="billing-card subscribe-card">
        <h1>{t('sub.title')}</h1>
        <p className="subscribe-subtitle">{t('sub.subtitle')}</p>

        {canceled && (
          <div className="alert alert-warning">
            {t('sub.canceled')}
          </div>
        )}

        {error && <div className="alert alert-error">{error}</div>}

        <div className="plan-card">
          <div className="plan-header">
            <h3>{t('sub.monthlyPlan')}</h3>
          </div>
          <div className="plan-features">
            <ul>
              <li>{t('sub.feature1')}</li>
              <li>{t('sub.feature2')}</li>
              <li>{t('sub.feature3')}</li>
              <li>{t('sub.feature4')}</li>
              <li>{t('sub.feature5')}</li>
              <li>{t('sub.feature6')}</li>
            </ul>
          </div>
          <button
            onClick={handleSubscribe}
            disabled={loading}
            className="btn btn-primary btn-subscribe"
          >
            {loading ? t('sub.redirecting') : t('sub.subscribeNow')}
          </button>
        </div>

        <p className="billing-footer-text">
          {t('sub.footer')}
        </p>
      </div>
    </div>
  );
}

export default SubscriptionPage;
