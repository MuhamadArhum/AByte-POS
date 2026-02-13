import { useState } from 'react';
import { BarChart3, Calendar, Download, Users, DollarSign, TrendingUp } from 'lucide-react';
import api from '../utils/api';
import { useToast } from '../components/Toast';

interface AttendanceReportRow {
  staff_id: number;
  full_name: string;
  department: string;
  days_present: number;
  days_absent: number;
  days_half_day: number;
  days_leave: number;
  leave_balance: number;
  attendance_percentage: number;
}

interface SalaryReportRow {
  department: string;
  staff_count: number;
  paid_count: number;
  total_base: number;
  total_deductions: number;
  total_bonuses: number;
  total_net_paid: number;
  total_expected: number;
  pending_amount: number;
}

const exportToCSV = (data: any[], filename: string, columns: { key: string; label: string }[]) => {
  const header = columns.map(c => c.label).join(',');
  const rows = data.map(row =>
    columns.map(c => {
      const val = row[c.key];
      if (val === null || val === undefined) return '';
      const str = String(val);
      return str.includes(',') || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
    }).join(',')
  );
  const csv = [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
};

const StaffReports = () => {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<'attendance' | 'salary'>('attendance');

  // Attendance report state
  const [attendanceMonth, setAttendanceMonth] = useState(new Date().toISOString().slice(0, 7));
  const [attendanceData, setAttendanceData] = useState<AttendanceReportRow[]>([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);

  // Salary report state
  const [salaryFromDate, setSalaryFromDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() - 1, 1).toISOString().split('T')[0];
  });
  const [salaryToDate, setSalaryToDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 0).toISOString().split('T')[0];
  });
  const [salaryData, setSalaryData] = useState<SalaryReportRow[]>([]);
  const [salaryLoading, setSalaryLoading] = useState(false);

  const fetchAttendanceReport = async () => {
    if (!attendanceMonth) { toast.error('Select a month'); return; }
    setAttendanceLoading(true);
    try {
      const res = await api.get('/staff/reports/attendance-monthly', { params: { month: attendanceMonth } });
      setAttendanceData(res.data.data || []);
      if ((res.data.data || []).length === 0) toast.info('No data found for selected month');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to load attendance report');
    } finally {
      setAttendanceLoading(false);
    }
  };

  const fetchSalaryReport = async () => {
    if (!salaryFromDate || !salaryToDate) { toast.error('Select date range'); return; }
    if (salaryFromDate > salaryToDate) { toast.error('From date must be before to date'); return; }
    setSalaryLoading(true);
    try {
      const res = await api.get('/staff/reports/salary-summary', { params: { from_date: salaryFromDate, to_date: salaryToDate } });
      setSalaryData(res.data.data || []);
      if ((res.data.data || []).length === 0) toast.info('No salary data for selected period');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to load salary report');
    } finally {
      setSalaryLoading(false);
    }
  };

  const attendancePctColor = (pct: number) => {
    if (pct >= 90) return 'text-green-600 bg-green-50';
    if (pct >= 70) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  // Totals for salary
  const salaryTotals = salaryData.reduce(
    (acc, r) => ({
      staff_count: acc.staff_count + r.staff_count,
      paid_count: acc.paid_count + r.paid_count,
      total_base: acc.total_base + Number(r.total_base),
      total_deductions: acc.total_deductions + Number(r.total_deductions),
      total_bonuses: acc.total_bonuses + Number(r.total_bonuses),
      total_net_paid: acc.total_net_paid + Number(r.total_net_paid),
      total_expected: acc.total_expected + Number(r.total_expected),
      pending_amount: acc.pending_amount + Number(r.pending_amount),
    }),
    { staff_count: 0, paid_count: 0, total_base: 0, total_deductions: 0, total_bonuses: 0, total_net_paid: 0, total_expected: 0, pending_amount: 0 }
  );

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <BarChart3 className="text-indigo-600" size={32} />
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Staff Reports</h1>
            <p className="text-gray-600 text-sm mt-1">Attendance & salary analytics</p>
          </div>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab('attendance')}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition ${
            activeTab === 'attendance'
              ? 'bg-indigo-600 text-white shadow-lg'
              : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          <Users size={18} />
          Attendance Report
        </button>
        <button
          onClick={() => setActiveTab('salary')}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition ${
            activeTab === 'salary'
              ? 'bg-indigo-600 text-white shadow-lg'
              : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          <DollarSign size={18} />
          Salary Report
        </button>
      </div>

      {/* Attendance Tab */}
      {activeTab === 'attendance' && (
        <div className="space-y-6">
          {/* Filters */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Month</label>
              <input
                type="month"
                value={attendanceMonth}
                onChange={e => setAttendanceMonth(e.target.value)}
                className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <button
              onClick={fetchAttendanceReport}
              disabled={attendanceLoading}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
            >
              {attendanceLoading ? 'Loading...' : 'Generate'}
            </button>
            {attendanceData.length > 0 && (
              <button
                onClick={() => exportToCSV(attendanceData, `attendance-report-${attendanceMonth}`, [
                  { key: 'full_name', label: 'Name' },
                  { key: 'department', label: 'Department' },
                  { key: 'days_present', label: 'Present' },
                  { key: 'days_absent', label: 'Absent' },
                  { key: 'days_half_day', label: 'Half Day' },
                  { key: 'days_leave', label: 'Leave' },
                  { key: 'leave_balance', label: 'Leave Balance' },
                  { key: 'attendance_percentage', label: 'Attendance %' },
                ])}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
              >
                <Download size={16} />
                Export CSV
              </button>
            )}
          </div>

          {/* Summary Cards */}
          {attendanceData.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <p className="text-sm text-gray-500">Total Staff</p>
                <p className="text-2xl font-bold text-gray-800">{attendanceData.length}</p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <p className="text-sm text-gray-500">Avg Attendance</p>
                <p className="text-2xl font-bold text-indigo-600">
                  {(attendanceData.reduce((s, r) => s + Number(r.attendance_percentage), 0) / attendanceData.length).toFixed(1)}%
                </p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <p className="text-sm text-gray-500">Total Leave Days</p>
                <p className="text-2xl font-bold text-amber-600">
                  {attendanceData.reduce((s, r) => s + Number(r.days_leave), 0)}
                </p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <p className="text-sm text-gray-500">Perfect Attendance</p>
                <p className="text-2xl font-bold text-green-600">
                  {attendanceData.filter(r => Number(r.attendance_percentage) === 100).length}
                </p>
              </div>
            </div>
          )}

          {/* Table */}
          {attendanceData.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr className="border-b">
                    <th className="text-left p-4 font-semibold text-gray-700">Name</th>
                    <th className="text-left p-4 font-semibold text-gray-700">Department</th>
                    <th className="text-center p-4 font-semibold text-gray-700">Present</th>
                    <th className="text-center p-4 font-semibold text-gray-700">Absent</th>
                    <th className="text-center p-4 font-semibold text-gray-700">Half Day</th>
                    <th className="text-center p-4 font-semibold text-gray-700">Leave</th>
                    <th className="text-center p-4 font-semibold text-gray-700">Leave Bal.</th>
                    <th className="text-center p-4 font-semibold text-gray-700">Attendance %</th>
                  </tr>
                </thead>
                <tbody>
                  {attendanceData.map(row => (
                    <tr key={row.staff_id} className="border-b hover:bg-gray-50 transition">
                      <td className="p-4 font-medium text-gray-800">{row.full_name}</td>
                      <td className="p-4 text-gray-600">{row.department || '-'}</td>
                      <td className="p-4 text-center text-green-600 font-medium">{row.days_present}</td>
                      <td className="p-4 text-center text-red-600 font-medium">{row.days_absent}</td>
                      <td className="p-4 text-center text-amber-600 font-medium">{row.days_half_day}</td>
                      <td className="p-4 text-center text-blue-600 font-medium">{row.days_leave}</td>
                      <td className="p-4 text-center">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          Number(row.leave_balance) > 5 ? 'bg-green-100 text-green-700' :
                          Number(row.leave_balance) > 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {row.leave_balance}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <span className={`px-3 py-1 rounded-full text-sm font-semibold ${attendancePctColor(Number(row.attendance_percentage))}`}>
                          {Number(row.attendance_percentage).toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {attendanceData.length === 0 && !attendanceLoading && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center text-gray-500">
              <Calendar size={48} className="mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium">Select a month and click Generate</p>
              <p className="text-sm mt-1">Attendance report will appear here</p>
            </div>
          )}
        </div>
      )}

      {/* Salary Tab */}
      {activeTab === 'salary' && (
        <div className="space-y-6">
          {/* Filters */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
              <input
                type="date"
                value={salaryFromDate}
                onChange={e => setSalaryFromDate(e.target.value)}
                className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
              <input
                type="date"
                value={salaryToDate}
                onChange={e => setSalaryToDate(e.target.value)}
                className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <button
              onClick={fetchSalaryReport}
              disabled={salaryLoading}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
            >
              {salaryLoading ? 'Loading...' : 'Generate'}
            </button>
            {salaryData.length > 0 && (
              <button
                onClick={() => exportToCSV(salaryData, `salary-report-${salaryFromDate}-to-${salaryToDate}`, [
                  { key: 'department', label: 'Department' },
                  { key: 'staff_count', label: 'Staff Count' },
                  { key: 'paid_count', label: 'Paid Count' },
                  { key: 'total_base', label: 'Total Base' },
                  { key: 'total_deductions', label: 'Deductions' },
                  { key: 'total_bonuses', label: 'Bonuses' },
                  { key: 'total_net_paid', label: 'Net Paid' },
                  { key: 'total_expected', label: 'Expected' },
                  { key: 'pending_amount', label: 'Pending' },
                ])}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
              >
                <Download size={16} />
                Export CSV
              </button>
            )}
          </div>

          {/* Summary Cards */}
          {salaryData.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <p className="text-sm text-gray-500">Total Staff</p>
                <p className="text-2xl font-bold text-gray-800">{salaryTotals.staff_count}</p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <p className="text-sm text-gray-500">Total Net Paid</p>
                <p className="text-2xl font-bold text-green-600">${salaryTotals.total_net_paid.toFixed(2)}</p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <p className="text-sm text-gray-500">Total Deductions</p>
                <p className="text-2xl font-bold text-red-600">${salaryTotals.total_deductions.toFixed(2)}</p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <p className="text-sm text-gray-500">Pending Amount</p>
                <p className="text-2xl font-bold text-amber-600">${salaryTotals.pending_amount.toFixed(2)}</p>
              </div>
            </div>
          )}

          {/* Table */}
          {salaryData.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr className="border-b">
                    <th className="text-left p-4 font-semibold text-gray-700">Department</th>
                    <th className="text-center p-4 font-semibold text-gray-700">Staff</th>
                    <th className="text-center p-4 font-semibold text-gray-700">Paid</th>
                    <th className="text-right p-4 font-semibold text-gray-700">Base</th>
                    <th className="text-right p-4 font-semibold text-gray-700">Deductions</th>
                    <th className="text-right p-4 font-semibold text-gray-700">Bonuses</th>
                    <th className="text-right p-4 font-semibold text-gray-700">Net Paid</th>
                    <th className="text-right p-4 font-semibold text-gray-700">Expected</th>
                    <th className="text-right p-4 font-semibold text-gray-700">Pending</th>
                  </tr>
                </thead>
                <tbody>
                  {salaryData.map((row, i) => (
                    <tr key={i} className="border-b hover:bg-gray-50 transition">
                      <td className="p-4 font-medium text-gray-800">{row.department || 'Unassigned'}</td>
                      <td className="p-4 text-center">{row.staff_count}</td>
                      <td className="p-4 text-center">{row.paid_count}</td>
                      <td className="p-4 text-right">${Number(row.total_base).toFixed(2)}</td>
                      <td className="p-4 text-right text-red-600">${Number(row.total_deductions).toFixed(2)}</td>
                      <td className="p-4 text-right text-green-600">${Number(row.total_bonuses).toFixed(2)}</td>
                      <td className="p-4 text-right font-medium text-indigo-600">${Number(row.total_net_paid).toFixed(2)}</td>
                      <td className="p-4 text-right">${Number(row.total_expected).toFixed(2)}</td>
                      <td className="p-4 text-right">
                        <span className={`font-medium ${Number(row.pending_amount) > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                          ${Number(row.pending_amount).toFixed(2)}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {/* Totals row */}
                  <tr className="bg-gray-50 font-semibold">
                    <td className="p-4 text-gray-800">Total</td>
                    <td className="p-4 text-center">{salaryTotals.staff_count}</td>
                    <td className="p-4 text-center">{salaryTotals.paid_count}</td>
                    <td className="p-4 text-right">${salaryTotals.total_base.toFixed(2)}</td>
                    <td className="p-4 text-right text-red-600">${salaryTotals.total_deductions.toFixed(2)}</td>
                    <td className="p-4 text-right text-green-600">${salaryTotals.total_bonuses.toFixed(2)}</td>
                    <td className="p-4 text-right text-indigo-600">${salaryTotals.total_net_paid.toFixed(2)}</td>
                    <td className="p-4 text-right">${salaryTotals.total_expected.toFixed(2)}</td>
                    <td className="p-4 text-right text-amber-600">${salaryTotals.pending_amount.toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {salaryData.length === 0 && !salaryLoading && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center text-gray-500">
              <TrendingUp size={48} className="mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium">Select a date range and click Generate</p>
              <p className="text-sm mt-1">Salary summary will appear here</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default StaffReports;
