// =============================================================
// ProtectedRoute.jsx - Route Guard Component
// Wraps protected pages to enforce authentication and role checks.
// If not logged in -> redirects to /login
// If logged in but wrong role -> redirects to /dashboard
// If logged in and role allowed -> renders the child component
//
// Usage in App.jsx:
//   <ProtectedRoute>             - Just requires login (any role)
//   <ProtectedRoute roles={['Admin', 'Manager']}>  - Requires specific roles
// =============================================================

import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();

  // While checking auth state (on app load), show a loading screen
  // This prevents a flash of the login page before the token is verified
  if (loading) {
    return <div className="loading-screen">Loading...</div>;
  }

  // If no user is logged in, redirect to the login page
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // If specific roles are required, check if the user's role is in the allowed list
  // Example: roles=['Admin', 'Manager'] and user.role='Cashier' -> redirect to dashboard
  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  // All checks passed - render the protected page
  return children;
}
