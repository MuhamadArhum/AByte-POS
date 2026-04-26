import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, UtensilsCrossed, Table2, Users, X, Check, Layers } from 'lucide-react';
import api from '../../utils/api';
import { useToast } from '../../components/Toast';

interface RestaurantTable {
  table_id: number;
  table_name: string;
  floor: string;
  capacity: number;
  status: string;
  has_pending_order: number;
}

const TableManagement = () => {
  const { success: toastSuccess, error: toastError } = useToast();
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTable, setEditingTable] = useState<RestaurantTable | null>(null);
  const [form, setForm] = useState({ table_name: '', floor: '', capacity: '4' });
  const [saving, setSaving] = useState(false);
  const [selectedFloor, setSelectedFloor] = useState<string>('All');

  // Floor management
  const [showFloorModal, setShowFloorModal] = useState(false);
  const [newFloorName, setNewFloorName] = useState('');
  const [customFloors, setCustomFloors] = useState<string[]>([]);

  const fetchTables = async () => {
    try {
      const res = await api.get('/restaurant/tables');
      const data: RestaurantTable[] = Array.isArray(res.data) ? res.data : [];
      setTables(data);
      // Derive unique floors from tables + custom floors
      const fromTables = Array.from(new Set(data.map(t => t.floor).filter(Boolean)));
      setCustomFloors(prev => Array.from(new Set([...prev, ...fromTables])));
    } catch {
      toastError('Failed to load tables');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTables(); }, []);

  // All unique floor names
  const allFloors = Array.from(new Set(customFloors));

  const openAdd = () => {
    setEditingTable(null);
    setForm({ table_name: '', floor: allFloors[0] || '', capacity: '4' });
    setShowForm(true);
  };

  const openEdit = (table: RestaurantTable) => {
    setEditingTable(table);
    setForm({ table_name: table.table_name, floor: table.floor, capacity: String(table.capacity) });
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!form.table_name.trim()) { toastError('Table name is required'); return; }
    setSaving(true);
    try {
      if (editingTable) {
        await api.put(`/restaurant/tables/${editingTable.table_id}`, form);
        toastSuccess('Table updated');
      } else {
        await api.post('/restaurant/tables', form);
        toastSuccess('Table added');
      }
      // If new floor typed, add to customFloors
      if (form.floor && !customFloors.includes(form.floor)) {
        setCustomFloors(prev => [...prev, form.floor]);
      }
      setShowForm(false);
      fetchTables();
    } catch (err: any) {
      toastError(err.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (table: RestaurantTable) => {
    if (Number(table.has_pending_order) > 0) {
      toastError('Cannot delete a table with active orders');
      return;
    }
    if (!confirm(`Delete table "${table.table_name}"?`)) return;
    try {
      await api.delete(`/restaurant/tables/${table.table_id}`);
      toastSuccess('Table deleted');
      fetchTables();
    } catch {
      toastError('Failed to delete');
    }
  };

  const addFloor = () => {
    const name = newFloorName.trim();
    if (!name) return;
    if (customFloors.includes(name)) { toastError('Floor already exists'); return; }
    setCustomFloors(prev => [...prev, name]);
    setNewFloorName('');
    toastSuccess(`Floor "${name}" added`);
  };

  const deleteFloor = (floor: string) => {
    const inUse = tables.some(t => t.floor === floor);
    if (inUse) { toastError('Cannot delete — tables are assigned to this floor'); return; }
    setCustomFloors(prev => prev.filter(f => f !== floor));
    if (selectedFloor === floor) setSelectedFloor('All');
  };

  const floorFilters = ['All', ...allFloors];
  const filtered = selectedFloor === 'All' ? tables : tables.filter(t => t.floor === selectedFloor);

  const stats = {
    total: tables.length,
    available: tables.filter(t => Number(t.has_pending_order) === 0).length,
    occupied: tables.filter(t => Number(t.has_pending_order) > 0).length,
  };

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center shadow-md">
            <UtensilsCrossed size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Table Management</h1>
            <p className="text-sm text-gray-500">Manage restaurant floor plan</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowFloorModal(true)}
            className="flex items-center gap-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-4 py-2.5 rounded-xl font-semibold text-sm shadow-sm transition-colors"
          >
            <Layers size={15} /> Manage Floors
          </button>
          <button
            onClick={openAdd}
            className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2.5 rounded-xl font-semibold text-sm shadow-md transition-colors"
          >
            <Plus size={16} /> Add Table
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: 'Total Tables', value: stats.total, color: 'bg-blue-50 text-blue-700', border: 'border-blue-200' },
          { label: 'Available', value: stats.available, color: 'bg-green-50 text-green-700', border: 'border-green-200' },
          { label: 'Occupied', value: stats.occupied, color: 'bg-red-50 text-red-700', border: 'border-red-200' },
        ].map(s => (
          <div key={s.label} className={`rounded-xl border ${s.border} ${s.color} p-4 text-center`}>
            <div className="text-2xl font-black">{s.value}</div>
            <div className="text-xs font-medium mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Floor Filter Tabs */}
      {floorFilters.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {floorFilters.map(floor => (
            <button
              key={floor}
              onClick={() => setSelectedFloor(floor)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                selectedFloor === floor
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {floor}
              {floor !== 'All' && (
                <span className="ml-1.5 text-[10px] opacity-70">
                  ({tables.filter(t => t.floor === floor).length})
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Tables Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-orange-500 border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-300">
          <Table2 size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">No tables yet</p>
          <p className="text-gray-400 text-sm mt-1">
            {allFloors.length === 0
              ? 'First add floors via "Manage Floors", then add tables'
              : 'Click "Add Table" to add tables'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {filtered.map(table => {
            const isOccupied = Number(table.has_pending_order) > 0;
            return (
              <div
                key={table.table_id}
                className={`relative rounded-2xl border-2 p-4 text-center transition-all ${
                  isOccupied ? 'border-red-300 bg-red-50' : 'border-green-300 bg-green-50'
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2 ${
                  isOccupied ? 'bg-red-200' : 'bg-green-200'
                }`}>
                  <Table2 size={20} className={isOccupied ? 'text-red-600' : 'text-green-600'} />
                </div>
                <div className="font-black text-gray-800 text-sm">{table.table_name}</div>
                {table.floor && (
                  <div className="text-[10px] text-gray-400 mt-0.5">{table.floor}</div>
                )}
                <div className="text-xs text-gray-500 mt-0.5 flex items-center justify-center gap-1">
                  <Users size={10} /> {table.capacity} seats
                </div>
                <div className={`text-xs font-semibold mt-1 ${isOccupied ? 'text-red-600' : 'text-green-600'}`}>
                  {isOccupied ? 'Occupied' : 'Available'}
                </div>
                <div className="flex items-center justify-center gap-1.5 mt-2">
                  <button
                    onClick={() => openEdit(table)}
                    className="p-1.5 rounded-lg bg-white text-blue-500 hover:bg-blue-50 border border-blue-200 transition-colors"
                  >
                    <Edit2 size={12} />
                  </button>
                  <button
                    onClick={() => handleDelete(table)}
                    className="p-1.5 rounded-lg bg-white text-red-500 hover:bg-red-50 border border-red-200 transition-colors"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Manage Floors Modal ── */}
      {showFloorModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowFloorModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Layers size={18} className="text-orange-500" /> Floors / Areas / Sections
              </h3>
              <button onClick={() => setShowFloorModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>

            {/* Add new floor */}
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                placeholder="e.g. Ground Floor, Rooftop..."
                value={newFloorName}
                onChange={e => setNewFloorName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addFloor()}
                className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                autoFocus
              />
              <button
                onClick={addFloor}
                className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-semibold text-sm transition-colors"
              >
                Add
              </button>
            </div>

            {/* Floor list */}
            {allFloors.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-4">No floors yet — type a name and click Add</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {allFloors.map(floor => {
                  const count = tables.filter(t => t.floor === floor).length;
                  return (
                    <div key={floor} className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2.5">
                      <div>
                        <span className="font-semibold text-gray-800 text-sm">{floor}</span>
                        <span className="text-xs text-gray-400 ml-2">{count} table{count !== 1 ? 's' : ''}</span>
                      </div>
                      <button
                        onClick={() => deleteFloor(floor)}
                        className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete floor"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <button
              onClick={() => setShowFloorModal(false)}
              className="w-full mt-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold text-sm transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* ── Add / Edit Table Modal ── */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold text-gray-900">{editingTable ? 'Edit Table' : 'Add New Table'}</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Table Name / Number *</label>
                <input
                  type="text"
                  value={form.table_name}
                  onChange={e => setForm(f => ({ ...f, table_name: e.target.value }))}
                  placeholder="e.g. T-01, Window Table, VIP Booth"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                  Floor / Area / Section
                  {allFloors.length === 0 && (
                    <span className="text-orange-500 ml-1">(add floors via Manage Floors)</span>
                  )}
                </label>
                <input
                  type="text"
                  list="floor-options"
                  value={form.floor}
                  onChange={e => setForm(f => ({ ...f, floor: e.target.value }))}
                  placeholder="Select or type a floor name"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                />
                <datalist id="floor-options">
                  {allFloors.map(floor => <option key={floor} value={floor} />)}
                </datalist>
                {allFloors.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {allFloors.map(floor => (
                      <button
                        key={floor}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, floor }))}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                          form.floor === floor
                            ? 'bg-orange-500 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-orange-100 hover:text-orange-700'
                        }`}
                      >
                        {floor}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Seating Capacity</label>
                <input
                  type="number"
                  value={form.capacity}
                  onChange={e => setForm(f => ({ ...f, capacity: e.target.value }))}
                  min="1" max="50"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl font-semibold text-sm hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving}
                className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2"
              >
                {saving ? 'Saving...' : <><Check size={15} /> {editingTable ? 'Update' : 'Add Table'}</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TableManagement;
