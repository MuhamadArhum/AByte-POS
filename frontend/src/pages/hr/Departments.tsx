import { useState, useEffect } from 'react';
import { Building2, Plus, Pencil, Trash2, Users } from 'lucide-react';
import { motion } from 'framer-motion';
import api from '../../utils/api';
import { useToast } from '../../components/Toast';
import { SkeletonCards } from '../../components/Skeleton';
import ModalWrapper from '../../components/ModalWrapper';

const DeptModal = ({ dept, onClose, onSuccess }: { dept: any | null; onClose: () => void; onSuccess: () => void }) => {
  const toast = useToast();
  const [form, setForm] = useState({ name: dept?.name || '', description: dept?.description || '', head_of_dept: dept?.head_of_dept || '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Department name required'); return; }
    setLoading(true);
    try {
      if (dept) {
        await api.put(`/staff/departments/${dept.department_id}`, form);
        toast.success('Department updated');
      } else {
        await api.post('/staff/departments', form);
        toast.success('Department created');
      }
      onSuccess(); onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save');
    } finally { setLoading(false); }
  };

  return (
    <ModalWrapper onClose={onClose}>
      <div className="bg-gradient-to-r from-cyan-500 to-cyan-600 p-6 rounded-t-2xl">
        <h2 className="text-base font-semibold text-white">{dept ? 'Edit Department' : 'New Department'}</h2>
        <p className="text-cyan-100 text-xs mt-0.5">{dept ? 'Update department details' : 'Add a new department to the organization'}</p>
      </div>
      <div className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Name *</label>
            <input autoFocus value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-400 bg-gray-50/50 outline-none transition" placeholder="e.g. Sales" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Head of Department</label>
            <input value={form.head_of_dept} onChange={e => setForm({ ...form, head_of_dept: e.target.value })}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-400 bg-gray-50/50 outline-none transition" placeholder="Manager name" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-400 bg-gray-50/50 outline-none transition resize-none" rows={2} />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50 transition">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-cyan-600 text-white rounded-xl text-sm font-semibold hover:from-cyan-600 hover:to-cyan-700 disabled:opacity-50 transition">
              {loading ? 'Saving...' : dept ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </ModalWrapper>
  );
};

const Departments = () => {
  const toast = useToast();
  const [depts, setDepts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editDept, setEditDept] = useState<any>(null);
  const [staffCounts, setStaffCounts] = useState<Record<string, number>>({});

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [dRes, sRes] = await Promise.all([
        api.get('/staff/departments'),
        api.get('/staff', { params: { limit: 500 } })
      ]);
      const depts = dRes.data.data || [];
      setDepts(depts);
      // Count staff per department
      const counts: Record<string, number> = {};
      for (const s of sRes.data.data || []) {
        if (s.department) counts[s.department] = (counts[s.department] || 0) + 1;
      }
      setStaffCounts(counts);
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  };

  const handleDelete = async (dept: any) => {
    if (!window.confirm(`Delete department "${dept.name}"?`)) return;
    try {
      await api.delete(`/staff/departments/${dept.department_id}`);
      toast.success('Department deleted');
      fetchAll();
    } catch (err: any) { toast.error(err.response?.data?.message || 'Failed to delete'); }
  };

  return (
    <div className="p-8">
      {/* Gradient page header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-cyan-50 via-white to-white border-b border-gray-100 px-8 py-6 -mx-8 -mt-8 mb-8">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=%2260%22 height=%2260%22 viewBox=%220 0 60 60%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cg fill=%22none%22 fill-rule=%22evenodd%22%3E%3Cg fill=%22%2306b6d4%22 fill-opacity=%221%22%3E%3Cpath d=%22M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-5" />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-2xl flex items-center justify-center shadow-lg shadow-cyan-200">
              <Building2 size={22} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Departments</h1>
              <p className="text-sm text-gray-500 mt-0.5">Manage company departments</p>
            </div>
          </div>
          <button onClick={() => { setEditDept(null); setShowModal(true); }}
            className="flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-cyan-600 text-white px-5 py-2.5 rounded-xl hover:from-cyan-600 hover:to-cyan-700 shadow-md shadow-cyan-200 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 font-medium text-sm">
            <Plus size={16} /> New Department
          </button>
        </div>
      </div>

      {loading ? (
        <SkeletonCards count={6} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {depts.map((d, i) => (
            <motion.div
              key={d.department_id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06, duration: 0.3 }}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-3 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-cyan-50 rounded-xl flex items-center justify-center">
                    <Building2 size={18} className="text-cyan-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 text-base">{d.name}</h3>
                    {d.head_of_dept && <p className="text-xs text-gray-500 mt-0.5">Head: {d.head_of_dept}</p>}
                  </div>
                </div>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${d.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${d.is_active ? 'bg-green-500' : 'bg-gray-400'}`} />
                  {d.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
              {d.description && <p className="text-sm text-gray-500">{d.description}</p>}
              <div className="flex items-center gap-1.5 text-sm text-cyan-700 font-medium bg-cyan-50 rounded-lg px-3 py-1.5 w-fit">
                <Users size={14} />
                {staffCounts[d.name] || 0} staff
              </div>
              <div className="flex gap-2 pt-1 border-t border-gray-100">
                <button onClick={() => { setEditDept(d); setShowModal(true); }}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-sm text-gray-600 hover:bg-cyan-50 hover:text-cyan-700 rounded-lg transition-all">
                  <Pencil size={14} /> Edit
                </button>
                <button onClick={() => handleDelete(d)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-sm text-red-500 hover:bg-red-50 rounded-lg transition-all">
                  <Trash2 size={14} /> Delete
                </button>
              </div>
            </motion.div>
          ))}
          {depts.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="col-span-3 text-center py-16 text-gray-400"
            >
              <Building2 size={40} className="mx-auto mb-3 opacity-30" />
              <p>No departments yet. Create one to get started.</p>
            </motion.div>
          )}
        </div>
      )}

      {showModal && (
        <DeptModal dept={editDept} onClose={() => setShowModal(false)} onSuccess={fetchAll} />
      )}
    </div>
  );
};

export default Departments;
