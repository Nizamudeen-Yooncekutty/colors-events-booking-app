import { createContext, useContext, useState, useEffect } from 'react';
import api from '@/lib/api';
import { authenticateWithSSO } from '@/auth/authService';

const AuthContext = createContext(null);

function isTokenExpired(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (!payload.exp) return false;
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
      if (isTokenExpired(token)) {
        localStorage.removeItem('token');
        localStorage.removeItem('employee');
        setLoading(false);
        return;
      }
      setEmployee(JSON.parse(stored));
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

  const loginWithSSO = async (idToken) => {
    const data = await authenticateWithSSO(idToken);
    localStorage.setItem('token', data.token);
    localStorage.setItem('employee', JSON.stringify(data.employee));
    setEmployee(data.employee);
    return data;
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
    <AuthContext.Provider value={{ employee, loading, login, loginWithSSO, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
