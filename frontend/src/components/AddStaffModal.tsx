import { useState, useEffect } from 'react';
import { X, User, Briefcase, DollarSign, Calendar, Mail, Phone, MapPin } from 'lucide-react';
import api from '../utils/api';
import { useToast } from './Toast';

interface StaffMember {
  staff_id: number;
  user_id: number | null;
  employee_id: string | null;
  full_name: string;
  phone: string;
  email: string;
  address: string;
  position: string;
  department: string;
  salary: number;
  salary_type: string;
  hire_date: string;
  is_active: number;
  leave_balance?: number;
}

interface AddStaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  staffToEdit?: StaffMember | null;
}

const AddStaffModal = ({ isOpen, onClose, onSuccess, staffToEdit }: AddStaffModalProps) => {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState({
    user_id: '',
    employee_id: '',
    full_name: '',
    phone: '',
    email: '',
    address: '',
    position: '',
    department: '',
    salary: '',
    salary_type: 'monthly',
    hire_date: new Date().toISOString().split('T')[0],
    is_active: 1,
    leave_balance: '20'
  });

  useEffect(() => {
    if (isOpen) {
      fetchUsers();
      setFormErrors({});
      if (staffToEdit) {
        setFormData({
          user_id: staffToEdit.user_id?.toString() || '',
          employee_id: staffToEdit.employee_id || '',
          full_name: staffToEdit.full_name,
          phone: staffToEdit.phone || '',
          email: staffToEdit.email || '',
          address: staffToEdit.address || '',
          position: staffToEdit.position || '',
          department: staffToEdit.department || '',
          salary: staffToEdit.salary?.toString() || '',
          salary_type: staffToEdit.salary_type || 'monthly',
          hire_date: staffToEdit.hire_date?.split('T')[0] || '',
          is_active: staffToEdit.is_active,
          leave_balance: (staffToEdit.leave_balance ?? 20).toString()
        });
      } else {
        resetForm();
      }
    }
  }, [isOpen, staffToEdit]);

  const fetchUsers = async () => {
    try {
      const res = await api.get('/users');
      setUsers(res.data.data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      user_id: '',
      full_name: '',
      phone: '',
      email: '',
      address: '',
      position: '',
      department: '',
      salary: '',
      salary_type: 'monthly',
      hire_date: new Date().toISOString().split('T')[0],
      is_active: 1,
      leave_balance: '20'
    });
    setFormErrors({});
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (formErrors[name]) setFormErrors(prev => ({ ...prev, [name]: '' }));
  };

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (!formData.full_name.trim()) errors.full_name = 'Full name is required';
    if (!formData.position.trim()) errors.position = 'Position is required';
    if (!formData.hire_date) errors.hire_date = 'Hire date is required';
    if (formData.phone && !/^[\d+\-() ]{7,20}$/.test(formData.phone)) {
      errors.phone = 'Invalid phone format';
    }
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Invalid email format';
    }
    if (formData.salary && Number(formData.salary) < 0) {
      errors.salary = 'Salary cannot be negative';
    }
    if (staffToEdit && (Number(formData.leave_balance) < 0 || isNaN(Number(formData.leave_balance)))) {
      errors.leave_balance = 'Must be 0 or more';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      const submitData: any = {
        ...formData,
        user_id: formData.user_id ? parseInt(formData.user_id) : null,
        salary: formData.salary ? parseFloat(formData.salary) : null,
        is_active: parseInt(formData.is_active.toString())
      };

      if (staffToEdit) {
        submitData.leave_balance = parseInt(formData.leave_balance);
        await api.put(`/staff/${staffToEdit.staff_id}`, submitData);
        toast.success('Staff member updated successfully');
      } else {
        delete submitData.leave_balance;
        await api.post('/staff', submitData);
        toast.success('Staff member added successfully');
      }

      resetForm();
      onSuccess();
      onClose();
    } catch (error: any) {
      const msg = error.response?.data?.message || 'Failed to save staff member';
      const field = error.response?.data?.field;
      if (field) setFormErrors(prev => ({ ...prev, [field]: msg }));
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!isOpen) return null;

  const inputClass = (field: string) =>
    `w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent ${formErrors[field] ? 'border-red-500' : 'border-gray-200'}`;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-cyan-600 to-cyan-700 p-6 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <User size={28} />
            <div>
              <h2 className="text-2xl font-bold">{staffToEdit ? 'Edit Staff Member' : 'Add New Staff Member'}</h2>
              <p className="text-cyan-100 text-sm mt-1">Enter staff details below</p>
            </div>
          </div>
          <button onClick={handleClose} className="text-white hover:bg-white/20 p-2 rounded-lg transition">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Link to User Account */}
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <User className="inline mr-2" size={16} />
                Link to User Account (Optional)
              </label>
              <select
                name="user_id"
                value={formData.user_id}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              >
                <option value="">-- No User Account --</option>
                {users.map(user => (
                  <option key={user.user_id} value={user.user_id}>
                    {user.name} ({user.email}) - {user.role}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-600 mt-1">Link this staff member to a system user account for login access</p>
            </div>

            {/* Personal Information */}
            <div className="border-l-4 border-cyan-500 pl-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Personal Information</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Employee ID</label>
                  <input
                    type="text"
                    name="employee_id"
                    value={formData.employee_id}
                    onChange={handleChange}
                    className={inputClass('employee_id')}
                    placeholder="e.g., EMP-001"
                  />
                  {formErrors.employee_id && <p className="text-red-500 text-xs mt-1">{formErrors.employee_id}</p>}
                  <p className="text-xs text-gray-500 mt-1">Used for attendance machine integration</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Full Name *</label>
                  <input
                    type="text"
                    name="full_name"
                    value={formData.full_name}
                    onChange={handleChange}
                    className={inputClass('full_name')}
                    placeholder="Enter full name"
                  />
                  {formErrors.full_name && <p className="text-red-500 text-xs mt-1">{formErrors.full_name}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Phone className="inline mr-1" size={16} />
                    Phone Number
                  </label>
                  <input
                    type="text"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    className={inputClass('phone')}
                    placeholder="03XX-XXXXXXX"
                  />
                  {formErrors.phone && <p className="text-red-500 text-xs mt-1">{formErrors.phone}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Mail className="inline mr-1" size={16} />
                    Email Address
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className={inputClass('email')}
                    placeholder="email@example.com"
                  />
                  {formErrors.email && <p className="text-red-500 text-xs mt-1">{formErrors.email}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <MapPin className="inline mr-1" size={16} />
                    Address
                  </label>
                  <input
                    type="text"
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    className={inputClass('address')}
                    placeholder="Enter address"
                  />
                </div>
              </div>
            </div>

            {/* Job Information */}
            <div className="border-l-4 border-green-500 pl-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Job Information</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Briefcase className="inline mr-1" size={16} />
                    Position *
                  </label>
                  <input
                    type="text"
                    name="position"
                    value={formData.position}
                    onChange={handleChange}
                    className={inputClass('position')}
                    placeholder="e.g., Sales Manager"
                  />
                  {formErrors.position && <p className="text-red-500 text-xs mt-1">{formErrors.position}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Department</label>
                  <input
                    type="text"
                    name="department"
                    value={formData.department}
                    onChange={handleChange}
                    className={inputClass('department')}
                    placeholder="e.g., Sales"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Calendar className="inline mr-1" size={16} />
                    Hire Date *
                  </label>
                  <input
                    type="date"
                    name="hire_date"
                    value={formData.hire_date}
                    onChange={handleChange}
                    className={inputClass('hire_date')}
                  />
                  {formErrors.hire_date && <p className="text-red-500 text-xs mt-1">{formErrors.hire_date}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                  <select
                    name="is_active"
                    value={formData.is_active}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  >
                    <option value={1}>Active</option>
                    <option value={0}>Inactive</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Salary Information */}
            <div className="border-l-4 border-purple-500 pl-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Salary Information</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <DollarSign className="inline mr-1" size={16} />
                    Salary Amount
                  </label>
                  <input
                    type="number"
                    name="salary"
                    value={formData.salary}
                    onChange={handleChange}
                    min="0"
                    step="0.01"
                    className={inputClass('salary')}
                    placeholder="Enter salary amount"
                  />
                  {formErrors.salary && <p className="text-red-500 text-xs mt-1">{formErrors.salary}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Salary Type</label>
                  <select
                    name="salary_type"
                    value={formData.salary_type}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  >
                    <option value="hourly">Hourly</option>
                    <option value="daily">Daily</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>

                {staffToEdit && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Leave Balance (days)</label>
                    <input
                      type="number"
                      name="leave_balance"
                      value={formData.leave_balance}
                      onChange={handleChange}
                      min="0"
                      className={inputClass('leave_balance')}
                    />
                    {formErrors.leave_balance && <p className="text-red-500 text-xs mt-1">{formErrors.leave_balance}</p>}
                  </div>
                )}
              </div>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="border-t border-gray-200 p-6 bg-gray-50 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={handleClose}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition"
          >
            Cancel
          </button>

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-6 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Saving...' : staffToEdit ? 'Update Staff Member' : 'Add Staff Member'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddStaffModal;
