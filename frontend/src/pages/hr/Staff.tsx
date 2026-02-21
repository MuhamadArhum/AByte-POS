import { useState, useEffect, useMemo } from 'react';
import { Plus, Eye, Edit, Trash2, DollarSign, User, Search, Filter, RotateCcw, TrendingUp } from 'lucide-react';
import api from '../../utils/api';
import { useToast } from '../../components/Toast';
import AddStaffModal from '../../components/AddStaffModal';
import StaffDetailsModal from '../../components/StaffDetailsModal';
import SalaryPaymentModal from '../../components/SalaryPaymentModal';
import SalaryIncrementModal from '../../components/SalaryIncrementModal';

const Staff = () => {
  const toast = useToast();
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showSalaryModal, setShowSalaryModal] = useState(false);
  const [showIncrementModal, setShowIncrementModal] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<any>(null);
  const [staffToEdit, setStaffToEdit] = useState<any>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');

  // Extract unique departments from staff list
  const departments = useMemo(() => {
    const depts = new Set<string>();
    staff.forEach((s: any) => {
      if (s.department) depts.add(s.department);
    });
    return Array.from(depts).sort();
  }, [staff]);

  useEffect(() => {
    fetchStaff();
  }, [pagination.page, statusFilter, departmentFilter]);

  const fetchStaff = async () => {
    setLoading(true);
    try {
      const params: any = {
        page: pagination.page,
        limit: pagination.limit
      };

      if (statusFilter !== 'all') {
        params.is_active = statusFilter;
      }

      if (departmentFilter !== 'all') {
        params.department = departmentFilter;
      }

      if (searchTerm) {
        params.search = searchTerm;
      }

      const res = await api.get('/staff', { params });
      setStaff(res.data.data || []);
      if (res.data.pagination) {
        setPagination(res.data.pagination);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setPagination({ ...pagination, page: 1 });
    fetchStaff();
  };

  const handleViewDetails = (staffMember: any) => {
    setSelectedStaff(staffMember);
    setShowDetailsModal(true);
  };

  const handleEdit = (staffMember: any) => {
    setStaffToEdit(staffMember);
    setShowAddModal(true);
  };

  const handlePaySalary = (staffMember: any) => {
    setSelectedStaff(staffMember);
    setShowSalaryModal(true);
  };

  const handleDelete = async (staffId: number, name: string) => {
    if (!window.confirm(`Are you sure you want to deactivate ${name}?`)) return;

    try {
      await api.delete(`/staff/${staffId}`);
      toast.success('Staff member deactivated successfully');
      fetchStaff();
    } catch (error: any) {
      console.error('Error deactivating staff:', error);
      toast.error(error.response?.data?.message || 'Failed to deactivate staff member');
    }
  };

  const handleReactivate = async (staffId: number, name: string) => {
    if (!window.confirm(`Reactivate ${name}?`)) return;

    try {
      await api.put(`/staff/${staffId}`, { is_active: 1 });
      toast.success(`${name} has been reactivated`);
      fetchStaff();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to reactivate staff member');
    }
  };

  if (loading && staff.length === 0) return <div className="p-8">Loading...</div>;

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <User className="text-cyan-600" size={32} />
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Staff Management</h1>
            <p className="text-gray-600 text-sm mt-1">Manage your team members</p>
          </div>
        </div>
        <button
          onClick={() => {
            setStaffToEdit(null);
            setShowAddModal(true);
          }}
          className="flex items-center gap-2 bg-cyan-600 text-white px-6 py-3 rounded-xl hover:bg-cyan-700 transition shadow-lg hover:shadow-xl"
        >
          <Plus size={20} />
          Add Staff Member
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <p className="text-gray-600 text-sm">Total Staff</p>
          <p className="text-3xl font-bold text-gray-800 mt-2">{pagination.total}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <p className="text-gray-600 text-sm">Active Staff</p>
          <p className="text-3xl font-bold text-green-600 mt-2">
            {staff.filter((s: any) => s.is_active === 1).length}
          </p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <p className="text-gray-600 text-sm">Inactive Staff</p>
          <p className="text-3xl font-bold text-gray-600 mt-2">
            {staff.filter((s: any) => s.is_active === 0).length}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-center">
          {/* Search */}
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Search by name, position, or phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <Filter size={20} className="text-gray-600" />
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPagination(p => ({ ...p, page: 1 })); }}
              className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="1">Active</option>
              <option value="0">Inactive</option>
            </select>
          </div>

          {/* Department Filter */}
          {departments.length > 0 && (
            <select
              value={departmentFilter}
              onChange={(e) => { setDepartmentFilter(e.target.value); setPagination(p => ({ ...p, page: 1 })); }}
              className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            >
              <option value="all">All Departments</option>
              {departments.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          )}

          <button
            onClick={handleSearch}
            className="bg-cyan-600 text-white px-6 py-2 rounded-lg hover:bg-cyan-700 transition"
          >
            Apply
          </button>
        </div>
      </div>

      {/* Staff Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr className="border-b">
              <th className="text-left p-4 font-semibold text-gray-700">Emp. ID</th>
              <th className="text-left p-4 font-semibold text-gray-700">Name</th>
              <th className="text-left p-4 font-semibold text-gray-700">Position</th>
              <th className="text-left p-4 font-semibold text-gray-700">Department</th>
              <th className="text-left p-4 font-semibold text-gray-700">Phone</th>
              <th className="text-right p-4 font-semibold text-gray-700">Salary</th>
              <th className="text-center p-4 font-semibold text-gray-700">Status</th>
              <th className="text-center p-4 font-semibold text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            {staff.length > 0 ? (
              staff.map((member: any) => (
                <tr key={member.staff_id} className="border-b hover:bg-gray-50 transition">
                  <td className="p-4 text-gray-600 font-mono text-sm">{member.employee_id || '-'}</td>
                  <td className="p-4 font-semibold text-gray-800">{member.full_name}</td>
                  <td className="p-4">{member.position}</td>
                  <td className="p-4 text-gray-600">{member.department || '-'}</td>
                  <td className="p-4 text-gray-600">{member.phone || '-'}</td>
                  <td className="p-4 text-right font-medium">
                    {member.salary ? `$${Number(member.salary).toFixed(0)}` : '-'}
                  </td>
                  <td className="p-4 text-center">
                    <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                      member.is_active === 1 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {member.is_active === 1 ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => handleViewDetails(member)}
                        className="text-blue-600 hover:bg-blue-50 p-2 rounded-lg transition"
                        title="View Details"
                      >
                        <Eye size={18} />
                      </button>
                      <button
                        onClick={() => handleEdit(member)}
                        className="text-cyan-600 hover:bg-cyan-50 p-2 rounded-lg transition"
                        title="Edit"
                      >
                        <Edit size={18} />
                      </button>
                      {member.is_active === 1 ? (
                        <>
                          <button
                            onClick={() => handlePaySalary(member)}
                            className="text-purple-600 hover:bg-purple-50 p-2 rounded-lg transition"
                            title="Pay Salary"
                          >
                            <DollarSign size={18} />
                          </button>
                          <button
                            onClick={() => { setSelectedStaff(member); setShowIncrementModal(true); }}
                            className="text-emerald-600 hover:bg-emerald-50 p-2 rounded-lg transition"
                            title="Salary Increment"
                          >
                            <TrendingUp size={18} />
                          </button>
                          <button
                            onClick={() => handleDelete(member.staff_id, member.full_name)}
                            className="text-red-600 hover:bg-red-50 p-2 rounded-lg transition"
                            title="Deactivate"
                          >
                            <Trash2 size={18} />
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => handleReactivate(member.staff_id, member.full_name)}
                          className="text-green-600 hover:bg-green-50 p-2 rounded-lg transition"
                          title="Reactivate"
                        >
                          <RotateCcw size={18} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8} className="p-8 text-center text-gray-500">
                  No staff members found. Add your first team member to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Showing page {pagination.page} of {pagination.totalPages} ({pagination.total} total staff)
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
                disabled={pagination.page === 1}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                Previous
              </button>
              <button
                onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
                disabled={pagination.page === pagination.totalPages}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <AddStaffModal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setStaffToEdit(null);
        }}
        onSuccess={fetchStaff}
        staffToEdit={staffToEdit}
      />

      {selectedStaff && (
        <>
          <StaffDetailsModal
            isOpen={showDetailsModal}
            onClose={() => {
              setShowDetailsModal(false);
              setSelectedStaff(null);
            }}
            staffId={selectedStaff.staff_id}
          />

          <SalaryPaymentModal
            isOpen={showSalaryModal}
            onClose={() => {
              setShowSalaryModal(false);
              setSelectedStaff(null);
            }}
            onSuccess={fetchStaff}
            staffMember={selectedStaff}
          />

          <SalaryIncrementModal
            isOpen={showIncrementModal}
            onClose={() => {
              setShowIncrementModal(false);
              setSelectedStaff(null);
            }}
            onSuccess={fetchStaff}
            staffMember={selectedStaff}
          />
        </>
      )}
    </div>
  );
};

export default Staff;
