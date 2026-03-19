import { useState, useEffect } from 'react';
import { useSettings } from '../../context/SettingsContext';
import { BarChart3, TrendingUp, TrendingDown, DollarSign, ShoppingCart, Download } from 'lucide-react';
import DateRangeFilter from '../../components/DateRangeFilter';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../../utils/api';
import { localToday } from '../../utils/dateUtils';
import ReportPasswordGate from '../../components/ReportPasswordGate';

const SalesReports = () => {
  const { currencySymbol: currency } = useSettings();
  const [dateFrom, setDateFrom] = useState(localToday());
  const [dateTo, setDateTo] = useState(localToday());
  const [loading, setLoading] = useState(true);

  const [summary, setSummary] = useState({ total_sales: 0, total_orders: 0, avg_order: 0, total_discount: 0, total_tax: 0 });
  const [comparison, setComparison] = useState({ change_percent: 0, previous_period: { total: 0 } });
  const [hourly, setHourly] = useState<any[]>([]);
  const [paymentBreakdown, setPaymentBreakdown] = useState<any[]>([]);
  const [cashierPerf, setCashierPerf] = useState<any[]>([]);
  const [dailyTrend, setDailyTrend] = useState<any[]>([]);
  const [topCustomers, setTopCustomers] = useState<any[]>([]);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const params = { date_from: dateFrom, date_to: dateTo };
      const [sumRes, compRes, hourRes, payRes, cashRes, trendRes, custRes] = await Promise.all([
        api.get('/sales-reports/summary', { params }),
        api.get('/sales-reports/comparison', { params }),
        api.get('/sales-reports/hourly', { params: { date: dateFrom } }),
        api.get('/sales-reports/payment-breakdown', { params }),
        api.get('/sales-reports/cashier-performance', { params }),
        api.get('/sales-reports/daily-trend', { params }),
        api.get('/sales-reports/top-customers', { params }),
      ]);
      setSummary(sumRes.data);
      setComparison(compRes.data);
      setHourly(hourRes.data.data || []);
      setPaymentBreakdown(payRes.data.data || []);
      setCashierPerf(cashRes.data.data || []);
      setDailyTrend(trendRes.data.data || []);
      setTopCustomers(custRes.data.data || []);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  useEffect(() => { fetchReports(); }, []);

  const METHOD_COLORS: Record<string, string> = { Cash: 'bg-green-500', Card: 'bg-emerald-500', Online: 'bg-emerald-500', Split: 'bg-orange-500' };

  const exportCSV = (data: any[], filename: string) => {
    if (!data.length) return;
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(r => Object.values(r).join(','));
    const blob = new Blob([headers + '\n' + rows.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click();
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-gray-900 flex items-center gap-3"><BarChart3 className="text-emerald-600" size={20} /> Sales Reports</h1>
          <p className="text-gray-500 mt-1">Comprehensive sales analytics and insights</p>
        </div>
      </div>

      <DateRangeFilter dateFrom={dateFrom} dateTo={dateTo} onFromChange={setDateFrom} onToChange={setDateTo} onApply={fetchReports} />

      {loading ? (
        <div className="flex items-center justify-center p-12"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600"></div></div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-center gap-3"><div className="p-3 bg-emerald-50 rounded-xl"><DollarSign size={24} className="text-emerald-600" /></div>
              <div><p className="text-2xl font-bold text-gray-800">{currency}{summary.total_sales.toFixed(2)}</p><p className="text-sm text-gray-500">Total Revenue</p></div></div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-center gap-3"><div className="p-3 bg-emerald-50 rounded-xl"><ShoppingCart size={24} className="text-emerald-600" /></div>
              <div><p className="text-2xl font-bold text-gray-800">{summary.total_orders}</p><p className="text-sm text-gray-500">Total Orders</p></div></div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-center gap-3"><div className="p-3 bg-emerald-50 rounded-xl"><BarChart3 size={24} className="text-emerald-600" /></div>
              <div><p className="text-2xl font-bold text-gray-800">{currency}{summary.avg_order.toFixed(2)}</p><p className="text-sm text-gray-500">Avg Order Value</p></div></div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-xl ${comparison.change_percent >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                  {comparison.change_percent >= 0 ? <TrendingUp size={24} className="text-green-600" /> : <TrendingDown size={24} className="text-red-600" />}
                </div>
                <div><p className={`text-2xl font-bold ${comparison.change_percent >= 0 ? 'text-green-600' : 'text-red-600'}`}>{comparison.change_percent > 0 ? '+' : ''}{comparison.change_percent}%</p><p className="text-sm text-gray-500">vs Previous Period</p></div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Hourly Sales */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-semibold text-gray-800 mb-4">Hourly Sales</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={hourly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="hour" tick={{ fontSize: 11 }} tickFormatter={(h) => `${h}:00`} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number | undefined) => v !== undefined ? [`${currency}${v.toFixed(2)}`, 'Revenue'] : ['$0.00', 'Revenue']} labelFormatter={(h) => `${h}:00 - ${h}:59`} />
                  <Bar dataKey="revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Daily Trend */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-gray-800">Daily Trend</h3>
                <button onClick={() => exportCSV(dailyTrend, 'daily_trend.csv')} className="text-xs text-gray-500 hover:text-emerald-600 flex items-center gap-1"><Download size={14} /> CSV</button>
              </div>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={dailyTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d) => new Date(d).toLocaleDateString('en', { month: 'short', day: 'numeric' })} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number | undefined) => v !== undefined ? [`${currency}${v.toFixed(2)}`, 'Revenue'] : ['$0.00', 'Revenue']} />
                  <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Payment Breakdown */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-semibold text-gray-800 mb-4">Payment Methods</h3>
              {paymentBreakdown.length === 0 ? <p className="text-center text-gray-400 py-8">No data</p> : (
                <div className="space-y-3">{paymentBreakdown.map((p) => (
                  <div key={p.method}>
                    <div className="flex justify-between text-sm mb-1"><span className="font-medium">{p.method}</span><span className="text-gray-500">{currency}{Number(p.total).toFixed(2)} ({p.percentage}%)</span></div>
                    <div className="w-full bg-gray-100 rounded-full h-2.5"><div className={`h-2.5 rounded-full ${METHOD_COLORS[p.method] || 'bg-gray-400'}`} style={{ width: `${p.percentage}%` }} /></div>
                  </div>
                ))}</div>
              )}
            </div>

            {/* Cashier Performance */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-gray-800">Cashier Performance</h3>
                <button onClick={() => exportCSV(cashierPerf, 'cashier_performance.csv')} className="text-xs text-gray-500 hover:text-emerald-600 flex items-center gap-1"><Download size={14} /> CSV</button>
              </div>
              {cashierPerf.length === 0 ? <p className="text-center text-gray-400 py-8">No data</p> : (
                <div className="space-y-3">{cashierPerf.map((c, idx) => (
                  <div key={c.user_id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-sm">{idx + 1}</div>
                    <div className="flex-1"><p className="font-medium text-sm">{c.cashier_name}</p><p className="text-xs text-gray-400">{c.order_count} orders</p></div>
                    <div className="text-right"><p className="font-bold text-sm">{currency}{Number(c.total_sales).toFixed(2)}</p><p className="text-xs text-gray-400">avg ${Number(c.avg_sale).toFixed(2)}</p></div>
                  </div>
                ))}</div>
              )}
            </div>

            {/* Top Customers */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-gray-800">Top Customers</h3>
                <button onClick={() => exportCSV(topCustomers, 'top_customers.csv')} className="text-xs text-gray-500 hover:text-emerald-600 flex items-center gap-1"><Download size={14} /> CSV</button>
              </div>
              {topCustomers.length === 0 ? <p className="text-center text-gray-400 py-8">No data</p> : (
                <div className="space-y-3">{topCustomers.map((c, idx) => (
                  <div key={c.customer_id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-sm">{idx + 1}</div>
                    <div className="flex-1"><p className="font-medium text-sm">{c.customer_name}</p><p className="text-xs text-gray-400">{c.order_count} orders</p></div>
                    <p className="font-bold text-sm">{currency}{Number(c.total_spent).toFixed(2)}</p>
                  </div>
                ))}</div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const SalesReportsWithGate = () => <ReportPasswordGate><SalesReports /></ReportPasswordGate>;
export default SalesReportsWithGate;
