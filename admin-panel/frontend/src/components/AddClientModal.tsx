import { useState, FormEvent } from 'react';
import { X } from 'lucide-react';
import api from '../api/axios';

const MODULES = [
  { key: 'sales',     label: 'Sale',        price: 2250 },
  { key: 'inventory', label: 'Inventory',   price: 2250 },
  { key: 'accounts',  label: 'Accounts',    price: 2999 },
  { key: 'hr',        label: 'HR & Payroll',price: 2999 },
];

interface Props { onClose: () => void; }

export default function AddClientModal({ onClose }: Props) {
  const [form, setForm] = useState({
    tenant_code: '', tenant_name: '', company_name: '',
    admin_name: '', admin_email: '', admin_password: '',
  });
  const [selectedModules, setSelectedModules] = useState<string[]>(['sales']);
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

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b">
          <h3 className="text-lg font-bold text-gray-900">Add New Client</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Company Code *</label>
              <input
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="ahmed_shop"
                value={form.tenant_code}
                onChange={e => set('tenant_code', e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                required
              />
              <p className="text-xs text-gray-400 mt-1">Lowercase, no spaces</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Business Name *</label>
              <input
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="Ahmed General Store"
                value={form.tenant_name}
                onChange={e => set('tenant_name', e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Company Name (Display)</label>
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="Ahmed General Store Pvt Ltd"
              value={form.company_name}
              onChange={e => set('company_name', e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Admin Name</label>
              <input
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="Ahmed Khan"
                value={form.admin_name}
                onChange={e => set('admin_name', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Admin Email *</label>
              <input
                type="email"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="admin@ahmed.com"
                value={form.admin_email}
                onChange={e => set('admin_email', e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Admin Password *</label>
            <input
              type="password"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="Min 6 characters"
              value={form.admin_password}
              onChange={e => set('admin_password', e.target.value)}
              required minLength={6}
            />
          </div>

          {/* Module Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Modules *</label>
            <div className="grid grid-cols-2 gap-2">
              {MODULES.map(m => (
                <label
                  key={m.key}
                  className={`flex items-center gap-3 p-3 border-2 rounded-xl cursor-pointer transition ${
                    selectedModules.includes(m.key)
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="accent-green-600"
                    checked={selectedModules.includes(m.key)}
                    onChange={() => toggleModule(m.key)}
                  />
                  <div>
                    <div className="text-sm font-medium text-gray-900">{m.label}</div>
                    <div className="text-xs text-gray-500">Rs. {m.price.toLocaleString()}/mo</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Total Price */}
          <div className="bg-gray-50 rounded-xl p-4 flex items-center justify-between">
            <span className="text-sm text-gray-600">Monthly Total:</span>
            <span className="text-lg font-bold text-green-600">Rs. {totalPrice.toLocaleString()}</span>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-xl text-sm hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-green-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-green-700 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Client'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
