import { useState, useEffect } from 'react';
import { useSettings } from '../../context/SettingsContext';
import { Receipt, Search, Printer, User, Calendar } from 'lucide-react';
import api from '../../utils/api';
import { useToast } from '../../components/Toast';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const fmt = (v: number) => Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const SalaryVoucher = () => {
  const { currencySymbol: currency } = useSettings();
  const toast = useToast();

  const now = new Date();
  const [staffList, setStaffList] = useState<any[]>([]);
  const [staffId, setStaffId]   = useState('');
  const [month, setMonth]       = useState(now.getMonth() + 1);
  const [year, setYear]         = useState(now.getFullYear());
  const [voucher, setVoucher]   = useState<any>(null);
  const [loading, setLoading]   = useState(false);

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);

  useEffect(() => {
    api.get('/staff', { params: { limit: 500 } })
      .then(r => setStaffList(r.data.data || []))
      .catch(() => {});
  }, []);

  const fetchVoucher = async () => {
    if (!staffId) { toast.error('Please select an employee'); return; }
    setLoading(true);
    try {
      const res = await api.get('/staff/reports/salary-voucher', { params: { staff_id: staffId, month, year } });
      setVoucher(res.data);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to load voucher');
    } finally {
      setLoading(false);
    }
  };

  const printVoucher = () => {
    if (!voucher) return;
    const { staff, month: m, year: y, days_in_month, holidays, working_days,
            present_days, absent_days, half_days, leave_days,
            basic_salary, adjustment, gross_pay, loan_deduction,
            absent_deduction, total_deduction, net_pay, daily_rate } = voucher;
    const html = `<html><head><title>Salary Voucher</title><style>
      *{box-sizing:border-box}
      body{font-family:Arial,sans-serif;max-width:680px;margin:20px auto;padding:0 20px;color:#111}
      .header{text-align:center;border-bottom:3px solid #059669;padding-bottom:12px;margin-bottom:16px}
      .header h2{color:#059669;margin:0;font-size:20px}
      .header p{margin:4px 0;color:#555;font-size:13px}
      .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px}
      .info-box{background:#f0fdf4;border:1px solid #d1fae5;border-radius:8px;padding:10px 14px}
      .info-box label{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:#6b7280;margin-bottom:2px}
      .info-box span{font-weight:700;font-size:14px;color:#111}
      .section{border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:14px}
      .section-title{background:#f9fafb;padding:8px 14px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#374151;border-bottom:1px solid #e5e7eb}
      table{width:100%;border-collapse:collapse}
      td{padding:7px 14px;font-size:13px;border-bottom:1px solid #f3f4f6}
      tr:last-child td{border-bottom:none}
      .lbl{color:#6b7280}.val{text-align:right;font-weight:500}
      .deduction{color:#ef4444}.earning{color:#059669}
      .net-row{background:#f0fdf4;font-weight:700;font-size:15px}
      .net-row td{color:#059669;padding:10px 14px;border-top:2px solid #059669}
      .footer{text-align:center;color:#9ca3af;font-size:11px;margin-top:20px;border-top:1px solid #e5e7eb;padding-top:10px}
      @media print{body{margin:0}}
    </style></head><body>
      <div class="header">
        <h2>Salary Voucher</h2>
        <p>${MONTHS[m-1]} ${y}</p>
      </div>
      <div class="info-grid">
        <div class="info-box"><label>Employee Name</label><span>${staff.full_name}</span></div>
        <div class="info-box"><label>Employee ID</label><span>${staff.employee_id || '-'}</span></div>
        <div class="info-box"><label>Department</label><span>${staff.department || '-'}</span></div>
        <div class="info-box"><label>Designation</label><span>${staff.position || '-'}</span></div>
      </div>

      <div class="section">
        <div class="section-title">Attendance Summary</div>
        <table>
          <tr><td class="lbl">Total Days</td><td class="val">${days_in_month}</td></tr>
          <tr><td class="lbl">Public Holidays</td><td class="val">${holidays}</td></tr>
          <tr><td class="lbl">Working Days</td><td class="val">${working_days}</td></tr>
          <tr><td class="lbl">Days Present</td><td class="val earning">${present_days}</td></tr>
          <tr><td class="lbl">Days Absent</td><td class="val deduction">${absent_days}</td></tr>
          <tr><td class="lbl">Half Days</td><td class="val">${half_days}</td></tr>
          <tr><td class="lbl">Leave Days</td><td class="val">${leave_days}</td></tr>
          <tr><td class="lbl">Daily Rate</td><td class="val">${currency}${fmt(daily_rate)}</td></tr>
        </table>
      </div>

      <div class="section">
        <div class="section-title">Earnings</div>
        <table>
          <tr><td class="lbl">Basic Salary</td><td class="val earning">${currency}${fmt(basic_salary)}</td></tr>
          ${adjustment !== 0 ? `<tr><td class="lbl">Adjustment</td><td class="val ${adjustment > 0 ? 'earning' : 'deduction'}">${adjustment > 0 ? '+' : ''}${currency}${fmt(Math.abs(adjustment))}</td></tr>` : ''}
          <tr><td class="lbl"><b>Gross Pay</b></td><td class="val earning"><b>${currency}${fmt(gross_pay)}</b></td></tr>
        </table>
      </div>

      <div class="section">
        <div class="section-title">Deductions</div>
        <table>
          ${absent_deduction > 0 ? `<tr><td class="lbl">Absent Deduction (${absent_days}d + ${half_days} half)</td><td class="val deduction">-${currency}${fmt(absent_deduction)}</td></tr>` : ''}
          ${loan_deduction > 0 ? `<tr><td class="lbl">Loan Repayment</td><td class="val deduction">-${currency}${fmt(loan_deduction)}</td></tr>` : ''}
          <tr><td class="lbl"><b>Total Deductions</b></td><td class="val deduction"><b>-${currency}${fmt(total_deduction)}</b></td></tr>
        </table>
      </div>

      <table class="section" style="margin-bottom:16px">
        <tr class="net-row">
          <td>NET PAYABLE</td>
          <td style="text-align:right">${currency}${fmt(net_pay)}</td>
        </tr>
      </table>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:30px;margin-top:30px;padding-top:10px">
        <div style="border-top:1px solid #111;padding-top:4px;text-align:center;font-size:12px;color:#6b7280">Prepared By</div>
        <div style="border-top:1px solid #111;padding-top:4px;text-align:center;font-size:12px;color:#6b7280">Employee Signature</div>
      </div>
      <div class="footer">Generated by AByte ERP &mdash; ${new Date().toLocaleDateString()}</div>
    </body></html>`;
    const w = window.open('', '_blank', 'width=750,height=700');
    if (w) { w.document.write(html); w.document.close(); w.print(); }
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-blue-50 via-white to-white border-b border-gray-100 px-8 py-6 -mx-8 -mt-8 mb-8">
        <div className="relative flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200">
            <Receipt size={22} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Salary Voucher</h1>
            <p className="text-sm text-gray-500 mt-0.5">Generate individual employee salary slip</p>
          </div>
        </div>
      </div>

      {/* Search Form */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-8">
        <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
          <Search size={16} className="text-blue-500" /> Select Employee & Period
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Employee</label>
            <select value={staffId} onChange={e => setStaffId(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm">
              <option value="">— Select Employee —</option>
              {staffList.map(s => (
                <option key={s.staff_id} value={s.staff_id}>
                  {s.full_name} {s.employee_id ? `(${s.employee_id})` : ''} {s.department ? `- ${s.department}` : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Month</label>
            <select value={month} onChange={e => setMonth(Number(e.target.value))}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm">
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Year</label>
            <select value={year} onChange={e => setYear(Number(e.target.value))}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm">
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>
        <div className="mt-4">
          <button onClick={fetchVoucher} disabled={loading || !staffId}
            className="flex items-center gap-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white px-6 py-2.5 rounded-xl hover:from-blue-600 hover:to-blue-700 shadow-md shadow-blue-200 hover:-translate-y-0.5 transition-all duration-200 font-medium text-sm disabled:opacity-50 disabled:hover:translate-y-0">
            <Calendar size={16} /> {loading ? 'Generating...' : 'Generate Voucher'}
          </button>
        </div>
      </div>

      {/* Voucher Display */}
      {voucher && (
        <div className="bg-white rounded-2xl border-2 border-blue-100 shadow-sm overflow-hidden">
          {/* Voucher Header */}
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm">SALARY VOUCHER</p>
                <h2 className="text-2xl font-bold mt-1">{MONTHS[voucher.month - 1]} {voucher.year}</h2>
              </div>
              <button onClick={printVoucher}
                className="flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-xl transition font-medium text-sm">
                <Printer size={16} /> Print Voucher
              </button>
            </div>
          </div>

          {/* Employee Info */}
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center">
                <User size={24} className="text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">{voucher.staff.full_name}</h3>
                <p className="text-gray-500 text-sm">{voucher.staff.position || '-'} &bull; {voucher.staff.department || '-'}</p>
                {voucher.staff.employee_id && <p className="text-xs text-gray-400 mt-0.5">ID: {voucher.staff.employee_id}</p>}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
            {/* Attendance Panel */}
            <div className="p-6 border-r border-gray-100">
              <h4 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">Attendance</h4>
              <div className="space-y-3">
                {[
                  { label: 'Total Days in Month', value: voucher.days_in_month, color: 'text-gray-700' },
                  { label: 'Public Holidays', value: voucher.holidays, color: 'text-purple-600' },
                  { label: 'Working Days', value: voucher.working_days, color: 'text-blue-600' },
                  { label: 'Days Present', value: voucher.present_days, color: 'text-emerald-600' },
                  { label: 'Days Absent', value: voucher.absent_days, color: 'text-red-500' },
                  { label: 'Half Days', value: voucher.half_days, color: 'text-yellow-600' },
                  { label: 'Leave Days', value: voucher.leave_days, color: 'text-blue-500' },
                ].map(row => (
                  <div key={row.label} className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">{row.label}</span>
                    <span className={`font-bold text-lg ${row.color}`}>{row.value}</span>
                  </div>
                ))}
                <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                  <span className="text-sm text-gray-500">Daily Rate</span>
                  <span className="font-medium text-gray-700">{voucher.currency}{fmt(voucher.daily_rate)}</span>
                </div>
              </div>
            </div>

            {/* Salary Panel */}
            <div className="p-6">
              <h4 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">Salary Breakdown</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b border-gray-50">
                  <span className="text-sm text-gray-600">Basic Salary</span>
                  <span className="font-semibold text-gray-800">{currency}{fmt(voucher.basic_salary)}</span>
                </div>
                {voucher.adjustment !== 0 && (
                  <div className="flex items-center justify-between py-2 border-b border-gray-50">
                    <span className="text-sm text-gray-600">Adjustment</span>
                    <span className={`font-semibold ${voucher.adjustment > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {voucher.adjustment > 0 ? '+' : ''}{currency}{fmt(Math.abs(voucher.adjustment))}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-sm font-semibold text-gray-700">Gross Pay</span>
                  <span className="font-bold text-emerald-600">{currency}{fmt(voucher.gross_pay)}</span>
                </div>
                {voucher.absent_deduction > 0 && (
                  <div className="flex items-center justify-between py-1">
                    <span className="text-sm text-gray-500">Absent Deduction ({voucher.absent_days}d + {voucher.half_days} half)</span>
                    <span className="font-medium text-red-500">-{currency}{fmt(voucher.absent_deduction)}</span>
                  </div>
                )}
                {voucher.loan_deduction > 0 && (
                  <div className="flex items-center justify-between py-1">
                    <span className="text-sm text-gray-500">Loan Deduction</span>
                    <span className="font-medium text-red-500">-{currency}{fmt(voucher.loan_deduction)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between py-2 border-t border-gray-100">
                  <span className="text-sm font-semibold text-gray-700">Total Deductions</span>
                  <span className="font-bold text-red-500">-{currency}{fmt(voucher.total_deduction)}</span>
                </div>
              </div>

              {/* Net Pay */}
              <div className="mt-4 bg-emerald-50 border-2 border-emerald-200 rounded-xl p-4 flex items-center justify-between">
                <span className="font-bold text-emerald-800 text-base">NET PAYABLE</span>
                <span className="font-bold text-emerald-700 text-2xl">{currency}{fmt(voucher.net_pay)}</span>
              </div>
            </div>
          </div>

          {/* Signature area */}
          <div className="px-6 py-4 border-t border-gray-100 grid grid-cols-3 gap-8 bg-gray-50">
            {['Prepared By', 'Approved By', 'Employee Signature'].map(label => (
              <div key={label} className="text-center">
                <div className="border-t-2 border-gray-300 pt-2 mt-8">
                  <p className="text-xs text-gray-400">{label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SalaryVoucher;
