import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || '/api';
const portalApi = axios.create({ baseURL: `${API_BASE}/portal` });

portalApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('portal_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

portalApi.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('portal_token');
      localStorage.removeItem('portal_employee');
      window.location.href = '/portal';
    }
    return Promise.reject(err);
  }
);

export default portalApi;
