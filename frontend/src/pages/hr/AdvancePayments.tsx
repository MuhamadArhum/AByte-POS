import { useState, useEffect } from 'react';
import { DollarSign, Plus, Download } from 'lucide-react';
import api from '../../utils/api';
import { useToast } from '../../components/Toast';

interface AdvancePaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const AdvancePaymentModal = ({ isOpen, onClose, onSuccess }: AdvancePaymentModalProps) => {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    staff_id: '',
    amount: '',
    payment_date: new Date().toISOString().split('T')[0],
    payment_method: 'cash',
    reason: ''
  });

  useEffect(() => {
    if (isOpen) {
      api.get('/staff', { params: { is_active: 1, limit: 200 } })
        .then(r => setStaffList(r.data.data || []))
        .catch(() => {});
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.staff_id || !formData.amount || !formData.payment_date) {
      toast.error('Please fill all required fields');
      return;
    }

    setLoading(true);
    try {
      await api.post('/staff/advance-payments', formData);
      toast.success('Advance payment recorded');
      onSuccess();
      onClose();
      setFormData({ staff_id: '', amount: '', payment_date: new Date().toISOString().split('T')[0], payment_method: 'cash', reason: '' });
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to record payment');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Record Advance Payment</h2>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Staff Member *</label>
              <select value={formData.staff_id} onChange={(e) => setFormData({ ...formData, staff_id: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500" required>
                <option value="">Select Staff</option>
                {staffList.map(s => (
                  <option key={s.staff_id} value={s.staff_id}>
                    {s.employee_id ? `[${s.employee_id}] ` : ''}{s.full_name} {s.department ? `- ${s.department}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Amount *</label>
              <input type="number" step="0.01" min="0.01" value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Payment Date *</label>
              <input type="date" value={formData.payment_date}
                onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
              <select value={formData.payment_method} onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500">
                <option value="cash">Cash</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="cheque">Cheque</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Reason</label>
              <textarea value={formData.reason} onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500" rows={3} />
            </div>
          </div>
          <div className="flex gap-3 mt-6">
            <button type="button" onClick={onClose} className="flex-1 px-6 py-3 border border-gray-300 rounded-xl hover:bg-gray-50 transition">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition disabled:opacity-50">
              {loading ? 'Recording...' : 'Record Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const AdvancePayments = () => {
  const toast = useToast();
  const [advances, setAdvances] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [showModal, setShowModal] = useState(false);
  const [staffFilter, setStaffFilter] = useState('');
  const [staffList, setStaffList] = useState<any[]>([]);

  useEffect(() => {
    api.get('/staff', { params: { limit: 200 } }).then(r => setStaffList(r.data.data || [])).catch(() => {});
  }, []);

  useEffect(() => { fetchAdvances(); }, [pagination.page, staffFilter]);

  const fetchAdvances = async () => {
    setLoading(true);
    try {
      const params: any = { page: pagination.page, limit: pagination.limit };
      if (staffFilter) params.staff_id = staffFilter;
      const res = await api.get('/staff/advance-payments', { params });
      setAdvances(res.data.data || []);
      if (res.data.pagination) setPagination(res.data.pagination);
    } catch (err) {
      toast.error('Failed to load advance payments');
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = () => {
    if (advances.length === 0) return;
    const headers = ['Date', 'Employee', 'Department', 'Amount', 'Method', 'Reason'];
    const rows = advances.map(a => [
      new Date(a.payment_date).toLocaleDateString(),
      `"${a.full_name}"`,
      a.department || '',
      Number(a.amount).toFixed(2),
      (a.payment_method || '').replace('_', ' '),
      `"${(a.reason || '').replace(/"/g, '""')}"`
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `advance_payments_${new Date().toISOString().split('T')[0]}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const totalAdvances = advances.reduce((sum, a) => sum + Number(a.amount || 0), 0);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <DollarSign className="text-purple-600" size={32} />
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Advance Payments</h1>
            <p className="text-gray-600 text-sm mt-1">Manage advance salary payments to staff</p>
          </div>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-purple-600 text-white px-6 py-3 rounded-xl hover:bg-purple-700 transition shadow-lg">
          <Plus size={20} /> Record Advance
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <p className="text-gray-600 text-sm">Total Advances</p>
          <p className="text-3xl font-bold text-gray-800 mt-2">{pagination.total}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <p className="text-gray-600 text-sm">Total Amount (Filtered)</p>
          <p className="text-3xl font-bold text-purple-600 mt-2">${totalAdvances.toLocaleString()}</p>
        </div>
      </div>

      {/* Filter */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <select value={staffFilter} onChange={(e) => { setStaffFilter(e.target.value); setPagination(p => ({ ...p, page: 1 })); }}
            className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 min-w-[200px]">
            <option value="">All Staff</option>
            {staffList.map(s => <option key={s.staff_id} value={s.staff_id}>{s.employee_id ? `[${s.employee_id}] ` : ''}{s.full_name}</option>)}
          </select>
          {advances.length > 0 && (
            <button onClick={exportCSV} className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition ml-auto">
              <Download size={18} /> Export CSV
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr className="border-b">
              <th className="text-left p-4 font-semibold text-gray-700">Date</th>
              <th className="text-left p-4 font-semibold text-gray-700">Employee</th>
              <th className="text-right p-4 font-semibold text-gray-700">Amount</th>
              <th className="text-center p-4 font-semibold text-gray-700">Method</th>
              <th className="text-left p-4 font-semibold text-gray-700">Reason</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="p-8 text-center text-gray-500">Loading...</td></tr>
            ) : advances.length > 0 ? (
              advances.map((adv: any) => (
                <tr key={adv.advance_id} className="border-b hover:bg-gray-50 transition">
                  <td className="p-4 text-gray-600">{new Date(adv.payment_date).toLocaleDateString()}</td>
                  <td className="p-4">
                    <div className="font-semibold text-gray-800">{adv.full_name}</div>
                    <div className="text-xs text-gray-500">{adv.employee_id || ''} {adv.department ? `- ${adv.department}` : ''}</div>
                  </td>
                  <td className="p-4 text-right font-bold text-purple-600">${Number(adv.amount).toLocaleString()}</td>
                  <td className="p-4 text-center">
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium capitalize">
                      {(adv.payment_method || '').replace('_', ' ')}
                    </span>
                  </td>
                  <td className="p-4 text-gray-600">{adv.reason || '-'}</td>
                </tr>
              ))
            ) : (
              <tr><td colSpan={5} className="p-8 text-center text-gray-500">No advance payments found</td></tr>
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

      <AdvancePaymentModal isOpen={showModal} onClose={() => setShowModal(false)} onSuccess={fetchAdvances} />
    </div>
  );
};

export default AdvancePayments;
