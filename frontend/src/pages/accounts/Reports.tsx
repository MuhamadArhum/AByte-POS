import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import DateRangeFilter from '../../components/DateRangeFilter';
import api from '../../utils/api';
import { localToday } from '../../utils/dateUtils';
import ReportPasswordGate from '../../components/ReportPasswordGate';

const Reports = () => {
  const [salesData, setSalesData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(localToday());
  const [dateTo, setDateTo] = useState(localToday());

  useEffect(() => {
    fetchSalesData(localToday(), localToday());
  }, []);

  const fetchSalesData = async (from = dateFrom, to = dateTo) => {
    setLoading(true);
    try {
      const res = await api.get(`/reports/date-range?start_date=${from}&end_date=${to}`);
      const dailyBreakdown = res.data.daily || [];

      const groupedData = dailyBreakdown.map((d: any) => {
        const revenue = parseFloat(d.revenue || 0);
        return {
          name: new Date(d.date).toLocaleDateString('en-US', { weekday: 'short' }),
          date: d.date,
          sales: revenue,
          profit: revenue * 0.2
        };
      });

      setSalesData(groupedData);
    } catch (error) {
      console.error("Failed to fetch sales report", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-gray-900">Analytics & Reports</h1>
          <p className="text-gray-600">Financial insights and performance metrics</p>
        </div>
      </div>

      <DateRangeFilter dateFrom={dateFrom} dateTo={dateTo} onFromChange={setDateFrom} onToChange={setDateTo} onApply={() => fetchSalesData()} />

      {loading ? (
        <div className="flex items-center justify-center p-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Sales Chart */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-96">
            <h3 className="text-sm font-semibold text-gray-800 mb-4">Revenue vs Profit</h3>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={salesData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} tickFormatter={(value) => `$${value}`} />
                <Tooltip
                  cursor={{ fill: '#f9fafb' }}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Legend />
                <Bar dataKey="sales" fill="#10b981" name="Revenue" radius={[4, 4, 0, 0]} />
                <Bar dataKey="profit" fill="#059669" name="Est. Profit" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Trend Chart */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-96">
            <h3 className="text-sm font-semibold text-gray-800 mb-4">Sales Trend</h3>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={salesData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} tickFormatter={(value) => `$${value}`} />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Legend />
                <Line type="monotone" dataKey="sales" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};

const ReportsWithGate = () => <ReportPasswordGate><Reports /></ReportPasswordGate>;
export default ReportsWithGate;
