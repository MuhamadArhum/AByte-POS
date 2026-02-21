import { useState, useEffect } from 'react';
import { BookOpen, Search, Download, Calendar, DollarSign, CreditCard, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import api from '../utils/api';
import { useToast } from '../components/Toast';

const EmployeeLedger = () => {
  const toast = useToast();
  const [staff, setStaff] = useState<any[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetchStaff();
  }, []);

  const fetchStaff = async () => {
    try {
      const res = await api.get('/staff', { params: { limit: 200 } });
      setStaff(res.data.data || []);
    } catch (err) { console.error(err); }
  };

  const fetchLedger = async () => {
    if (!selectedStaffId) { toast.error('Select a staff member'); return; }
    setLoading(true);
    try {
      const params: any = {};
      if (fromDate) params.from_date = fromDate;
      if (toDate) params.to_date = toDate;
      const res = await api.get(`/staff/reports/employee-ledger/${selectedStaffId}`, { params });
      setData(res.data);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to load ledger');
    } finally {
      setLoading(false);
    }
  };

  // Build combined ledger entries sorted by date
  const buildLedgerEntries = () => {
    if (!data) return [];
    const entries: any[] = [];

    (data.salary_payments || []).forEach((p: any) => {
      entries.push({
        date: p.date || p.payment_date,
        type: 'Salary',
        description: `Salary Payment${p.payment_method ? ` (${p.payment_method})` : ''}${p.notes ? ` - ${p.notes}` : ''}`,
        credit: Number(p.net_amount || 0),
        debit: 0,
        deductions: Number(p.deductions || 0),
        bonuses: Number(p.bonuses || 0)
      });
    });

    (data.loans || []).forEach((l: any) => {
      entries.push({
        date: l.loan_date,
        type: 'Loan',
        description: `Loan Issued${l.reason ? ` - ${l.reason}` : ''} (Status: ${l.status})`,
        credit: 0,
        debit: Number(l.loan_amount || 0)
      });
    });

    (data.repayments || []).forEach((r: any) => {
      entries.push({
        date: r.repayment_date,
        type: 'Repayment',
        description: `Loan Repayment${r.payment_method ? ` (${r.payment_method})` : ''}${r.notes ? ` - ${r.notes}` : ''}`,
        credit: 0,
        debit: Number(r.amount || 0)
      });
    });

    entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return entries;
  };

  const entries = buildLedgerEntries();

  const exportCSV = () => {
    if (!data || entries.length === 0) return;
    const staffInfo = data.staff;
    const headers = ['Date', 'Type', 'Description', 'Debit', 'Credit'];
    const rows = entries.map(e => [
      e.date,
      e.type,
      `"${e.description.replace(/"/g, '""')}"`,
      e.debit > 0 ? e.debit.toFixed(2) : '',
      e.credit > 0 ? e.credit.toFixed(2) : ''
    ]);
    const csv = [
      `Employee Ledger - ${staffInfo.full_name} (${staffInfo.employee_id || 'N/A'})`,
      fromDate && toDate ? `Period: ${fromDate} to ${toDate}` : 'Period: All Time',
      '',
      headers.join(','),
      ...rows.map(r => r.join(','))
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ledger_${staffInfo.full_name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <BookOpen className="text-indigo-600" size={32} />
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Employee Ledger</h1>
            <p className="text-gray-600 text-sm mt-1">Complete financial history per employee</p>
          </div>
        </div>
        {data && entries.length > 0 && (
          <button onClick={exportCSV} className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl hover:bg-indigo-700 transition shadow">
            <Download size={18} /> Export CSV
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[220px]">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Search size={16} className="inline mr-1" /> Staff Member
            </label>
            <select
              value={selectedStaffId}
              onChange={(e) => setSelectedStaffId(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="">-- Select Employee --</option>
              {staff.map(s => (
                <option key={s.staff_id} value={s.staff_id}>
                  {s.employee_id ? `[${s.employee_id}] ` : ''}{s.full_name} - {s.department || s.position}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-[160px]">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Calendar size={16} className="inline mr-1" /> From Date
            </label>
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div className="min-w-[160px]">
            <label className="block text-sm font-medium text-gray-700 mb-2">To Date</label>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500" />
          </div>
          <button onClick={fetchLedger} disabled={loading}
            className="bg-indigo-600 text-white px-8 py-2.5 rounded-lg hover:bg-indigo-700 transition disabled:opacity-50">
            {loading ? 'Loading...' : 'Generate'}
          </button>
        </div>
      </div>

      {/* Content */}
      {data && (
        <>
          {/* Staff Info */}
          <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 rounded-xl p-6 text-white mb-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center text-2xl font-bold">
                {data.staff.full_name?.charAt(0) || '?'}
              </div>
              <div>
                <h2 className="text-2xl font-bold">{data.staff.full_name}</h2>
                <p className="text-indigo-200">
                  {data.staff.employee_id ? `ID: ${data.staff.employee_id} | ` : ''}{data.staff.position} - {data.staff.department || 'N/A'}
                </p>
                <p className="text-indigo-200">Base Salary: ${Number(data.staff.salary || 0).toLocaleString()}</p>
              </div>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <ArrowUpCircle className="text-green-600" size={20} />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Earned</p>
                  <p className="text-xl font-bold text-green-600">${data.totals.totalEarned.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
              </div>
            </div>
            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                  <ArrowDownCircle className="text-red-600" size={20} />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Loans</p>
                  <p className="text-xl font-bold text-red-600">${data.totals.totalLoans.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
              </div>
            </div>
            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <CreditCard className="text-blue-600" size={20} />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Repaid</p>
                  <p className="text-xl font-bold text-blue-600">${data.totals.totalRepaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
              </div>
            </div>
            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                  <DollarSign className="text-orange-600" size={20} />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Outstanding Balance</p>
                  <p className="text-xl font-bold text-orange-600">${data.totals.outstandingLoanBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Attendance Summary */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
            <h3 className="text-lg font-bold text-gray-800 mb-3">Attendance Summary</h3>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              {[
                { label: 'Present', value: data.attendance_summary.present, bg: 'bg-green-50 border-green-200', text: 'text-green-600' },
                { label: 'Absent', value: data.attendance_summary.absent, bg: 'bg-red-50 border-red-200', text: 'text-red-600' },
                { label: 'Half Day', value: data.attendance_summary.half_day, bg: 'bg-yellow-50 border-yellow-200', text: 'text-yellow-600' },
                { label: 'Leave', value: data.attendance_summary.leave, bg: 'bg-blue-50 border-blue-200', text: 'text-blue-600' },
                { label: 'Holiday', value: data.attendance_summary.holiday, bg: 'bg-purple-50 border-purple-200', text: 'text-purple-600' },
                { label: 'Total Days', value: data.attendance_summary.total, bg: 'bg-gray-50 border-gray-200', text: 'text-gray-600' },
              ].map(item => (
                <div key={item.label} className={`${item.bg} border rounded-lg p-3 text-center`}>
                  <p className={`text-2xl font-bold ${item.text}`}>{item.value}</p>
                  <p className="text-xs text-gray-600 mt-1">{item.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Ledger Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 border-b bg-gray-50">
              <h3 className="text-lg font-bold text-gray-800">Transaction History</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr className="border-b">
                    <th className="text-left p-4 font-semibold text-gray-700">Date</th>
                    <th className="text-left p-4 font-semibold text-gray-700">Type</th>
                    <th className="text-left p-4 font-semibold text-gray-700">Description</th>
                    <th className="text-right p-4 font-semibold text-gray-700">Debit</th>
                    <th className="text-right p-4 font-semibold text-gray-700">Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.length > 0 ? entries.map((entry, idx) => (
                    <tr key={idx} className="border-b hover:bg-gray-50 transition">
                      <td className="p-4 text-gray-600">{new Date(entry.date).toLocaleDateString()}</td>
                      <td className="p-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          entry.type === 'Salary' ? 'bg-green-100 text-green-700' :
                          entry.type === 'Loan' ? 'bg-red-100 text-red-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {entry.type}
                        </span>
                      </td>
                      <td className="p-4 text-gray-700 text-sm">{entry.description}</td>
                      <td className="p-4 text-right font-medium text-red-600">
                        {entry.debit > 0 ? `$${entry.debit.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '-'}
                      </td>
                      <td className="p-4 text-right font-medium text-green-600">
                        {entry.credit > 0 ? `$${entry.credit.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '-'}
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-gray-500">No transactions found for selected period.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Empty state */}
      {!data && !loading && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-16 text-center">
          <BookOpen className="mx-auto text-gray-300 mb-4" size={64} />
          <h3 className="text-xl font-semibold text-gray-600 mb-2">Select an Employee</h3>
          <p className="text-gray-400">Choose a staff member and click Generate to view their ledger</p>
        </div>
      )}
    </div>
  );
};

export default EmployeeLedger;
