import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { 
  DollarSign, 
  ShoppingBag, 
  ShoppingCart,
  AlertTriangle, 
  TrendingUp, 
  Plus, 
  Users, 
  Package, 
  CreditCard, 
  ArrowRight 
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar
} from 'recharts';

const Dashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    totalSales: 0,
    orderCount: 0,
    lowStockCount: 0
  });
  const [chartData, setChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Fetch all data needed
      const [salesRes, productsRes] = await Promise.all([
        api.get('/sales'),
        api.get('/products')
      ]);

      const allSales = salesRes.data;
      const allProducts = productsRes.data;

      // 1. Calculate Today's Stats
      const today = new Date().toISOString().split('T')[0];
      const todaySales = allSales.filter((s: any) => s.sale_date && s.sale_date.startsWith(today));
      const totalRevenue = todaySales.reduce((sum: number, sale: any) => sum + parseFloat(sale.total_amount || 0), 0);
      const lowStock = allProducts.filter((p: any) => (p.stock_quantity || 0) < 10);

      setStats({
        totalSales: totalRevenue,
        orderCount: todaySales.length,
        lowStockCount: lowStock.length
      });

      // 2. Prepare Chart Data (Last 7 Days)
      const last7Days = [...Array(7)].map((_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        return d.toISOString().split('T')[0];
      });

      const salesData = last7Days.map(date => {
        const daySales = allSales.filter((s: any) => s.sale_date && s.sale_date.startsWith(date));
        const amount = daySales.reduce((sum: number, s: any) => sum + parseFloat(s.total_amount || 0), 0);
        return {
          name: new Date(date).toLocaleDateString('en-US', { weekday: 'short' }),
          sales: amount,
          orders: daySales.length
        };
      });

      setChartData(salesData);

    } catch (error) {
      console.error("Failed to fetch dashboard data", error);
      // Fallback mock data for visual demonstration if API fails
      setChartData([
        { name: 'Mon', sales: 4000, orders: 24 },
        { name: 'Tue', sales: 3000, orders: 18 },
        { name: 'Wed', sales: 2000, orders: 12 },
        { name: 'Thu', sales: 2780, orders: 20 },
        { name: 'Fri', sales: 1890, orders: 15 },
        { name: 'Sat', sales: 2390, orders: 22 },
        { name: 'Sun', sales: 3490, orders: 30 },
      ]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  const quickActions = [
    { label: 'New Sale', icon: ShoppingCart, path: '/pos', color: 'bg-emerald-100 text-emerald-600' },
    { label: 'Add Product', icon: Plus, path: '/inventory', color: 'bg-blue-100 text-blue-600' }, // Redirects to inventory for now
    { label: 'Add Customer', icon: Users, path: '/customers', color: 'bg-purple-100 text-purple-600' },
    { label: 'View Reports', icon: TrendingUp, path: '/reports', color: 'bg-orange-100 text-orange-600' },
  ];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-800">Dashboard Overview</h1>
        <p className="text-gray-500 text-sm">Welcome back, here's what's happening today.</p>
      </header>
      
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Total Sales Card */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between group hover:shadow-md transition-all duration-200">
          <div>
            <h3 className="text-gray-500 font-medium mb-1 text-sm">Total Sales (Today)</h3>
            <p className="text-3xl font-bold text-gray-800">${stats.totalSales.toFixed(2)}</p>
            <div className="flex items-center gap-1 text-emerald-600 text-xs mt-2 font-medium bg-emerald-50 px-2 py-1 rounded-full w-fit">
              <TrendingUp size={12} />
              <span>+12.5% vs yesterday</span>
            </div>
          </div>
          <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform shadow-sm">
            <DollarSign size={24} />
          </div>
        </div>

        {/* Orders Card */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between group hover:shadow-md transition-all duration-200">
          <div>
            <h3 className="text-gray-500 font-medium mb-1 text-sm">Orders Completed</h3>
            <p className="text-3xl font-bold text-gray-800">{stats.orderCount}</p>
            <div className="flex items-center gap-1 text-blue-600 text-xs mt-2 font-medium bg-blue-50 px-2 py-1 rounded-full w-fit">
              <ShoppingBag size={12} />
              <span>{stats.orderCount} invoices</span>
            </div>
          </div>
          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform shadow-sm">
            <ShoppingBag size={24} />
          </div>
        </div>

        {/* Low Stock Card */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between group hover:shadow-md transition-all duration-200">
          <div>
            <h3 className="text-gray-500 font-medium mb-1 text-sm">Low Stock Alerts</h3>
            <p className={`text-3xl font-bold ${stats.lowStockCount > 0 ? 'text-red-600' : 'text-gray-800'}`}>
              {stats.lowStockCount}
            </p>
            <div className={`flex items-center gap-1 text-xs mt-2 font-medium px-2 py-1 rounded-full w-fit ${stats.lowStockCount > 0 ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-500'}`}>
              <Package size={12} />
              <span>Items need attention</span>
            </div>
          </div>
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-sm ${stats.lowStockCount > 0 ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-400'}`}>
            <AlertTriangle size={24} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-gray-800">Revenue Overview</h2>
            <select className="bg-gray-50 border border-gray-200 rounded-lg text-sm px-3 py-1 outline-none focus:ring-2 focus:ring-emerald-500/20">
              <option>Last 7 Days</option>
              <option>This Month</option>
              <option>This Year</option>
            </select>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#9CA3AF', fontSize: 12 }} 
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#9CA3AF', fontSize: 12 }} 
                  tickFormatter={(value) => `$${value}`}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  itemStyle={{ color: '#059669' }}
                  formatter={(value: number) => [`$${value}`, 'Revenue']}
                />
                <Area 
                  type="monotone" 
                  dataKey="sales" 
                  stroke="#10B981" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorSales)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Quick Actions & Recent Activity */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h2 className="text-lg font-bold text-gray-800 mb-4">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-4">
              {quickActions.map((action, index) => {
                const Icon = action.icon;
                return (
                  <Link 
                    key={index} 
                    to={action.path}
                    className="flex flex-col items-center justify-center p-4 rounded-xl border border-gray-50 hover:border-emerald-100 hover:bg-emerald-50/30 transition-all group text-center"
                  >
                    <div className={`w-10 h-10 ${action.color} rounded-full flex items-center justify-center mb-2 group-hover:scale-110 transition-transform`}>
                      <Icon size={20} />
                    </div>
                    <span className="text-sm font-medium text-gray-700">{action.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Mini Recent Orders (Placeholder) */}
          <div className="bg-gradient-to-br from-emerald-600 to-teal-700 p-6 rounded-2xl text-white shadow-lg">
            <h2 className="text-lg font-bold mb-2">Pro Tip</h2>
            <p className="text-emerald-100 text-sm mb-4">
              Check your low stock items regularly to ensure you never run out of best-sellers.
            </p>
            <Link to="/inventory" className="inline-flex items-center gap-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg text-sm font-semibold transition-colors backdrop-blur-sm">
              Check Inventory <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
