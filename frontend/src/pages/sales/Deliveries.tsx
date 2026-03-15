import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Truck, Plus, Search, X, Edit2, Trash2, CheckCircle,
  Clock, MapPin, Phone, User, Calendar, DollarSign, Loader2,
  RefreshCw, Package, XCircle, Navigation, ChevronRight,
  Save, List, ShoppingCart, CreditCard,
} from 'lucide-react';
import api from '../../utils/api';
import Pagination from '../../components/Pagination';
import { useToast } from '../../components/Toast';
import { localToday, localMonthStart } from '../../utils/dateUtils';

type Status = 'pending' | 'assigned' | 'dispatched' | 'in_transit' | 'delivered' | 'failed' | 'cancelled';

interface Delivery {
  delivery_id: number;
  delivery_number: string;
  sale_id: number | null;
  customer_id: number;
  customer_name: string;
  customer_phone: string;
  delivery_address: string;
  delivery_city: string;
  delivery_phone: string;
  rider_name: string;
  rider_phone: string;
  status: Status;
  delivery_charges: number;
  estimated_delivery: string | null;
  actual_delivery: string | null;
  notes: string;
  created_by_name: string;
  created_at: string;
  sale_status?: string;
  sale_total_amount?: number;
}

interface Stats {
  total: number; pending: number; assigned: number;
  dispatched: number; in_transit: number; delivered: number;
  failed: number; cancelled: number;
  delivered_today: number; monthly_charges: number;
}

interface Customer { customer_id: number; customer_name: string; phone_number: string; }

const STATUS_CONFIG: Record<Status, { label: string; color: string; bg: string; border: string; icon: any }> = {
  pending:    { label: 'Pending',    color: 'text-gray-600',    bg: 'bg-gray-100',    border: 'border-gray-300',   icon: Clock },
  assigned:   { label: 'Assigned',   color: 'text-blue-700',    bg: 'bg-blue-100',    border: 'border-blue-500',   icon: User },
  dispatched: { label: 'Dispatched', color: 'text-amber-700',   bg: 'bg-amber-100',   border: 'border-amber-500',  icon: Package },
  in_transit: { label: 'In Transit', color: 'text-orange-700',  bg: 'bg-orange-100',  border: 'border-orange-500', icon: Navigation },
  delivered:  { label: 'Delivered',  color: 'text-emerald-700', bg: 'bg-emerald-100', border: 'border-emerald-500',icon: CheckCircle },
  failed:     { label: 'Failed',     color: 'text-red-700',     bg: 'bg-red-100',     border: 'border-red-400',    icon: XCircle },
  cancelled:  { label: 'Cancelled',  color: 'text-gray-500',    bg: 'bg-gray-100',    border: 'border-gray-300',   icon: X },
};

const RUNNING: Status[] = ['pending', 'assigned', 'dispatched', 'in_transit'];

const StatusBadge = ({ status }: { status: Status }) => {
  const c = STATUS_CONFIG[status];
  const Icon = c.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${c.bg} ${c.color}`}>
      <Icon size={11} />{c.label}
    </span>
  );
};

const emptyForm = () => ({
  customer_id: '', sale_id: '', delivery_address: '', delivery_city: '',
  delivery_phone: '', rider_name: '', rider_phone: '',
  delivery_charges: '', estimated_delivery: '', notes: '',
});

// ── Running Order Card ───────────────────────────────────────────────────────
interface CardProps {
  delivery: Delivery;
  onStatusChange: (id: number, status: Status) => void;
  onEdit: (d: Delivery) => void;
  onDelete: (d: Delivery) => void;
  onRefresh: () => void;
  onEditOrder: (d: Delivery) => void;
  onPay: (d: Delivery) => void;
  updatingStatus: number | null;
}

const RunningCard = ({ delivery: d, onStatusChange, onEdit, onDelete, onRefresh, onEditOrder, onPay, updatingStatus }: CardProps) => {
  const toast = useToast();
  const [showRiderForm, setShowRiderForm] = useState(false);
  const [riderName, setRiderName] = useState('');
  const [riderPhone, setRiderPhone] = useState('');
  const [savingRider, setSavingRider] = useState(false);

  const cfg = STATUS_CONFIG[d.status];
  const isUpdating = updatingStatus === d.delivery_id;

  const saveRider = async () => {
    if (!riderName.trim()) return;
    setSavingRider(true);
    try {
      await api.put(`/deliveries/${d.delivery_id}`, {
        delivery_address: d.delivery_address,
        delivery_city: d.delivery_city,
        delivery_phone: d.delivery_phone,
        rider_name: riderName.trim(),
        rider_phone: riderPhone.trim(),
        delivery_charges: d.delivery_charges,
        estimated_delivery: d.estimated_delivery,
        notes: d.notes,
        status: d.status,
      });
      toast.success('Rider assigned');
      setShowRiderForm(false);
      onRefresh();
    } catch {
      toast.error('Failed to assign rider');
    } finally {
      setSavingRider(false);
    }
  };

  const openRiderForm = (prefill = false) => {
    setRiderName(prefill ? d.rider_name : '');
    setRiderPhone(prefill ? d.rider_phone : '');
    setShowRiderForm(true);
  };

  // Next-status buttons
  const nextStatuses: { status: Status; label: string; cls: string }[] = [];
  if (d.status === 'pending' || d.status === 'assigned')
    nextStatuses.push({ status: 'dispatched', label: 'Dispatch →', cls: 'bg-amber-500 hover:bg-amber-600 text-white' });
  if (d.status === 'dispatched')
    nextStatuses.push({ status: 'in_transit', label: 'In Transit →', cls: 'bg-orange-500 hover:bg-orange-600 text-white' });
  if (d.status === 'in_transit') {
    nextStatuses.push({ status: 'delivered', label: '✓ Delivered', cls: 'bg-emerald-600 hover:bg-emerald-700 text-white' });
    nextStatuses.push({ status: 'failed',    label: '✗ Failed',    cls: 'bg-red-500 hover:bg-red-600 text-white' });
  }

  const fmtDate = (v: string | null) =>
    v ? new Date(v).toLocaleDateString('en-PK', { day: '2-digit', month: 'short' }) : null;

  return (
    <div className={`bg-white rounded-xl border border-gray-200 border-l-4 shadow-sm hover:shadow-md transition-all flex flex-col ${cfg.border}`}>
      {/* Header */}
      <div className="px-4 pt-3.5 pb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-mono text-xs font-bold text-gray-400">{d.delivery_number}</span>
            {d.sale_id && (
              <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-medium">Sale #{d.sale_id}</span>
            )}
          </div>
          <p className="font-bold text-gray-900 text-sm truncate">{d.customer_name}</p>
        </div>
        <StatusBadge status={d.status} />
      </div>

      {/* Address */}
      <div className="px-4 py-2 border-t border-gray-50 space-y-1">
        <div className="flex items-start gap-2">
          <MapPin size={13} className="text-gray-400 mt-0.5 shrink-0" />
          <p className="text-xs text-gray-700 leading-snug">
            {d.delivery_address}
            {d.delivery_city && <span className="text-gray-400">, {d.delivery_city}</span>}
          </p>
        </div>
        {(d.delivery_phone || d.customer_phone) && (
          <div className="flex items-center gap-2">
            <Phone size={11} className="text-gray-400 shrink-0" />
            <span className="text-xs text-gray-500">{d.delivery_phone || d.customer_phone}</span>
          </div>
        )}
      </div>

      {/* Rider */}
      <div className="px-4 py-2.5 border-t border-gray-50">
        {!showRiderForm ? (
          d.rider_name ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xs shrink-0">
                  {d.rider_name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">{d.rider_name}</p>
                  {d.rider_phone && <p className="text-xs text-gray-400">{d.rider_phone}</p>}
                </div>
              </div>
              <button onClick={() => openRiderForm(true)} className="text-xs text-blue-500 hover:text-blue-700 font-medium transition-colors">
                Change
              </button>
            </div>
          ) : (
            <button
              onClick={() => openRiderForm(false)}
              className="w-full flex items-center justify-center gap-2 py-2 border border-dashed border-blue-300 text-blue-500 hover:bg-blue-50 rounded-lg text-xs font-semibold transition-all"
            >
              <User size={13} /> Assign Rider
            </button>
          )
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <input
                className="form-input text-xs py-1.5"
                placeholder="Rider name *"
                value={riderName}
                onChange={e => setRiderName(e.target.value)}
                autoFocus
              />
              <input
                className="form-input text-xs py-1.5"
                placeholder="Phone"
                value={riderPhone}
                onChange={e => setRiderPhone(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowRiderForm(false)}
                className="flex-1 py-1.5 text-xs text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={saveRider}
                disabled={!riderName.trim() || savingRider}
                className="flex-1 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all disabled:opacity-50 flex items-center justify-center gap-1"
              >
                {savingRider ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
                Save
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer — meta info */}
      <div className="px-4 py-2 border-t border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs text-gray-400">
          {Number(d.delivery_charges) > 0 && (
            <span className="flex items-center gap-1 font-semibold text-gray-600">
              <DollarSign size={11} />Rs. {Number(d.delivery_charges).toLocaleString()}
            </span>
          )}
          {d.estimated_delivery && (
            <span className="flex items-center gap-1">
              <Calendar size={11} />Est. {fmtDate(d.estimated_delivery)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => onEdit(d)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all" title="Edit delivery details">
            <Edit2 size={13} />
          </button>
          {['pending', 'cancelled'].includes(d.status) && (
            <button onClick={() => onDelete(d)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all" title="Delete">
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Sale Actions (only when linked to a sale) */}
      {d.sale_id && (
        <div className="px-3 pb-2 flex gap-2 border-t border-gray-50 pt-2">
          <button
            onClick={() => onEditOrder(d)}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-800 rounded-lg transition-all"
          >
            <ShoppingCart size={12} /> Edit Order
          </button>
          {d.sale_status === 'pending' && (
            <button
              onClick={() => onPay(d)}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-all"
            >
              <CreditCard size={12} /> Collect Payment
            </button>
          )}
          {d.sale_status === 'completed' && (
            <span className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold bg-emerald-50 text-emerald-600 rounded-lg border border-emerald-200">
              <CheckCircle size={12} /> Paid
            </span>
          )}
        </div>
      )}

      {/* Status Progression */}
      {nextStatuses.length > 0 && (
        <div className="px-3 pb-3 flex gap-2">
          {nextStatuses.map(ns => (
            <button
              key={ns.status}
              onClick={() => onStatusChange(d.delivery_id, ns.status)}
              disabled={isUpdating}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all disabled:opacity-50 ${ns.cls}`}
            >
              {isUpdating ? <Loader2 size={11} className="animate-spin" /> : <ChevronRight size={12} />}
              {ns.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Edit Drawer ──────────────────────────────────────────────────────────────
interface DrawerProps {
  delivery: Delivery;
  form: ReturnType<typeof emptyForm>;
  setForm: (f: ReturnType<typeof emptyForm>) => void;
  saving: boolean;
  onSave: () => void;
  onClose: () => void;
}

const EditDrawer = ({ delivery: d, form, setForm, saving, onSave, onClose }: DrawerProps) => {
  const set = (k: string, v: string) => setForm({ ...form, [k]: v });
  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 w-96 bg-white shadow-2xl z-50 flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50 shrink-0">
          <div>
            <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
              <Truck size={16} className="text-emerald-600" />{d.delivery_number}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">{d.customer_name}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-lg transition-all"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div>
            <label className="form-label">Delivery Address <span className="text-red-500">*</span></label>
            <textarea className="form-input resize-none" rows={2} value={form.delivery_address} onChange={e => set('delivery_address', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">City</label>
              <input className="form-input" value={form.delivery_city} onChange={e => set('delivery_city', e.target.value)} />
            </div>
            <div>
              <label className="form-label">Contact Phone</label>
              <input className="form-input" value={form.delivery_phone} onChange={e => set('delivery_phone', e.target.value)} />
            </div>
          </div>

          <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 space-y-3">
            <p className="text-xs font-semibold text-blue-700 flex items-center gap-1.5"><User size={13} />Rider Info</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label">Rider Name</label>
                <input className="form-input" placeholder="Full name" value={form.rider_name} onChange={e => set('rider_name', e.target.value)} />
              </div>
              <div>
                <label className="form-label">Rider Phone</label>
                <input className="form-input" placeholder="03xx-xxxxxxx" value={form.rider_phone} onChange={e => set('rider_phone', e.target.value)} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Delivery Charges (Rs.)</label>
              <input className="form-input" type="number" min="0" value={form.delivery_charges} onChange={e => set('delivery_charges', e.target.value)} />
            </div>
            <div>
              <label className="form-label">Est. Delivery Date</label>
              <input className="form-input" type="date" value={form.estimated_delivery} onChange={e => set('estimated_delivery', e.target.value)} />
            </div>
          </div>

          <div>
            <label className="form-label">Notes</label>
            <textarea className="form-input resize-none" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>
        </div>

        <div className="px-5 py-4 border-t border-gray-100 flex gap-3 shrink-0">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 text-sm border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-xl transition-all">
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-xl transition-all disabled:opacity-60"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            Save Changes
          </button>
        </div>
      </div>
    </>
  );
};

// ── Create Modal ─────────────────────────────────────────────────────────────
interface CreateModalProps {
  form: ReturnType<typeof emptyForm>;
  setForm: (f: ReturnType<typeof emptyForm>) => void;
  customers: Customer[];
  custSearch: string;
  setCustSearch: (s: string) => void;
  saving: boolean;
  onSave: () => void;
  onClose: () => void;
}

const DeliveryCreateModal = ({ form, setForm, customers, custSearch, setCustSearch, saving, onSave, onClose }: CreateModalProps) => {
  const set = (k: string, v: string) => setForm({ ...form, [k]: v });
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2"><Truck size={18} className="text-emerald-600" />New Delivery</h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <div>
            <label className="form-label">Customer <span className="text-red-500">*</span></label>
            <div className="relative mb-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input className="form-input pl-8" placeholder="Search customer..." value={custSearch} onChange={e => setCustSearch(e.target.value)} />
            </div>
            <select className="form-select" value={form.customer_id} onChange={e => set('customer_id', e.target.value)}>
              <option value="">— Select Customer —</option>
              {customers.filter(c => c.customer_id !== 1).map(c => (
                <option key={c.customer_id} value={c.customer_id}>{c.customer_name}{c.phone_number ? ` — ${c.phone_number}` : ''}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">Linked Sale ID <span className="text-gray-400 font-normal">(optional)</span></label>
            <input className="form-input" type="number" placeholder="e.g. 1042" value={form.sale_id} onChange={e => set('sale_id', e.target.value)} />
          </div>
          <div>
            <label className="form-label">Delivery Address <span className="text-red-500">*</span></label>
            <textarea className="form-input resize-none" rows={2} value={form.delivery_address} onChange={e => set('delivery_address', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">City</label>
              <input className="form-input" placeholder="e.g. Karachi" value={form.delivery_city} onChange={e => set('delivery_city', e.target.value)} />
            </div>
            <div>
              <label className="form-label">Contact Phone</label>
              <input className="form-input" placeholder="03xx-xxxxxxx" value={form.delivery_phone} onChange={e => set('delivery_phone', e.target.value)} />
            </div>
          </div>
          <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-100 space-y-3">
            <p className="text-sm font-semibold text-blue-700 flex items-center gap-2"><User size={14} />Rider Info</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="form-label">Rider Name</label>
                <input className="form-input" placeholder="Rider full name" value={form.rider_name} onChange={e => set('rider_name', e.target.value)} />
              </div>
              <div>
                <label className="form-label">Rider Phone</label>
                <input className="form-input" placeholder="03xx-xxxxxxx" value={form.rider_phone} onChange={e => set('rider_phone', e.target.value)} />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Delivery Charges (Rs.)</label>
              <input className="form-input" type="number" min="0" placeholder="0" value={form.delivery_charges} onChange={e => set('delivery_charges', e.target.value)} />
            </div>
            <div>
              <label className="form-label">Estimated Delivery Date</label>
              <input className="form-input" type="date" value={form.estimated_delivery} onChange={e => set('estimated_delivery', e.target.value)} />
            </div>
          </div>
          <div>
            <label className="form-label">Notes</label>
            <textarea className="form-input resize-none" rows={2} placeholder="Special instructions..." value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-200 hover:bg-gray-100 rounded-lg transition-all">Cancel</button>
          <button onClick={onSave} disabled={saving} className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-all disabled:opacity-60">
            {saving && <Loader2 size={14} className="animate-spin" />}
            Create Delivery
          </button>
        </div>
      </div>
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════
const Deliveries = () => {
  const toast = useToast();
  const navigate = useNavigate();

  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [stats, setStats]           = useState<Stats | null>(null);
  const [loading, setLoading]       = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [total, setTotal]           = useState(0);
  const [page, setPage]             = useState(1);
  const [limit]                     = useState(20);
  const [view, setView]             = useState<'running' | 'all'>('running');

  const [search, setSearch]     = useState('');
  const [dateFrom, setDateFrom] = useState(localMonthStart());
  const [dateTo, setDateTo]     = useState(localToday());

  const [showCreate, setShowCreate] = useState(false);
  const [editItem, setEditItem]     = useState<Delivery | null>(null);
  const [form, setForm]             = useState(emptyForm());
  const [customers, setCustomers]   = useState<Customer[]>([]);
  const [custSearch, setCustSearch] = useState('');
  const [saving, setSaving]         = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState<number | null>(null);

  const fetchDeliveries = useCallback(async () => {
    setLoading(true);
    try {
      if (view === 'running') {
        const res = await api.get('/deliveries', { params: { limit: 200, search } });
        const all = (res.data.data || []).filter((d: Delivery) => RUNNING.includes(d.status));
        setDeliveries(all);
        setTotal(all.length);
      } else {
        const res = await api.get('/deliveries', {
          params: { page, limit, search, date_from: dateFrom, date_to: dateTo },
        });
        setDeliveries(res.data.data);
        setTotal(res.data.pagination.total);
      }
    } catch {
      toast.error('Failed to load deliveries');
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, view, dateFrom, dateTo]);

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await api.get('/deliveries/stats');
      setStats(res.data);
    } catch { } finally {
      setStatsLoading(false);
    }
  }, []);

  const fetchCustomers = useCallback(async () => {
    try {
      const res = await api.get('/customers', { params: { limit: 200, search: custSearch } });
      setCustomers(res.data.data || []);
    } catch { setCustomers([]); }
  }, [custSearch]);

  useEffect(() => { fetchDeliveries(); }, [fetchDeliveries]);
  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => { if (showCreate) fetchCustomers(); }, [showCreate, fetchCustomers]);

  const handleCreate = async () => {
    if (!form.customer_id) return toast.error('Please select a customer');
    if (!form.delivery_address.trim()) return toast.error('Delivery address is required');
    setSaving(true);
    try {
      const res = await api.post('/deliveries', {
        ...form,
        customer_id: parseInt(form.customer_id),
        sale_id: form.sale_id ? parseInt(form.sale_id) : null,
        delivery_charges: parseFloat(form.delivery_charges || '0'),
      });
      toast.success(`${res.data.delivery_number} created`);
      setShowCreate(false);
      setForm(emptyForm());
      fetchDeliveries(); fetchStats();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to create delivery');
    } finally { setSaving(false); }
  };

  const handleUpdate = async () => {
    if (!editItem) return;
    setSaving(true);
    try {
      await api.put(`/deliveries/${editItem.delivery_id}`, {
        ...form,
        delivery_charges: parseFloat(form.delivery_charges || '0'),
      });
      toast.success('Delivery updated');
      setEditItem(null);
      fetchDeliveries(); fetchStats();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to update delivery');
    } finally { setSaving(false); }
  };

  const handleStatusChange = async (id: number, status: Status) => {
    setUpdatingStatus(id);
    try {
      await api.patch(`/deliveries/${id}/status`, { status });
      toast.success(`→ ${STATUS_CONFIG[status].label}`);
      fetchDeliveries(); fetchStats();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed');
    } finally { setUpdatingStatus(null); }
  };

  const handleDelete = async (d: Delivery) => {
    if (!confirm(`Delete ${d.delivery_number}?`)) return;
    try {
      await api.delete(`/deliveries/${d.delivery_id}`);
      toast.success('Deleted');
      fetchDeliveries(); fetchStats();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Cannot delete');
    }
  };

  const openEdit = (d: Delivery) => {
    setEditItem(d);
    setForm({
      customer_id: String(d.customer_id),
      sale_id: d.sale_id ? String(d.sale_id) : '',
      delivery_address: d.delivery_address,
      delivery_city: d.delivery_city,
      delivery_phone: d.delivery_phone,
      rider_name: d.rider_name,
      rider_phone: d.rider_phone,
      delivery_charges: String(d.delivery_charges),
      estimated_delivery: d.estimated_delivery ? d.estimated_delivery.split('T')[0] : '',
      notes: d.notes,
    });
  };

  const handleEditOrder = (d: Delivery) => {
    if (!d.sale_id) return;
    navigate('/pos', { state: { editOrder: { sale_id: d.sale_id, token_no: d.delivery_number } } });
  };

  const handlePay = (d: Delivery) => {
    if (!d.sale_id) return;
    navigate('/pos', { state: { pendingSale: { sale_id: d.sale_id, total_amount: d.sale_total_amount } } });
  };

  const fmt = (v: string | null) =>
    v ? new Date(v).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  const runningCount = (stats?.pending || 0) + (stats?.assigned || 0) + (stats?.dispatched || 0) + (stats?.in_transit || 0);

  const sortedRunning = [...deliveries].sort((a, b) => RUNNING.indexOf(a.status) - RUNNING.indexOf(b.status));

  return (
    <div className="page-wrapper">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Truck size={22} className="text-emerald-600" /> Deliveries
          </h1>
          <p className="page-subtitle">Assign riders · Track shipments · Update status</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { fetchDeliveries(); fetchStats(); }} className="p-2 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all">
            <RefreshCw size={18} />
          </button>
          <button onClick={() => { setShowCreate(true); setForm(emptyForm()); }} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-sm">
            <Plus size={16} /> New Delivery
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: 'Pending',       value: stats?.pending ?? 0,         color: 'text-gray-600',    bg: 'bg-gray-50',    icon: Clock },
          { label: 'Assigned',      value: stats?.assigned ?? 0,        color: 'text-blue-600',    bg: 'bg-blue-50',    icon: User },
          { label: 'Dispatched',    value: stats?.dispatched ?? 0,      color: 'text-amber-600',   bg: 'bg-amber-50',   icon: Package },
          { label: 'In Transit',    value: stats?.in_transit ?? 0,      color: 'text-orange-600',  bg: 'bg-orange-50',  icon: Navigation },
          { label: 'Delivered Today', value: stats?.delivered_today ?? 0, color: 'text-emerald-600', bg: 'bg-emerald-50', icon: CheckCircle },
        ].map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${s.bg} mb-2`}>
                <Icon size={16} className={s.color} />
              </div>
              <p className="text-2xl font-black text-gray-800">{statsLoading ? '—' : s.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
            </div>
          );
        })}
      </div>

      {/* View Toggle + Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
          <button
            onClick={() => { setView('running'); setPage(1); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${view === 'running' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <Navigation size={14} />
            Running Orders
            {!statsLoading && runningCount > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${view === 'running' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-500'}`}>
                {runningCount}
              </span>
            )}
          </button>
          <button
            onClick={() => { setView('all'); setPage(1); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${view === 'all' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <List size={14} /> All Orders
          </button>
        </div>

        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="form-input pl-9"
            placeholder="Search delivery #, customer, rider..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </div>

        {view === 'all' && (
          <div className="flex items-center gap-2">
            <input type="date" className="form-input w-36" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }} />
            <span className="text-gray-400 text-sm">to</span>
            <input type="date" className="form-input w-36" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }} />
          </div>
        )}
      </div>

      {/* Running Orders Cards */}
      {view === 'running' && (
        loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={28} className="animate-spin text-emerald-500" />
          </div>
        ) : sortedRunning.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col items-center justify-center py-20">
            <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mb-4">
              <CheckCircle size={32} className="text-emerald-400" />
            </div>
            <p className="text-gray-700 font-semibold text-lg">All Clear!</p>
            <p className="text-gray-400 text-sm mt-1">No running deliveries right now</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {sortedRunning.map(d => (
              <RunningCard
                key={d.delivery_id}
                delivery={d}
                onStatusChange={handleStatusChange}
                onEdit={openEdit}
                onDelete={handleDelete}
                onRefresh={fetchDeliveries}
                onEditOrder={handleEditOrder}
                onPay={handlePay}
                updatingStatus={updatingStatus}
              />
            ))}
          </div>
        )
      )}

      {/* All Orders Table */}
      {view === 'all' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="tbl-head">
                <tr>
                  <th className="text-left px-4 py-3">Delivery #</th>
                  <th className="text-left px-4 py-3">Customer</th>
                  <th className="text-left px-4 py-3">Address</th>
                  <th className="text-left px-4 py-3">Rider</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-right px-4 py-3">Charges</th>
                  <th className="text-left px-4 py-3">Date</th>
                  <th className="text-left px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="tbl-body">
                {loading ? (
                  <tr><td colSpan={8} className="text-center py-12 text-gray-400">
                    <Loader2 size={24} className="animate-spin mx-auto mb-2" /><p>Loading...</p>
                  </td></tr>
                ) : deliveries.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-12 text-gray-400">
                    <Truck size={32} className="mx-auto mb-2 opacity-30" /><p>No deliveries found</p>
                  </td></tr>
                ) : deliveries.map(d => (
                  <tr key={d.delivery_id} className="tbl-row">
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs font-semibold text-gray-700">{d.delivery_number}</span>
                      {d.sale_id && <p className="text-xs text-gray-400 mt-0.5">Sale #{d.sale_id}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800 text-sm">{d.customer_name}</p>
                      {d.delivery_phone && <p className="text-xs text-gray-400">{d.delivery_phone}</p>}
                    </td>
                    <td className="px-4 py-3 max-w-[160px]">
                      <p className="text-sm text-gray-700 truncate">{d.delivery_address}</p>
                      {d.delivery_city && <p className="text-xs text-gray-400">{d.delivery_city}</p>}
                    </td>
                    <td className="px-4 py-3">
                      {d.rider_name
                        ? <><p className="text-sm text-gray-700">{d.rider_name}</p>{d.rider_phone && <p className="text-xs text-gray-400">{d.rider_phone}</p>}</>
                        : <span className="text-xs text-gray-400 italic">Not assigned</span>}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={d.status} /></td>
                    <td className="px-4 py-3 text-right text-sm font-semibold text-gray-700">
                      {Number(d.delivery_charges) > 0 ? `Rs. ${Number(d.delivery_charges).toLocaleString()}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{fmt(d.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(d)} className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all" title="Edit">
                          <Edit2 size={15} />
                        </button>
                        {['pending', 'cancelled'].includes(d.status) && (
                          <button onClick={() => handleDelete(d)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all" title="Delete">
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-gray-100">
            <Pagination page={page} totalPages={Math.ceil(total / limit)} onPageChange={setPage} />
          </div>
        </div>
      )}

      {showCreate && (
        <DeliveryCreateModal
          form={form} setForm={setForm}
          customers={customers} custSearch={custSearch} setCustSearch={setCustSearch}
          saving={saving} onSave={handleCreate}
          onClose={() => { setShowCreate(false); setForm(emptyForm()); }}
        />
      )}

      {editItem && (
        <EditDrawer
          delivery={editItem} form={form} setForm={setForm}
          saving={saving} onSave={handleUpdate}
          onClose={() => { setEditItem(null); setForm(emptyForm()); }}
        />
      )}
    </div>
  );
};

export default Deliveries;
