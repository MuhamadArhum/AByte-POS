// =============================================================
// App.jsx - Root Application Component
// Sets up routing, authentication context, and page layout.
// This is the main component that defines which page to show
// based on the URL path. Also handles role-based access control.
//
// Route Structure:
//   /login           - Login page (public)
//   /dashboard       - Dashboard (all roles)
//   /pos             - POS billing interface (all roles)
//   /products        - Product management (Admin, Manager)
//   /inventory       - Inventory management (Admin, Manager)
//   /customers       - Customer management (Admin, Manager)
//   /reports         - Reports (Admin, Manager)
//   /users           - User management (Admin only)
// =============================================================

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';                // Toast notification popup component
import 'react-toastify/dist/ReactToastify.css';                 // Toast notification CSS styles
import { AuthProvider } from './context/AuthContext';            // Provides user login state to all components
import ProtectedRoute from './components/Auth/ProtectedRoute';  // Route guard that checks auth + role
import AppLayout from './components/Layout/AppLayout';          // Sidebar + main content area layout
import Login from './components/Auth/Login';                    // Login page component
import Dashboard from './pages/Dashboard/Dashboard';            // Dashboard with stats and quick actions
import ProductList from './pages/Products/ProductList';         // Product CRUD page
import POSInterface from './pages/POS/POSInterface';            // POS billing/checkout page
import UserManagement from './pages/Users/UserManagement';      // User CRUD page (Admin only)
import InventoryList from './pages/Inventory/InventoryList';    // Inventory/stock management page
import CustomerList from './pages/Customers/CustomerList';      // Customer management page
import Reports from './pages/Reports/Reports';                  // Reports page with 4 tabs
import './App.css';

function App() {
  return (
    // BrowserRouter enables client-side routing (URL changes without page reload)
    <BrowserRouter>
      {/* AuthProvider wraps the entire app to provide user/login/logout state */}
      <AuthProvider>
        <Routes>
          {/* Login page - accessible without authentication */}
          <Route path="/login" element={<Login />} />

          {/* Main app layout - protected (requires login) */}
          {/* AppLayout renders the Sidebar + an <Outlet> for child routes */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            {/* Redirect root "/" to "/dashboard" */}
            <Route index element={<Navigate to="/dashboard" replace />} />

            {/* Dashboard and POS - accessible to ALL logged-in roles */}
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="pos" element={<POSInterface />} />

            {/* Products page - Admin and Manager only */}
            <Route
              path="products"
              element={
                <ProtectedRoute roles={['Admin', 'Manager']}>
                  <ProductList />
                </ProtectedRoute>
              }
            />

            {/* Inventory page - Admin and Manager only */}
            <Route
              path="inventory"
              element={
                <ProtectedRoute roles={['Admin', 'Manager']}>
                  <InventoryList />
                </ProtectedRoute>
              }
            />

            {/* Customers page - Admin and Manager only */}
            <Route
              path="customers"
              element={
                <ProtectedRoute roles={['Admin', 'Manager']}>
                  <CustomerList />
                </ProtectedRoute>
              }
            />

            {/* Reports page - Admin and Manager only */}
            <Route
              path="reports"
              element={
                <ProtectedRoute roles={['Admin', 'Manager']}>
                  <Reports />
                </ProtectedRoute>
              }
            />

            {/* Users page - Admin ONLY */}
            <Route
              path="users"
              element={
                <ProtectedRoute roles={['Admin']}>
                  <UserManagement />
                </ProtectedRoute>
              }
            />
          </Route>

          {/* Catch-all: redirect any unknown URL to dashboard */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>

        {/* Toast notification container - shows success/error popups in top-right corner */}
        <ToastContainer position="top-right" autoClose={3000} />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
