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
  TrendingDown,
  Plus, 
  Users, 
  Package, 
  CreditCard, 
  ArrowRight,
  Clock,
  CheckCircle,
  XCircle,
  Box,
  Activity
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
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';

interface DashboardStats {
  totalSales: number;
  orderCount: number;
  lowStockCount: number;
  customerCount: number;
  todayRevenue: number;
  weekRevenue: number;
  monthRevenue: number;
  revenueGrowth: number;
  ordersGrowth: number;
}

interface ChartDataPoint {
  name: string;
  sales: number;
  orders: number;
  date?: string;
}

interface RecentOrder {
  sale_id: number;
  total: number;
  customer_name: string;
  created_at: string;
  status: string;
}

interface TopProduct {
  product_id: number;
  product_name: string;
  quantity_sold: number;
  revenue: number;
}

const Dashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalSales: 0,
    orderCount: 0,
    lowStockCount: 0,
    customerCount: 0,
    todayRevenue: 0,
    weekRevenue: 0,
    monthRevenue: 0,
    revenueGrowth: 0,
    ordersGrowth: 0
  });
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [chartPeriod, setChartPeriod] = useState<'week' | 'month' | 'year'>('week');

  useEffect(() => {
    fetchDashboardData();
  }, [chartPeriod]);

  const fetchDashboardData = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      let startDate: string;
      let daysBack: number;
      
      switch(chartPeriod) {
        case 'month':
          daysBack = 30;
          break;
        case 'year':
          daysBack = 365;
          break;
        default:
          daysBack = 7;
      }
      
      startDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const weekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const monthStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const [
        todayRes,
        yesterdayRes,
        dateRangeRes,
        weekRes,
        monthRes,
        inventoryRes,
        customersRes,
        recentOrdersRes
      ] = await Promise.all([
        api.get('/reports/daily'),
        api.get(`/reports/date-range?start_date=${yesterday}&end_date=${yesterday}`),
        api.get(`/reports/date-range?start_date=${startDate}&end_date=${today}`),
        api.get(`/reports/date-range?start_date=${weekStart}&end_date=${today}`),
        api.get(`/reports/date-range?start_date=${monthStart}&end_date=${today}`),
        api.get('/reports/inventory'),
        api.get('/customers?page=1&limit=1'),
        api.get('/sales?page=1&limit=5')
      ]);

      // Calculate stats
      const todayData = todayRes.data;
      const yesterdayData = yesterdayRes.data.daily?.[0] || { revenue: 0, transactions: 0 };
      const todayRevenue = parseFloat(todayData.total_revenue || 0);
      const todayOrders = parseInt(todayData.total_transactions || 0);
      const yesterdayRevenue = parseFloat(yesterdayData.revenue || 0);
      const yesterdayOrders = parseInt(yesterdayData.transactions || 0);

      const revenueGrowth = yesterdayRevenue > 0 
        ? ((todayRevenue - yesterdayRevenue) / yesterdayRevenue * 100) 
        : 0;
      const ordersGrowth = yesterdayOrders > 0 
        ? ((todayOrders - yesterdayOrders) / yesterdayOrders * 100) 
        : 0;

      setStats({
        totalSales: todayRevenue,
        orderCount: todayOrders,
        lowStockCount: (inventoryRes.data.low_stock?.length || 0) + (inventoryRes.data.out_of_stock?.length || 0),
        customerCount: customersRes.data.pagination?.total || customersRes.data.data?.length || 0,
        todayRevenue: todayRevenue,
        weekRevenue: parseFloat(weekRes.data.summary?.total_revenue || 0),
        monthRevenue: parseFloat(monthRes.data.summary?.total_revenue || 0),
        revenueGrowth,
        ordersGrowth
      });

      // Chart Data
      const dailyBreakdown = dateRangeRes.data.daily || [];
      const salesData = dailyBreakdown.map((d: any) => ({
        name: chartPeriod === 'year' 
          ? new Date(d.date).toLocaleDateString('en-US', { month: 'short' })
          : new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        sales: parseFloat(d.revenue || 0),
        orders: parseInt(d.transactions || 0),
        date: d.date
      }));

      setChartData(salesData);

      // Recent Orders
      const recentSales = recentOrdersRes.data.data || recentOrdersRes.data.sales || [];
      setRecentOrders(recentSales.slice(0, 5).map((s: any) => ({
        sale_id: s.sale_id,
        total: s.total_amount || s.net_amount || 0,
        customer_name: s.customer_name,
        created_at: s.sale_date || s.created_at,
        status: s.status
      })));

      // Top Products from product report
      try {
        const productReportRes = await api.get('/reports/product');
        const productSales = productReportRes.data.data || productReportRes.data || [];
        setTopProducts(productSales.slice(0, 5).map((p: any) => ({
          product_id: p.product_id || 0,
          product_name: p.product_name,
          quantity_sold: p.total_quantity || 0,
          revenue: p.total_revenue || 0
        })));
      } catch { setTopProducts([]); }

    } catch (error) {
      console.error("Failed to fetch dashboard data", error);
      // Fallback data
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
    { label: 'Add Product', icon: Plus, path: '/inventory', color: 'bg-blue-100 text-blue-600' },
    { label: 'Add Customer', icon: Users, path: '/customers', color: 'bg-purple-100 text-purple-600' },
    { label: 'View Reports', icon: TrendingUp, path: '/reports', color: 'bg-orange-100 text-orange-600' },
  ];

  const periodLabels = {
    week: 'Last 7 Days',
    month: 'Last 30 Days',
    year: 'Last Year'
  };

  return (
    <div className="space-y-6 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Dashboard Overview</h1>
          <p className="text-gray-500 mt-1">Welcome back, {user?.name}. Here's what's happening today.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchDashboardData}
            className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
          >
            <Activity size={16} />
            Refresh
          </button>
        </div>
      </header>
      
      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Today's Sales Card */}
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 p-6 rounded-2xl text-white shadow-lg group hover:shadow-xl transition-all duration-200">
          <div className="flex items-start justify-between mb-4">
            <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <DollarSign size={24} />
            </div>
            <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
              stats.revenueGrowth >= 0 ? 'bg-white/20' : 'bg-red-500/20'
            }`}>
              {stats.revenueGrowth >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              <span>{Math.abs(stats.revenueGrowth).toFixed(1)}%</span>
            </div>
          </div>
          <h3 className="text-white/80 font-medium mb-1 text-sm">Today's Sales</h3>
          <p className="text-3xl font-bold">${stats.totalSales.toFixed(2)}</p>
          <p className="text-white/70 text-xs mt-2">vs yesterday</p>
        </div>

        {/* Orders Card */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 group hover:shadow-md transition-all duration-200">
          <div className="flex items-start justify-between mb-4">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform">
              <ShoppingBag size={24} />
            </div>
            <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
              stats.ordersGrowth >= 0 ? 'bg-blue-50 text-blue-600' : 'bg-red-50 text-red-600'
            }`}>
              {stats.ordersGrowth >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              <span>{Math.abs(stats.ordersGrowth).toFixed(1)}%</span>
            </div>
          </div>
          <h3 className="text-gray-500 font-medium mb-1 text-sm">Orders Today</h3>
          <p className="text-3xl font-bold text-gray-800">{stats.orderCount}</p>
          <p className="text-gray-400 text-xs mt-2">transactions completed</p>
        </div>

        {/* Low Stock Card */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 group hover:shadow-md transition-all duration-200">
          <div className="flex items-start justify-between mb-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform ${
              stats.lowStockCount > 0 ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-400'
            }`}>
              <AlertTriangle size={24} />
            </div>
            {stats.lowStockCount > 0 && (
              <span className="px-2 py-1 bg-red-100 text-red-600 rounded-full text-xs font-medium">
                Alert
              </span>
            )}
          </div>
          <h3 className="text-gray-500 font-medium mb-1 text-sm">Low Stock Items</h3>
          <p className={`text-3xl font-bold ${stats.lowStockCount > 0 ? 'text-red-600' : 'text-gray-800'}`}>
            {stats.lowStockCount}
          </p>
          <Link to="/inventory" className="text-emerald-600 text-xs mt-2 inline-flex items-center gap-1 hover:underline">
            View inventory <ArrowRight size={12} />
          </Link>
        </div>

        {/* Customers Card */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 group hover:shadow-md transition-all duration-200">
          <div className="flex items-start justify-between mb-4">
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center text-purple-600 group-hover:scale-110 transition-transform">
              <Users size={24} />
            </div>
          </div>
          <h3 className="text-gray-500 font-medium mb-1 text-sm">Total Customers</h3>
          <p className="text-3xl font-bold text-gray-800">{stats.customerCount}</p>
          <Link to="/customers" className="text-emerald-600 text-xs mt-2 inline-flex items-center gap-1 hover:underline">
            Manage customers <ArrowRight size={12} />
          </Link>
        </div>
      </div>

      {/* Revenue Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm font-medium">This Week</p>
              <p className="text-2xl font-bold text-gray-800 mt-1">${stats.weekRevenue.toFixed(2)}</p>
            </div>
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600">
              <TrendingUp size={20} />
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm font-medium">This Month</p>
              <p className="text-2xl font-bold text-gray-800 mt-1">${stats.monthRevenue.toFixed(2)}</p>
            </div>
            <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center text-purple-600">
              <DollarSign size={20} />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-red-500 p-5 rounded-xl text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/80 text-sm font-medium">Avg Order Value</p>
              <p className="text-2xl font-bold mt-1">
                ${stats.orderCount > 0 ? (stats.totalSales / stats.orderCount).toFixed(2) : '0.00'}
              </p>
            </div>
            <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center">
              <CreditCard size={20} />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-gray-800">Revenue Overview</h2>
            <select 
              value={chartPeriod}
              onChange={(e) => setChartPeriod(e.target.value as 'week' | 'month' | 'year')}
              className="bg-gray-50 border border-gray-200 rounded-lg text-sm px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500/20"
            >
              <option value="week">Last 7 Days</option>
              <option value="month">Last 30 Days</option>
              <option value="year">Last Year</option>
            </select>
          </div>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.2}/>
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
                  contentStyle={{ 
                    backgroundColor: '#fff', 
                    borderRadius: '12px', 
                    border: 'none', 
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    padding: '12px'
                  }}
                  formatter={(value: number, name: string) => {
                    if (name === 'sales') return [`$${value.toFixed(2)}`, 'Revenue'];
                    return [value, 'Orders'];
                  }}
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

        {/* Quick Actions */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h2 className="text-lg font-bold text-gray-800 mb-4">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-3">
              {quickActions.map((action, index) => {
                const Icon = action.icon;
                return (
                  <Link 
                    key={index} 
                    to={action.path}
                    className="flex flex-col items-center justify-center p-4 rounded-xl border border-gray-100 hover:border-emerald-200 hover:bg-emerald-50/50 transition-all group text-center"
                  >
                    <div className={`w-11 h-11 ${action.color} rounded-xl flex items-center justify-center mb-2 group-hover:scale-110 transition-transform shadow-sm`}>
                      <Icon size={20} />
                    </div>
                    <span className="text-xs font-medium text-gray-700">{action.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Pro Tip Card */}
          <div className="bg-gradient-to-br from-emerald-600 to-teal-700 p-6 rounded-2xl text-white shadow-lg">
            <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center mb-3">
              <Package size={20} />
            </div>
            <h2 className="text-lg font-bold mb-2">Pro Tip</h2>
            <p className="text-emerald-100 text-sm mb-4">
              Check your low stock items regularly to ensure you never run out of best-sellers.
            </p>
            <Link 
              to="/inventory" 
              className="inline-flex items-center gap-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg text-sm font-semibold transition-colors backdrop-blur-sm"
            >
              Check Inventory <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </div>

      {/* Recent Orders & Top Products */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Orders */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-800">Recent Orders</h2>
            <Link to="/sales" className="text-emerald-600 text-sm hover:underline flex items-center gap-1">
              View all <ArrowRight size={14} />
            </Link>
          </div>
          <div className="space-y-3">
            {recentOrders.length > 0 ? (
              recentOrders.map((order) => (
                <div key={order.sale_id} className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center text-emerald-600">
                      <ShoppingCart size={18} />
                    </div>
                    <div>
                      <p className="font-medium text-gray-800 text-sm">
                        {order.customer_name || 'Walk-in Customer'}
                      </p>
                      <p className="text-xs text-gray-500 flex items-center gap-1">
                        <Clock size={12} />
                        {new Date(order.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-800">${parseFloat(order.total).toFixed(2)}</p>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-xs">
                      <CheckCircle size={10} />
                      Completed
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-400">
                <ShoppingCart size={32} className="mx-auto mb-2 opacity-50" />
                <p className="text-sm">No recent orders</p>
              </div>
            )}
          </div>
        </div>

        {/* Top Products */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-800">Top Selling Products</h2>
            <Link to="/reports" className="text-emerald-600 text-sm hover:underline flex items-center gap-1">
              View all <ArrowRight size={14} />
            </Link>
          </div>
          <div className="space-y-3">
            {topProducts.length > 0 ? (
              topProducts.map((product, index) => (
                <div key={product.product_id} className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center text-purple-600 font-bold text-sm">
                      #{index + 1}
                    </div>
                    <div>
                      <p className="font-medium text-gray-800 text-sm">
                        {product.product_name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {product.quantity_sold} units sold
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-800">${parseFloat(product.revenue.toString()).toFixed(2)}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-400">
                <Box size={32} className="mx-auto mb-2 opacity-50" />
                <p className="text-sm">No product data available</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;