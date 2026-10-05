import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';

const AuthContext = createContext();

export const ROLE_LABELS = {
  SUPER_ADMIN: 'مدير النظام',
  ADMIN: 'مدير',
  MANAGER: 'مشرف',
  RECEPTIONIST: 'استقبال',
  DOCTOR: 'طبيب',
  NURSE: 'ممرض',
  TECHNICIAN: 'فني',
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('user'));
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(false);

  const login = useCallback(async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('accessToken', data.data.accessToken);
    localStorage.setItem('user', JSON.stringify(data.data.user));
    setUser(data.data.user);
    return data.data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch (e) {}
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
    setUser(null);
  }, []);

  const hasRole = useCallback(
    (...roles) => {
      if (!user) return false;
      if (user.role === 'SUPER_ADMIN') return true;
      return roles.includes(user.role);
    },
    [user]
  );

  const value = {
    user,
    login,
    logout,
    loading,
    hasRole,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
