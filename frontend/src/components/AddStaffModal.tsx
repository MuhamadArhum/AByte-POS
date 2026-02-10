import { useState, useEffect } from 'react';
import { X, User, Briefcase, DollarSign, Calendar, Mail, Phone, MapPin } from 'lucide-react';
import api from '../utils/api';

interface StaffMember {
  staff_id: number;
  user_id: number | null;
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
}

interface AddStaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  staffToEdit?: StaffMember | null;
}

const AddStaffModal = ({ isOpen, onClose, onSuccess, staffToEdit }: AddStaffModalProps) => {
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<any[]>([]);

  // Form data
  const [formData, setFormData] = useState({
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
    is_active: 1
  });

  useEffect(() => {
    if (isOpen) {
      fetchUsers();
      if (staffToEdit) {
        setFormData({
          user_id: staffToEdit.user_id?.toString() || '',
          full_name: staffToEdit.full_name,
          phone: staffToEdit.phone || '',
          email: staffToEdit.email || '',
          address: staffToEdit.address || '',
          position: staffToEdit.position || '',
          department: staffToEdit.department || '',
          salary: staffToEdit.salary?.toString() || '',
          salary_type: staffToEdit.salary_type || 'monthly',
          hire_date: staffToEdit.hire_date?.split('T')[0] || '',
          is_active: staffToEdit.is_active
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
      is_active: 1
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.full_name || !formData.position || !formData.hire_date) {
      alert('Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      const submitData = {
        ...formData,
        user_id: formData.user_id ? parseInt(formData.user_id) : null,
        salary: formData.salary ? parseFloat(formData.salary) : null,
        is_active: parseInt(formData.is_active.toString())
      };

      if (staffToEdit) {
        await api.put(`/staff/${staffToEdit.staff_id}`, submitData);
        alert('Staff member updated successfully!');
      } else {
        await api.post('/staff', submitData);
        alert('Staff member added successfully!');
      }

      resetForm();
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error saving staff:', error);
      alert(error.response?.data?.message || 'Failed to save staff member');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!isOpen) return null;

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
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    name="full_name"
                    value={formData.full_name}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                    placeholder="Enter full name"
                  />
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
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                    placeholder="03XX-XXXXXXX"
                  />
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
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                    placeholder="email@example.com"
                  />
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
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
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
                    required
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                    placeholder="e.g., Sales Manager"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Department
                  </label>
                  <input
                    type="text"
                    name="department"
                    value={formData.department}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
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
                    required
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status
                  </label>
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
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                    placeholder="Enter salary amount"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Salary Type
                  </label>
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
