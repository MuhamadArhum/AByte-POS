import { useState, useEffect } from 'react';
import { Plus, Calendar, Search, Filter, TrendingUp, Users, CheckCircle, XCircle } from 'lucide-react';
import api from '../utils/api';
import MarkAttendanceModal from '../components/MarkAttendanceModal';

const Attendance = () => {
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [showMarkModal, setShowMarkModal] = useState(false);

  // Filters
  const [filters, setFilters] = useState({
    staff_id: '',
    start_date: '',
    end_date: new Date().toISOString().split('T')[0],
    status: 'all'
  });
  const [staff, setStaff] = useState<any[]>([]);
  const [summary, setSummary] = useState({
    present: 0,
    absent: 0,
    halfDay: 0,
    leave: 0,
    total: 0
  });

  useEffect(() => {
    fetchStaff();
  }, []);

  useEffect(() => {
    fetchAttendance();
  }, [pagination.page, filters]);

  const fetchStaff = async () => {
    try {
      const res = await api.get('/staff', { params: { is_active: 1, limit: 100 } });
      setStaff(res.data.data || []);
    } catch (error) {
      console.error('Error fetching staff:', error);
    }
  };

  const fetchAttendance = async () => {
    setLoading(true);
    try {
      const params: any = {
        page: pagination.page,
        limit: pagination.limit
      };

      if (filters.staff_id) params.staff_id = filters.staff_id;
      if (filters.start_date) params.start_date = filters.start_date;
      if (filters.end_date) params.end_date = filters.end_date;
      if (filters.status !== 'all') params.status = filters.status;

      const res = await api.get('/staff/attendance', { params });
      const records = res.data.data || [];
      setAttendance(records);

      if (res.data.pagination) {
        setPagination(res.data.pagination);
      }

      // Calculate summary
      const summaryData = {
        present: records.filter((a: any) => a.status === 'present').length,
        absent: records.filter((a: any) => a.status === 'absent').length,
        halfDay: records.filter((a: any) => a.status === 'half_day').length,
        leave: records.filter((a: any) => a.status === 'leave').length,
        total: records.length
      };
      setSummary(summaryData);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (name: string, value: string) => {
    setFilters(prev => ({ ...prev, [name]: value }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handleApplyFilters = () => {
    setPagination({ ...pagination, page: 1 });
    fetchAttendance();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'present':
        return 'bg-green-100 text-green-700';
      case 'absent':
        return 'bg-red-100 text-red-700';
      case 'half_day':
        return 'bg-yellow-100 text-yellow-700';
      case 'leave':
        return 'bg-blue-100 text-blue-700';
      case 'holiday':
        return 'bg-purple-100 text-purple-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  if (loading && attendance.length === 0) return <div className="p-8">Loading...</div>;

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Calendar className="text-indigo-600" size={32} />
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Attendance Management</h1>
            <p className="text-gray-600 text-sm mt-1">Track staff attendance records</p>
          </div>
        </div>
        <button
          onClick={() => setShowMarkModal(true)}
          className="flex items-center gap-2 bg-green-600 text-white px-6 py-3 rounded-xl hover:bg-green-700 transition shadow-lg hover:shadow-xl"
        >
          <Plus size={20} />
          Mark Attendance
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <Users className="text-gray-600" size={20} />
            <p className="text-gray-600 text-sm">Total Records</p>
          </div>
          <p className="text-3xl font-bold text-gray-800">{summary.total}</p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="text-green-600" size={20} />
            <p className="text-gray-600 text-sm">Present</p>
          </div>
          <p className="text-3xl font-bold text-green-600">{summary.present}</p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <XCircle className="text-red-600" size={20} />
            <p className="text-gray-600 text-sm">Absent</p>
          </div>
          <p className="text-3xl font-bold text-red-600">{summary.absent}</p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="text-yellow-600" size={20} />
            <p className="text-gray-600 text-sm">Half Day</p>
          </div>
          <p className="text-3xl font-bold text-yellow-600">{summary.halfDay}</p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="text-blue-600" size={20} />
            <p className="text-gray-600 text-sm">On Leave</p>
          </div>
          <p className="text-3xl font-bold text-blue-600">{summary.leave}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {/* Staff Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Staff Member</label>
            <select
              value={filters.staff_id}
              onChange={(e) => handleFilterChange('staff_id', e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="">All Staff</option>
              {staff.map(member => (
                <option key={member.staff_id} value={member.staff_id}>
                  {member.full_name}
                </option>
              ))}
            </select>
          </div>

          {/* Start Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
            <input
              type="date"
              value={filters.start_date}
              onChange={(e) => handleFilterChange('start_date', e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          {/* End Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
            <input
              type="date"
              value={filters.end_date}
              onChange={(e) => handleFilterChange('end_date', e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="present">Present</option>
              <option value="absent">Absent</option>
              <option value="half_day">Half Day</option>
              <option value="leave">On Leave</option>
              <option value="holiday">Holiday</option>
            </select>
          </div>

          {/* Apply Button */}
          <div className="flex items-end">
            <button
              onClick={handleApplyFilters}
              className="w-full bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition"
            >
              Apply Filters
            </button>
          </div>
        </div>
      </div>

      {/* Attendance Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr className="border-b">
              <th className="text-left p-4 font-semibold text-gray-700">Staff Member</th>
              <th className="text-left p-4 font-semibold text-gray-700">Position</th>
              <th className="text-center p-4 font-semibold text-gray-700">Date</th>
              <th className="text-center p-4 font-semibold text-gray-700">Check In</th>
              <th className="text-center p-4 font-semibold text-gray-700">Check Out</th>
              <th className="text-center p-4 font-semibold text-gray-700">Status</th>
              <th className="text-left p-4 font-semibold text-gray-700">Notes</th>
            </tr>
          </thead>
          <tbody>
            {attendance.length > 0 ? (
              attendance.map((record: any) => (
                <tr key={record.attendance_id} className="border-b hover:bg-gray-50 transition">
                  <td className="p-4 font-semibold text-gray-800">{record.full_name}</td>
                  <td className="p-4 text-gray-600">{record.position || '-'}</td>
                  <td className="p-4 text-center">
                    {new Date(record.attendance_date).toLocaleDateString()}
                  </td>
                  <td className="p-4 text-center font-mono text-sm">
                    {record.check_in || '-'}
                  </td>
                  <td className="p-4 text-center font-mono text-sm">
                    {record.check_out || '-'}
                  </td>
                  <td className="p-4 text-center">
                    <span className={`px-3 py-1 rounded-full text-sm font-semibold capitalize ${getStatusColor(record.status)}`}>
                      {record.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="p-4 text-sm text-gray-600">
                    {record.notes || '-'}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="p-8 text-center text-gray-500">
                  No attendance records found. Mark attendance to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Showing page {pagination.page} of {pagination.totalPages} ({pagination.total} total records)
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

      {/* Modal */}
      <MarkAttendanceModal
        isOpen={showMarkModal}
        onClose={() => setShowMarkModal(false)}
        onSuccess={fetchAttendance}
      />
    </div>
  );
};

export default Attendance;
