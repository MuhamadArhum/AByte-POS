import { useEffect, useState } from 'react';
import {
  RefreshCw, Activity, CheckCircle2,
  TrendingUp, Calendar, ChevronRight, Wifi, WifiOff,
} from 'lucide-react';
import api from '../api/axios';
import ActivityDetailModal from '../components/ActivityDetailModal';

interface TenantActivity {
  tenant_id:    number;
  tenant_code:  string;
  display_name: string;
  is_active:    number;
  today_logins: number;
  week_logins:  number;
  total_logins: number;
  last_login: {
    user_name:  string;
    ip_address: string;
    created_at: string;
  } | null;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1)   return 'Just now';
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return 'Yesterday';
  return `${days}d ago`;
}

function isToday(dateStr: string): boolean {
  return new Date(dateStr).toDateString() === new Date().toDateString();
}

function isOnline(dateStr: string): boolean {
  return Date.now() - new Date(dateStr).getTime() < 30 * 60 * 1000;
}

function SkeletonRow() {
  return (
    <tr className="border-b border-slate-100">
      {[180, 110, 80, 80, 100, 130, 60].map((w, i) => (
        <td key={i} className="px-4 py-3.5">
          <div
            className="h-3.5 bg-slate-100 rounded animate-pulse"
            style={{ width: w }}
          />
        </td>
      ))}
    </tr>
  );
}

export default function ActivityPage() {
  const [data, setData]         = useState<TenantActivity[]>([]);
  const [loading, setLoading]   = useState(true);
  const [selected, setSelected] = useState<TenantActivity | null>(null);
  const [filter, setFilter]     = useState<'all' | 'today' | 'inactive'>('all');

  const load = () => {
    setLoading(true);
    api
      .get('/tenants/activity')
      .then(r => setData(r.data.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const totalToday  = data.reduce((s, t) => s + t.today_logins, 0);
  const activeToday = data.filter(t => t.today_logins > 0).length;
  const onlineNow   = data.filter(t => t.last_login && isOnline(t.last_login.created_at)).length;

  const filtered = data.filter(t => {
    if (filter === 'today')    return t.today_logins > 0;
    if (filter === 'inactive') return !t.last_login || !isToday(t.last_login.created_at);
    return true;
  });

  const TABS = [
    { key: 'all',      label: 'All clients',   count: data.length },
    { key: 'today',    label: 'Active today',  count: activeToday },
    { key: 'inactive', label: 'Not today',     count: data.length - activeToday },
  ] as const;

  const CARDS = [
    {
      label: 'Online now',
      sub:   'within 30 min',
      value: onlineNow,
      icon:  Wifi,
      iconBg: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
    },
    {
      label: 'Logged in today',
      sub:   'unique clients',
      value: activeToday,
      icon:  CheckCircle2,
      iconBg: 'bg-blue-50',
      iconColor: 'text-blue-600',
    },
    {
      label: 'Sessions today',
      sub:   'all logins',
      value: totalToday,
      icon:  Activity,
      iconBg: 'bg-violet-50',
      iconColor: 'text-violet-600',
    },
    {
      label: 'No activity today',
      sub:   'not logged in',
      value: data.length - activeToday,
      icon:  WifiOff,
      iconBg: 'bg-slate-100',
      iconColor: 'text-slate-400',
    },
  ];

  return (
    <div className="p-6 max-w-screen-xl">

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-lg font-medium text-slate-800">Usage &amp; Activity</h2>
          <p className="text-slate-400 text-sm mt-0.5">Real-time login tracking across all clients</p>
        </div>

        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 text-sm border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50 disabled:opacity-50 transition"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* ── Summary cards ──────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {CARDS.map(({ label, sub, value, icon: Icon, iconBg, iconColor }) => (
          <div key={label} className="bg-slate-50 rounded-xl p-4">
            <div className={`w-8 h-8 ${iconBg} rounded-lg flex items-center justify-center mb-3`}>
              <Icon size={15} className={iconColor} />
            </div>
            <p className="text-2xl font-medium text-slate-800">{loading ? '—' : value}</p>
            <p className="text-slate-600 text-xs font-medium mt-0.5">{label}</p>
            <p className="text-slate-400 text-xs">{sub}</p>
          </div>
        ))}
      </div>

      {/* ── Filter tabs ────────────────────────────────────── */}
      <div className="flex items-center gap-1 mb-3 bg-slate-100 rounded-lg p-1 w-fit">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              filter === tab.key
                ? 'bg-white text-slate-800 border border-slate-200 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
              filter === tab.key
                ? 'bg-slate-100 text-slate-500'
                : 'bg-slate-200/50 text-slate-400'
            }`}>
              {loading ? '…' : tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* ── Table ──────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                {['Client', 'Status', 'Today', 'This week', 'Last login', 'Last user', ''].map(h => (
                  <th
                    key={h}
                    className="text-left px-4 py-3 text-[11px] font-medium text-slate-400 uppercase tracking-wide whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {loading
                ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
                : filtered.map(t => {
                    const ll     = t.last_login;
                    const online = ll && isOnline(ll.created_at);
                    const today  = ll && isToday(ll.created_at);

                    return (
                      <tr
                        key={t.tenant_id}
                        className="border-b border-slate-50 hover:bg-slate-50/70 transition-colors"
                      >
                        {/* Client */}
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-medium flex-shrink-0 ${
                              online
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-slate-100 text-slate-500'
                            }`}>
                              {t.display_name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium text-slate-800 text-[13px] leading-tight">{t.display_name}</p>
                              <p className="text-slate-400 text-[11px] font-mono mt-0.5">{t.tenant_code}</p>
                            </div>
                          </div>
                        </td>

                        {/* Account status */}
                        <td className="px-4 py-3.5">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-medium ${
                            t.is_active
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-slate-100 text-slate-400'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              t.is_active ? 'bg-emerald-500' : 'bg-slate-300'
                            }`} />
                            {t.is_active ? 'Active' : 'Suspended'}
                          </span>
                        </td>

                        {/* Today logins */}
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1.5">
                            <span className={`text-base font-medium ${
                              t.today_logins > 0 ? 'text-slate-800' : 'text-slate-300'
                            }`}>
                              {t.today_logins}
                            </span>
                            {t.today_logins > 0 && (
                              <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-medium">
                                logins
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Week logins */}
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1">
                            <TrendingUp
                              size={12}
                              className={t.week_logins > 0 ? 'text-violet-400' : 'text-slate-200'}
                            />
                            <span className={`text-[13px] font-medium ${
                              t.week_logins > 0 ? 'text-slate-700' : 'text-slate-300'
                            }`}>
                              {t.week_logins}
                            </span>
                          </div>
                        </td>

                        {/* Last login time */}
                        <td className="px-4 py-3.5">
                          {ll ? (
                            <div>
                              <div className="flex items-center gap-1.5">
                                {online && (
                                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse flex-shrink-0" />
                                )}
                                <span className={`text-xs font-medium ${
                                  online
                                    ? 'text-emerald-600'
                                    : today
                                      ? 'text-blue-600'
                                      : 'text-slate-500'
                                }`}>
                                  {online ? 'Online now' : timeAgo(ll.created_at)}
                                </span>
                              </div>
                              <p className="text-slate-400 text-[11px] mt-0.5">
                                {new Date(ll.created_at).toLocaleDateString('en-PK', {
                                  day: '2-digit', month: 'short',
                                  hour: '2-digit', minute: '2-digit',
                                })}
                              </p>
                            </div>
                          ) : (
                            <span className="text-slate-300 text-xs">Never</span>
                          )}
                        </td>

                        {/* Last user */}
                        <td className="px-4 py-3.5">
                          {ll ? (
                            <div>
                              <p className="text-slate-700 font-medium text-xs">{ll.user_name || '—'}</p>
                              <p className="text-slate-400 text-[11px] font-mono mt-0.5">{ll.ip_address || '—'}</p>
                            </div>
                          ) : (
                            <span className="text-slate-300 text-xs">—</span>
                          )}
                        </td>

                        {/* Detail button */}
                        <td className="px-4 py-3.5">
                          <button
                            onClick={() => setSelected(t)}
                            className="flex items-center gap-1 text-xs text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:border-emerald-200 transition font-medium"
                          >
                            View <ChevronRight size={12} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
              }

              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center">
                    <Calendar size={28} className="text-slate-200 mx-auto mb-2" />
                    <p className="text-slate-400 text-sm">No clients match this filter</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <ActivityDetailModal
          tenantId={selected.tenant_id}
          tenantName={selected.display_name}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}