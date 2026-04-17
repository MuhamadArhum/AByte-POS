import { useState, useEffect, useMemo } from 'react';
import { useSettings } from '../../context/SettingsContext';
import { FileText, Download, Filter, Printer, ChevronDown, ChevronRight } from 'lucide-react';
import api from '../../utils/api';
import { useToast } from '../../components/Toast';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const n = (v: any) => Number(v || 0);
const fmt = (v: number) => v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const SalarySheet = () => {
  const { currencySymbol: currency } = useSettings();
  const toast = useToast();

  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear]   = useState(now.getFullYear());
  const [deptFilter, setDeptFilter] = useState('all');

  const [data, setData]   = useState<any[]>([]);
  const [meta, setMeta]   = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [collapsedDepts, setCollapsedDepts] = useState<Record<string, boolean>>({});

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);

  const departments = useMemo(() => {
    const s = new Set<string>();
    data.forEach(r => { if (r.department) s.add(r.department); });
    return Array.from(s).sort();
  }, [data]);

  const filtered = useMemo(() =>
    deptFilter === 'all' ? data : data.filter(r => r.department === deptFilter),
    [data, deptFilter]
  );

  // Group by department for dept-wise totals
  const grouped = useMemo(() => {
    const map: Record<string, any[]> = {};
    filtered.forEach(r => {
      const d = r.department || '(No Department)';
      if (!map[d]) map[d] = [];
      map[d].push(r);
    });
    return map;
  }, [filtered]);

  const grandTotal = useMemo(() => filtered.reduce((acc, r) => ({
    gross_pay       : acc.gross_pay       + n(r.gross_pay),
    adjustment      : acc.adjustment      + n(r.adjustment),
    total_deduction : acc.total_deduction + n(r.total_deduction),
    net_salary      : acc.net_salary      + n(r.net_salary),
    present_days    : acc.present_days    + n(r.present_days),
    absent_days     : acc.absent_days     + n(r.absent_days),
  }), { gross_pay: 0, adjustment: 0, total_deduction: 0, net_salary: 0, present_days: 0, absent_days: 0 }),
  [filtered]);

  const fetchSheet = async () => {
    setLoading(true);
    try {
      const res = await api.get('/staff/reports/salary-sheet', { params: { month, year, department: deptFilter === 'all' ? undefined : deptFilter } });
      setData(res.data.data || []);
      setMeta(res.data.meta || {});
    } catch {
      toast.error('Failed to load salary sheet');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSheet(); }, []);

  const exportCSV = () => {
    const headers = ['Emp ID','Name','Department','Position','Attendance','Absent','Leave','Basic Salary','Absent Ded.','Loan Ded.','Total Ded.','Net Salary'];
    const rows = filtered.map(r => [
      r.employee_id || '',
      `"${r.full_name}"`,
      r.department || '',
      r.position || '',
      r.present_days, r.absent_days, r.leave_days,
      n(r.gross_pay).toFixed(2),
      n(r.absent_deduction).toFixed(2),
      n(r.loan_deduction).toFixed(2),
      n(r.total_deduction).toFixed(2),
      n(r.net_salary).toFixed(2),
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `salary_sheet_${MONTHS[month-1]}_${year}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const printSheet = () => {
    const rows = filtered.map(r => `
      <tr>
        <td>${r.employee_id || '-'}</td><td>${r.full_name}</td><td>${r.department || '-'}</td><td>${r.position || '-'}</td>
        <td style="text-align:center">${r.present_days}</td>
        <td style="text-align:center">${r.absent_days}</td>
        <td style="text-align:center">${r.leave_days}</td>
        <td style="text-align:center">${meta.holidays || 0}</td>
        <td style="text-align:right">${currency}${fmt(n(r.gross_pay))}</td>
        <td style="text-align:right">${n(r.adjustment) > 0 ? `+${currency}${fmt(n(r.adjustment))}` : '-'}</td>
        <td style="text-align:right">${n(r.total_deduction) > 0 ? `-${currency}${fmt(n(r.total_deduction))}` : '-'}</td>
        <td style="text-align:right; font-weight:700">${currency}${fmt(n(r.net_salary))}</td>
      </tr>`).join('');
    const html = `<html><head><title>Salary Sheet</title><style>
      body{font-family:Arial,sans-serif;font-size:11px;padding:20px}
      h2{text-align:center;color:#059669}
      table{width:100%;border-collapse:collapse;margin-top:10px}
      th{background:#f0fdf4;padding:6px 8px;border:1px solid #d1fae5;text-align:left;font-size:10px}
      td{padding:5px 8px;border:1px solid #e5e7eb}
      .total-row{background:#f0fdf4;font-weight:700}
      @media print{body{margin:0}}
    </style></head><body>
      <h2>Salary Sheet — ${MONTHS[month-1]} ${year}</h2>
      <p>Working Days: ${meta.working_days} &nbsp; Holidays: ${meta.holidays} &nbsp; Total Staff: ${filtered.length}</p>
      <table>
        <thead><tr>
          <th>Emp ID</th><th>Name</th><th>Dept</th><th>Position</th>
          <th>Present</th><th>Absent</th><th>Leave</th><th>Holidays</th>
          <th>Gross Pay</th><th>Adjustment</th><th>Deduction</th><th>Net Pay</th>
        </tr></thead>
        <tbody>${rows}
          <tr class="total-row">
            <td colspan="4">TOTAL (${filtered.length} Staff)</td>
            <td style="text-align:center">${grandTotal.present_days}</td>
            <td style="text-align:center">${grandTotal.absent_days}</td>
            <td colspan="2"></td>
            <td style="text-align:right">${currency}${fmt(grandTotal.gross_pay)}</td>
            <td></td>
            <td style="text-align:right">-${currency}${fmt(grandTotal.total_deduction)}</td>
            <td style="text-align:right">${currency}${fmt(grandTotal.net_salary)}</td>
          </tr>
        </tbody>
      </table>
    </body></html>`;
    const w = window.open('', '_blank', 'width=1100,height=700');
    if (w) { w.document.write(html); w.document.close(); w.print(); }
  };

  const toggleDept = (dept: string) =>
    setCollapsedDepts(prev => ({ ...prev, [dept]: !prev[dept] }));

  const deptTotal = (rows: any[]) => rows.reduce((acc, r) => ({
    gross_pay: acc.gross_pay + n(r.gross_pay),
    total_deduction: acc.total_deduction + n(r.total_deduction),
    net_salary: acc.net_salary + n(r.net_salary),
  }), { gross_pay: 0, total_deduction: 0, net_salary: 0 });

  return (
    <div className="p-8">
      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-emerald-50 via-white to-white border-b border-gray-100 px-8 py-6 -mx-8 -mt-8 mb-8">
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-200">
              <FileText size={22} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Salary Sheet</h1>
              <p className="text-sm text-gray-500 mt-0.5">Monthly salary breakdown with attendance</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={exportCSV} className="flex items-center gap-2 border border-gray-200 text-gray-600 px-4 py-2 rounded-xl hover:bg-gray-50 transition text-sm font-medium">
              <Download size={15} /> Export CSV
            </button>
            <button onClick={printSheet} className="flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white px-5 py-2.5 rounded-xl hover:from-emerald-600 hover:to-emerald-700 shadow-md shadow-emerald-200 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 font-medium text-sm">
              <Printer size={15} /> Print
            </button>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-4 mb-6">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Month</label>
            <select value={month} onChange={e => setMonth(Number(e.target.value))}
              className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent">
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Year</label>
            <select value={year} onChange={e => setYear(Number(e.target.value))}
              className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent">
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Department</label>
            <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent">
              <option value="all">All Departments</option>
              {departments.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <button onClick={fetchSheet} disabled={loading}
            className="flex items-center gap-2 bg-emerald-500 text-white px-5 py-2 rounded-xl hover:bg-emerald-600 transition text-sm font-medium disabled:opacity-50">
            <Filter size={15} /> {loading ? 'Loading...' : 'Apply'}
          </button>
        </div>
      </div>

      {/* Meta Info */}
      {meta.working_days && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total Staff', value: filtered.length, cls: 'text-gray-800' },
            { label: 'Working Days', value: meta.working_days, cls: 'text-emerald-600' },
            { label: 'Public Holidays', value: meta.holidays, cls: 'text-blue-600' },
            { label: 'Total Net Payable', value: `${currency}${fmt(grandTotal.net_salary)}`, cls: 'text-emerald-600' },
          ].map(c => (
            <div key={c.label} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
              <p className="text-xs text-gray-500 font-medium">{c.label}</p>
              <p className={`text-2xl font-bold mt-1 ${c.cls}`}>{c.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-16 text-center text-gray-400">
          <FileText size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">No staff data found</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gradient-to-r from-gray-50 to-white sticky top-0 z-10">
                <tr className="border-b border-gray-100">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Emp. ID</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Designation</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-emerald-600 uppercase tracking-wider whitespace-nowrap">Attendance</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-red-500 uppercase tracking-wider whitespace-nowrap">Absent</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-blue-500 uppercase tracking-wider whitespace-nowrap">Leave</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-purple-500 uppercase tracking-wider whitespace-nowrap">Holidays</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Basic Salary</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Adjustment</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Gross Pay</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-red-500 uppercase tracking-wider whitespace-nowrap">Deduction</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-emerald-600 uppercase tracking-wider whitespace-nowrap">Net Pay</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(grouped).map(([dept, rows]) => {
                  const dt = deptTotal(rows);
                  const isCollapsed = collapsedDepts[dept];
                  return (
                    <>
                      {/* Department Header Row */}
                      <tr key={`dept-${dept}`} className="bg-emerald-50/60 cursor-pointer select-none"
                        onClick={() => toggleDept(dept)}>
                        <td colSpan={12} className="px-4 py-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {isCollapsed ? <ChevronRight size={14} className="text-emerald-600" /> : <ChevronDown size={14} className="text-emerald-600" />}
                              <span className="text-xs font-bold uppercase tracking-widest text-emerald-700">{dept}</span>
                              <span className="text-xs text-gray-400">({rows.length} staff)</span>
                            </div>
                            <div className="flex items-center gap-6 text-xs font-semibold">
                              <span className="text-gray-600">Gross: {currency}{fmt(dt.gross_pay)}</span>
                              <span className="text-red-500">Ded: -{currency}{fmt(dt.total_deduction)}</span>
                              <span className="text-emerald-700">Net: {currency}{fmt(dt.net_salary)}</span>
                            </div>
                          </div>
                        </td>
                      </tr>
                      {/* Employee Rows */}
                      {!isCollapsed && rows.map((r: any) => (
                        <tr key={r.staff_id} className="border-b border-gray-50 hover:bg-emerald-50/20 transition-colors">
                          <td className="px-4 py-3 font-mono text-xs text-gray-500">{r.employee_id || '-'}</td>
                          <td className="px-4 py-3 font-semibold text-gray-800 whitespace-nowrap">{r.full_name}</td>
                          <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{r.position || '-'}</td>
                          <td className="px-4 py-3 text-center">
                            <span className="inline-block w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 font-bold text-sm leading-8">{r.present_days}</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-block w-8 h-8 rounded-full font-bold text-sm leading-8 ${r.absent_days > 0 ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-400'}`}>{r.absent_days}</span>
                          </td>
                          <td className="px-4 py-3 text-center text-gray-500">{r.leave_days}</td>
                          <td className="px-4 py-3 text-center text-purple-600 font-medium">{meta.holidays || 0}</td>
                          <td className="px-4 py-3 text-right font-medium text-gray-700">{currency}{fmt(n(r.salary))}</td>
                          <td className="px-4 py-3 text-right text-gray-400">
                            {n(r.adjustment) !== 0 ? <span className={n(r.adjustment) > 0 ? 'text-green-600' : 'text-red-500'}>{n(r.adjustment) > 0 ? '+' : ''}{currency}{fmt(Math.abs(n(r.adjustment)))}</span> : '-'}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-gray-700">{currency}{fmt(n(r.gross_pay))}</td>
                          <td className="px-4 py-3 text-right text-red-500 font-medium">
                            {n(r.total_deduction) > 0 ? (
                              <span title={`Loan: ${currency}${fmt(n(r.loan_deduction))} | Absent: ${currency}${fmt(n(r.absent_deduction))}`}>
                                -{currency}{fmt(n(r.total_deduction))}
                              </span>
                            ) : '-'}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-emerald-700">{currency}{fmt(n(r.net_salary))}</td>
                        </tr>
                      ))}
                    </>
                  );
                })}
                {/* Grand Total */}
                <tr className="bg-emerald-50 border-t-2 border-emerald-200">
                  <td colSpan={7} className="px-4 py-4 font-bold text-gray-700 text-sm">
                    GRAND TOTAL — {filtered.length} Employees &nbsp;|&nbsp; {MONTHS[month-1]} {year}
                  </td>
                  <td className="px-4 py-4 text-right font-bold text-gray-800">{currency}{fmt(grandTotal.gross_pay)}</td>
                  <td className="px-4 py-4 text-right font-bold text-gray-400">-</td>
                  <td className="px-4 py-4 text-right font-bold text-gray-800">{currency}{fmt(grandTotal.gross_pay)}</td>
                  <td className="px-4 py-4 text-right font-bold text-red-600">-{currency}{fmt(grandTotal.total_deduction)}</td>
                  <td className="px-4 py-4 text-right font-bold text-emerald-700 text-base">{currency}{fmt(grandTotal.net_salary)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalarySheet;
