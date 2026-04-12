import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const ADMIN_EMAILS = (process.env.REACT_APP_ADMIN_EMAILS || '')
  .split(',').map(e => e.trim().toLowerCase()).filter(Boolean);

function AdminRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) return <div className="loading-screen">Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  if (!ADMIN_EMAILS.includes(user.email?.toLowerCase())) return <Navigate to="/" />;

  return children;
}

export default AdminRoute;
