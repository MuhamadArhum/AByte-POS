import { useEffect, useState } from 'react';
import { Users, UserCheck, UserX, TrendingUp, ArrowUpRight, Building2, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';

interface Stats { total: number; active: number; inactive: number; monthly_revenue: number; }
interface Tenant {
  tenant_id: number; tenant_code: string; tenant_name: string;
  company_name: string; is_active: number; modules_enabled: string | string[];
  created_at: string;
}

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

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30)  return `${days}d ago`;
  return new Date(d).toLocaleDateString('en-PK', { day: '2-digit', month: 'short' });
}

function getModuleCount(m: string | string[]): number {
  if (!m) return 0;
  if (Array.isArray(m)) return m.length;
  try { return JSON.parse(m).length; } catch { return 0; }
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats]   = useState<Stats | null>(null);
  const [recent, setRecent] = useState<Tenant[]>([]);
  const [loading, setLoading]       = useState(true);
  const [recentLoading, setRecentLoading] = useState(true);

  useEffect(() => {
    api.get('/tenants/stats')
      .then(r => setStats(r.data))
      .finally(() => setLoading(false));

    api.get('/tenants')
      .then(r => setRecent((r.data.data as Tenant[]).slice(0, 6)))
      .finally(() => setRecentLoading(false));
  }, []);

  const cards = [
    { label: 'Total Clients',   display: String(stats?.total ?? 0),    icon: Users,     iconBg: 'bg-blue-50',    iconColor: 'text-blue-600',    accent: 'border-blue-100' },
    { label: 'Active Clients',  display: String(stats?.active ?? 0),   icon: UserCheck, iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600', accent: 'border-emerald-100' },
    { label: 'Inactive Clients',display: String(stats?.inactive ?? 0), icon: UserX,     iconBg: 'bg-red-50',     iconColor: 'text-red-500',     accent: 'border-red-100' },
    {
      label: 'Monthly Revenue',
      display: `Rs. ${(stats?.monthly_revenue || 0).toLocaleString()}`,
      icon: TrendingUp, iconBg: 'bg-purple-50', iconColor: 'text-purple-600', accent: 'border-purple-100',
    },
  ];

  const activeRate = stats && stats.total > 0
    ? Math.round((stats.active / stats.total) * 100) : 0;

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

      {/* Middle row */}
      {!loading && stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
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
            <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp size={15} className="text-emerald-400" />
                <span className="text-emerald-400 text-sm font-medium">
                  Avg Rs. {stats.total > 0 ? Math.round(stats.monthly_revenue / stats.total).toLocaleString() : 0} / client
                </span>
              </div>
              <button
                onClick={() => navigate('/revenue')}
                className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition"
              >
                View details <ChevronRight size={13} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recent Clients */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 size={15} className="text-slate-400" />
            <h3 className="text-sm font-semibold text-slate-700">Recent Clients</h3>
          </div>
          <button
            onClick={() => navigate('/clients')}
            className="text-xs text-slate-500 hover:text-emerald-600 flex items-center gap-1 transition font-medium"
          >
            View all <ChevronRight size={13} />
          </button>
        </div>

        {recentLoading ? (
          <div className="divide-y divide-slate-50">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-3.5 animate-pulse">
                <div className="w-9 h-9 bg-slate-100 rounded-xl flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-4 bg-slate-100 rounded w-40" />
                  <div className="h-3 bg-slate-100 rounded w-28" />
                </div>
                <div className="h-4 bg-slate-100 rounded w-16" />
              </div>
            ))}
          </div>
        ) : recent.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-sm">No clients yet</div>
        ) : (
          <div className="divide-y divide-slate-50">
            {recent.map(c => (
              <div
                key={c.tenant_id}
                onClick={() => navigate(`/clients/${c.tenant_id}`)}
                className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50/70 cursor-pointer transition-colors group"
              >
                <div className="w-9 h-9 bg-gradient-to-br from-slate-100 to-slate-200 rounded-xl flex items-center justify-center text-sm font-bold text-slate-600 flex-shrink-0">
                  {(c.company_name || c.tenant_name).charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800 text-sm truncate">
                    {c.company_name || c.tenant_name}
                  </p>
                  <p className="text-slate-400 text-xs font-mono">{c.tenant_code} · {getModuleCount(c.modules_enabled)} module{getModuleCount(c.modules_enabled) !== 1 ? 's' : ''}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                    c.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${c.is_active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                    {c.is_active ? 'Active' : 'Inactive'}
                  </span>
                  <p className="text-xs text-slate-400 mt-1">{timeAgo(c.created_at)}</p>
                </div>
                <ChevronRight size={14} className="text-slate-300 group-hover:text-slate-500 transition flex-shrink-0" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
