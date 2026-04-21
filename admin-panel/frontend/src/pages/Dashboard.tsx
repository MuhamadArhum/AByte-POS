import { useEffect, useState } from 'react';
import { Users, UserCheck, UserX, TrendingUp, ArrowUpRight } from 'lucide-react';
import api from '../api/axios';

interface Stats { total: number; active: number; inactive: number; monthly_revenue: number; }

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 animate-pulse">
      <div className="flex items-start justify-between mb-4">
        <div className="w-11 h-11 bg-slate-100 rounded-xl" />
        <div className="w-8 h-5 bg-slate-100 rounded-full" />
      </div>
      <div className="w-16 h-7 bg-slate-100 rounded-lg mb-1" />
      <div className="w-24 h-4 bg-slate-100 rounded" />
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/tenants/stats')
      .then(r => setStats(r.data))
      .finally(() => setLoading(false));
  }, []);

  const cards = [
    {
      label: 'Total Clients',
      value: stats?.total ?? 0,
      display: String(stats?.total ?? 0),
      icon: Users,
      iconBg: 'bg-blue-50',
      iconColor: 'text-blue-600',
      accent: 'border-blue-100',
    },
    {
      label: 'Active Clients',
      value: stats?.active ?? 0,
      display: String(stats?.active ?? 0),
      icon: UserCheck,
      iconBg: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
      accent: 'border-emerald-100',
    },
    {
      label: 'Inactive Clients',
      value: stats?.inactive ?? 0,
      display: String(stats?.inactive ?? 0),
      icon: UserX,
      iconBg: 'bg-red-50',
      iconColor: 'text-red-500',
      accent: 'border-red-100',
    },
    {
      label: 'Monthly Revenue',
      value: stats?.monthly_revenue ?? 0,
      display: `Rs. ${(stats?.monthly_revenue || 0).toLocaleString()}`,
      icon: TrendingUp,
      iconBg: 'bg-purple-50',
      iconColor: 'text-purple-600',
      accent: 'border-purple-100',
    },
  ];

  const activeRate = stats && stats.total > 0
    ? Math.round((stats.active / stats.total) * 100)
    : 0;

  return (
    <div className="p-6 max-w-6xl">
      {/* Header */}
      <div className="mb-7">
        <h2 className="text-xl font-bold text-slate-800">Overview</h2>
        <p className="text-slate-500 text-sm mt-0.5">Your client base at a glance</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
          : cards.map(({ label, display, icon: Icon, iconBg, iconColor, accent }) => (
              <div
                key={label}
                className={`bg-white rounded-2xl border ${accent} p-5 hover:shadow-md transition-shadow duration-200`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-11 h-11 ${iconBg} rounded-xl flex items-center justify-center`}>
                    <Icon size={20} className={iconColor} />
                  </div>
                  <ArrowUpRight size={15} className="text-slate-300" />
                </div>
                <p className="text-2xl font-bold text-slate-800 mb-0.5">{display}</p>
                <p className="text-slate-500 text-sm">{label}</p>
              </div>
            ))
        }
      </div>

      {/* Bottom row */}
      {!loading && stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Active rate */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-4">Client Activity Rate</h3>
            <div className="flex items-end gap-3 mb-3">
              <span className="text-3xl font-bold text-slate-800">{activeRate}%</span>
              <span className="text-sm text-slate-500 mb-1">active clients</span>
            </div>
            <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-700"
                style={{ width: `${activeRate}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-slate-400 mt-2">
              <span>{stats.active} active</span>
              <span>{stats.inactive} inactive</span>
            </div>
          </div>

          {/* Revenue summary */}
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-5 text-white">
            <h3 className="text-sm font-semibold text-slate-300 mb-4">Revenue Summary</h3>
            <p className="text-3xl font-bold mb-1">
              Rs. {(stats.monthly_revenue || 0).toLocaleString()}
            </p>
            <p className="text-slate-400 text-sm">Monthly recurring</p>
            <div className="mt-4 pt-4 border-t border-white/10 flex items-center gap-2">
              <TrendingUp size={15} className="text-emerald-400" />
              <span className="text-emerald-400 text-sm font-medium">
                Avg Rs. {stats.total > 0 ? Math.round(stats.monthly_revenue / stats.total).toLocaleString() : 0} / client
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
