import axios from 'axios';
import { supabase } from '../config/supabase';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || '/api',
});

api.interceptors.request.use(async (config) => {
  // Member token wins if present — sub-users should never use lingering Supabase session
  const memberToken = localStorage.getItem('member_token');
  if (memberToken) {
    config.headers.Authorization = `Bearer ${memberToken}`;
    return config;
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await supabase.auth.signOut();
      localStorage.removeItem('member_token');
      localStorage.removeItem('member_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
