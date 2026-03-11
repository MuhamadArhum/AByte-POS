import { useState, useEffect } from 'react';
import { TrendingUp, DollarSign, Package, Users, Calendar } from 'lucide-react';
import api from '../../utils/api';

const todayStr = new Date().toISOString().split('T')[0];

const Analytics = () => {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    start_date: todayStr,
    end_date: todayStr
  });

  useEffect(() => {
    fetchAnalytics();
  }, [dateRange]);

  const fetchAnalytics = async () => {
    try {
      const res = await api.get('/analytics/dashboard', { params: dateRange });
      setStats(res.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <div className="p-8">
      <h1 className="text-xl font-semibold tracking-tight text-gray-900 mb-8">Analytics Dashboard</h1>

      {/* Date Range Selector */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6 flex flex-wrap items-center gap-4">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {[{label:'Today',key:'today'},{label:'This Week',key:'week'},{label:'This Month',key:'month'}].map(p => (
            <button key={p.key} onClick={() => {
              const d = new Date();
              let from = todayStr, to = todayStr;
              if (p.key === 'week') from = new Date(d.getTime() - 6 * 86400000).toISOString().split('T')[0];
              else if (p.key === 'month') from = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
              setDateRange({ start_date: from, end_date: to });
            }} className="px-3 py-1.5 rounded-md text-sm font-medium hover:bg-white hover:shadow transition-all">
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Calendar size={18} className="text-gray-400" />
          <div>
            <label className="block text-xs text-gray-500 mb-0.5">From</label>
            <input
              type="date"
              value={dateRange.start_date}
              onChange={(e) => setDateRange({ ...dateRange, start_date: e.target.value })}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm"
            />
          </div>
          <span className="text-gray-400 mt-4">to</span>
          <div>
            <label className="block text-xs text-gray-500 mb-0.5">To</label>
            <input
              type="date"
              value={dateRange.end_date}
              onChange={(e) => setDateRange({ ...dateRange, end_date: e.target.value })}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm"
            />
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-2">
            <DollarSign className="text-emerald-600" size={24} />
            <h3 className="text-sm font-medium text-gray-600">Total Sales</h3>
          </div>
          <p className="text-3xl font-bold text-gray-800">${Number(stats?.sales?.net_sales || 0).toFixed(2)}</p>
          <p className="text-sm text-gray-500 mt-1">{stats?.sales?.total_transactions || 0} transactions</p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="text-emerald-600" size={24} />
            <h3 className="text-sm font-medium text-gray-600">Expenses</h3>
          </div>
          <p className="text-3xl font-bold text-gray-800">${Number(stats?.expenses?.total_expenses || 0).toFixed(2)}</p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-2">
            <Package className="text-emerald-600" size={24} />
            <h3 className="text-sm font-medium text-gray-600">Profit</h3>
          </div>
          <p className="text-3xl font-bold text-gray-800">${Number(stats?.profit || 0).toFixed(2)}</p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-2">
            <Users className="text-orange-600" size={24} />
            <h3 className="text-sm font-medium text-gray-600">Avg Transaction</h3>
          </div>
          <p className="text-3xl font-bold text-gray-800">${Number(stats?.sales?.avg_transaction || 0).toFixed(2)}</p>
        </div>
      </div>

      {/* Top Products */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-base font-semibold text-gray-800 mb-4">Top Selling Products</h2>
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="text-left p-4">Product</th>
              <th className="text-right p-4">Units Sold</th>
              <th className="text-right p-4">Revenue</th>
            </tr>
          </thead>
          <tbody>
            {stats?.topProducts?.map((product: any, index: number) => (
              <tr key={index} className="border-b hover:bg-gray-50">
                <td className="p-4 font-medium">{product.product_name}</td>
                <td className="p-4 text-right">{product.units_sold}</td>
                <td className="p-4 text-right font-semibold">${Number(product.revenue || 0).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Analytics;
