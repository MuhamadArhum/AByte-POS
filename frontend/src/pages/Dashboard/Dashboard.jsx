// =============================================================
// Dashboard.jsx - Dashboard Page Component
// The main landing page after login. Shows:
// - Stats cards: today's revenue, transactions, total products, low stock count
// - Quick action buttons: New Sale, Manage Products, View Reports
// Stats cards are clickable and navigate to their respective pages.
// Admin/Manager see all 4 cards; Cashier sees only revenue and transactions.
// =============================================================

import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { FiDollarSign, FiShoppingBag, FiPackage, FiAlertTriangle } from 'react-icons/fi';

export default function Dashboard() {
  const { user } = useAuth();       // Get current user (for name and role)
  const navigate = useNavigate();    // Navigation hook

  // Dashboard statistics state
  const [stats, setStats] = useState({
    todaySales: 0,          // Total revenue for today
    todayTransactions: 0,   // Number of sales today
    totalProducts: 0,       // Total number of products in system
    lowStockCount: 0,       // Products with stock between 1-9
  });

  // Load stats when the component mounts (page loads)
  useEffect(() => {
    loadStats();
  }, []);

  // --- Fetch Dashboard Statistics ---
  // Makes 3 API calls in parallel using Promise.all for speed.
  // Each call has a .catch() fallback so if one fails (e.g., Cashier can't access reports),
  // the others still work.
  const loadStats = async () => {
    try {
      const [dailyRes, productsRes, lowStockRes] = await Promise.all([
        api.get('/reports/daily').catch(() => ({ data: {} })),          // May fail for Cashier role
        api.get('/products').catch(() => ({ data: [] })),              // Get all products
        api.get('/inventory/low-stock').catch(() => ({ data: [] })),   // Get low stock items
      ]);

      setStats({
        todaySales: dailyRes.data.total_revenue || 0,
        todayTransactions: dailyRes.data.total_transactions || 0,
        totalProducts: productsRes.data.length || 0,
        lowStockCount: lowStockRes.data.length || 0,
      });
    } catch (err) {
      // Stats may fail for cashier role - that's ok, cards will show 0
    }
  };

  return (
    <div className="page">
      {/* Page header with welcome message */}
      <div className="page-header">
        <h1>Dashboard</h1>
        <p>Welcome back, {user?.name}!</p>
      </div>

      {/* Stats cards grid */}
      <div className="stats-grid">
        {/* Today's Revenue card - clickable, navigates to POS */}
        <div className="stat-card" onClick={() => navigate('/pos')}>
          <div className="stat-icon blue">
            <FiDollarSign />
          </div>
          <div className="stat-info">
            <h3>Today's Revenue</h3>
            <p className="stat-value">Rs. {Number(stats.todaySales).toLocaleString()}</p>
          </div>
        </div>

        {/* Today's Transactions card */}
        <div className="stat-card">
          <div className="stat-icon green">
            <FiShoppingBag />
          </div>
          <div className="stat-info">
            <h3>Today's Transactions</h3>
            <p className="stat-value">{stats.todayTransactions}</p>
          </div>
        </div>

        {/* Total Products and Low Stock cards - only visible to Admin/Manager */}
        {['Admin', 'Manager'].includes(user?.role) && (
          <>
            <div className="stat-card" onClick={() => navigate('/products')}>
              <div className="stat-icon purple">
                <FiPackage />
              </div>
              <div className="stat-info">
                <h3>Total Products</h3>
                <p className="stat-value">{stats.totalProducts}</p>
              </div>
            </div>

            <div className="stat-card" onClick={() => navigate('/inventory')}>
              <div className="stat-icon orange">
                <FiAlertTriangle />
              </div>
              <div className="stat-info">
                <h3>Low Stock Items</h3>
                <p className="stat-value">{stats.lowStockCount}</p>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Quick action buttons */}
      <div className="quick-actions">
        <h2>Quick Actions</h2>
        <div className="action-buttons">
          <button className="btn btn-primary" onClick={() => navigate('/pos')}>
            New Sale
          </button>
          {/* Admin/Manager get extra action buttons */}
          {['Admin', 'Manager'].includes(user?.role) && (
            <>
              <button className="btn btn-secondary" onClick={() => navigate('/products')}>
                Manage Products
              </button>
              <button className="btn btn-secondary" onClick={() => navigate('/reports')}>
                View Reports
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
