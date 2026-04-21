import { useState, type FormEvent } from 'react';
import { X, AlertCircle, Eye, EyeOff, UserPlus } from 'lucide-react';
import api from '../api/axios';

const MODULES = [
  { key: 'sales',     label: 'Sales',       price: 2250, icon: '🛒' },
  { key: 'inventory', label: 'Inventory',   price: 2250, icon: '📦' },
  { key: 'accounts',  label: 'Accounts',    price: 2999, icon: '📊' },
  { key: 'hr',        label: 'HR & Payroll',price: 2999, icon: '👥' },
];

interface Props { onClose: () => void; }

export default function AddClientModal({ onClose }: Props) {
  const [form, setForm] = useState({
    tenant_code: '', tenant_name: '', company_name: '',
    admin_name: '', admin_email: '', admin_password: '',
  });
  const [selectedModules, setSelectedModules] = useState<string[]>(['sales']);
  const [showPw, setShowPw]   = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const totalPrice = selectedModules.reduce((sum, m) => {
    return sum + (MODULES.find(x => x.key === m)?.price || 0);
  }, 0);

  const toggleModule = (key: string) => {
    setSelectedModules(prev =>
      prev.includes(key) ? prev.filter(m => m !== key) : [...prev, key]
    );
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (selectedModules.length === 0) { setError('Select at least one module'); return; }
    setError('');
    setLoading(true);
    try {
      await api.post('/tenants', { ...form, modules: selectedModules });
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create client');
    } finally {
      setLoading(false);
    }
  };

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const inputCls = 'w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition';

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center">
              <UserPlus size={17} className="text-emerald-600" />
            </div>
            <h3 className="text-base font-bold text-slate-800">Add New Client</h3>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 transition">
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1">
          <div className="p-5 space-y-4">
            {error && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-sm">
                <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
                {error}
              </div>
            )}

            {/* Business Info */}
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Business Info</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Company Code *</label>
                  <input
                    className={inputCls}
                    placeholder="ahmed_shop"
                    value={form.tenant_code}
                    onChange={e => set('tenant_code', e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    required
                  />
                  <p className="text-xs text-slate-400 mt-1">Lowercase, no spaces</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Business Name *</label>
                  <input
                    className={inputCls}
                    placeholder="Ahmed General Store"
                    value={form.tenant_name}
                    onChange={e => set('tenant_name', e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="mt-3">
                <label className="block text-sm font-medium text-slate-700 mb-1">Company Name (Display)</label>
                <input
                  className={inputCls}
                  placeholder="Ahmed General Store Pvt Ltd"
                  value={form.company_name}
                  onChange={e => set('company_name', e.target.value)}
                />
              </div>
            </div>

            {/* Admin Info */}
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Admin Account</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Admin Name</label>
                  <input
                    className={inputCls}
                    placeholder="Ahmed Khan"
                    value={form.admin_name}
                    onChange={e => set('admin_name', e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Admin Email *</label>
                  <input
                    type="email"
                    className={inputCls}
                    placeholder="admin@ahmed.com"
                    value={form.admin_email}
                    onChange={e => set('admin_email', e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="mt-3">
                <label className="block text-sm font-medium text-slate-700 mb-1">Admin Password *</label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    className={`${inputCls} pr-10`}
                    placeholder="Min 6 characters"
                    value={form.admin_password}
                    onChange={e => set('admin_password', e.target.value)}
                    required
                    minLength={6}
                  />
                  <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            </div>

            {/* Modules */}
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Select Modules *</p>
              <div className="grid grid-cols-2 gap-2">
                {MODULES.map(m => {
                  const active = selectedModules.includes(m.key);
                  return (
                    <label
                      key={m.key}
                      className={`flex items-center gap-3 p-3.5 border-2 rounded-2xl cursor-pointer transition-all ${
                        active
                          ? 'border-emerald-500 bg-emerald-50/70'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="accent-emerald-600 w-4 h-4"
                        checked={active}
                        onChange={() => toggleModule(m.key)}
                      />
                      <div>
                        <div className="text-sm font-semibold text-slate-800">
                          {m.icon} {m.label}
                        </div>
                        <div className="text-xs text-slate-500">Rs. {m.price.toLocaleString()}/mo</div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Total */}
            <div className="bg-slate-800 rounded-2xl p-4 flex items-center justify-between">
              <span className="text-sm text-slate-400">Monthly Total</span>
              <div className="text-right">
                <span className="text-xl font-bold text-emerald-400">
                  Rs. {totalPrice.toLocaleString()}
                </span>
                <span className="text-slate-500 text-xs ml-1">/mo</span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-5 pb-5 flex gap-3 flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-slate-200 text-slate-600 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-emerald-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 transition shadow-sm shadow-emerald-200"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating...
                </span>
              ) : 'Create Client'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
