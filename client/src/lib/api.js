import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

let isHandlingSessionExpiry = false;

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => {
    // Validate that JSON responses have correct content-type
    const contentType = response.headers?.['content-type'] || '';
    if (response.data && typeof response.data === 'object' && !contentType.includes('application/json')) {
      // Allow empty content-type for small responses but warn on mismatch
      if (contentType && !contentType.includes('json')) {
        console.warn('Expected JSON content-type but received:', contentType);
      }
    }
    return response;
  },
  (error) => {
    if (error.code === 'ECONNABORTED') {
      error.userMessage = 'Request timed out. Please try again.';
      return Promise.reject(error);
    }

    if (!error.response) {
      error.userMessage = 'Network error. Please check your connection.';
      return Promise.reject(error);
    }

    if (error.response.status === 401 && !isHandlingSessionExpiry) {
      isHandlingSessionExpiry = true;
      localStorage.removeItem('token');
      localStorage.removeItem('employee');
      setTimeout(() => {
        isHandlingSessionExpiry = false;
        window.location.href = '/login';
      }, 100);
    }

    if (error.response.status === 403) {
      error.userMessage = 'You do not have permission to perform this action.';
    }

    if (error.response.status === 429) {
      error.userMessage = 'Too many requests. Please wait a moment and try again.';
    }

    if (error.response.status >= 500) {
      error.userMessage = 'Server error. Please try again later.';
    }

    return Promise.reject(error);
  }
);

export default api;
