import { useState, useEffect, useCallback } from 'react';
import { Store, Plus, Pencil, Trash2, Search, MapPin, Phone, Mail, X, Building2, User, TrendingUp, Info } from 'lucide-react';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';

interface StoreData {
  store_id:       number;
  store_name:     string;
  store_code:     string;
  address:        string | null;
  phone:          string | null;
  email:          string | null;
  manager_id:     number | null;
  manager_name:   string | null;
  monthly_charge: number;
  is_active:      number;
}

interface ConsolidatedBranch {
  store_id:        number;
  store_name:      string;
  store_code:      string;
  monthly_charge:  number;
  manager_name:    string | null;
  today_sale_count: number;
  today_revenue:   number;
  month_revenue:   number;
  total_staff:     number;
  total_users:     number;
}

interface ConsolidatedTotals {
  today_revenue:   number;
  month_revenue:   number;
  today_sales:     number;
  total_staff:     number;
  total_users:     number;
  monthly_charges: number;
}

interface UserOption {
  user_id: number;
  name: string;
  role: string;
}

interface StoreModalProps {
  store: StoreData | null;
  users: UserOption[];
  onClose: () => void;
  onSave: () => void;
}

const StoreModal = ({ store, users, onClose, onSave }: StoreModalProps) => {
  const [form, setForm] = useState({
    store_name:     store?.store_name || '',
    store_code:     store?.store_code || '',
    address:        store?.address || '',
    phone:          store?.phone || '',
    email:          store?.email || '',
    manager_id:     store?.manager_id || '',
    monthly_charge: store?.monthly_charge ?? 0,
    is_active:      store ? store.is_active : 1,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.store_name.trim() || !form.store_code.trim()) {
      setError('Store name and code are required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (store) {
        await api.put(`/stores/${store.store_id}`, form);
      } else {
        await api.post('/stores', form);
      }
      onSave();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save store');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
            <Building2 size={22} className="text-emerald-600" />
            {store ? 'Edit Store' : 'Add New Store'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm border border-red-200">{error}</div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Store Name *</label>
              <input
                type="text"
                value={form.store_name}
                onChange={(e) => setForm({ ...form, store_name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                placeholder="Main Branch"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Store Code *</label>
              <input
                type="text"
                value={form.store_code}
                onChange={(e) => setForm({ ...form, store_code: e.target.value.toUpperCase() })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                placeholder="MAIN"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
            <input
              type="text"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
              placeholder="123 Main Street"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input
                type="text"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                placeholder="+92 300 1234567"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                placeholder="store@example.com"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Manager</label>
              <select
                value={form.manager_id}
                onChange={(e) => setForm({ ...form, manager_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
              >
                <option value="">No Manager</option>
                {users.map(u => (
                  <option key={u.user_id} value={u.user_id}>{u.name} ({u.role})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Monthly Charge (Rs.)</label>
              <input
                type="number"
                min="0"
                value={form.monthly_charge}
                onChange={(e) => setForm({ ...form, monthly_charge: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                placeholder="0"
              />
            </div>
          </div>
          {store && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
              >
                <option value={1}>Active</option>
                <option value={0}>Inactive</option>
              </select>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:bg-gray-300 transition-colors font-medium"
            >
              {saving ? 'Saving...' : store ? 'Update Store' : 'Create Store'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const Stores = () => {
  const { isAdmin } = useAuth();
  const [stores, setStores] = useState<StoreData[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editStore, setEditStore] = useState<StoreData | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [consolidated, setConsolidated] = useState<ConsolidatedBranch[]>([]);
  const [consolidatedTotals, setConsolidatedTotals] = useState<ConsolidatedTotals | null>(null);
  const [showConsolidated, setShowConsolidated] = useState(false);

  const fetchStores = useCallback(async () => {
    setLoading(true);
    try {
      const [storeRes, consolidRes] = await Promise.all([
        api.get('/stores'),
        isAdmin ? api.get('/stores/consolidated-summary').catch(() => ({ data: { data: [], totals: null } })) : Promise.resolve({ data: { data: [], totals: null } }),
      ]);
      setStores(storeRes.data.data || []);
      if (isAdmin) {
        setConsolidated(consolidRes.data.data || []);
        setConsolidatedTotals(consolidRes.data.totals || null);
      }
    } catch (error) {
      console.error('Failed to fetch stores', error);
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await api.get('/users');
      setUsers(res.data.data || res.data || []);
    } catch (error) {
      console.error('Failed to fetch users', error);
    }
  }, []);

  useEffect(() => {
    fetchStores();
    fetchUsers();
  }, [fetchStores, fetchUsers]);

  const handleDelete = async (store: StoreData) => {
    if (!window.confirm(`Delete store "${store.store_name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/stores/${store.store_id}`);
      fetchStores();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete store');
    }
  };

  const handleModalSave = () => {
    setShowModal(false);
    setEditStore(null);
    fetchStores();
  };

  const filteredStores = stores.filter(s => {
    const matchesSearch = !searchQuery ||
      s.store_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.store_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.address && s.address.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (s.manager_name && s.manager_name.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = statusFilter === 'all' ||
      (statusFilter === 'active' && s.is_active) ||
      (statusFilter === 'inactive' && !s.is_active);

    return matchesSearch && matchesStatus;
  });

  const activeCount = stores.filter(s => s.is_active).length;
  const inactiveCount = stores.filter(s => !s.is_active).length;

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-gray-900 flex items-center gap-3">
            <Store className="text-emerald-600" size={20} />
            Branch / Store Management
          </h1>
          <p className="text-gray-500 mt-1">{stores.length} branches configured</p>
        </div>
        <div className="flex items-center gap-3">
          {isAdmin && stores.length > 1 && (
            <button
              onClick={() => setShowConsolidated(!showConsolidated)}
              className={`px-4 py-2.5 rounded-lg font-medium flex items-center gap-2 transition-colors text-sm border ${showConsolidated ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-blue-600 border-blue-200 hover:bg-blue-50'}`}
            >
              <TrendingUp size={16} />
              Consolidated Summary
            </button>
          )}
          <button
            onClick={() => { setEditStore(null); setShowModal(true); }}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-lg font-medium flex items-center gap-2 transition-colors"
          >
            <Plus size={20} />
            Add Branch
          </button>
        </div>
      </div>

      {/* Super Admin note */}
      <div className="mb-6 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
        <Info size={15} className="flex-shrink-0 mt-0.5" />
        <span>New branches are provisioned and billed through the <strong>Super Admin Panel</strong>. Use this page to manage settings for existing branches.</span>
      </div>

      {/* Consolidated Summary Panel */}
      {isAdmin && showConsolidated && consolidated.length > 0 && (
        <div className="mb-6 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center justify-between">
            <h2 className="font-semibold text-sm flex items-center gap-2"><TrendingUp size={16} /> Consolidated Branch Summary</h2>
            {consolidatedTotals && (
              <div className="flex gap-6 text-xs text-blue-100">
                <span>Today Revenue: <strong className="text-white">Rs. {consolidatedTotals.today_revenue.toLocaleString()}</strong></span>
                <span>Month Revenue: <strong className="text-white">Rs. {consolidatedTotals.month_revenue.toLocaleString()}</strong></span>
                <span>Total Staff: <strong className="text-white">{consolidatedTotals.total_staff}</strong></span>
                <span>Monthly Charges: <strong className="text-white">Rs. {consolidatedTotals.monthly_charges.toLocaleString()}</strong></span>
              </div>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50">
                <tr>
                  {['Branch', 'Code', 'Manager', "Today's Sales", "Today's Revenue", 'Month Revenue', 'Staff', 'Users', 'Monthly Charge'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {consolidated.map(b => (
                  <tr key={b.store_id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-800 text-sm">{b.store_name}</td>
                    <td className="px-4 py-3 text-xs font-mono text-gray-500">{b.store_code}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{b.manager_name || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{b.today_sale_count}</td>
                    <td className="px-4 py-3 text-sm font-medium text-emerald-700">Rs. {Number(b.today_revenue).toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm font-medium text-blue-700">Rs. {Number(b.month_revenue).toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{b.total_staff}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{b.total_users}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">Rs. {Number(b.monthly_charge).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-50 rounded-xl">
              <Building2 size={24} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-800">{stores.length}</p>
              <p className="text-sm text-gray-500">Total Stores</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-50 rounded-xl">
              <Store size={24} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-emerald-600">{activeCount}</p>
              <p className="text-sm text-gray-500">Active</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gray-100 rounded-xl">
              <Store size={24} className="text-gray-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-400">{inactiveCount}</p>
              <p className="text-sm text-gray-500">Inactive</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search stores..."
                className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
          >
            <option value="all">All Status</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>
        </div>
      </div>

      {/* Store Cards */}
      {loading ? (
        <div className="flex items-center justify-center p-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600"></div>
        </div>
      ) : filteredStores.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <Store size={48} className="mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500">
            {searchQuery || statusFilter !== 'all' ? 'No stores match your filters' : 'No stores yet. Add your first store.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredStores.map((store) => (
            <div
              key={store.store_id}
              className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow"
            >
              {/* Card Header */}
              <div className="p-5 border-b border-gray-50">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl ${store.is_active ? 'bg-emerald-50' : 'bg-gray-100'}`}>
                      <Store size={20} className={store.is_active ? 'text-emerald-600' : 'text-gray-400'} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-800">{store.store_name}</h3>
                      <span className="text-xs font-mono text-gray-400">{store.store_code}</span>
                    </div>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    store.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {store.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>

              {/* Card Body */}
              <div className="p-5 space-y-2.5 text-sm">
                {store.address && (
                  <div className="flex items-start gap-2 text-gray-600">
                    <MapPin size={14} className="mt-0.5 text-gray-400 shrink-0" />
                    <span>{store.address}</span>
                  </div>
                )}
                {store.phone && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Phone size={14} className="text-gray-400" />
                    <span>{store.phone}</span>
                  </div>
                )}
                {store.email && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Mail size={14} className="text-gray-400" />
                    <span>{store.email}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-gray-600">
                  <User size={14} className="text-gray-400" />
                  <span>{store.manager_name || 'No Manager'}</span>
                </div>
              </div>

              {/* Card Actions */}
              <div className="px-5 py-3 bg-gray-50 flex justify-end gap-2">
                <button
                  onClick={() => { setEditStore(store); setShowModal(true); }}
                  className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                  title="Edit Store"
                >
                  <Pencil size={16} />
                </button>
                <button
                  onClick={() => handleDelete(store)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Delete Store"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <StoreModal
          store={editStore}
          users={users}
          onClose={() => { setShowModal(false); setEditStore(null); }}
          onSave={handleModalSave}
        />
      )}
    </div>
  );
};

export default Stores;
