import { createContext, useContext, useState, useEffect } from 'react';
import api from '@/lib/api';

const AuthContext = createContext(null);

function isTokenExpired(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (!payload.exp) return false;
    // Add 5-second buffer for clock skew
    return payload.exp * 1000 < Date.now() - 5000;
  } catch {
    return true;
  }
}

export function AuthProvider({ children }) {
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const stored = localStorage.getItem('employee');
    if (token && stored) {
      // Check if token is expired before making API call
      if (isTokenExpired(token)) {
        localStorage.removeItem('token');
        localStorage.removeItem('employee');
        setLoading(false);
        return;
      }
      setEmployee(JSON.parse(stored));
      // Verify token is still valid on server
      api.get('/auth/me')
        .then(res => {
          setEmployee(res.data.employee);
          localStorage.setItem('employee', JSON.stringify(res.data.employee));
        })
        .catch(() => {
          localStorage.removeItem('token');
          localStorage.removeItem('employee');
          setEmployee(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (employeeId, password) => {
    const res = await api.post('/auth/login', { employeeId, password });
    localStorage.setItem('token', res.data.token);
    localStorage.setItem('employee', JSON.stringify(res.data.employee));
    setEmployee(res.data.employee);
    return res.data;
  };

  const register = async (data) => {
    const res = await api.post('/auth/register', data);
    localStorage.setItem('token', res.data.token);
    localStorage.setItem('employee', JSON.stringify(res.data.employee));
    setEmployee(res.data.employee);
    return res.data;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('employee');
    setEmployee(null);
  };

  return (
    <AuthContext.Provider value={{ employee, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
