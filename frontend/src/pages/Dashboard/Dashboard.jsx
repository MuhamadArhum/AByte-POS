import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { FiDollarSign, FiShoppingBag, FiPackage, FiAlertTriangle } from 'react-icons/fi';

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    todaySales: 0,
    todayTransactions: 0,
    totalProducts: 0,
    lowStockCount: 0,
  });

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const [dailyRes, productsRes, lowStockRes] = await Promise.all([
        api.get('/reports/daily').catch(() => ({ data: {} })),
        api.get('/products').catch(() => ({ data: [] })),
        api.get('/inventory/low-stock').catch(() => ({ data: [] })),
      ]);

      setStats({
        todaySales: dailyRes.data.total_revenue || 0,
        todayTransactions: dailyRes.data.total_transactions || 0,
        totalProducts: productsRes.data.length || 0,
        lowStockCount: lowStockRes.data.length || 0,
      });
    } catch (err) {
      // Stats may fail for cashier role - that's ok
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>Dashboard</h1>
        <p>Welcome back, {user?.name}!</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card" onClick={() => navigate('/pos')}>
          <div className="stat-icon blue">
            <FiDollarSign />
          </div>
          <div className="stat-info">
            <h3>Today's Revenue</h3>
            <p className="stat-value">Rs. {Number(stats.todaySales).toLocaleString()}</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon green">
            <FiShoppingBag />
          </div>
          <div className="stat-info">
            <h3>Today's Transactions</h3>
            <p className="stat-value">{stats.todayTransactions}</p>
          </div>
        </div>

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

      <div className="quick-actions">
        <h2>Quick Actions</h2>
        <div className="action-buttons">
          <button className="btn btn-primary" onClick={() => navigate('/pos')}>
            New Sale
          </button>
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
