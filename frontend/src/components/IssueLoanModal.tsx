import { useState, useEffect } from 'react';
import { X, DollarSign } from 'lucide-react';
import api from '../utils/api';
import { useToast } from './Toast';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const IssueLoanModal = ({ isOpen, onClose, onSuccess }: Props) => {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [staff, setStaff] = useState<any[]>([]);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState({
    staff_id: '',
    loan_amount: '',
    monthly_deduction: '',
    loan_date: new Date().toISOString().split('T')[0],
    reason: ''
  });

  useEffect(() => {
    if (isOpen) {
      fetchStaff();
      setFormErrors({});
      setFormData({ staff_id: '', loan_amount: '', monthly_deduction: '', loan_date: new Date().toISOString().split('T')[0], reason: '' });
    }
  }, [isOpen]);

  const fetchStaff = async () => {
    try {
      const res = await api.get('/staff', { params: { is_active: 1, limit: 100 } });
      setStaff(res.data.data || []);
    } catch (err) { console.error(err); }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (formErrors[name]) setFormErrors(prev => ({ ...prev, [name]: '' }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (!formData.staff_id) errors.staff_id = 'Select a staff member';
    if (!formData.loan_amount || Number(formData.loan_amount) <= 0) errors.loan_amount = 'Valid amount required';
    if (!formData.loan_date) errors.loan_date = 'Date required';
    if (formData.monthly_deduction && Number(formData.monthly_deduction) < 0) errors.monthly_deduction = 'Cannot be negative';
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setLoading(true);
    try {
      await api.post('/staff/loans', {
        staff_id: Number(formData.staff_id),
        loan_amount: Number(formData.loan_amount),
        monthly_deduction: Number(formData.monthly_deduction) || 0,
        loan_date: formData.loan_date,
        reason: formData.reason || null
      });
      toast.success('Loan issued successfully');
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to issue loan');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const inputClass = (field: string) =>
    `w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent ${formErrors[field] ? 'border-red-500' : 'border-gray-200'}`;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full">
        <div className="bg-gradient-to-r from-cyan-600 to-cyan-700 p-6 text-white flex items-center justify-between rounded-t-2xl">
          <div className="flex items-center gap-3">
            <DollarSign size={28} />
            <h2 className="text-xl font-bold">Issue New Loan</h2>
          </div>
          <button onClick={onClose} className="text-white hover:bg-white/20 p-2 rounded-lg transition"><X size={24} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Staff Member *</label>
            <select name="staff_id" value={formData.staff_id} onChange={handleChange} className={inputClass('staff_id')}>
              <option value="">-- Select Staff --</option>
              {staff.map(s => <option key={s.staff_id} value={s.staff_id}>{s.employee_id ? `[${s.employee_id}] ` : ''}{s.full_name} - {s.position}</option>)}
            </select>
            {formErrors.staff_id && <p className="text-red-500 text-xs mt-1">{formErrors.staff_id}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Loan Amount *</label>
              <input type="number" name="loan_amount" value={formData.loan_amount} onChange={handleChange} min="0" step="0.01" placeholder="0.00" className={inputClass('loan_amount')} />
              {formErrors.loan_amount && <p className="text-red-500 text-xs mt-1">{formErrors.loan_amount}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Monthly Deduction</label>
              <input type="number" name="monthly_deduction" value={formData.monthly_deduction} onChange={handleChange} min="0" step="0.01" placeholder="0.00" className={inputClass('monthly_deduction')} />
              {formErrors.monthly_deduction && <p className="text-red-500 text-xs mt-1">{formErrors.monthly_deduction}</p>}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Loan Date *</label>
            <input type="date" name="loan_date" value={formData.loan_date} onChange={handleChange} className={inputClass('loan_date')} />
            {formErrors.loan_date && <p className="text-red-500 text-xs mt-1">{formErrors.loan_date}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Reason</label>
            <textarea name="reason" value={formData.reason} onChange={handleChange} rows={2} className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-cyan-500" placeholder="Reason for loan..." />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition">Cancel</button>
            <button type="submit" disabled={loading} className="px-6 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition disabled:opacity-50">
              {loading ? 'Issuing...' : 'Issue Loan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default IssueLoanModal;
