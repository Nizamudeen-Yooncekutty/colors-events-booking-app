import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { authenticateWithSSO } from '@/auth/authService';
import useIdleTimeout from '@/hooks/useIdleTimeout';

const AuthContext = createContext(null);

function parseTokenPayload(token) {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch {
    return null;
  }
}

function isTokenExpired(token) {
  const payload = parseTokenPayload(token);
  if (!payload || !payload.exp) return !payload;
  return payload.exp * 1000 < Date.now() - 5000;
}

export function AuthProvider({ children }) {
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);

  const applyTokenRole = (employeeData, token) => {
    const payload = parseTokenPayload(token);
    if (payload?.role) {
      return { ...employeeData, role: payload.role };
    }
    return employeeData;
  };

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
          const emp = applyTokenRole(res.data.employee, token);
          setEmployee(emp);
          sessionStorage.setItem('employee', JSON.stringify(emp));
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
    const emp = applyTokenRole(res.data.employee, res.data.token);
    sessionStorage.setItem('token', res.data.token);
    sessionStorage.setItem('employee', JSON.stringify(emp));
    setEmployee(emp);
    return res.data;
  };

  const loginWithSSO = async (idToken) => {
    const data = await authenticateWithSSO(idToken);
    const emp = applyTokenRole(data.employee, data.token);
    sessionStorage.setItem('token', data.token);
    sessionStorage.setItem('employee', JSON.stringify(emp));
    setEmployee(emp);
    return data;
  };

  const register = async (data) => {
    const res = await api.post('/auth/register', data);
    const emp = applyTokenRole(res.data.employee, res.data.token);
    sessionStorage.setItem('token', res.data.token);
    sessionStorage.setItem('employee', JSON.stringify(emp));
    setEmployee(emp);
    return res.data;
  };

  const logout = useCallback(() => {
    api.post('/auth/logout').catch(() => {});
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('employee');
    setEmployee(null);
  }, []);

  const handleIdle = useCallback(() => {
    if (employee) {
      logout();
    }
  }, [employee, logout]);

  useIdleTimeout(handleIdle);

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
