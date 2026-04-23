import { useState } from 'react';
import { X, Check, Loader2 } from 'lucide-react';
import api from '../api/axios';

const ALL_MODULES = [
  { key: 'sales',     label: 'Sales',       desc: 'POS, invoices, returns',     price: 2250, color: 'border-blue-200 bg-blue-50',    check: 'bg-blue-600',   text: 'text-blue-700' },
  { key: 'inventory', label: 'Inventory',   desc: 'Products, stock, suppliers', price: 2250, color: 'border-emerald-200 bg-emerald-50', check: 'bg-emerald-600', text: 'text-emerald-700' },
  { key: 'accounts',  label: 'Accounts',    desc: 'Ledger, vouchers, reports',  price: 2999, color: 'border-purple-200 bg-purple-50', check: 'bg-purple-600', text: 'text-purple-700' },
  { key: 'hr',        label: 'HR & Payroll',desc: 'Staff, attendance, salary',  price: 2999, color: 'border-orange-200 bg-orange-50', check: 'bg-orange-600', text: 'text-orange-700' },
];

interface Props {
  tenantId:       number;
  clientName:     string;
  currentModules: string[];
  onClose:        () => void;
}

export default function EditModulesModal({ tenantId, clientName, currentModules, onClose }: Props) {
  const [selected, setSelected] = useState<string[]>(currentModules);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState(false);

  const toggle = (key: string) => {
    setSelected(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  const monthly = selected.reduce((s, k) => {
    const m = ALL_MODULES.find(m => m.key === k);
    return s + (m?.price || 0);
  }, 0);

  const handleSave = async () => {
    if (selected.length === 0) { setError('At least one module is required.'); return; }
    setSaving(true); setError('');
    try {
      await api.put(`/tenants/${tenantId}`, { modules: selected });
      setSuccess(true);
      setTimeout(onClose, 900);
    } catch (e: any) {
      setError(e.response?.data?.message || 'Failed to update modules.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-slate-800">Manage Modules</h3>
            <p className="text-xs text-slate-500 mt-0.5">{clientName}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 transition">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-3">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div>
          )}

          {ALL_MODULES.map(m => {
            const active = selected.includes(m.key);
            return (
              <button
                key={m.key}
                onClick={() => toggle(m.key)}
                className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left ${
                  active ? m.color + ' border-opacity-100' : 'border-slate-100 bg-white hover:bg-slate-50'
                }`}
              >
                <div className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 transition-all ${
                  active ? m.check : 'border-2 border-slate-200 bg-white'
                }`}>
                  {active && <Check size={12} strokeWidth={3} className="text-white" />}
                </div>
                <div className="flex-1">
                  <p className={`font-semibold text-sm ${active ? m.text : 'text-slate-700'}`}>{m.label}</p>
                  <p className="text-slate-400 text-xs">{m.desc}</p>
                </div>
                <span className={`text-sm font-bold ${active ? m.text : 'text-slate-400'}`}>
                  Rs. {m.price.toLocaleString()}
                </span>
              </button>
            );
          })}

          {/* Total */}
          <div className="flex justify-between items-center pt-2 border-t border-slate-100">
            <span className="text-sm text-slate-500">Monthly Total</span>
            <span className="text-lg font-bold text-slate-800">Rs. {monthly.toLocaleString()}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 pb-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 text-sm border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || success}
            className="flex-1 px-4 py-3 text-sm bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {success ? (
              <><Check size={16} /> Saved!</>
            ) : saving ? (
              <><Loader2 size={16} className="animate-spin" /> Saving...</>
            ) : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
