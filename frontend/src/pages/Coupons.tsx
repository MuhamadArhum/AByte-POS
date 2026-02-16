import { useState, useEffect, useCallback } from 'react';
import { Ticket, Plus, Search, Pencil, Trash2, X, Calendar, Percent, DollarSign } from 'lucide-react';
import api from '../utils/api';
import Pagination from '../components/Pagination';

interface Coupon {
  coupon_id: number;
  code: string;
  description: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  min_purchase: number;
  max_discount: number | null;
  usage_limit: number | null;
  used_count: number;
  valid_from: string;
  valid_until: string;
  is_active: number;
  created_by_name: string;
  created_at: string;
}

const Coupons = () => {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [stats, setStats] = useState({ active_coupons: 0, total_redemptions: 0, total_savings: 0 });
  const [showModal, setShowModal] = useState(false);
  const [editCoupon, setEditCoupon] = useState<Coupon | null>(null);

  // Form state
  const [form, setForm] = useState({ code: '', description: '', discount_type: 'percentage' as 'percentage' | 'fixed', discount_value: '', min_purchase: '', max_discount: '', usage_limit: '', valid_from: '', valid_until: '' });

  const fetchCoupons = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      const res = await api.get('/coupons', { params });
      setCoupons(res.data.data);
      setTotalItems(res.data.pagination.total);
      setTotalPages(res.data.pagination.totalPages);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  }, [page, limit, search, statusFilter]);

  const fetchStats = async () => {
    try { const res = await api.get('/coupons/stats'); setStats(res.data); } catch (err) { console.error(err); }
  };

  useEffect(() => { fetchStats(); }, []);
  useEffect(() => { fetchCoupons(); }, [fetchCoupons]);

  const openCreate = () => {
    setEditCoupon(null);
    setForm({ code: '', description: '', discount_type: 'percentage', discount_value: '', min_purchase: '', max_discount: '', usage_limit: '', valid_from: '', valid_until: '' });
    setShowModal(true);
  };

  const openEdit = (c: Coupon) => {
    setEditCoupon(c);
    setForm({ code: c.code, description: c.description || '', discount_type: c.discount_type, discount_value: String(c.discount_value), min_purchase: String(c.min_purchase || ''), max_discount: c.max_discount ? String(c.max_discount) : '', usage_limit: c.usage_limit ? String(c.usage_limit) : '', valid_from: c.valid_from?.split('T')[0] || '', valid_until: c.valid_until?.split('T')[0] || '' });
    setShowModal(true);
  };

  const handleSubmit = async () => {
    try {
      const payload = { ...form, discount_value: parseFloat(form.discount_value), min_purchase: parseFloat(form.min_purchase) || 0, max_discount: form.max_discount ? parseFloat(form.max_discount) : null, usage_limit: form.usage_limit ? parseInt(form.usage_limit) : null };
      if (editCoupon) {
        await api.put(`/coupons/${editCoupon.coupon_id}`, payload);
      } else {
        await api.post('/coupons', payload);
      }
      setShowModal(false);
      fetchCoupons();
      fetchStats();
    } catch (err: any) { alert(err.response?.data?.message || 'Failed to save coupon'); }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this coupon?')) return;
    try { await api.delete(`/coupons/${id}`); fetchCoupons(); fetchStats(); } catch (err: any) { alert(err.response?.data?.message || 'Failed'); }
  };

  const isExpired = (c: Coupon) => new Date(c.valid_until) < new Date() || !c.is_active;
  const isUsedUp = (c: Coupon) => c.usage_limit !== null && c.used_count >= c.usage_limit;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3"><Ticket className="text-indigo-600" size={32} /> Coupons</h1>
          <p className="text-gray-500 mt-1">Manage discount codes and promotions</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl hover:bg-indigo-700 transition-colors"><Plus size={20} /> Create Coupon</button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-50 rounded-xl"><Ticket size={24} className="text-indigo-600" /></div>
            <div><p className="text-2xl font-bold text-gray-800">{stats.active_coupons}</p><p className="text-sm text-gray-500">Active Coupons</p></div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-50 rounded-xl"><Calendar size={24} className="text-green-600" /></div>
            <div><p className="text-2xl font-bold text-green-600">{stats.total_redemptions}</p><p className="text-sm text-gray-500">Total Redemptions</p></div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-50 rounded-xl"><DollarSign size={24} className="text-emerald-600" /></div>
            <div><p className="text-2xl font-bold text-emerald-600">${stats.total_savings.toFixed(2)}</p><p className="text-sm text-gray-500">Total Savings</p></div>
          </div>
        </div>
      </div>

      {/* Filters & Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex flex-wrap gap-4 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input type="text" placeholder="Search by code or description..." className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none">
            <option value="">All</option>
            <option value="active">Active</option>
            <option value="expired">Expired / Inactive</option>
            <option value="used_up">Used Up</option>
          </select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-12"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Discount</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Usage</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Valid Period</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {coupons.map((c) => (
                  <tr key={c.coupon_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3"><span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-1 rounded">{c.code}</span></td>
                    <td className="px-4 py-3 text-gray-600 max-w-[200px] truncate">{c.description || '-'}</td>
                    <td className="px-4 py-3">
                      <span className="font-semibold">{c.discount_type === 'percentage' ? `${c.discount_value}%` : `$${c.discount_value}`}</span>
                      {c.min_purchase > 0 && <span className="text-xs text-gray-400 ml-1">(min ${c.min_purchase})</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="font-medium">{c.used_count}</span>
                      <span className="text-gray-400">/{c.usage_limit || '∞'}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{new Date(c.valid_from).toLocaleDateString()} - {new Date(c.valid_until).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      {isUsedUp(c) ? (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">Used Up</span>
                      ) : isExpired(c) ? (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">Expired</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Active</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button onClick={() => openEdit(c)} className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg"><Pencil size={16} /></button>
                        <button onClick={() => handleDelete(c.coupon_id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {coupons.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400"><Ticket size={40} className="mx-auto mb-3 text-gray-300" /><p>No coupons found</p></td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} totalItems={totalItems} itemsPerPage={limit} onItemsPerPageChange={(v) => { setLimit(v); setPage(1); }} />
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-bold">{editCoupon ? 'Edit Coupon' : 'Create Coupon'}</h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Coupon Code</label>
                <input type="text" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} disabled={!!editCoupon} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-mono disabled:bg-gray-100" placeholder="e.g. SAVE20" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input type="text" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Optional description" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Discount Type</label>
                  <div className="flex gap-2">
                    <button onClick={() => setForm({ ...form, discount_type: 'percentage' })} className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${form.discount_type === 'percentage' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}><Percent size={14} className="inline mr-1" />Percentage</button>
                    <button onClick={() => setForm({ ...form, discount_type: 'fixed' })} className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${form.discount_type === 'fixed' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}><DollarSign size={14} className="inline mr-1" />Fixed</button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Discount Value</label>
                  <input type="number" value={form.discount_value} onChange={(e) => setForm({ ...form, discount_value: e.target.value })} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" min="0" step="0.01" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Min Purchase</label>
                  <input type="number" value={form.min_purchase} onChange={(e) => setForm({ ...form, min_purchase: e.target.value })} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" min="0" step="0.01" placeholder="0" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Max Discount</label>
                  <input type="number" value={form.max_discount} onChange={(e) => setForm({ ...form, max_discount: e.target.value })} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" min="0" step="0.01" placeholder="No limit" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Usage Limit</label>
                  <input type="number" value={form.usage_limit} onChange={(e) => setForm({ ...form, usage_limit: e.target.value })} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" min="1" placeholder="Unlimited" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Valid From</label>
                  <input type="date" value={form.valid_from} onChange={(e) => setForm({ ...form, valid_from: e.target.value })} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Valid Until</label>
                  <input type="date" value={form.valid_until} onChange={(e) => setForm({ ...form, valid_until: e.target.value })} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-gray-700 border rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={handleSubmit} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">{editCoupon ? 'Update' : 'Create'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Coupons;
