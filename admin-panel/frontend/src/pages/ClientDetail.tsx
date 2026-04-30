import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Users, ShoppingCart, Database, Clock,
  User, Globe, Package, Building2, Plus, Pencil, Trash2, X
} from 'lucide-react';
import api from '../api/axios';
import EditModulesModal from '../components/EditModulesModal';
import ResetPasswordModal from '../components/ResetPasswordModal';

interface TenantDetail {
  tenant_id: number; tenant_code: string; tenant_name: string;
  admin_email: string; is_active: number; db_name: string;
  company_name: string; modules_enabled: string[]; created_at: string;
}
interface UserRow { user_id: number; username: string; name: string; email: string; role_name: string; created_at: string; }
interface LoginRow { user_name: string; ip_address: string; created_at: string; }
interface DetailData {
  tenant: TenantDetail;
  users: UserRow[];
  sales_count: number;
  total_revenue: number;
  db_size_mb: number;
  recent_logins: LoginRow[];
  monthly_price: number;
}
interface Branch {
  store_id: number;
  store_name: string;
  store_code: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  is_active: number;
  monthly_charge: number;
  manager_name: string | null;
  total_staff: number;
  today_sales: number;
  month_revenue: number;
}
interface BranchForm {
  store_name: string; store_code: string; address: string;
  phone: string; email: string; monthly_charge: number; is_active: number;
}

function BranchModal({ branch, tenantId, onClose, onSave }: {
  branch: Branch | null; tenantId: number; onClose: () => void; onSave: () => void;
}) {
  const [form, setForm] = useState<BranchForm>({
    store_name:     branch?.store_name || '',
    store_code:     branch?.store_code || '',
    address:        branch?.address || '',
    phone:          branch?.phone || '',
    email:          branch?.email || '',
    monthly_charge: branch?.monthly_charge ?? 0,
    is_active:      branch?.is_active ?? 1,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.store_name.trim() || !form.store_code.trim()) {
      setError('Branch name and code are required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (branch) {
        await api.put(`/tenants/${tenantId}/branches/${branch.store_id}`, form);
      } else {
        await api.post(`/tenants/${tenantId}/branches`, form);
      }
      onSave();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save branch');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
            <Building2 size={18} className="text-emerald-600" />
            {branch ? 'Edit Branch' : 'Add New Branch'}
          </h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
            <X size={18} className="text-slate-500" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm border border-red-200">{error}</div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Branch Name *</label>
              <input type="text" value={form.store_name}
                onChange={e => setForm({ ...form, store_name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                placeholder="Main Branch" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Branch Code *</label>
              <input type="text" value={form.store_code}
                onChange={e => setForm({ ...form, store_code: e.target.value.toUpperCase() })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none font-mono"
                placeholder="MAIN" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Address</label>
            <input type="text" value={form.address}
              onChange={e => setForm({ ...form, address: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
              placeholder="123 Main Street" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Phone</label>
              <input type="text" value={form.phone}
                onChange={e => setForm({ ...form, phone: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                placeholder="+92 300 1234567" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Monthly Charge (Rs.)</label>
              <input type="number" min="0" value={form.monthly_charge}
                onChange={e => setForm({ ...form, monthly_charge: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                placeholder="0" />
            </div>
          </div>
          {branch && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
              <select value={form.is_active} onChange={e => setForm({ ...form, is_active: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none">
                <option value={1}>Active</option>
                <option value={0}>Inactive</option>
              </select>
            </div>
          )}
          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <button type="button" onClick={onClose}
              className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700 disabled:bg-slate-300 transition-colors font-medium">
              {saving ? 'Saving...' : branch ? 'Update Branch' : 'Create Branch'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const MODULE_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  sales:     { bg: 'bg-blue-50',    text: 'text-blue-600',    label: 'Sales' },
  inventory: { bg: 'bg-emerald-50', text: 'text-emerald-600', label: 'Inventory' },
  accounts:  { bg: 'bg-purple-50',  text: 'text-purple-600',  label: 'Accounts' },
  hr:        { bg: 'bg-orange-50',  text: 'text-orange-600',  label: 'HR' },
};

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000), h = Math.floor(diff / 3600000), days = Math.floor(diff / 86400000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  if (days === 1) return 'Yesterday';
  return `${days}d ago`;
}

const ROLE_COLORS: Record<string, string> = {
  Admin:       'bg-red-50 text-red-600',
  Manager:     'bg-blue-50 text-blue-600',
  Cashier:     'bg-slate-100 text-slate-600',
  Accountant:  'bg-purple-50 text-purple-600',
};

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [data, setData]               = useState<DetailData | null>(null);
  const [loading, setLoading]         = useState(true);
  const [showModules, setShowModules] = useState(false);
  const [showReset, setShowReset]     = useState(false);
  const [branches, setBranches]       = useState<Branch[]>([]);
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [editBranch, setEditBranch]   = useState<Branch | null>(null);

  const loadBranches = () => {
    api.get(`/tenants/${id}/branches`)
      .then(r => setBranches(r.data.data || []))
      .catch(() => setBranches([]));
  };

  const load = () => {
    setLoading(true);
    api.get(`/tenants/${id}/details`)
      .then(r => setData(r.data))
      .finally(() => setLoading(false));
    loadBranches();
  };

  const handleDeleteBranch = async (branch: Branch) => {
    if (!window.confirm(`Delete branch "${branch.store_name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/tenants/${id}/branches/${branch.store_id}`);
      loadBranches();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete branch');
    }
  };

  useEffect(() => { load(); }, [id]);

  if (loading) return (
    <div className="p-6 max-w-6xl animate-pulse space-y-4">
      <div className="h-8 w-48 bg-slate-100 rounded-xl" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <div key={i} className="h-28 bg-slate-100 rounded-2xl" />)}
      </div>
      <div className="h-64 bg-slate-100 rounded-2xl" />
    </div>
  );

  if (!data) return (
    <div className="p-6 flex flex-col items-center justify-center min-h-[40vh] gap-3">
      <p className="text-slate-500 font-medium">Failed to load client data</p>
      <button
        onClick={load}
        className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition"
      >
        Retry
      </button>
    </div>
  );

  const { tenant, users, sales_count, total_revenue, db_size_mb, recent_logins, monthly_price } = data;
  const mods = Array.isArray(tenant.modules_enabled) ? tenant.modules_enabled : [];

  const stats = [
    { label: 'Users',         value: users.length,                     icon: Users,       color: 'text-blue-600',   bg: 'bg-blue-50' },
    { label: 'Total Sales',   value: sales_count.toLocaleString(),      icon: ShoppingCart,color: 'text-emerald-600',bg: 'bg-emerald-50' },
    { label: 'Revenue',       value: `Rs. ${total_revenue.toLocaleString()}`, icon: Package, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'DB Size',       value: `${db_size_mb} MB`,               icon: Database,    color: 'text-orange-600', bg: 'bg-orange-50' },
  ];

  return (
    <div className="p-6 max-w-6xl space-y-6">

      {/* Back + Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/clients')}
            className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 transition"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="w-12 h-12 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-sm">
            {(tenant.company_name || tenant.tenant_name).charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-800">
                {tenant.company_name || tenant.tenant_name}
              </h2>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                tenant.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${tenant.is_active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                {tenant.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
            <p className="text-slate-400 text-sm font-mono">{tenant.tenant_code} · {tenant.admin_email}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowModules(true)}
            className="px-3 py-2 text-sm border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition"
          >
            Manage Modules
          </button>
          <button
            onClick={() => setShowReset(true)}
            className="px-3 py-2 text-sm border border-amber-200 rounded-xl text-amber-600 hover:bg-amber-50 transition"
          >
            Reset Password
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white rounded-2xl border border-slate-200 p-5">
            <div className={`w-10 h-10 ${bg} rounded-xl flex items-center justify-center mb-3`}>
              <Icon size={18} className={color} />
            </div>
            <p className="text-xl font-bold text-slate-800">{value}</p>
            <p className="text-slate-500 text-sm">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Modules + Info */}
        <div className="space-y-4">

          {/* Modules */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Active Modules</h3>
            <div className="space-y-2">
              {mods.length === 0 ? (
                <p className="text-slate-400 text-sm">No modules enabled</p>
              ) : mods.map(m => {
                const s = MODULE_STYLES[m] || { bg: 'bg-slate-50', text: 'text-slate-600', label: m };
                const price = ['accounts', 'hr'].includes(m) ? 2999 : 2250;
                return (
                  <div key={m} className={`flex items-center justify-between px-3 py-2 rounded-xl ${s.bg}`}>
                    <span className={`text-sm font-medium ${s.text}`}>{s.label}</span>
                    <span className={`text-xs font-semibold ${s.text}`}>Rs. {price.toLocaleString()}</span>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100 flex justify-between items-center">
              <span className="text-sm text-slate-500">Monthly Total</span>
              <span className="text-sm font-bold text-slate-800">Rs. {monthly_price.toLocaleString()}</span>
            </div>
          </div>

          {/* Info */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Client Info</h3>
            <div className="space-y-2.5 text-sm">
              {[
                { label: 'Database',  value: tenant.db_name },
                { label: 'Created',   value: new Date(tenant.created_at).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' }) },
                { label: 'Annual',    value: `Rs. ${(monthly_price * 12).toLocaleString()}` },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between">
                  <span className="text-slate-400">{label}</span>
                  <span className="text-slate-700 font-medium font-mono text-xs">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Users Table */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
            <Users size={15} className="text-slate-400" />
            <h3 className="text-sm font-semibold text-slate-700">Users ({users.length})</h3>
          </div>
          <div className="overflow-x-auto">
            {users.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-sm">No users found</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    {['Name', 'Email', 'Role', 'Joined'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.user_id} className="border-b border-slate-50 hover:bg-slate-50/60">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0">
                            <User size={12} className="text-slate-500" />
                          </div>
                          <div>
                            <p className="font-medium text-slate-800 text-sm">{u.name || u.username}</p>
                            <p className="text-slate-400 text-xs">{u.username}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{u.email}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-lg text-xs font-medium ${ROLE_COLORS[u.role_name] || 'bg-slate-100 text-slate-600'}`}>
                          {u.role_name}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-xs">
                        {new Date(u.created_at).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Recent Logins */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <Clock size={15} className="text-slate-400" />
          <h3 className="text-sm font-semibold text-slate-700">Recent Logins</h3>
        </div>
        {recent_logins.length === 0 ? (
          <div className="py-10 text-center text-slate-400 text-sm">No login records</div>
        ) : (
          <div className="divide-y divide-slate-50">
            {recent_logins.map((l, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-3">
                <div className="w-8 h-8 bg-slate-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <User size={13} className="text-slate-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700">{l.user_name || 'Unknown'}</p>
                  <p className="text-xs text-slate-400 flex items-center gap-1">
                    <Globe size={10} /> {l.ip_address || '—'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-500 font-medium">{timeAgo(l.created_at)}</p>
                  <p className="text-xs text-slate-400">
                    {new Date(l.created_at).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Branches Management */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 size={15} className="text-slate-400" />
            <h3 className="text-sm font-semibold text-slate-700">Branches / Stores ({branches.length})</h3>
          </div>
          <button
            onClick={() => { setEditBranch(null); setShowBranchModal(true); }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-xs font-medium rounded-lg hover:bg-emerald-700 transition-colors"
          >
            <Plus size={13} />
            Add Branch
          </button>
        </div>
        {branches.length === 0 ? (
          <div className="py-10 text-center text-slate-400 text-sm">No branches found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  {['Branch', 'Code', 'Address', 'Monthly Charge', 'Staff', "Today's Sales", 'Month Revenue', 'Status', ''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {branches.map(b => (
                  <tr key={b.store_id} className="border-b border-slate-50 hover:bg-slate-50/60">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${b.is_active ? 'bg-emerald-50' : 'bg-slate-100'}`}>
                          <Building2 size={13} className={b.is_active ? 'text-emerald-600' : 'text-slate-400'} />
                        </div>
                        <span className="font-medium text-slate-800">{b.store_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{b.store_code}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs max-w-[150px] truncate">{b.address || '—'}</td>
                    <td className="px-4 py-3 font-medium text-slate-700">Rs. {Number(b.monthly_charge).toLocaleString()}</td>
                    <td className="px-4 py-3 text-slate-600">{b.total_staff}</td>
                    <td className="px-4 py-3 text-slate-600">{b.today_sales}</td>
                    <td className="px-4 py-3 font-medium text-emerald-700">Rs. {Number(b.month_revenue).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-lg text-xs font-medium ${b.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                        {b.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => { setEditBranch(b); setShowBranchModal(true); }}
                          className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                          title="Edit Branch"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => handleDeleteBranch(b)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete Branch"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showBranchModal && (
        <BranchModal
          branch={editBranch}
          tenantId={Number(id)}
          onClose={() => { setShowBranchModal(false); setEditBranch(null); }}
          onSave={() => { setShowBranchModal(false); setEditBranch(null); loadBranches(); }}
        />
      )}

      {showModules && (
        <EditModulesModal
          tenantId={tenant.tenant_id}
          clientName={tenant.company_name || tenant.tenant_name}
          currentModules={mods}
          onClose={() => { setShowModules(false); load(); }}
        />
      )}

      {showReset && (
        <ResetPasswordModal
          tenantId={tenant.tenant_id}
          clientName={tenant.company_name || tenant.tenant_name}
          onClose={() => setShowReset(false)}
        />
      )}
    </div>
  );
}
