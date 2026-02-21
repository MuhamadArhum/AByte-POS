import { useState, useEffect } from 'react';
import { Receipt, Plus, Trash2, X, Download } from 'lucide-react';
import api from '../../utils/api';
import { useToast } from '../../components/Toast';

const ReceiptVoucherModal = ({ isOpen, onClose, onSuccess }: any) => {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    voucher_date: new Date().toISOString().split('T')[0],
    received_from: '',
    receipt_type: 'customer',
    account_id: '',
    amount: '',
    payment_method: 'cash',
    cheque_number: '',
    bank_account_id: '',
    description: ''
  });

  useEffect(() => {
    if (isOpen) {
      api.get('/accounting/accounts', { params: { type: 'revenue', limit: 200 } })
        .then(r => setAccounts(r.data.data || []))
        .catch(() => {});
      api.get('/accounting/bank-accounts')
        .then(r => setBankAccounts(r.data.data || []))
        .catch(() => {});
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.voucher_date || !formData.received_from || !formData.account_id || !formData.amount) {
      toast.error('Please fill all required fields');
      return;
    }

    setLoading(true);
    try {
      await api.post('/accounting/receipt-vouchers', formData);
      toast.success('Receipt voucher created');
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Operation failed');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Create Receipt Voucher</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Voucher Date *</label>
              <input type="date" value={formData.voucher_date}
                onChange={(e) => setFormData({ ...formData, voucher_date: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Received From *</label>
              <input type="text" value={formData.received_from}
                onChange={(e) => setFormData({ ...formData, received_from: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500"
                placeholder="e.g., Customer Name" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Receipt Type *</label>
              <select value={formData.receipt_type} onChange={(e) => setFormData({ ...formData, receipt_type: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500">
                <option value="customer">Customer Payment</option>
                <option value="sales">Sales</option>
                <option value="other">Other Income</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Revenue Account *</label>
              <select value={formData.account_id} onChange={(e) => setFormData({ ...formData, account_id: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500" required>
                <option value="">Select Account</option>
                {accounts.map(a => (
                  <option key={a.account_id} value={a.account_id}>{a.account_code} - {a.account_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Amount *</label>
              <input type="number" step="0.01" value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500"
                placeholder="0.00" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method *</label>
              <select value={formData.payment_method} onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500">
                <option value="cash">Cash</option>
                <option value="bank">Bank Transfer</option>
                <option value="cheque">Cheque</option>
                <option value="online">Online Payment</option>
              </select>
            </div>
            {(formData.payment_method === 'bank' || formData.payment_method === 'online') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Bank Account</label>
                <select value={formData.bank_account_id} onChange={(e) => setFormData({ ...formData, bank_account_id: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500">
                  <option value="">Select Bank Account</option>
                  {bankAccounts.map(b => (
                    <option key={b.bank_account_id} value={b.bank_account_id}>{b.bank_name} - {b.account_number}</option>
                  ))}
                </select>
              </div>
            )}
            {formData.payment_method === 'cheque' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Cheque Number</label>
                <input type="text" value={formData.cheque_number}
                  onChange={(e) => setFormData({ ...formData, cheque_number: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500"
                  placeholder="e.g., CHQ-123456" />
              </div>
            )}
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
              <textarea value={formData.description} rows={3}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500"
                placeholder="Enter receipt details..." />
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button type="button" onClick={onClose} disabled={loading}
              className="flex-1 px-6 py-3 border border-gray-300 rounded-xl hover:bg-gray-50 font-medium transition">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 bg-green-600 text-white px-6 py-3 rounded-xl hover:bg-green-700 font-medium transition disabled:bg-gray-400">
              {loading ? 'Creating...' : 'Create Receipt Voucher'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const ReceiptVouchers = () => {
  const toast = useToast();
  const [vouchers, setVouchers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [showModal, setShowModal] = useState(false);
  const [filters, setFilters] = useState({
    from_date: '',
    to_date: '',
    receipt_type: ''
  });

  const fetchVouchers = async () => {
    setLoading(true);
    try {
      const res = await api.get('/accounting/receipt-vouchers', {
        params: { ...filters, page: pagination.page, limit: pagination.limit }
      });
      setVouchers(res.data.data || []);
      setPagination(res.data.pagination);
    } catch (err) {
      toast.error('Failed to fetch receipt vouchers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchVouchers(); }, [pagination.page, filters]);

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this receipt voucher?')) return;
    try {
      await api.delete(`/accounting/receipt-vouchers/${id}`);
      toast.success('Receipt voucher deleted');
      fetchVouchers();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Delete failed');
    }
  };

  const exportToCSV = () => {
    const headers = ['Voucher #', 'Date', 'Received From', 'Type', 'Amount', 'Method', 'Account', 'Created By'];
    const rows = vouchers.map(v => [
      v.voucher_number,
      new Date(v.voucher_date).toLocaleDateString(),
      v.received_from,
      v.receipt_type,
      v.amount,
      v.payment_method,
      v.account_name,
      v.created_by_name
    ]);
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `receipt-vouchers-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    toast.success('Exported to CSV');
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Receipt className="text-green-600" size={32} />
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Receipt Vouchers</h1>
            <p className="text-gray-600 text-sm mt-1">Track all incoming payments</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={exportToCSV} disabled={vouchers.length === 0}
            className="flex items-center gap-2 bg-gray-100 text-gray-700 px-6 py-3 rounded-xl hover:bg-gray-200 transition disabled:opacity-50">
            <Download size={20} /> Export CSV
          </button>
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-green-600 text-white px-6 py-3 rounded-xl hover:bg-green-700 transition shadow-lg">
            <Plus size={20} /> New Receipt
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">From Date</label>
            <input type="date" value={filters.from_date}
              onChange={(e) => setFilters({ ...filters, from_date: e.target.value })}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">To Date</label>
            <input type="date" value={filters.to_date}
              onChange={(e) => setFilters({ ...filters, to_date: e.target.value })}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Receipt Type</label>
            <select value={filters.receipt_type} onChange={(e) => setFilters({ ...filters, receipt_type: e.target.value })}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500">
              <option value="">All Types</option>
              <option value="customer">Customer</option>
              <option value="sales">Sales</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : vouchers.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
          <Receipt className="mx-auto text-gray-300 mb-4" size={64} />
          <h3 className="text-xl font-semibold text-gray-700 mb-2">No Receipt Vouchers</h3>
          <p className="text-gray-500 mb-6">Start by creating your first receipt voucher</p>
          <button onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 bg-green-600 text-white px-6 py-3 rounded-xl hover:bg-green-700 transition">
            <Plus size={20} /> New Receipt
          </button>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Voucher #</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Date</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Received From</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Type</th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700">Amount</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Method</th>
                    <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {vouchers.map((voucher) => (
                    <tr key={voucher.voucher_id} className="hover:bg-gray-50 transition">
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-800">{voucher.voucher_number}</div>
                        <div className="text-xs text-gray-500">{voucher.account_name}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {new Date(voucher.voucher_date).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-800">{voucher.received_from}</td>
                      <td className="px-6 py-4">
                        <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 capitalize">
                          {voucher.receipt_type}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="font-semibold text-green-600">Rs. {Number(voucher.amount).toFixed(2)}</span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 capitalize">{voucher.payment_method}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center">
                          <button onClick={() => handleDelete(voucher.voucher_id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition">
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <p className="text-sm text-gray-600">
                Showing {vouchers.length} of {pagination.total} vouchers
              </p>
              <div className="flex gap-2">
                <button onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
                  disabled={pagination.page === 1}
                  className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">
                  Previous
                </button>
                <button onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
                  disabled={pagination.page === pagination.totalPages}
                  className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}

      <ReceiptVoucherModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={fetchVouchers}
      />
    </div>
  );
};

export default ReceiptVouchers;
