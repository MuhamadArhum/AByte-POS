import axios from 'axios';

const baseURL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api';

const api = axios.create({
  baseURL,
  timeout: 30000, // 30 second timeout — prevents infinite hangs if backend is slow/down
  headers: {
    'Content-Type': 'application/json',
  },
});

// Mutable ref so AuthContext can update it without re-importing
// Admin-selected branch filter — null means all branches
export const branchFilter = { id: null as number | null };

// ── Request interceptor ───────────────────────────────────────
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // When admin has selected a specific branch, pass it as a query param on GET requests
    if (branchFilter.id !== null && config.method?.toLowerCase() === 'get') {
      config.params = { ...config.params, filter_branch: branchFilter.id };
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ── Response interceptor ──────────────────────────────────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const requestUrl = error.config?.url || '';
      const isAuthEndpoint = requestUrl.includes('/auth/login') || requestUrl.includes('/auth/logout');
      const onLoginPage = window.location.pathname === '/login';

      if (!isAuthEndpoint && !onLoginPage) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('permissions');
        localStorage.removeItem('tenantConfig');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
