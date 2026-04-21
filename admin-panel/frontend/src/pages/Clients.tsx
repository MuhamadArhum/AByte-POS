import { useEffect, useState } from 'react';
import { Plus, RefreshCw, CheckCircle, XCircle, Key, Search, Building2, AlertCircle } from 'lucide-react';
import api from '../api/axios';
import AddClientModal from '../components/AddClientModal';
import ResetPasswordModal from '../components/ResetPasswordModal';

interface Tenant {
  tenant_id: number; tenant_code: string; tenant_name: string;
  admin_email: string; is_active: number; modules_enabled: string | string[];
  company_name: string; db_name: string;
}

interface ResetTarget { id: number; name: string; }

const moduleStyles: Record<string, { bg: string; text: string; label: string }> = {
  sales:     { bg: 'bg-blue-50',   text: 'text-blue-600',   label: 'Sales' },
  inventory: { bg: 'bg-emerald-50',text: 'text-emerald-600',label: 'Inventory' },
  accounts:  { bg: 'bg-purple-50', text: 'text-purple-600', label: 'Accounts' },
  hr:        { bg: 'bg-orange-50', text: 'text-orange-600', label: 'HR' },
};

function SkeletonRow() {
  return (
    <tr className="animate-pulse border-b border-slate-100">
      {[140, 160, 120, 90, 70, 80].map((w, i) => (
        <td key={i} className="px-5 py-4">
          <div className={`h-4 bg-slate-100 rounded`} style={{ width: w }} />
        </td>
      ))}
    </tr>
  );
}

export default function Clients() {
  const [clients, setClients]     = useState<Tenant[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [resetTarget, setResetTarget] = useState<ResetTarget | null>(null);
  const [search, setSearch]       = useState('');
  const [toggling, setToggling]   = useState<number | null>(null);

  const load = () => {
    setLoading(true);
    api.get('/tenants').then(r => setClients(r.data.data)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const toggleStatus = async (id: number, current: number) => {
    setToggling(id);
    await api.put(`/tenants/${id}`, { is_active: current ? 0 : 1 });
    await load();
    setToggling(null);
  };

  const getModules = (modules: string | string[]): string[] => {
    if (!modules) return [];
    if (Array.isArray(modules)) return modules;
    try { return JSON.parse(modules); } catch { return []; }
  };

  const getMonthly = (modules: string[]) =>
    modules.reduce((sum, m) => sum + (['accounts', 'hr'].includes(m) ? 2999 : 2250), 0);

  const filtered = clients.filter(c => {
    const q = search.toLowerCase();
    return (
      (c.company_name || c.tenant_name).toLowerCase().includes(q) ||
      c.admin_email.toLowerCase().includes(q) ||
      c.tenant_code.toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Clients</h2>
          <p className="text-slate-500 text-sm mt-0.5">
            {loading ? '...' : `${clients.length} total client${clients.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 text-sm border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-xl shadow-sm shadow-emerald-200 transition"
          >
            <Plus size={16} />
            <span className="hidden sm:inline">Add Client</span>
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4 max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search clients..."
          className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white text-slate-700 placeholder-slate-400"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                {['Client', 'Email', 'Modules', 'Monthly', 'Status', 'Actions'].map(h => (
                  <th key={h} className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)
                : filtered.map(c => {
                    const mods = getModules(c.modules_enabled);
                    const monthly = getMonthly(mods);
                    const isToggling = toggling === c.tenant_id;

                    return (
                      <tr key={c.tenant_id} className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
                        {/* Client */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-slate-100 rounded-xl flex items-center justify-center flex-shrink-0">
                              <Building2 size={14} className="text-slate-500" />
                            </div>
                            <div>
                              <p className="font-semibold text-slate-800 leading-tight">
                                {c.company_name || c.tenant_name}
                              </p>
                              <p className="text-slate-400 text-xs mt-0.5 font-mono">{c.tenant_code}</p>
                            </div>
                          </div>
                        </td>

                        {/* Email */}
                        <td className="px-5 py-4 text-slate-600">{c.admin_email}</td>

                        {/* Modules */}
                        <td className="px-5 py-4">
                          <div className="flex flex-wrap gap-1">
                            {mods.length === 0
                              ? <span className="text-slate-300 text-xs">—</span>
                              : mods.map((m: string) => {
                                  const style = moduleStyles[m] || { bg: 'bg-slate-50', text: 'text-slate-500', label: m };
                                  return (
                                    <span key={m} className={`px-2 py-0.5 rounded-lg text-xs font-medium ${style.bg} ${style.text}`}>
                                      {style.label}
                                    </span>
                                  );
                                })
                            }
                          </div>
                        </td>

                        {/* Monthly */}
                        <td className="px-5 py-4">
                          <span className="font-semibold text-slate-700">Rs. {monthly.toLocaleString()}</span>
                          <span className="text-slate-400 text-xs">/mo</span>
                        </td>

                        {/* Status */}
                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                            c.is_active
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-slate-100 text-slate-500'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${c.is_active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                            {c.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => toggleStatus(c.tenant_id, c.is_active)}
                              disabled={isToggling}
                              title={c.is_active ? 'Deactivate' : 'Activate'}
                              className={`p-2 rounded-xl transition ${
                                c.is_active
                                  ? 'hover:bg-red-50 text-slate-400 hover:text-red-500'
                                  : 'hover:bg-emerald-50 text-slate-400 hover:text-emerald-600'
                              } disabled:opacity-40`}
                            >
                              {isToggling
                                ? <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin block" />
                                : c.is_active
                                  ? <XCircle size={17} />
                                  : <CheckCircle size={17} />
                              }
                            </button>
                            <button
                              onClick={() => setResetTarget({ id: c.tenant_id, name: c.company_name || c.tenant_name })}
                              title="Reset Password"
                              className="p-2 rounded-xl hover:bg-amber-50 text-slate-400 hover:text-amber-600 transition"
                            >
                              <Key size={17} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
              }

              {/* Empty state */}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-14 text-center">
                    <AlertCircle size={32} className="text-slate-200 mx-auto mb-3" />
                    <p className="text-slate-400 font-medium">
                      {search ? 'No clients match your search' : 'No clients yet'}
                    </p>
                    {!search && (
                      <p className="text-slate-300 text-xs mt-1">Click "Add Client" to get started</p>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <AddClientModal onClose={() => { setShowModal(false); load(); }} />
      )}

      {resetTarget && (
        <ResetPasswordModal
          tenantId={resetTarget.id}
          clientName={resetTarget.name}
          onClose={() => setResetTarget(null)}
        />
      )}
    </div>
  );
}
