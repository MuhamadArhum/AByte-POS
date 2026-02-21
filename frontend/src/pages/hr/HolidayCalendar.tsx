import { useState, useEffect } from 'react';
import { Calendar, Plus, Edit, Trash2, Filter } from 'lucide-react';
import api from '../../utils/api';
import { useToast } from '../../components/Toast';

const HolidayModal = ({ isOpen, onClose, onSuccess, holiday }: any) => {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    holiday_date: '',
    holiday_name: '',
    description: ''
  });

  useEffect(() => {
    if (holiday) {
      setFormData({
        holiday_date: holiday.holiday_date.split('T')[0],
        holiday_name: holiday.holiday_name,
        description: holiday.description || ''
      });
    } else {
      setFormData({ holiday_date: '', holiday_name: '', description: '' });
    }
  }, [holiday]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.holiday_date || !formData.holiday_name) {
      toast.error('Please fill all required fields');
      return;
    }

    setLoading(true);
    try {
      if (holiday) {
        await api.put(`/staff/holidays/${holiday.holiday_id}`, formData);
        toast.success('Holiday updated');
      } else {
        await api.post('/staff/holidays', formData);
        toast.success('Holiday created');
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Operation failed');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">{holiday ? 'Edit Holiday' : 'Add Holiday'}</h2>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Holiday Date *</label>
              <input type="date" value={formData.holiday_date}
                onChange={(e) => setFormData({ ...formData, holiday_date: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Holiday Name *</label>
              <input type="text" value={formData.holiday_name}
                onChange={(e) => setFormData({ ...formData, holiday_name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
                placeholder="e.g., New Year's Day" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
              <textarea value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500" rows={3} />
            </div>
          </div>
          <div className="flex gap-3 mt-6">
            <button type="button" onClick={onClose}
              className="flex-1 px-6 py-3 border border-gray-300 rounded-xl hover:bg-gray-50 transition">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition disabled:opacity-50">
              {loading ? 'Saving...' : holiday ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const HolidayCalendar = () => {
  const toast = useToast();
  const [holidays, setHolidays] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedHoliday, setSelectedHoliday] = useState<any>(null);
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear().toString());

  useEffect(() => { fetchHolidays(); }, [yearFilter]);

  const fetchHolidays = async () => {
    setLoading(true);
    try {
      const params = yearFilter ? { year: yearFilter } : {};
      const res = await api.get('/staff/holidays', { params });
      setHolidays(res.data.data || []);
    } catch (err) {
      toast.error('Failed to load holidays');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (holiday: any) => {
    if (!window.confirm(`Delete holiday "${holiday.holiday_name}"?`)) return;
    try {
      await api.delete(`/staff/holidays/${holiday.holiday_id}`);
      toast.success('Holiday deleted');
      fetchHolidays();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete');
    }
  };

  const handleEdit = (holiday: any) => {
    setSelectedHoliday(holiday);
    setShowModal(true);
  };

  const handleAdd = () => {
    setSelectedHoliday(null);
    setShowModal(true);
  };

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 1 + i);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Calendar className="text-indigo-600" size={32} />
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Holiday Calendar</h1>
            <p className="text-gray-600 text-sm mt-1">Manage company holidays</p>
          </div>
        </div>
        <button onClick={handleAdd}
          className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl hover:bg-indigo-700 transition shadow-lg">
          <Plus size={20} /> Add Holiday
        </button>
      </div>

      {/* Summary */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-8">
        <p className="text-gray-600 text-sm">Total Holidays {yearFilter && `in ${yearFilter}`}</p>
        <p className="text-3xl font-bold text-indigo-600 mt-2">{holidays.length}</p>
      </div>

      {/* Filter */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
        <div className="flex items-center gap-4">
          <Filter size={20} className="text-gray-600" />
          <select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500">
            <option value="">All Years</option>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr className="border-b">
              <th className="text-left p-4 font-semibold text-gray-700">Date</th>
              <th className="text-left p-4 font-semibold text-gray-700">Holiday Name</th>
              <th className="text-left p-4 font-semibold text-gray-700">Description</th>
              <th className="text-center p-4 font-semibold text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="p-8 text-center text-gray-500">Loading...</td></tr>
            ) : holidays.length > 0 ? (
              holidays.map((h: any) => (
                <tr key={h.holiday_id} className="border-b hover:bg-gray-50 transition">
                  <td className="p-4 font-medium">{new Date(h.holiday_date).toLocaleDateString()}</td>
                  <td className="p-4 font-semibold text-gray-800">{h.holiday_name}</td>
                  <td className="p-4 text-gray-600">{h.description || '-'}</td>
                  <td className="p-4 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => handleEdit(h)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition" title="Edit">
                        <Edit size={16} />
                      </button>
                      <button onClick={() => handleDelete(h)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition" title="Delete">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr><td colSpan={4} className="p-8 text-center text-gray-500">No holidays found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <HolidayModal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setSelectedHoliday(null); }}
        onSuccess={fetchHolidays}
        holiday={selectedHoliday}
      />
    </div>
  );
};

export default HolidayCalendar;
