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
    const token = sessionStorage.getItem('token');
    if (token) {
      if (isTokenExpired(token)) {
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('employee');
        setLoading(false);
        return;
      }
      api.get('/auth/me')
        .then(res => {
          setEmployee(res.data.employee);
          sessionStorage.setItem('employee', JSON.stringify(res.data.employee));
        })
        .catch(() => {
          sessionStorage.removeItem('token');
          sessionStorage.removeItem('employee');
          setEmployee(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (employeeId, password) => {
    const res = await api.post('/auth/login', { employeeId, password });
    sessionStorage.setItem('token', res.data.token);
    sessionStorage.setItem('employee', JSON.stringify(res.data.employee));
    setEmployee(res.data.employee);
    return res.data;
  };

  const loginWithSSO = async (idToken) => {
    const data = await authenticateWithSSO(idToken);
    sessionStorage.setItem('token', data.token);
    sessionStorage.setItem('employee', JSON.stringify(data.employee));
    setEmployee(data.employee);
    return data;
  };

  const register = async (data) => {
    const res = await api.post('/auth/register', data);
    sessionStorage.setItem('token', res.data.token);
    sessionStorage.setItem('employee', JSON.stringify(res.data.employee));
    setEmployee(res.data.employee);
    return res.data;
  };

  const logout = () => {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('employee');
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
