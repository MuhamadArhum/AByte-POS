// =============================================================
// AuthContext.jsx - Authentication State Management
// Provides user authentication state to the entire application.
// Uses React Context API to share user data, login, and logout
// functions across all components without prop drilling.
//
// How it works:
// 1. AuthProvider wraps the app (in App.jsx)
// 2. Any component can call useAuth() to get user, login, logout
// 3. User data is persisted in localStorage so it survives page refresh
// 4. On app load, verifies the stored token is still valid with the server
// =============================================================

import { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';  // Configured Axios instance

// Create a React Context for authentication
// This creates a "channel" that can share data across all components
const AuthContext = createContext(null);

// --- AuthProvider Component ---
// Wraps the entire app and provides authentication state.
// Manages: user (current user data), loading (initial check in progress)
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);      // Current logged-in user (or null if logged out)
  const [loading, setLoading] = useState(true); // True while checking if stored token is valid

  // --- On App Load: Verify Stored Token ---
  // When the app first loads, check if there's a saved token in localStorage
  // If yes, verify it with the server to make sure it's still valid
  useEffect(() => {
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    if (token && savedUser) {
      // Immediately show saved user data (so the UI doesn't flash)
      setUser(JSON.parse(savedUser));
      // Then verify with server in background
      api.get('/auth/verify')
        .then((res) => {
          // Token is valid - update user data with fresh data from server
          setUser(res.data.user);
          localStorage.setItem('user', JSON.stringify(res.data.user));
        })
        .catch(() => {
          // Token is invalid or expired - clear everything and force re-login
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setUser(null);
        })
        .finally(() => setLoading(false));  // Done checking
    } else {
      setLoading(false);  // No token found, not logged in
    }
  }, []);  // Empty dependency array = runs only once on mount

  // --- Login Function ---
  // Called by the Login component when user submits email/password.
  // Sends credentials to the server, stores the returned token and user data.
  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    localStorage.setItem('token', res.data.token);                    // Store JWT token
    localStorage.setItem('user', JSON.stringify(res.data.user));      // Store user data
    setUser(res.data.user);                                           // Update React state
    return res.data.user;
  };

  // --- Logout Function ---
  // Clears all stored credentials and resets user state.
  // The ProtectedRoute component will redirect to /login when user becomes null.
  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  // Provide user, login, logout, and loading to all child components
  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

// --- useAuth Hook ---
// Custom hook that components use to access authentication state.
// Usage: const { user, login, logout } = useAuth();
// Throws an error if used outside of AuthProvider (safety check).
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
