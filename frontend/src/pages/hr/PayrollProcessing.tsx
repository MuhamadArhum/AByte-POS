import { useState, useEffect } from 'react';
import { DollarSign, Calendar, Play, Download, CheckCircle } from 'lucide-react';
import api from '../../utils/api';
import { useToast } from '../../components/Toast';

const PayrollProcessing = () => {
  const toast = useToast();
  const [step, setStep] = useState<'setup' | 'preview' | 'processing' | 'complete'>('setup');
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    from_date: '',
    to_date: '',
    payment_date: new Date().toISOString().split('T')[0],
    department: ''
  });

  const [preview, setPreview] = useState<any[]>([]);
  const [totals, setTotals] = useState({ count: 0, total_base: 0, total_deductions: 0, total_net: 0 });
  const [departments, setDepartments] = useState<string[]>([]);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    fetchDepartments();
  }, []);

  const fetchDepartments = async () => {
    try {
      const res = await api.get('/staff', { params: { limit: 200 } });
      const depts = new Set<string>();
      res.data.data?.forEach((s: any) => { if (s.department) depts.add(s.department); });
      setDepartments(Array.from(depts).sort());
    } catch (err) {
      console.error(err);
    }
  };

  const handlePreview = async () => {
    if (!formData.from_date || !formData.to_date || !formData.payment_date) {
      toast.error('Please fill all required fields');
      return;
    }

    setLoading(true);
    try {
      const res = await api.get('/staff/payroll/preview', { params: formData });
      setPreview(res.data.preview || []);
      setTotals(res.data.totals || { count: 0, total_base: 0, total_deductions: 0, total_net: 0 });
      setStep('preview');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to load preview');
    } finally {
      setLoading(false);
    }
  };

  const handleProcess = async () => {
    if (!window.confirm(`Process payroll for ${preview.length} staff members?\nTotal amount: $${totals.total_net.toLocaleString()}`)) return;

    setStep('processing');
    setLoading(true);

    try {
      const payments = preview.map(p => ({
        staff_id: p.staff_id,
        payment_date: p.payment_date,
        from_date: p.from_date,
        to_date: p.to_date,
        amount: p.base_salary,
        deductions: p.deductions,
        bonuses: p.bonuses,
        net_amount: p.net_amount
      }));

      const res = await api.post('/staff/payroll/process', { payments });
      setResult(res.data);
      toast.success(res.data.message);
      setStep('complete');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to process payroll');
      setStep('preview');
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = () => {
    const headers = ['Employee ID', 'Name', 'Department', 'Position', 'Base Salary', 'Deductions', 'Bonuses', 'Net Amount'];
    const rows = preview.map(p => [
      p.employee_id || '',
      `"${p.full_name}"`,
      p.department || '',
      p.position || '',
      p.base_salary.toFixed(2),
      p.deductions.toFixed(2),
      p.bonuses.toFixed(2),
      p.net_amount.toFixed(2)
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `payroll_${formData.payment_date}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const resetFlow = () => {
    setStep('setup');
    setPreview([]);
    setTotals({ count: 0, total_base: 0, total_deductions: 0, total_net: 0 });
    setResult(null);
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <DollarSign className="text-blue-600" size={32} />
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Payroll Processing</h1>
            <p className="text-gray-600 text-sm mt-1">Bulk salary generation for staff</p>
          </div>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-8">
        <div className="flex items-center justify-between">
          {['setup', 'preview', 'processing', 'complete'].map((s, idx) => (
            <div key={s} className="flex items-center">
              <div className={`flex items-center gap-2 ${step === s ? 'text-blue-600' : idx < ['setup', 'preview', 'processing', 'complete'].indexOf(step) ? 'text-green-600' : 'text-gray-400'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold ${step === s ? 'bg-blue-100' : idx < ['setup', 'preview', 'processing', 'complete'].indexOf(step) ? 'bg-green-100' : 'bg-gray-100'}`}>
                  {idx + 1}
                </div>
                <span className="font-medium capitalize">{s}</span>
              </div>
              {idx < 3 && <div className={`w-16 h-1 mx-4 ${idx < ['setup', 'preview', 'processing', 'complete'].indexOf(step) ? 'bg-green-600' : 'bg-gray-200'}`}></div>}
            </div>
          ))}
        </div>
      </div>

      {/* Step 1: Setup */}
      {step === 'setup' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
          <h2 className="text-xl font-bold text-gray-800 mb-6">Payroll Configuration</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">From Date *</label>
              <input type="date" value={formData.from_date} onChange={(e) => setFormData({ ...formData, from_date: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">To Date *</label>
              <input type="date" value={formData.to_date} onChange={(e) => setFormData({ ...formData, to_date: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Payment Date *</label>
              <input type="date" value={formData.payment_date} onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Department Filter</label>
              <select value={formData.department} onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500">
                <option value="">All Departments</option>
                {departments.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>
          <div className="flex justify-end mt-8">
            <button onClick={handlePreview} disabled={loading}
              className="flex items-center gap-2 bg-blue-600 text-white px-8 py-3 rounded-xl hover:bg-blue-700 transition shadow-lg disabled:opacity-50">
              <Calendar size={20} /> {loading ? 'Loading...' : 'Generate Preview'}
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Preview */}
      {step === 'preview' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <p className="text-gray-600 text-sm">Total Staff</p>
              <p className="text-3xl font-bold text-gray-800 mt-2">{totals.count}</p>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <p className="text-gray-600 text-sm">Total Base Salary</p>
              <p className="text-3xl font-bold text-blue-600 mt-2">${totals.total_base.toLocaleString()}</p>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <p className="text-gray-600 text-sm">Total Deductions</p>
              <p className="text-3xl font-bold text-red-600 mt-2">${totals.total_deductions.toLocaleString()}</p>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <p className="text-gray-600 text-sm">Total Net Payable</p>
              <p className="text-3xl font-bold text-green-600 mt-2">${totals.total_net.toLocaleString()}</p>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-6">
            <div className="p-4 bg-gray-50 border-b flex items-center justify-between">
              <h3 className="font-semibold text-gray-800">Payroll Preview ({preview.length} staff)</h3>
              <button onClick={exportCSV} className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition">
                <Download size={16} /> Export CSV
              </button>
            </div>
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full">
                <thead className="bg-gray-50 sticky top-0">
                  <tr className="border-b">
                    <th className="text-left p-4 font-semibold text-gray-700">Employee</th>
                    <th className="text-right p-4 font-semibold text-gray-700">Base Salary</th>
                    <th className="text-right p-4 font-semibold text-gray-700">Deductions</th>
                    <th className="text-right p-4 font-semibold text-gray-700">Bonuses</th>
                    <th className="text-right p-4 font-semibold text-gray-700">Net Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((p: any) => (
                    <tr key={p.staff_id} className="border-b hover:bg-gray-50">
                      <td className="p-4">
                        <div className="font-semibold text-gray-800">{p.full_name}</div>
                        <div className="text-xs text-gray-500">{p.employee_id || ''} {p.department ? `- ${p.department}` : ''}</div>
                      </td>
                      <td className="p-4 text-right font-medium">${p.base_salary.toLocaleString()}</td>
                      <td className="p-4 text-right font-medium text-red-600">{p.deductions > 0 ? `-$${p.deductions.toLocaleString()}` : '-'}</td>
                      <td className="p-4 text-right font-medium text-green-600">{p.bonuses > 0 ? `+$${p.bonuses.toLocaleString()}` : '-'}</td>
                      <td className="p-4 text-right font-bold text-blue-600">${p.net_amount.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex gap-4 justify-between">
            <button onClick={resetFlow} className="px-8 py-3 border border-gray-300 rounded-xl hover:bg-gray-50 transition">
              Back
            </button>
            <button onClick={handleProcess} disabled={loading || preview.length === 0}
              className="flex items-center gap-2 bg-green-600 text-white px-8 py-3 rounded-xl hover:bg-green-700 transition shadow-lg disabled:opacity-50">
              <Play size={20} /> Process Payroll
            </button>
          </div>
        </>
      )}

      {/* Step 3: Processing */}
      {step === 'processing' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <div className="animate-spin w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <h3 className="text-xl font-bold text-gray-800 mb-2">Processing Payroll...</h3>
          <p className="text-gray-600">Please wait while we process salary payments.</p>
        </div>
      )}

      {/* Step 4: Complete */}
      {step === 'complete' && result && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <CheckCircle className="text-green-600 w-20 h-20 mx-auto mb-4" />
          <h3 className="text-2xl font-bold text-gray-800 mb-4">Payroll Processed Successfully!</h3>
          <div className="text-left max-w-md mx-auto bg-gray-50 rounded-lg p-6 mb-8">
            <p className="text-gray-700 mb-2"><span className="font-semibold">Successful Payments:</span> {result.successCount}</p>
            {result.errors && result.errors.length > 0 && (
              <p className="text-red-600"><span className="font-semibold">Errors:</span> {result.errors.length}</p>
            )}
          </div>
          <button onClick={resetFlow} className="bg-blue-600 text-white px-8 py-3 rounded-xl hover:bg-blue-700 transition shadow-lg">
            Process New Payroll
          </button>
        </div>
      )}
    </div>
  );
};

export default PayrollProcessing;
