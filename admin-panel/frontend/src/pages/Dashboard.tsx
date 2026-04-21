import { useEffect, useState } from 'react';
import { Users, UserCheck, UserX, TrendingUp } from 'lucide-react';
import api from '../api/axios';

interface Stats { total: number; active: number; inactive: number; monthly_revenue: number; }

export default function Dashboard() {
  const [stats, setStats]   = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/tenants/stats')
      .then(r => setStats(r.data))
      .finally(() => setLoading(false));
  }, []);

  const cards = [
    { label: 'Total Clients',    value: stats?.total,           icon: Users,      color: 'bg-blue-500' },
    { label: 'Active Clients',   value: stats?.active,          icon: UserCheck,  color: 'bg-green-500' },
    { label: 'Inactive Clients', value: stats?.inactive,        icon: UserX,      color: 'bg-red-500' },
    { label: 'Monthly Revenue',  value: `Rs. ${(stats?.monthly_revenue || 0).toLocaleString()}`, icon: TrendingUp, color: 'bg-purple-500' },
  ];

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-6">Dashboard</h2>

      {loading ? (
        <div className="text-gray-500">Loading...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {cards.map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-white rounded-xl shadow-sm p-5 flex items-center gap-4">
              <div className={`${color} w-12 h-12 rounded-xl flex items-center justify-center`}>
                <Icon className="text-white" size={22} />
              </div>
              <div>
                <p className="text-gray-500 text-sm">{label}</p>
                <p className="text-2xl font-bold text-gray-900">{value ?? 0}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
