import { useState, useEffect, useMemo } from 'react';
import { DollarSign, Download, Filter } from 'lucide-react';
import api from '../utils/api';
import { useToast } from '../components/Toast';

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
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <DollarSign className="text-emerald-600" size={32} />
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Salary Sheet</h1>
            <p className="text-gray-600 text-sm mt-1">Complete staff salary overview</p>
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
          className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-xl hover:bg-emerald-700 transition"
        >
          <Download size={18} /> Export CSV
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <p className="text-gray-600 text-sm">Total Staff</p>
          <p className="text-3xl font-bold text-gray-800 mt-2">{filtered.length}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <p className="text-gray-600 text-sm">Total Base Salary</p>
          <p className="text-3xl font-bold text-emerald-600 mt-2">${totals.salary.toLocaleString()}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <p className="text-gray-600 text-sm">Total Loan Deductions</p>
          <p className="text-3xl font-bold text-red-600 mt-2">${totals.loan.toLocaleString()}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <p className="text-gray-600 text-sm">Total Net Salary</p>
          <p className="text-3xl font-bold text-blue-600 mt-2">${totals.net.toLocaleString()}</p>
        </div>
      </div>

      {/* Filter */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
        <div className="flex items-center gap-4">
          <Filter size={20} className="text-gray-600" />
          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          >
            <option value="all">All Departments</option>
            {departments.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr className="border-b">
              <th className="text-left p-4 font-semibold text-gray-700">Emp. ID</th>
              <th className="text-left p-4 font-semibold text-gray-700">Name</th>
              <th className="text-left p-4 font-semibold text-gray-700">Department</th>
              <th className="text-left p-4 font-semibold text-gray-700">Position</th>
              <th className="text-right p-4 font-semibold text-gray-700">Base Salary</th>
              <th className="text-center p-4 font-semibold text-gray-700">Type</th>
              <th className="text-right p-4 font-semibold text-gray-700">Loan Deduction</th>
              <th className="text-right p-4 font-semibold text-gray-700">Net Salary</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="p-8 text-center text-gray-500">Loading...</td></tr>
            ) : filtered.length > 0 ? (
              <>
                {filtered.map((s: any) => (
                  <tr key={s.staff_id} className="border-b hover:bg-gray-50 transition">
                    <td className="p-4 font-mono text-sm text-gray-600">{s.employee_id || '-'}</td>
                    <td className="p-4 font-semibold text-gray-800">{s.full_name}</td>
                    <td className="p-4 text-gray-600">{s.department || '-'}</td>
                    <td className="p-4 text-gray-600">{s.position || '-'}</td>
                    <td className="p-4 text-right font-medium">${Number(s.salary).toLocaleString()}</td>
                    <td className="p-4 text-center">
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium capitalize">{s.salary_type}</span>
                    </td>
                    <td className="p-4 text-right font-medium text-red-600">
                      {s.loan_deduction > 0 ? `-$${Number(s.loan_deduction).toLocaleString()}` : '-'}
                    </td>
                    <td className="p-4 text-right font-bold text-emerald-700">${Number(s.net_salary).toLocaleString()}</td>
                  </tr>
                ))}
                {/* Totals Row */}
                <tr className="bg-gray-100 font-bold border-t-2 border-gray-300">
                  <td colSpan={4} className="p-4 text-gray-800">TOTAL ({filtered.length} Staff)</td>
                  <td className="p-4 text-right">${totals.salary.toLocaleString()}</td>
                  <td className="p-4"></td>
                  <td className="p-4 text-right text-red-600">{totals.loan > 0 ? `-$${totals.loan.toLocaleString()}` : '-'}</td>
                  <td className="p-4 text-right text-emerald-700">${totals.net.toLocaleString()}</td>
                </tr>
              </>
            ) : (
              <tr><td colSpan={8} className="p-8 text-center text-gray-500">No staff found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SalarySheet;
