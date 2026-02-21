import { useState, useEffect } from 'react';
import { BookOpen, Plus, Edit, Trash2, Search, Filter, X, Building2, CreditCard, Landmark, TrendingUp, TrendingDown } from 'lucide-react';
import api from '../utils/api';
import { useToast } from '../components/Toast';

const AccountModal = ({ isOpen, onClose, onSuccess, account, categoryType }: any) => {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    account_code: '',
    account_name: '',
    group_id: '',
    parent_account_id: '',
    account_type: categoryType || 'asset',
    opening_balance: '0',
    description: ''
  });

  useEffect(() => {
    if (isOpen) {
      api.get('/accounting/account-groups').then(r => setGroups(r.data.data || [])).catch(() => {});
      api.get('/accounting/accounts', { params: { limit: 200 } }).then(r => setAccounts(r.data.data || [])).catch(() => {});
    }
    if (account) {
      setFormData({
        account_code: account.account_code || '',
        account_name: account.account_name || '',
        group_id: account.group_id || '',
        parent_account_id: account.parent_account_id || '',
        account_type: account.account_type || categoryType || 'asset',
        opening_balance: '',
        description: account.description || ''
      });
    } else {
      setFormData({ account_code: '', account_name: '', group_id: '', parent_account_id: '', account_type: categoryType || 'asset', opening_balance: '0', description: '' });
    }
  }, [isOpen, account, categoryType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.account_code || !formData.account_name || !formData.group_id) {
      toast.error('Please fill all required fields');
      return;
    }

    setLoading(true);
    try {
      if (account) {
        await api.put(`/accounting/accounts/${account.account_id}`, formData);
        toast.success('Account updated');
      } else {
        await api.post('/accounting/accounts', formData);
        toast.success('Account created');
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Operation failed');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const getCategoryTitle = () => {
    if (account) return 'Edit Account';
    const titles: Record<string, string> = {
      asset: 'Add Asset Account',
      liability: 'Add Liability Account',
      equity: 'Add Equity Account',
      revenue: 'Add Revenue Account',
      expense: 'Add Expense Account'
    };
    return titles[categoryType] || 'Add Account';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">{getCategoryTitle()}</h2>
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Account Code *</label>
              <input type="text" value={formData.account_code}
                onChange={(e) => setFormData({ ...formData, account_code: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
                placeholder="e.g., 1001" required disabled={!!account} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Account Name *</label>
              <input type="text" value={formData.account_name}
                onChange={(e) => setFormData({ ...formData, account_name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
                placeholder="e.g., Cash in Hand" required />
            </div>
            {account && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Account Type *</label>
                <select value={formData.account_type} onChange={(e) => setFormData({ ...formData, account_type: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500" disabled>
                  <option value="asset">Asset</option>
                  <option value="liability">Liability</option>
                  <option value="equity">Equity</option>
                  <option value="revenue">Revenue</option>
                  <option value="expense">Expense</option>
                </select>
              </div>
            )}
            <div className={account ? '' : 'col-span-2'}>
              <label className="block text-sm font-medium text-gray-700 mb-2">Account Group *</label>
              <select value={formData.group_id} onChange={(e) => setFormData({ ...formData, group_id: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500" required>
                <option value="">Select Group</option>
                {groups.filter(g => g.group_type === formData.account_type).map(g => (
                  <option key={g.group_id} value={g.group_id}>{g.group_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Parent Account</label>
              <select value={formData.parent_account_id} onChange={(e) => setFormData({ ...formData, parent_account_id: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500">
                <option value="">None (Top Level)</option>
                {accounts.filter(a => a.account_type === formData.account_type && a.account_id !== account?.account_id).map(a => (
                  <option key={a.account_id} value={a.account_id}>[{a.account_code}] {a.account_name}</option>
                ))}
              </select>
            </div>
            {!account && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Opening Balance</label>
                <input type="number" step="0.01" value={formData.opening_balance}
                  onChange={(e) => setFormData({ ...formData, opening_balance: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500" />
              </div>
            )}
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
              <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500" rows={3} />
            </div>
          </div>
          <div className="flex gap-3 mt-6">
            <button type="button" onClick={onClose}
              className="flex-1 px-6 py-3 border border-gray-300 rounded-xl hover:bg-gray-50 transition">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition disabled:opacity-50">
              {loading ? 'Saving...' : account ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const ChartOfAccounts = () => {
  const toast = useToast();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 0 });
  const [showModal, setShowModal] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<any>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('asset');
  const [showCategorySelector, setShowCategorySelector] = useState(false);
  const [typeFilter, setTypeFilter] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => { fetchAccounts(); }, [pagination.page, typeFilter, search]);

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const params: any = { page: pagination.page, limit: pagination.limit };
      if (typeFilter !== 'all') params.type = typeFilter;
      if (search) params.search = search;
      const res = await api.get('/accounting/accounts', { params });
      setAccounts(res.data.data || []);
      if (res.data.pagination) setPagination(res.data.pagination);
    } catch (err) {
      toast.error('Failed to load accounts');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (account: any) => {
    if (!window.confirm(`Delete account "${account.account_name}"? This action cannot be undone.`)) return;
    try {
      await api.delete(`/accounting/accounts/${account.account_id}`);
      toast.success('Account deleted');
      fetchAccounts();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete');
    }
  };

  const typeBadge = (type: string) => {
    const map: Record<string, string> = {
      asset: 'bg-blue-100 text-blue-700',
      liability: 'bg-red-100 text-red-700',
      equity: 'bg-purple-100 text-purple-700',
      revenue: 'bg-green-100 text-green-700',
      expense: 'bg-orange-100 text-orange-700'
    };
    return <span className={`px-2 py-1 rounded-full text-xs font-semibold capitalize ${map[type]}`}>{type}</span>;
  };

  const categoryOptions = [
    {
      type: 'asset',
      label: 'Assets',
      icon: Building2,
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      iconColor: 'text-blue-600',
      hoverBg: 'hover:bg-blue-100',
      description: 'Cash, Bank, Inventory, Equipment, etc.'
    },
    {
      type: 'liability',
      label: 'Liabilities',
      icon: CreditCard,
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      iconColor: 'text-red-600',
      hoverBg: 'hover:bg-red-100',
      description: 'Accounts Payable, Loans, Credit Cards, etc.'
    },
    {
      type: 'equity',
      label: 'Equity',
      icon: Landmark,
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-200',
      iconColor: 'text-purple-600',
      hoverBg: 'hover:bg-purple-100',
      description: 'Owner Capital, Retained Earnings, etc.'
    },
    {
      type: 'revenue',
      label: 'Revenue',
      icon: TrendingUp,
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      iconColor: 'text-green-600',
      hoverBg: 'hover:bg-green-100',
      description: 'Sales, Service Income, Other Income, etc.'
    },
    {
      type: 'expense',
      label: 'Expenses',
      icon: TrendingDown,
      bgColor: 'bg-orange-50',
      borderColor: 'border-orange-200',
      iconColor: 'text-orange-600',
      hoverBg: 'hover:bg-orange-100',
      description: 'Salaries, Rent, Utilities, Office Supplies, etc.'
    }
  ];

  const handleCategorySelect = (categoryType: string) => {
    setSelectedCategory(categoryType);
    setSelectedAccount(null);
    setShowCategorySelector(false);
    setShowModal(true);
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <BookOpen className="text-indigo-600" size={32} />
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Chart of Accounts</h1>
            <p className="text-gray-600 text-sm mt-1">Manage your account structure</p>
          </div>
        </div>
        <button onClick={() => setShowCategorySelector(true)}
          className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl hover:bg-indigo-700 transition shadow-lg">
          <Plus size={20} /> Add New Account
        </button>
      </div>

      {/* Category Selector Modal */}
      {showCategorySelector && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full p-8">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-3xl font-bold text-gray-800">Select Account Category</h2>
                <p className="text-gray-600 mt-2">Choose the type of account you want to create</p>
              </div>
              <button onClick={() => setShowCategorySelector(false)}
                className="text-gray-400 hover:text-gray-600 transition p-2 hover:bg-gray-100 rounded-lg">
                <X size={28} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {categoryOptions.map((option) => {
                const Icon = option.icon;
                return (
                  <button
                    key={option.type}
                    onClick={() => handleCategorySelect(option.type)}
                    className={`${option.bgColor} ${option.borderColor} ${option.hoverBg} border-2 rounded-2xl p-6 transition-all transform hover:scale-105 hover:shadow-2xl text-left`}
                  >
                    <div className="flex flex-col items-center text-center gap-4">
                      <div className={`p-4 rounded-2xl ${option.bgColor} shadow-md`}>
                        <Icon size={48} className={option.iconColor} />
                      </div>
                      <div>
                        <h3 className="text-2xl font-bold text-gray-800 mb-2">{option.label}</h3>
                        <p className="text-sm text-gray-600">{option.description}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <Filter size={20} className="text-gray-600" />
          <select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPagination(p => ({ ...p, page: 1 })); }}
            className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500">
            <option value="all">All Types</option>
            <option value="asset">Assets</option>
            <option value="liability">Liabilities</option>
            <option value="equity">Equity</option>
            <option value="revenue">Revenue</option>
            <option value="expense">Expenses</option>
          </select>
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by code or name..."
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500" />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr className="border-b">
              <th className="text-left p-4 font-semibold text-gray-700">Code</th>
              <th className="text-left p-4 font-semibold text-gray-700">Account Name</th>
              <th className="text-center p-4 font-semibold text-gray-700">Type</th>
              <th className="text-left p-4 font-semibold text-gray-700">Group</th>
              <th className="text-right p-4 font-semibold text-gray-700">Balance</th>
              <th className="text-center p-4 font-semibold text-gray-700">Status</th>
              <th className="text-center p-4 font-semibold text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="p-8 text-center text-gray-500">Loading...</td></tr>
            ) : accounts.length > 0 ? (
              accounts.map((acc: any) => (
                <tr key={acc.account_id} className="border-b hover:bg-gray-50 transition">
                  <td className="p-4 font-mono font-semibold text-gray-800">{acc.account_code}</td>
                  <td className="p-4">
                    <div className="font-semibold text-gray-800">{acc.account_name}</div>
                    {acc.parent_account_name && (
                      <div className="text-xs text-gray-500">Parent: {acc.parent_account_name}</div>
                    )}
                  </td>
                  <td className="p-4 text-center">{typeBadge(acc.account_type)}</td>
                  <td className="p-4 text-gray-600">{acc.group_name}</td>
                  <td className="p-4 text-right font-medium">${Number(acc.current_balance).toLocaleString()}</td>
                  <td className="p-4 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${acc.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                      {acc.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => { setSelectedAccount(acc); setShowModal(true); }}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition" title="Edit">
                        <Edit size={16} />
                      </button>
                      <button onClick={() => handleDelete(acc)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition" title="Delete">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr><td colSpan={7} className="p-8 text-center text-gray-500">No accounts found</td></tr>
            )}
          </tbody>
        </table>

        {pagination.totalPages > 1 && (
          <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-600">Page {pagination.page} of {pagination.totalPages}</div>
            <div className="flex gap-2">
              <button onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))} disabled={pagination.page === 1}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 transition">Previous</button>
              <button onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))} disabled={pagination.page === pagination.totalPages}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 transition">Next</button>
            </div>
          </div>
        )}
      </div>

      <AccountModal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setSelectedAccount(null); }}
        onSuccess={fetchAccounts}
        account={selectedAccount}
        categoryType={selectedCategory}
      />
    </div>
  );
};

export default ChartOfAccounts;
