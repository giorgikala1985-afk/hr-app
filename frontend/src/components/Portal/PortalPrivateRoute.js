import React from 'react';
import { Navigate } from 'react-router-dom';
import { usePortalAuth } from '../../contexts/PortalAuthContext';
import PortalLayout from './PortalLayout';

export default function PortalPrivateRoute({ children }) {
  const { isAuthenticated } = usePortalAuth();
  if (!isAuthenticated) return <Navigate to="/portal" replace />;
  return <PortalLayout>{children}</PortalLayout>;
}
