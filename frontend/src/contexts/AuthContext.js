import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../config/supabase';

const AuthContext = createContext({});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        setLoading(false);
      } else {
        // Restore member session from localStorage
        const stored = localStorage.getItem('member_user');
        setUser(stored ? JSON.parse(stored) : null);
        setLoading(false);
      }
    });

    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user);
      } else if (!localStorage.getItem('member_token')) {
        setUser(null);
      }
    });

    return () => authSubscription.unsubscribe();
  }, []);

  const signIn = async (email, password) => {
    // Always clear any prior session first
    localStorage.removeItem('member_token');
    localStorage.removeItem('member_user');
    await supabase.auth.signOut();

    // Try member login first (sub-users)
    const apiUrl = process.env.REACT_APP_API_URL || '/api';
    const res = await fetch(`${apiUrl}/auth/member-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (res.ok) {
      const memberData = await res.json();
      localStorage.setItem('member_token', memberData.token);
      localStorage.setItem('member_user', JSON.stringify(memberData.user));
      setUser(memberData.user);
      return memberData;
    }

    // Fall back to Supabase auth (Super Admins / company owners)
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  };

  const signUp = async (email, password, metadata = {}) => {
    const apiUrl = process.env.REACT_APP_API_URL || '/api';
    const res = await fetch(`${apiUrl}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, ...metadata }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Signup failed');
    // Sign in after successful registration
    const { data: session, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) throw signInError;
    return session;
  };

  const signOut = async () => {
    localStorage.removeItem('member_token');
    localStorage.removeItem('member_user');
    setUser(null);
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      signIn,
      signUp,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
