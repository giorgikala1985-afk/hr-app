import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const PortalAuthContext = createContext(null);

export function PortalAuthProvider({ children }) {
  const [employee, setEmployee] = useState(() => {
    try { return JSON.parse(localStorage.getItem('portal_employee')); } catch { return null; }
  });
  const [token, setToken] = useState(() => localStorage.getItem('portal_token'));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const login = async (personal_id, pin) => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.post('/api/portal/login', { personal_id, pin });
      const { token: t, employee: emp } = res.data;
      localStorage.setItem('portal_token', t);
      localStorage.setItem('portal_employee', JSON.stringify(emp));
      setToken(t);
      setEmployee(emp);
      return true;
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('portal_token');
    localStorage.removeItem('portal_employee');
    setToken(null);
    setEmployee(null);
  };

  return (
    <PortalAuthContext.Provider value={{ employee, token, loading, error, setError, login, logout, isAuthenticated: !!token }}>
      {children}
    </PortalAuthContext.Provider>
  );
}

export function usePortalAuth() {
  return useContext(PortalAuthContext);
}
