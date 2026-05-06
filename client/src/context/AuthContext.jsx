import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('sanket_token');
    if (token) {
      api.get('/auth/profile')
        .then((res) => setUser(res.data.data))
        .catch(() => localStorage.removeItem('sanket_token'))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    const { token, user: userData } = res.data.data;
    localStorage.setItem('sanket_token', token);
    setUser(userData);
    return userData;
  }, []);

  const register = useCallback(async (name, email, password, phone) => {
    const res = await api.post('/auth/register', { name, email, password, phone });
    const { token, user: userData } = res.data.data;
    localStorage.setItem('sanket_token', token);
    setUser(userData);
    return userData;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('sanket_token');
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
