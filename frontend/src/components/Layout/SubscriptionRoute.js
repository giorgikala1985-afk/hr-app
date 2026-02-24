import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

function SubscriptionRoute({ children }) {
  const { subscription, subscriptionLoading } = useAuth();

  if (subscriptionLoading) {
    return <div className="loading-screen">Loading...</div>;
  }

  const isActive = subscription?.status === 'active'
    && subscription?.current_period_end
    && new Date(subscription.current_period_end) > new Date();

  if (!isActive) {
    return <Navigate to="/subscribe" />;
  }

  return children;
}

export default SubscriptionRoute;
