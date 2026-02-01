// =============================================================
// api.js - Axios HTTP Client Configuration
// Creates a pre-configured Axios instance for making API calls.
// Automatically attaches the JWT token to every request and
// handles 401 (unauthorized) responses by redirecting to login.
// All frontend components import this instead of using raw axios.
// =============================================================

import axios from 'axios';

// Create an Axios instance with the backend API base URL
// All API calls will be prefixed with this URL
// Example: api.get('/products') -> GET http://localhost:5000/api/products
const api = axios.create({
  baseURL: 'http://localhost:5000/api',
});

// --- Request Interceptor ---
// Runs before EVERY API request is sent.
// Attaches the JWT token from localStorage to the Authorization header.
// This way, we don't have to manually add the token to every API call.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');  // Get stored JWT token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;  // Add "Bearer <token>" header
  }
  return config;
});

// --- Response Interceptor ---
// Runs after EVERY API response is received.
// If the server returns 401 (Unauthorized), it means the token is
// expired or invalid. In that case, clear the stored credentials
// and redirect the user to the login page.
api.interceptors.response.use(
  (response) => response,  // If response is OK, just pass it through
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');   // Clear expired/invalid token
      localStorage.removeItem('user');    // Clear stored user data
      window.location.href = '/login';    // Redirect to login page
    }
    return Promise.reject(error);  // Re-throw the error so the calling code can handle it
  }
);

export default api;
