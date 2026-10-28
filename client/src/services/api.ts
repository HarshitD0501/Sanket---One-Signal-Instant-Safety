import axios from 'axios';
import { AUTH_DETACHED } from '../config/authMode';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('sanket_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (!AUTH_DETACHED && err.response?.status === 401) {
      const url = err.config?.url || '';
      const isExcluded =
        url.includes('/auth/login') ||
        url.includes('/auth/register') ||
        url.includes('/assistant') ||
        url.includes('/livekit');
      if (!isExcluded) {
        localStorage.removeItem('sanket_token');
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

export default api;
