import { useState, useEffect, useMemo } from 'react';
import { useSettings } from '../../context/SettingsContext';
import { FileText, DollarSign, Download, Filter } from 'lucide-react';
import api from '../../utils/api';
import { useToast } from '../../components/Toast';
import { SkeletonTable } from '../../components/Skeleton';

const exportToCSV = (data: any[], filename: string, columns: { key: string; label: string }[]) => {
  const header = columns.map(c => c.label).join(',');
  const rows = data.map(row => columns.map(c => {
    const val = row[c.key];
    return typeof val === 'string' && val.includes(',') ? `"${val}"` : val ?? '';
  }).join(','));
  const csv = [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
};

const SalarySheet = () => {
  const { currencySymbol: currency } = useSettings();
  const toast = useToast();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [departmentFilter, setDepartmentFilter] = useState('all');

  const departments = useMemo(() => {
    const depts = new Set<string>();
    data.forEach(s => { if (s.department) depts.add(s.department); });
    return Array.from(depts).sort();
  }, [data]);

  const filtered = useMemo(() => {
    if (departmentFilter === 'all') return data;
    return data.filter(s => s.department === departmentFilter);
  }, [data, departmentFilter]);

  useEffect(() => { fetchSheet(); }, []);

  const fetchSheet = async () => {
    setLoading(true);
    try {
      const res = await api.get('/staff/reports/salary-sheet');
      setData(res.data.data || []);
    } catch (err: any) {
      toast.error('Failed to load salary sheet');
    } finally {
      setLoading(false);
    }
  };

  const totals = useMemo(() => filtered.reduce((acc, s) => ({
    salary: acc.salary + s.salary,
    loan: acc.loan + s.loan_deduction,
    net: acc.net + s.net_salary
  }), { salary: 0, loan: 0, net: 0 }), [filtered]);

  return (
    <div className="p-8">
      {/* Gradient Page Header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-emerald-50 via-white to-white border-b border-gray-100 px-8 py-6 -mx-8 -mt-8 mb-8">
        <div className="absolute inset-0 opacity-5 bg-[url('data:image/svg+xml,%3Csvg width=%2260%22 height=%2260%22 viewBox=%220 0 60 60%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cg fill=%22none%22 fill-rule=%22evenodd%22%3E%3Cg fill=%22%23000%22 fill-opacity=%221%22%3E%3Cpath d=%22M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z%22/%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E')]" />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-200">
              <FileText size={22} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Salary Sheet</h1>
              <p className="text-sm text-gray-500 mt-0.5">View and export salary data</p>
            </div>
          </div>
          <button
            onClick={() => exportToCSV(filtered, 'salary-sheet.csv', [
              { key: 'employee_id', label: 'Emp ID' },
              { key: 'full_name', label: 'Name' },
              { key: 'department', label: 'Department' },
              { key: 'position', label: 'Position' },
              { key: 'salary', label: 'Base Salary' },
              { key: 'salary_type', label: 'Type' },
              { key: 'loan_deduction', label: 'Loan Deduction' },
              { key: 'net_salary', label: 'Net Salary' }
            ])}
            className="flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white px-5 py-2.5 rounded-xl hover:from-emerald-600 hover:to-emerald-700 shadow-md shadow-emerald-200 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 font-medium text-sm"
          >
            <Download size={16} /> Export CSV
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200">
          <p className="text-gray-500 text-sm font-medium">Total Staff</p>
          <p className="text-3xl font-bold text-gray-800 mt-2">{filtered.length}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200">
          <p className="text-gray-500 text-sm font-medium">Total Base Salary</p>
          <p className="text-3xl font-bold text-emerald-600 mt-2">{currency}{totals.salary.toLocaleString()}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200">
          <p className="text-gray-500 text-sm font-medium">Total Loan Deductions</p>
          <p className="text-3xl font-bold text-red-500 mt-2">{currency}{totals.loan.toLocaleString()}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200">
          <p className="text-gray-500 text-sm font-medium">Total Net Salary</p>
          <p className="text-3xl font-bold text-emerald-600 mt-2">{currency}{totals.net.toLocaleString()}</p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-100 shadow-sm px-5 py-4 mb-6">
        <div className="flex items-center gap-4">
          <Filter size={18} className="text-emerald-500 flex-shrink-0" />
          <span className="text-sm font-medium text-gray-600">Department:</span>
          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm transition"
          >
            <option value="all">All Departments</option>
            {departments.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <SkeletonTable rows={6} cols={8} />
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-gray-50 to-white">
              <tr className="border-b border-gray-100">
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Emp. ID</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Department</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Position</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Base Salary</th>
                <th className="text-center px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Loan Deduction</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Net Salary</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length > 0 ? (
                <>
                  {filtered.map((s: any) => (
                    <tr key={s.staff_id} className="border-b border-gray-50 hover:bg-emerald-50/20 transition-colors">
                      <td className="px-6 py-4 font-mono text-sm text-gray-500">{s.employee_id || '-'}</td>
                      <td className="px-6 py-4 font-semibold text-gray-800">{s.full_name}</td>
                      <td className="px-6 py-4 text-gray-600 text-sm">{s.department || '-'}</td>
                      <td className="px-6 py-4 text-gray-600 text-sm">{s.position || '-'}</td>
                      <td className="px-6 py-4 text-right font-medium text-gray-700">{currency}{Number(s.salary).toLocaleString()}</td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 capitalize">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          {s.salary_type}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-medium text-red-500">
                        {s.loan_deduction > 0 ? `-$${Number(s.loan_deduction).toLocaleString()}` : '-'}
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-emerald-700">{currency}{Number(s.net_salary).toLocaleString()}</td>
                    </tr>
                  ))}
                  {/* Totals Row */}
                  <tr className="bg-emerald-50 font-bold border-t-2 border-emerald-100">
                    <td colSpan={4} className="px-6 py-4 text-gray-700">TOTAL ({filtered.length} Staff)</td>
                    <td className="px-6 py-4 text-right text-gray-800">{currency}{totals.salary.toLocaleString()}</td>
                    <td className="px-6 py-4"></td>
                    <td className="px-6 py-4 text-right text-red-500">{totals.loan > 0 ? `-$${totals.loan.toLocaleString()}` : '-'}</td>
                    <td className="px-6 py-4 text-right text-emerald-700">{currency}{totals.net.toLocaleString()}</td>
                  </tr>
                </>
              ) : (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-400">
                    <DollarSign size={32} className="mx-auto mb-3 opacity-30" />
                    <p className="font-medium">No staff found</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default SalarySheet;
