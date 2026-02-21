import { useState, useEffect } from 'react';
import { FileText, Plus, Check, X, Filter, Search } from 'lucide-react';
import api from '../utils/api';
import { useToast } from '../components/Toast';

const LeaveRequestModal = ({ isOpen, onClose, onSuccess }: any) => {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    staff_id: '',
    leave_type: 'annual',
    from_date: '',
    to_date: '',
    reason: ''
  });

  useEffect(() => {
    if (isOpen) {
      api.get('/staff', { params: { is_active: 1, limit: 200 } })
        .then(r => setStaffList(r.data.data || []))
        .catch(() => {});
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.staff_id || !formData.from_date || !formData.to_date) {
      toast.error('Please fill all required fields');
      return;
    }

    setLoading(true);
    try {
      await api.post('/staff/leave-requests', formData);
      toast.success('Leave request submitted');
      onSuccess();
      onClose();
      setFormData({ staff_id: '', leave_type: 'annual', from_date: '', to_date: '', reason: '' });
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to submit');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">New Leave Request</h2>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Staff Member *</label>
              <select value={formData.staff_id} onChange={(e) => setFormData({ ...formData, staff_id: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500" required>
                <option value="">Select Staff</option>
                {staffList.map(s => (
                  <option key={s.staff_id} value={s.staff_id}>
                    {s.employee_id ? `[${s.employee_id}] ` : ''}{s.full_name} {s.department ? `- ${s.department}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Leave Type *</label>
              <select value={formData.leave_type} onChange={(e) => setFormData({ ...formData, leave_type: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500">
                <option value="annual">Annual Leave</option>
                <option value="sick">Sick Leave</option>
                <option value="emergency">Emergency Leave</option>
                <option value="unpaid">Unpaid Leave</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">From Date *</label>
              <input type="date" value={formData.from_date}
                onChange={(e) => setFormData({ ...formData, from_date: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">To Date *</label>
              <input type="date" value={formData.to_date}
                onChange={(e) => setFormData({ ...formData, to_date: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Reason</label>
              <textarea value={formData.reason} onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500" rows={3} />
            </div>
          </div>
          <div className="flex gap-3 mt-6">
            <button type="button" onClick={onClose}
              className="flex-1 px-6 py-3 border border-gray-300 rounded-xl hover:bg-gray-50 transition">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 px-6 py-3 bg-teal-600 text-white rounded-xl hover:bg-teal-700 transition disabled:opacity-50">
              {loading ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const LeaveRequests = () => {
  const toast = useToast();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [showModal, setShowModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [staffFilter, setStaffFilter] = useState('');
  const [staffList, setStaffList] = useState<any[]>([]);

  useEffect(() => {
    api.get('/staff', { params: { limit: 200 } }).then(r => setStaffList(r.data.data || [])).catch(() => {});
  }, []);

  useEffect(() => { fetchRequests(); }, [pagination.page, statusFilter, staffFilter]);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const params: any = { page: pagination.page, limit: pagination.limit };
      if (statusFilter !== 'all') params.status = statusFilter;
      if (staffFilter) params.staff_id = staffFilter;
      const res = await api.get('/staff/leave-requests', { params });
      setRequests(res.data.data || []);
      if (res.data.pagination) setPagination(res.data.pagination);
    } catch (err) {
      toast.error('Failed to load leave requests');
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async (requestId: number, status: 'approved' | 'rejected') => {
    const notes = prompt(`Enter review notes (optional):`);
    if (notes === null) return;

    try {
      await api.put(`/staff/leave-requests/${requestId}/review`, { status, review_notes: notes });
      toast.success(`Leave request ${status}`);
      fetchRequests();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to review');
    }
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-700',
      approved: 'bg-green-100 text-green-700',
      rejected: 'bg-red-100 text-red-700'
    };
    return <span className={`px-2 py-1 rounded-full text-xs font-semibold capitalize ${map[status] || 'bg-gray-100 text-gray-700'}`}>{status}</span>;
  };

  const leaveTypeBadge = (type: string) => {
    const map: Record<string, string> = {
      annual: 'bg-blue-100 text-blue-700',
      sick: 'bg-orange-100 text-orange-700',
      emergency: 'bg-red-100 text-red-700',
      unpaid: 'bg-gray-100 text-gray-700',
      other: 'bg-purple-100 text-purple-700'
    };
    return <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${map[type] || 'bg-gray-100 text-gray-700'}`}>{type.replace('_', ' ')}</span>;
  };

  const pendingCount = requests.filter(r => r.status === 'pending').length;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <FileText className="text-teal-600" size={32} />
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Leave Requests</h1>
            <p className="text-gray-600 text-sm mt-1">Manage employee leave applications</p>
          </div>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-teal-600 text-white px-6 py-3 rounded-xl hover:bg-teal-700 transition shadow-lg">
          <Plus size={20} /> New Request
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <p className="text-gray-600 text-sm">Total Requests</p>
          <p className="text-3xl font-bold text-gray-800 mt-2">{pagination.total}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-yellow-100 border-2">
          <p className="text-gray-600 text-sm">Pending Review</p>
          <p className="text-3xl font-bold text-yellow-600 mt-2">{pendingCount}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <p className="text-gray-600 text-sm">Approved</p>
          <p className="text-3xl font-bold text-green-600 mt-2">{requests.filter(r => r.status === 'approved').length}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <p className="text-gray-600 text-sm">Rejected</p>
          <p className="text-3xl font-bold text-red-600 mt-2">{requests.filter(r => r.status === 'rejected').length}</p>
        </div>
      </div>

      {/* Filter */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <Filter size={20} className="text-gray-600" />
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPagination(p => ({ ...p, page: 1 })); }}
            className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500">
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          <select value={staffFilter} onChange={(e) => { setStaffFilter(e.target.value); setPagination(p => ({ ...p, page: 1 })); }}
            className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 min-w-[200px]">
            <option value="">All Staff</option>
            {staffList.map(s => <option key={s.staff_id} value={s.staff_id}>{s.employee_id ? `[${s.employee_id}] ` : ''}{s.full_name}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr className="border-b">
              <th className="text-left p-4 font-semibold text-gray-700">Staff</th>
              <th className="text-center p-4 font-semibold text-gray-700">Type</th>
              <th className="text-center p-4 font-semibold text-gray-700">Period</th>
              <th className="text-center p-4 font-semibold text-gray-700">Days</th>
              <th className="text-left p-4 font-semibold text-gray-700">Reason</th>
              <th className="text-center p-4 font-semibold text-gray-700">Status</th>
              <th className="text-center p-4 font-semibold text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="p-8 text-center text-gray-500">Loading...</td></tr>
            ) : requests.length > 0 ? (
              requests.map((req: any) => (
                <tr key={req.request_id} className="border-b hover:bg-gray-50 transition">
                  <td className="p-4">
                    <div className="font-semibold text-gray-800">{req.full_name}</div>
                    <div className="text-xs text-gray-500">{req.employee_id || ''} {req.department ? `- ${req.department}` : ''}</div>
                  </td>
                  <td className="p-4 text-center">{leaveTypeBadge(req.leave_type)}</td>
                  <td className="p-4 text-center text-sm text-gray-600">
                    {new Date(req.from_date).toLocaleDateString()}<br/>to {new Date(req.to_date).toLocaleDateString()}
                  </td>
                  <td className="p-4 text-center font-semibold text-gray-800">{req.days}</td>
                  <td className="p-4 text-gray-600 max-w-xs truncate">{req.reason || '-'}</td>
                  <td className="p-4 text-center">{statusBadge(req.status)}</td>
                  <td className="p-4 text-center">
                    {req.status === 'pending' ? (
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => handleReview(req.request_id, 'approved')}
                          className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition" title="Approve">
                          <Check size={16} />
                        </button>
                        <button onClick={() => handleReview(req.request_id, 'rejected')}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition" title="Reject">
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-500">Reviewed by {req.reviewed_by_name || 'N/A'}</span>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr><td colSpan={7} className="p-8 text-center text-gray-500">No leave requests found</td></tr>
            )}
          </tbody>
        </table>

        {pagination.totalPages > 1 && (
          <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-600">Page {pagination.page} of {pagination.totalPages}</div>
            <div className="flex gap-2">
              <button onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))} disabled={pagination.page === 1}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 transition">Previous</button>
              <button onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))} disabled={pagination.page === pagination.totalPages}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 transition">Next</button>
            </div>
          </div>
        )}
      </div>

      <LeaveRequestModal isOpen={showModal} onClose={() => setShowModal(false)} onSuccess={fetchRequests} />
    </div>
  );
};

export default LeaveRequests;
