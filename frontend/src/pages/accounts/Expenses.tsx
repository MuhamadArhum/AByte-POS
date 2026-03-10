import { useState, useEffect } from 'react';
import { DollarSign, Plus, Search, Edit2, Trash2, X, Filter, Calendar, TrendingDown } from 'lucide-react';
import api from '../../utils/api';
import Pagination from '../../components/Pagination';
import { useAuth } from '../../context/AuthContext';

interface Expense {
  expense_id: number;
  title: string;
  amount: number;
  category: string | null;
  expense_date: string;
  description: string | null;
  created_by_name: string | null;
}

interface Summary {
  total_expenses: number;
  grand_total: number;
}

const today = new Date().toISOString().split('T')[0];
const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

const CATEGORIES = ['Rent', 'Utilities', 'Salaries', 'Supplies', 'Marketing', 'Maintenance', 'Transport', 'Other'];

const emptyForm = { title: '', amount: '', category: '', expense_date: today, description: '' };

const Expenses = () => {
  const { user } = useAuth();
  const isAdminOrManager = user?.role_name === 'Admin' || user?.role_name === 'Manager';

  const [expenses, setExpenses]   = useState<Expense[]>([]);
  const [summary, setSummary]     = useState<Summary>({ total_expenses: 0, grand_total: 0 });
  const [loading, setLoading]     = useState(true);
  const [page, setPage]           = useState(1);
  const [limit, setLimit]         = useState(20);
  const [totalPages, setTotalPages] = useState(0);
  const [totalItems, setTotalItems] = useState(0);

  // Filters
  const [search, setSearch]       = useState('');
  const [category, setCategory]   = useState('');
  const [dateFrom, setDateFrom]   = useState(monthStart);
  const [dateTo, setDateTo]       = useState(today);

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm]           = useState(emptyForm);
  const [saving, setSaving]       = useState(false);
  const [deleteId, setDeleteId]   = useState<number | null>(null);
  const [deleting, setDeleting]   = useState(false);

  const fetchExpenses = async (p = page, l = limit) => {
    setLoading(true);
    try {
      const params: any = { page: p, limit: l };
      if (search)   params.search     = search;
      if (category) params.category   = category;
      if (dateFrom) params.start_date = dateFrom;
      if (dateTo)   params.end_date   = dateTo;

      const [expRes, sumRes] = await Promise.all([
        api.get('/expenses', { params }),
        api.get('/expenses/summary', { params: { start_date: dateFrom, end_date: dateTo } })
      ]);

      setExpenses(expRes.data.data || []);
      setTotalPages(expRes.data.pagination.totalPages);
      setTotalItems(expRes.data.pagination.total);
      setSummary(sumRes.data.total || { total_expenses: 0, grand_total: 0 });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchExpenses(page, limit); }, [page, limit]);

  const applyFilters = () => { setPage(1); fetchExpenses(1, limit); };

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (e: Expense) => {
    setEditingId(e.expense_id);
    setForm({
      title: e.title,
      amount: String(e.amount),
      category: e.category || '',
      expense_date: e.expense_date.split('T')[0],
      description: e.description || ''
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.amount) return alert('Title and amount are required');
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        amount: parseFloat(form.amount),
        category: form.category || null,
        expense_date: form.expense_date,
        description: form.description.trim() || null
      };
      if (editingId) {
        await api.put(`/expenses/${editingId}`, payload);
      } else {
        await api.post('/expenses', payload);
      }
      setShowModal(false);
      fetchExpenses(page, limit);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to save expense');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await api.delete(`/expenses/${deleteId}`);
      setDeleteId(null);
      fetchExpenses(page, limit);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete');
    } finally {
      setDeleting(false);
    }
  };

  const setPreset = (preset: string) => {
    const d = new Date();
    let from = today;
    if (preset === 'week')  from = new Date(d.getTime() - 6 * 86400000).toISOString().split('T')[0];
    else if (preset === 'month') from = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
    setDateFrom(from);
    setDateTo(today);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-gray-900 flex items-center gap-3">
            <TrendingDown className="text-red-500" size={20} />
            Expenses
          </h1>
          <p className="text-gray-500 mt-1">Track and manage business expenses</p>
        </div>
        {isAdminOrManager && (
          <button
            onClick={openAdd}
            className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-xl hover:bg-emerald-700 transition-colors font-medium shadow-sm"
          >
            <Plus size={20} />
            Add Expense
          </button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center">
              <DollarSign size={24} className="text-red-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600">Rs. {Number(summary.grand_total).toLocaleString()}</p>
              <p className="text-sm text-gray-500">Total Expenses</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-orange-50 rounded-xl flex items-center justify-center">
              <Filter size={24} className="text-orange-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-800">{summary.total_expenses}</p>
              <p className="text-sm text-gray-500">Total Entries</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
              <Calendar size={24} className="text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-800">
                {summary.total_expenses > 0
                  ? `Rs. ${(Number(summary.grand_total) / summary.total_expenses).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                  : 'Rs. 0'}
              </p>
              <p className="text-sm text-gray-500">Avg per Entry</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Preset Buttons */}
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {[{ label: 'Today', key: 'today' }, { label: 'This Week', key: 'week' }, { label: 'This Month', key: 'month' }].map(p => (
              <button
                key={p.key}
                onClick={() => setPreset(p.key)}
                className="px-3 py-1.5 rounded-md text-sm font-medium hover:bg-white hover:shadow transition-all text-gray-700"
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Date Range */}
          <div className="flex items-center gap-2">
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30" />
            <span className="text-gray-400 text-sm">to</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30" />
          </div>

          {/* Category Filter */}
          <select
            value={category}
            onChange={e => setCategory(e.target.value)}
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 bg-white text-gray-700"
          >
            <option value="">All Categories</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && applyFilters()}
              placeholder="Search expenses..."
              className="w-full pl-9 pr-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            />
          </div>

          <button
            onClick={applyFilters}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium transition-colors"
          >
            Apply
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600" />
          </div>
        ) : expenses.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <TrendingDown size={40} className="mb-3 opacity-30" />
            <p className="text-base font-medium">No expenses found</p>
            <p className="text-sm mt-1">Try adjusting your filters or add a new expense</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">#</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Date</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Title</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Category</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Description</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Added By</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600">Amount</th>
                    {isAdminOrManager && (
                      <th className="text-center px-4 py-3 font-semibold text-gray-600">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {expenses.map((exp, idx) => (
                    <tr key={exp.expense_id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="px-4 py-3 text-gray-400">{(page - 1) * limit + idx + 1}</td>
                      <td className="px-4 py-3 text-gray-600">
                        {new Date(exp.expense_date).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-800">{exp.title}</td>
                      <td className="px-4 py-3">
                        {exp.category ? (
                          <span className="px-2 py-0.5 bg-orange-50 text-orange-700 rounded-full text-xs font-medium">
                            {exp.category}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">Uncategorized</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500 max-w-[200px] truncate">{exp.description || '—'}</td>
                      <td className="px-4 py-3 text-gray-500">{exp.created_by_name || '—'}</td>
                      <td className="px-4 py-3 text-right font-semibold text-red-600">
                        Rs. {Number(exp.amount).toLocaleString()}
                      </td>
                      {isAdminOrManager && (
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => openEdit(exp)}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Edit"
                            >
                              <Edit2 size={15} />
                            </button>
                            {user?.role_name === 'Admin' && (
                              <button
                                onClick={() => setDeleteId(exp.expense_id)}
                                className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                title="Delete"
                              >
                                <Trash2 size={15} />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={setPage}
              totalItems={totalItems}
              itemsPerPage={limit}
              onItemsPerPageChange={(l) => { setLimit(l); setPage(1); }}
            />
          </>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-800">
                {editingId ? 'Edit Expense' : 'Add Expense'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400"
                  placeholder="e.g. Office Rent"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount (Rs.) <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    value={form.amount}
                    onChange={e => setForm({ ...form, amount: e.target.value })}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400"
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <input
                    type="date"
                    value={form.expense_date}
                    onChange={e => setForm({ ...form, expense_date: e.target.value })}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  value={form.category}
                  onChange={e => setForm({ ...form, category: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 bg-white"
                >
                  <option value="">Select category...</option>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 resize-none"
                  rows={3}
                  placeholder="Optional notes..."
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors font-medium"
              >
                {saving ? 'Saving...' : editingId ? 'Update Expense' : 'Add Expense'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="text-center">
              <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 size={24} className="text-red-600" />
              </div>
              <h3 className="text-sm font-semibold text-gray-800 mb-2">Delete Expense</h3>
              <p className="text-gray-500 text-sm mb-6">This action cannot be undone. Are you sure you want to delete this expense?</p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => setDeleteId(null)}
                  className="px-5 py-2 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="px-5 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors font-medium"
                >
                  {deleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Expenses;
