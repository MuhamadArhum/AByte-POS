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

  const grouped = useMemo(() => {
    const map: Record<string, any[]> = {};
    filtered.forEach(r => {
      const d = r.department || '(No Department)';
      if (!map[d]) map[d] = [];
      map[d].push(r);
    });
    return map;
  }, [filtered]);

  const zeroTotals = { gross_pay: 0, absent_deduction: 0, excess_leave_deduction: 0, loan_deduction: 0, advance_deduction: 0, total_deduction: 0, net_salary: 0, present_days: 0, absent_days: 0, leave_days: 0 };

  const grandTotal = useMemo(() => filtered.reduce((acc, r) => ({
    gross_pay:              acc.gross_pay              + n(r.gross_pay),
    absent_deduction:       acc.absent_deduction       + n(r.absent_deduction),
    excess_leave_deduction: acc.excess_leave_deduction + n(r.excess_leave_deduction),
    loan_deduction:         acc.loan_deduction         + n(r.loan_deduction),
    advance_deduction:      acc.advance_deduction      + n(r.advance_deduction),
    total_deduction:        acc.total_deduction        + n(r.total_deduction),
    net_salary:             acc.net_salary             + n(r.net_salary),
    present_days:           acc.present_days           + n(r.present_days),
    absent_days:            acc.absent_days            + n(r.absent_days),
    leave_days:             acc.leave_days             + n(r.leave_days),
  }), { ...zeroTotals }), [filtered]);

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
    const headers = ['Emp ID','Name','Dept','Designation','Present','Absent','Leave','Excess Leave','Working Days','Daily Rate','Basic Salary','Absent Ded.','Excess Leave Ded.','Loan Ded.','Advance Ded.','Total Ded.','Net Salary'];
    const rows = filtered.map(r => [
      r.employee_id || '',
      `"${r.full_name}"`,
      r.department || '',
      r.position || '',
      n(r.present_days), n(r.absent_days), n(r.leave_days), n(r.excess_leave),
      meta.working_days || '',
      n(r.daily_rate).toFixed(2),
      n(r.gross_pay).toFixed(2),
      n(r.absent_deduction).toFixed(2),
      n(r.excess_leave_deduction).toFixed(2),
      n(r.loan_deduction).toFixed(2),
      n(r.advance_deduction).toFixed(2),
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
        <td>${r.employee_id || '-'}</td>
        <td>${r.full_name}</td>
        <td>${r.department || '-'}</td>
        <td>${r.position || '-'}</td>
        <td align="center">${n(r.present_days)}</td>
        <td align="center">${n(r.absent_days)}</td>
        <td align="center">${n(r.leave_days)}</td>
        <td align="center">${n(r.excess_leave)}</td>
        <td align="center">${meta.holidays || 0}</td>
        <td align="right">${currency}${fmt(n(r.daily_rate))}</td>
        <td align="right">${currency}${fmt(n(r.gross_pay))}</td>
        <td align="right" style="color:#ef4444">${n(r.absent_deduction) > 0 ? `-${currency}${fmt(n(r.absent_deduction))}` : '-'}</td>
        <td align="right" style="color:#f97316">${n(r.excess_leave_deduction) > 0 ? `-${currency}${fmt(n(r.excess_leave_deduction))}` : '-'}</td>
        <td align="right" style="color:#8b5cf6">${n(r.loan_deduction) > 0 ? `-${currency}${fmt(n(r.loan_deduction))}` : '-'}</td>
        <td align="right" style="color:#6366f1">${n(r.advance_deduction) > 0 ? `-${currency}${fmt(n(r.advance_deduction))}` : '-'}</td>
        <td align="right" style="color:#dc2626;font-weight:600">${n(r.total_deduction) > 0 ? `-${currency}${fmt(n(r.total_deduction))}` : '-'}</td>
        <td align="right" style="font-weight:700;color:#059669">${currency}${fmt(n(r.net_salary))}</td>
      </tr>`).join('');

    const html = `<html><head><title>Salary Sheet</title><style>
      body{font-family:Arial,sans-serif;font-size:10px;padding:20px}
      h2{text-align:center;color:#059669;margin:0 0 4px}
      p{text-align:center;color:#6b7280;margin:0 0 12px;font-size:11px}
      table{width:100%;border-collapse:collapse;margin-top:8px}
      th{background:#f0fdf4;padding:5px 6px;border:1px solid #d1fae5;font-size:9px;white-space:nowrap}
      td{padding:4px 6px;border:1px solid #e5e7eb;white-space:nowrap}
      .total-row{background:#ecfdf5;font-weight:700}
      @media print{@page{size:landscape}body{margin:0}}
    </style></head><body>
      <h2>Salary Sheet — ${MONTHS[month-1]} ${year}</h2>
      <p>Working Days: ${meta.working_days} &nbsp;|&nbsp; Holidays: ${meta.holidays} &nbsp;|&nbsp; Total Staff: ${filtered.length}</p>
      <table>
        <thead><tr>
          <th>Emp ID</th><th>Name</th><th>Dept</th><th>Designation</th>
          <th>Present</th><th>Absent</th><th>Leave</th><th>Excess Leave</th><th>Holidays</th>
          <th>Daily Rate</th><th>Basic Salary</th>
          <th>Absent Ded.</th><th>Leave Ded.</th><th>Loan Ded.</th><th>Advance Ded.</th>
          <th>Total Ded.</th><th>Net Pay</th>
        </tr></thead>
        <tbody>${rows}
          <tr class="total-row">
            <td colspan="4">GRAND TOTAL (${filtered.length} Staff)</td>
            <td align="center">${grandTotal.present_days}</td>
            <td align="center">${grandTotal.absent_days}</td>
            <td align="center">${grandTotal.leave_days}</td>
            <td colspan="3"></td>
            <td align="right">${currency}${fmt(grandTotal.gross_pay)}</td>
            <td align="right">-${currency}${fmt(grandTotal.absent_deduction)}</td>
            <td align="right">-${currency}${fmt(grandTotal.excess_leave_deduction)}</td>
            <td align="right">-${currency}${fmt(grandTotal.loan_deduction)}</td>
            <td align="right">-${currency}${fmt(grandTotal.advance_deduction)}</td>
            <td align="right">-${currency}${fmt(grandTotal.total_deduction)}</td>
            <td align="right">${currency}${fmt(grandTotal.net_salary)}</td>
          </tr>
        </tbody>
      </table>
    </body></html>`;
    const w = window.open('', '_blank', 'width=1400,height=800');
    if (w) { w.document.write(html); w.document.close(); w.print(); }
  };

  const toggleDept = (dept: string) =>
    setCollapsedDepts(prev => ({ ...prev, [dept]: !prev[dept] }));

  const deptTotal = (rows: any[]) => rows.reduce((acc, r) => ({
    gross_pay:              acc.gross_pay              + n(r.gross_pay),
    absent_deduction:       acc.absent_deduction       + n(r.absent_deduction),
    excess_leave_deduction: acc.excess_leave_deduction + n(r.excess_leave_deduction),
    loan_deduction:         acc.loan_deduction         + n(r.loan_deduction),
    advance_deduction:      acc.advance_deduction      + n(r.advance_deduction),
    total_deduction:        acc.total_deduction        + n(r.total_deduction),
    net_salary:             acc.net_salary             + n(r.net_salary),
  }), { gross_pay: 0, absent_deduction: 0, excess_leave_deduction: 0, loan_deduction: 0, advance_deduction: 0, total_deduction: 0, net_salary: 0 });

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
              <p className="text-sm text-gray-500 mt-0.5">Complete monthly payroll breakdown</p>
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
              className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500">
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Year</label>
            <select value={year} onChange={e => setYear(Number(e.target.value))}
              className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500">
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Department</label>
            <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500">
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

      {/* Meta Cards */}
      {meta.working_days && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          {[
            { label: 'Total Staff',       value: filtered.length,                      cls: 'text-gray-800' },
            { label: 'Working Days',      value: meta.working_days,                    cls: 'text-emerald-600' },
            { label: 'Public Holidays',   value: meta.holidays,                        cls: 'text-blue-600' },
            { label: 'Total Gross',       value: `${currency}${fmt(grandTotal.gross_pay)}`,   cls: 'text-gray-700' },
            { label: 'Total Net Payable', value: `${currency}${fmt(grandTotal.net_salary)}`,  cls: 'text-emerald-600 text-lg' },
          ].map(c => (
            <div key={c.label} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
              <p className="text-xs text-gray-500 font-medium">{c.label}</p>
              <p className={`text-xl font-bold mt-1 ${c.cls}`}>{c.value}</p>
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
            <table className="w-full text-xs">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr className="border-b border-gray-100">
                  <th className="text-left px-3 py-3 font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Emp. ID</th>
                  <th className="text-left px-3 py-3 font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Name</th>
                  <th className="text-left px-3 py-3 font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Designation</th>
                  {/* Attendance */}
                  <th className="text-center px-3 py-3 font-semibold text-emerald-600 uppercase tracking-wider whitespace-nowrap">Present</th>
                  <th className="text-center px-3 py-3 font-semibold text-red-500 uppercase tracking-wider whitespace-nowrap">Absent</th>
                  <th className="text-center px-3 py-3 font-semibold text-blue-500 uppercase tracking-wider whitespace-nowrap">Leave</th>
                  <th className="text-center px-3 py-3 font-semibold text-orange-500 uppercase tracking-wider whitespace-nowrap">Ex.Leave</th>
                  <th className="text-center px-3 py-3 font-semibold text-purple-500 uppercase tracking-wider whitespace-nowrap">Holidays</th>
                  {/* Salary */}
                  <th className="text-right px-3 py-3 font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Daily Rate</th>
                  <th className="text-right px-3 py-3 font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">Basic Salary</th>
                  {/* Deductions */}
                  <th className="text-right px-3 py-3 font-semibold text-red-400 uppercase tracking-wider whitespace-nowrap">Absent Ded.</th>
                  <th className="text-right px-3 py-3 font-semibold text-orange-500 uppercase tracking-wider whitespace-nowrap">Leave Ded.</th>
                  <th className="text-right px-3 py-3 font-semibold text-purple-500 uppercase tracking-wider whitespace-nowrap">Loan Ded.</th>
                  <th className="text-right px-3 py-3 font-semibold text-indigo-500 uppercase tracking-wider whitespace-nowrap">Advance Ded.</th>
                  <th className="text-right px-3 py-3 font-semibold text-red-600 uppercase tracking-wider whitespace-nowrap">Total Ded.</th>
                  <th className="text-right px-3 py-3 font-semibold text-emerald-600 uppercase tracking-wider whitespace-nowrap">Net Pay</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(grouped).map(([dept, rows]) => {
                  const dt = deptTotal(rows);
                  const isCollapsed = collapsedDepts[dept];
                  return (
                    <>
                      {/* Department Header */}
                      <tr key={`dept-${dept}`} className="bg-emerald-50/60 cursor-pointer select-none" onClick={() => toggleDept(dept)}>
                        <td colSpan={16} className="px-3 py-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {isCollapsed ? <ChevronRight size={13} className="text-emerald-600" /> : <ChevronDown size={13} className="text-emerald-600" />}
                              <span className="text-xs font-bold uppercase tracking-widest text-emerald-700">{dept}</span>
                              <span className="text-xs text-gray-400">({rows.length} staff)</span>
                            </div>
                            <div className="flex items-center gap-4 text-xs font-semibold">
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
                          <td className="px-3 py-2.5 font-mono text-gray-400">{r.employee_id || '-'}</td>
                          <td className="px-3 py-2.5 font-semibold text-gray-800 whitespace-nowrap">{r.full_name}</td>
                          <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{r.position || '-'}</td>
                          {/* Attendance */}
                          <td className="px-3 py-2.5 text-center">
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 font-bold">{n(r.present_days)}</span>
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full font-bold ${n(r.absent_days) > 0 ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-400'}`}>{n(r.absent_days)}</span>
                          </td>
                          <td className="px-3 py-2.5 text-center text-gray-500">{n(r.leave_days)}</td>
                          <td className="px-3 py-2.5 text-center">
                            {n(r.excess_leave) > 0
                              ? <span className="text-orange-600 font-semibold">{n(r.excess_leave)}</span>
                              : <span className="text-gray-300">-</span>}
                          </td>
                          <td className="px-3 py-2.5 text-center text-purple-600 font-medium">{meta.holidays || 0}</td>
                          {/* Salary */}
                          <td className="px-3 py-2.5 text-right text-gray-400">{currency}{fmt(n(r.daily_rate))}</td>
                          <td className="px-3 py-2.5 text-right font-medium text-gray-700">{currency}{fmt(n(r.salary))}</td>
                          {/* Deductions */}
                          <td className="px-3 py-2.5 text-right text-red-500">
                            {n(r.absent_deduction) > 0 ? `-${currency}${fmt(n(r.absent_deduction))}` : <span className="text-gray-300">-</span>}
                          </td>
                          <td className="px-3 py-2.5 text-right text-orange-500">
                            {n(r.excess_leave_deduction) > 0 ? `-${currency}${fmt(n(r.excess_leave_deduction))}` : <span className="text-gray-300">-</span>}
                          </td>
                          <td className="px-3 py-2.5 text-right text-purple-500">
                            {n(r.loan_deduction) > 0 ? `-${currency}${fmt(n(r.loan_deduction))}` : <span className="text-gray-300">-</span>}
                          </td>
                          <td className="px-3 py-2.5 text-right text-indigo-500">
                            {n(r.advance_deduction) > 0 ? `-${currency}${fmt(n(r.advance_deduction))}` : <span className="text-gray-300">-</span>}
                          </td>
                          <td className="px-3 py-2.5 text-right font-semibold text-red-600">
                            {n(r.total_deduction) > 0
                              ? <span title={`Absent: ${currency}${fmt(n(r.absent_deduction))} | Leave: ${currency}${fmt(n(r.excess_leave_deduction))} | Loan: ${currency}${fmt(n(r.loan_deduction))} | Advance: ${currency}${fmt(n(r.advance_deduction))}`}>
                                  -{currency}{fmt(n(r.total_deduction))}
                                </span>
                              : <span className="text-gray-300">-</span>}
                          </td>
                          <td className="px-3 py-2.5 text-right font-bold text-emerald-700">{currency}{fmt(n(r.net_salary))}</td>
                        </tr>
                      ))}
                    </>
                  );
                })}

                {/* Grand Total */}
                <tr className="bg-emerald-50 border-t-2 border-emerald-200">
                  <td colSpan={3} className="px-3 py-4 font-bold text-gray-700 text-sm">
                    GRAND TOTAL — {filtered.length} Employees &nbsp;|&nbsp; {MONTHS[month-1]} {year}
                  </td>
                  <td className="px-3 py-4 text-center font-bold text-emerald-700">{grandTotal.present_days}</td>
                  <td className="px-3 py-4 text-center font-bold text-red-500">{grandTotal.absent_days}</td>
                  <td className="px-3 py-4 text-center font-bold text-blue-500">{grandTotal.leave_days}</td>
                  <td colSpan={3} />
                  <td className="px-3 py-4 text-right font-bold text-gray-800">{currency}{fmt(grandTotal.gross_pay)}</td>
                  <td className="px-3 py-4 text-right font-bold text-red-500">-{currency}{fmt(grandTotal.absent_deduction)}</td>
                  <td className="px-3 py-4 text-right font-bold text-orange-500">-{currency}{fmt(grandTotal.excess_leave_deduction)}</td>
                  <td className="px-3 py-4 text-right font-bold text-purple-500">-{currency}{fmt(grandTotal.loan_deduction)}</td>
                  <td className="px-3 py-4 text-right font-bold text-indigo-500">-{currency}{fmt(grandTotal.advance_deduction)}</td>
                  <td className="px-3 py-4 text-right font-bold text-red-600">-{currency}{fmt(grandTotal.total_deduction)}</td>
                  <td className="px-3 py-4 text-right font-bold text-emerald-700 text-sm">{currency}{fmt(grandTotal.net_salary)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Deduction Legend */}
          <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 flex flex-wrap gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block"></span> Absent Ded. = Absent days × daily rate + (half days × 0.5 × daily rate)</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-orange-400 inline-block"></span> Leave Ded. = Leaves beyond monthly allowed quota × daily rate</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-purple-400 inline-block"></span> Loan Ded. = Active loan monthly installment</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-indigo-400 inline-block"></span> Advance Ded. = Advance payments taken this month</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalarySheet;
