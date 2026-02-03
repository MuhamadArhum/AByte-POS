// =============================================================
// Login.jsx - Login Page Component
// Displays the login form with email and password fields.
// On successful login, redirects to the Dashboard.
// On failure, shows a toast error notification.
// =============================================================

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';  // Auth context for login function
import { toast } from 'react-toastify';               // Toast notifications
import { FiMail, FiLock } from 'react-icons/fi';

export default function Login() {
  // Local state for form fields and loading indicator
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();       // Get the login function from AuthContext
  const navigate = useNavigate();     // React Router navigation hook

  // --- Form Submit Handler ---
  // Called when user clicks "Login" button.
  const handleSubmit = async (e) => {
    e.preventDefault();      // Prevent default form submission (page reload)
    setLoading(true);        // Show loading state on button
    try {
      await login(email, password);         // Send email/password to API
      toast.success('Login successful');     // Show success notification
      navigate('/dashboard');               // Redirect to dashboard
    } catch (err) {
      // Show the error message from the server, or a generic message
      toast.error(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);    // Reset loading state
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        {/* Login page header with app name */}
        <div className="login-header">
          <h1>AByte POS</h1>
          <p>Point of Sale & Inventory Management</p>
        </div>

        {/* Login form */}
        <form onSubmit={handleSubmit}>
          {/* Email field */}
          <div className="form-group">
            <label>Email</label>
            <div className="input-with-icon">
              <FiMail />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
              />
            </div>
          </div>

          {/* Password field */}
          <div className="form-group">
            <label>Password</label>
            <div className="input-with-icon">
              <FiLock />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
              />
            </div>
          </div>

          {/* Submit button - disabled while loading to prevent double-click */}
          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
}
