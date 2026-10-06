import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
  withCredentials: true,
});

let isRefreshing = false;
let refreshSubscribers = [];
let isHandlingSessionExpiry = false;

function onTokenRefreshed(newToken) {
  refreshSubscribers.forEach(cb => cb(newToken));
  refreshSubscribers = [];
}

function addRefreshSubscriber(cb) {
  refreshSubscribers.push(cb);
}

function forceLogout() {
  if (isHandlingSessionExpiry) return;
  isHandlingSessionExpiry = true;
  sessionStorage.removeItem('token');
  sessionStorage.removeItem('employee');
  setTimeout(() => {
    isHandlingSessionExpiry = false;
    window.location.href = '/login';
  }, 100);
}

api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => {
    const contentType = response.headers?.['content-type'] || '';
    if (response.data && typeof response.data === 'object' && !contentType.includes('application/json')) {
      if (contentType && !contentType.includes('json')) {
        console.warn('Expected JSON content-type but received:', contentType);
      }
    }
    return response;
  },
  async (error) => {
    if (error.code === 'ECONNABORTED') {
      error.userMessage = 'Request timed out. Please try again.';
      return Promise.reject(error);
    }

    if (!error.response) {
      error.userMessage = 'Network error. Please check your connection.';
      return Promise.reject(error);
    }

    const originalRequest = error.config;

    // Auto-refresh on 401 (except for refresh/login requests themselves)
    if (
      error.response.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/auth/refresh') &&
      !originalRequest.url?.includes('/auth/login')
    ) {
      originalRequest._retry = true;

      if (isRefreshing) {
        return new Promise((resolve) => {
          addRefreshSubscriber((newToken) => {
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            resolve(api(originalRequest));
          });
        });
      }

      isRefreshing = true;

      try {
        const res = await axios.post(
          `${api.defaults.baseURL}/auth/refresh`,
          {},
          { withCredentials: true }
        );
        const { token, employee } = res.data;
        sessionStorage.setItem('token', token);
        sessionStorage.setItem('employee', JSON.stringify(employee));
        isRefreshing = false;
        onTokenRefreshed(token);
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return api(originalRequest);
      } catch {
        isRefreshing = false;
        refreshSubscribers = [];
        forceLogout();
        return Promise.reject(error);
      }
    }

    if (error.response.status === 401) {
      forceLogout();
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
