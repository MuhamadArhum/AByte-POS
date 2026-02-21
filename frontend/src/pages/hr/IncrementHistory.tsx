import { useState, useEffect } from 'react';
import { TrendingUp, Filter, Download } from 'lucide-react';
import api from '../utils/api';
import { useToast } from '../components/Toast';
import SalaryIncrementModal from '../components/SalaryIncrementModal';

const IncrementHistory = () => {
  const toast = useToast();
  const [increments, setIncrements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [staffFilter, setStaffFilter] = useState('');
  const [staffList, setStaffList] = useState<any[]>([]);
  const [showIncrementModal, setShowIncrementModal] = useState(false);

  useEffect(() => {
    api.get('/staff', { params: { limit: 200 } }).then(r => setStaffList(r.data.data || [])).catch(() => {});
  }, []);

  useEffect(() => { fetchIncrements(); }, [pagination.page, staffFilter]);

  const fetchIncrements = async () => {
    setLoading(true);
    try {
      const params: any = { page: pagination.page, limit: pagination.limit };
      if (staffFilter) params.staff_id = staffFilter;
      const res = await api.get('/staff/increments', { params });
      setIncrements(res.data.data || []);
      if (res.data.pagination) setPagination(res.data.pagination);
    } catch (err) {
      toast.error('Failed to load increments');
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = () => {
    if (increments.length === 0) return;
    const headers = ['Date', 'Employee', 'Department', 'Old Salary', 'New Salary', 'Change', 'Change %', 'Reason', 'Approved By'];
    const rows = increments.map(i => [
      new Date(i.effective_date).toLocaleDateString(),
      `"${i.full_name}"`,
      i.department || '',
      Number(i.old_salary).toFixed(2),
      Number(i.new_salary).toFixed(2),
      Number(i.increment_amount).toFixed(2),
      `${Number(i.increment_percentage).toFixed(1)}%`,
      `"${(i.reason || '').replace(/"/g, '""')}"`,
      i.approved_by_name || ''
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `increment_history_${new Date().toISOString().split('T')[0]}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <TrendingUp className="text-emerald-600" size={32} />
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Salary Increments</h1>
            <p className="text-gray-600 text-sm mt-1">Track all salary changes and increments</p>
          </div>
        </div>
        <div className="flex gap-3">
          {increments.length > 0 && (
            <button onClick={exportCSV} className="flex items-center gap-2 bg-gray-100 text-gray-700 px-4 py-3 rounded-xl hover:bg-gray-200 transition border border-gray-200">
              <Download size={18} /> Export CSV
            </button>
          )}
          <button onClick={() => setShowIncrementModal(true)} className="flex items-center gap-2 bg-emerald-600 text-white px-6 py-3 rounded-xl hover:bg-emerald-700 transition shadow-lg">
            <TrendingUp size={20} /> New Increment
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <p className="text-gray-600 text-sm">Total Increments</p>
          <p className="text-3xl font-bold text-gray-800 mt-2">{pagination.total}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <p className="text-gray-600 text-sm">Avg Increase</p>
          <p className="text-3xl font-bold text-emerald-600 mt-2">
            {increments.length > 0
              ? `${(increments.reduce((s, i) => s + Number(i.increment_percentage || 0), 0) / increments.length).toFixed(1)}%`
              : '0%'}
          </p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <p className="text-gray-600 text-sm">Total Salary Added</p>
          <p className="text-3xl font-bold text-blue-600 mt-2">
            ${increments.reduce((s, i) => s + Math.max(0, Number(i.increment_amount || 0)), 0).toLocaleString()}
          </p>
        </div>
      </div>

      {/* Filter */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <Filter size={20} className="text-gray-600" />
          <select value={staffFilter} onChange={(e) => { setStaffFilter(e.target.value); setPagination(p => ({ ...p, page: 1 })); }}
            className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 min-w-[220px]">
            <option value="">All Staff</option>
            {staffList.map(s => <option key={s.staff_id} value={s.staff_id}>{s.employee_id ? `[${s.employee_id}] ` : ''}{s.full_name}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr className="border-b">
              <th className="text-left p-4 font-semibold text-gray-700">Date</th>
              <th className="text-left p-4 font-semibold text-gray-700">Employee</th>
              <th className="text-left p-4 font-semibold text-gray-700">Department</th>
              <th className="text-right p-4 font-semibold text-gray-700">Old Salary</th>
              <th className="text-right p-4 font-semibold text-gray-700">New Salary</th>
              <th className="text-right p-4 font-semibold text-gray-700">Change</th>
              <th className="text-left p-4 font-semibold text-gray-700">Reason</th>
              <th className="text-left p-4 font-semibold text-gray-700">Approved By</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="p-8 text-center text-gray-500">Loading...</td></tr>
            ) : increments.length > 0 ? (
              increments.map((inc: any) => {
                const isIncrease = Number(inc.increment_amount) >= 0;
                return (
                  <tr key={inc.increment_id} className="border-b hover:bg-gray-50 transition">
                    <td className="p-4 text-gray-600">{new Date(inc.effective_date).toLocaleDateString()}</td>
                    <td className="p-4">
                      <div className="font-semibold text-gray-800">{inc.full_name}</div>
                      {inc.employee_id && <div className="text-xs text-gray-500">{inc.employee_id}</div>}
                    </td>
                    <td className="p-4 text-gray-600">{inc.department || '-'}</td>
                    <td className="p-4 text-right text-gray-600">${Number(inc.old_salary).toLocaleString()}</td>
                    <td className="p-4 text-right font-bold text-gray-800">${Number(inc.new_salary).toLocaleString()}</td>
                    <td className="p-4 text-right">
                      <span className={`font-semibold ${isIncrease ? 'text-green-600' : 'text-red-600'}`}>
                        {isIncrease ? '+' : ''}{Number(inc.increment_amount).toLocaleString()}
                      </span>
                      <span className={`block text-xs ${isIncrease ? 'text-green-500' : 'text-red-500'}`}>
                        ({Number(inc.increment_percentage).toFixed(1)}%)
                      </span>
                    </td>
                    <td className="p-4 text-sm text-gray-600 max-w-[200px] truncate">{inc.reason || '-'}</td>
                    <td className="p-4 text-sm text-gray-600">{inc.approved_by_name || '-'}</td>
                  </tr>
                );
              })
            ) : (
              <tr><td colSpan={8} className="p-8 text-center text-gray-500">No increment records found</td></tr>
            )}
          </tbody>
        </table>

        {pagination.totalPages > 1 && (
          <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-600">Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)</div>
            <div className="flex gap-2">
              <button onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))} disabled={pagination.page === 1}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 transition">Previous</button>
              <button onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))} disabled={pagination.page === pagination.totalPages}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 transition">Next</button>
            </div>
          </div>
        )}
      </div>

      <SalaryIncrementModal isOpen={showIncrementModal} onClose={() => setShowIncrementModal(false)} onSuccess={fetchIncrements} />
    </div>
  );
};

export default IncrementHistory;
