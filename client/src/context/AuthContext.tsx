import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '../services/api';
import type { User } from '../types';
import { AUTH_DETACHED, DETACHED_USER } from '../config/authMode';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (name: string, email: string, phone: string, password: string) => Promise<User>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (AUTH_DETACHED) {
      setUser(DETACHED_USER);
      setLoading(false);
      return;
    }

    const token = localStorage.getItem('sanket_token');
    if (token) {
      api.get('/auth/profile')
        .then((r) => setUser(r.data.data))
        .catch(() => localStorage.removeItem('sanket_token'))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.post('/auth/login', { email, password });
    localStorage.setItem('sanket_token', res.data.data.token);
    setUser(res.data.data.user);
    return res.data.data.user as User;
  };

  const register = async (name: string, email: string, phone: string, password: string) => {
    const res = await api.post('/auth/register', { name, email, phone, password });
    localStorage.setItem('sanket_token', res.data.data.token);
    setUser(res.data.data.user);
    return res.data.data.user as User;
  };

  const logout = () => {
    localStorage.removeItem('sanket_token');
    setUser(AUTH_DETACHED ? DETACHED_USER : null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
