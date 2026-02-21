import { useState, useEffect, useCallback } from 'react';
import { FileText, Plus, Search, Eye, Edit2, Printer, Trash2, X, Send, CheckCircle, DollarSign, AlertTriangle, FileCheck } from 'lucide-react';
import api from '../utils/api';
import Pagination from '../components/Pagination';
import InvoicePrintModal from '../components/InvoicePrintModal';

interface InvoiceItem {
  item_id?: number;
  product_id: number;
  variant_id?: number;
  product_name?: string;
  description?: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface Invoice {
  invoice_id: number;
  invoice_number: string;
  sale_id: number | null;
  customer_id: number;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  subtotal: number;
  tax_amount: number;
  discount: number;
  total_amount: number;
  status: string;
  due_date: string | null;
  payment_terms: string;
  notes: string;
  created_by_name: string;
  created_at: string;
  items?: InvoiceItem[];
}

interface Stats {
  outstanding: number;
  overdue_count: number;
  draft_count: number;
  total_invoices: number;
  paid_this_month: number;
}

const STATUS_BADGES: Record<string, { label: string; bg: string; text: string }> = {
  draft: { label: 'Draft', bg: 'bg-gray-100', text: 'text-gray-700' },
  sent: { label: 'Sent', bg: 'bg-blue-100', text: 'text-blue-700' },
  paid: { label: 'Paid', bg: 'bg-green-100', text: 'text-green-700' },
  partial: { label: 'Partial', bg: 'bg-yellow-100', text: 'text-yellow-700' },
  overdue: { label: 'Overdue', bg: 'bg-red-100', text: 'text-red-700' },
  cancelled: { label: 'Cancelled', bg: 'bg-gray-100', text: 'text-gray-400 line-through' },
};

const Invoices = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [stats, setStats] = useState<Stats>({ outstanding: 0, overdue_count: 0, draft_count: 0, total_invoices: 0, paid_this_month: 0 });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const [showCreate, setShowCreate] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [showPrint, setShowPrint] = useState(false);
  const [showFromSale, setShowFromSale] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [editMode, setEditMode] = useState(false);

  // Create form
  const [formCustomerId, setFormCustomerId] = useState('');
  const [formItems, setFormItems] = useState<InvoiceItem[]>([{ product_id: 0, quantity: 1, unit_price: 0, total_price: 0, description: '' }]);
  const [formDiscount, setFormDiscount] = useState(0);
  const [formTax, setFormTax] = useState(0);
  const [formDueDate, setFormDueDate] = useState('');
  const [formTerms, setFormTerms] = useState('Due on Receipt');
  const [formNotes, setFormNotes] = useState('');
  const [saleId, setSaleId] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchInvoices = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (search) params.append('search', search);
      if (statusFilter) params.append('status', statusFilter);
      const res = await api.get(`/invoices?${params}`);
      setInvoices(res.data.data);
      setTotalPages(res.data.pagination.totalPages);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [page, search, statusFilter]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get('/invoices/stats');
      setStats(res.data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);
  useEffect(() => { fetchStats(); }, [fetchStats]);

  const handleViewDetail = async (inv: Invoice) => {
    try {
      const res = await api.get(`/invoices/${inv.invoice_id}`);
      setSelectedInvoice(res.data);
      setShowDetail(true);
    } catch { /* ignore */ }
  };

  const handleEdit = async (inv: Invoice) => {
    try {
      const res = await api.get(`/invoices/${inv.invoice_id}`);
      const data = res.data;
      setSelectedInvoice(data);
      setFormCustomerId(String(data.customer_id));
      setFormItems(data.items && data.items.length > 0 ? data.items : [{ product_id: 0, quantity: 1, unit_price: 0, total_price: 0, description: '' }]);
      setFormDiscount(data.discount || 0);
      setFormTax(data.tax_amount || 0);
      setFormDueDate(data.due_date ? data.due_date.split('T')[0] : '');
      setFormTerms(data.payment_terms || 'Due on Receipt');
      setFormNotes(data.notes || '');
      setEditMode(true);
      setShowCreate(true);
    } catch { /* ignore */ }
  };

  const resetForm = () => {
    setFormCustomerId('');
    setFormItems([{ product_id: 0, quantity: 1, unit_price: 0, total_price: 0, description: '' }]);
    setFormDiscount(0);
    setFormTax(0);
    setFormDueDate('');
    setFormTerms('Due on Receipt');
    setFormNotes('');
    setEditMode(false);
    setSelectedInvoice(null);
  };

  const handleSave = async () => {
    if (!formCustomerId || formItems.length === 0) return;
    setSaving(true);
    try {
      const payload = {
        customer_id: parseInt(formCustomerId),
        items: formItems.map(i => ({
          product_id: i.product_id,
          variant_id: i.variant_id || null,
          description: i.description,
          quantity: i.quantity,
          unit_price: i.unit_price,
        })),
        discount: formDiscount,
        tax_amount: formTax,
        due_date: formDueDate || null,
        payment_terms: formTerms,
        notes: formNotes,
      };

      if (editMode && selectedInvoice) {
        await api.put(`/invoices/${selectedInvoice.invoice_id}`, payload);
      } else {
        await api.post('/invoices', payload);
      }
      setShowCreate(false);
      resetForm();
      fetchInvoices();
      fetchStats();
    } catch { /* ignore */ } finally { setSaving(false); }
  };

  const handleStatusChange = async (id: number, status: string) => {
    try {
      await api.put(`/invoices/${id}/status`, { status });
      fetchInvoices();
      fetchStats();
    } catch { /* ignore */ }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this draft invoice?')) return;
    try {
      await api.delete(`/invoices/${id}`);
      fetchInvoices();
      fetchStats();
    } catch { /* ignore */ }
  };

  const handleFromSale = async () => {
    if (!saleId) return;
    setSaving(true);
    try {
      await api.post(`/invoices/from-sale/${saleId}`);
      setShowFromSale(false);
      setSaleId('');
      fetchInvoices();
      fetchStats();
    } catch { /* ignore */ } finally { setSaving(false); }
  };

  const updateItem = (index: number, field: string, value: any) => {
    const updated = [...formItems];
    (updated[index] as any)[field] = value;
    if (field === 'quantity' || field === 'unit_price') {
      updated[index].total_price = Math.round((updated[index].quantity * updated[index].unit_price + Number.EPSILON) * 100) / 100;
    }
    setFormItems(updated);
  };

  const addItem = () => {
    setFormItems([...formItems, { product_id: 0, quantity: 1, unit_price: 0, total_price: 0, description: '' }]);
  };

  const removeItem = (index: number) => {
    if (formItems.length <= 1) return;
    setFormItems(formItems.filter((_, i) => i !== index));
  };

  const calcSubtotal = () => formItems.reduce((s, i) => s + i.total_price, 0);
  const calcTotal = () => Math.round((calcSubtotal() + formTax - formDiscount + Number.EPSILON) * 100) / 100;

  const fmt = (n: number) => `Rs ${Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 2 })}`;
  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('en-PK') : '-';

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Invoices</h1>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg"><FileText className="w-5 h-5 text-blue-600" /></div>
            <div>
              <p className="text-sm text-gray-500">Total Invoices</p>
              <p className="text-xl font-bold text-gray-800">{stats.total_invoices}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-50 rounded-lg"><DollarSign className="w-5 h-5 text-orange-600" /></div>
            <div>
              <p className="text-sm text-gray-500">Outstanding</p>
              <p className="text-xl font-bold text-orange-600">{fmt(stats.outstanding)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-50 rounded-lg"><AlertTriangle className="w-5 h-5 text-red-600" /></div>
            <div>
              <p className="text-sm text-gray-500">Overdue</p>
              <p className="text-xl font-bold text-red-600">{stats.overdue_count}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-50 rounded-lg"><Edit2 className="w-5 h-5 text-gray-600" /></div>
            <div>
              <p className="text-sm text-gray-500">Drafts</p>
              <p className="text-xl font-bold text-gray-800">{stats.draft_count}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-50 rounded-lg"><CheckCircle className="w-5 h-5 text-green-600" /></div>
            <div>
              <p className="text-sm text-gray-500">Paid This Month</p>
              <p className="text-xl font-bold text-green-600">{fmt(stats.paid_this_month)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search invoices..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="paid">Paid</option>
            <option value="partial">Partial</option>
            <option value="overdue">Overdue</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <button onClick={() => setShowFromSale(true)} className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 flex items-center gap-2">
            <FileCheck className="w-4 h-4" /> From Sale
          </button>
          <button onClick={() => { resetForm(); setShowCreate(true); }} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2">
            <Plus className="w-4 h-4" /> Create Invoice
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400">Loading...</div>
        ) : invoices.length === 0 ? (
          <div className="p-12 text-center text-gray-400">No invoices found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Invoice #</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Customer</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Amount</th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Status</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Due Date</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Terms</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Created</th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {invoices.map(inv => {
                  const badge = STATUS_BADGES[inv.status] || STATUS_BADGES.draft;
                  return (
                    <tr key={inv.invoice_id} className="hover:bg-gray-50">
                      <td className="py-3 px-4 font-medium text-blue-600">{inv.invoice_number}</td>
                      <td className="py-3 px-4 text-gray-700">{inv.customer_name}</td>
                      <td className="py-3 px-4 text-right font-semibold">{fmt(inv.total_amount)}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>{badge.label}</span>
                      </td>
                      <td className="py-3 px-4 text-gray-600">{fmtDate(inv.due_date || '')}</td>
                      <td className="py-3 px-4 text-gray-600 text-sm">{inv.payment_terms}</td>
                      <td className="py-3 px-4 text-gray-600 text-sm">{fmtDate(inv.created_at)}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => handleViewDetail(inv)} className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded" title="View">
                            <Eye className="w-4 h-4" />
                          </button>
                          {inv.status === 'draft' && (
                            <button onClick={() => handleEdit(inv)} className="p-1.5 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 rounded" title="Edit">
                              <Edit2 className="w-4 h-4" />
                            </button>
                          )}
                          <button onClick={() => { setSelectedInvoice(inv); setShowPrint(true); }} className="p-1.5 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded" title="Print">
                            <Printer className="w-4 h-4" />
                          </button>
                          {inv.status === 'draft' && (
                            <button onClick={() => handleStatusChange(inv.invoice_id, 'sent')} className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded" title="Send">
                              <Send className="w-4 h-4" />
                            </button>
                          )}
                          {(inv.status === 'sent' || inv.status === 'partial') && (
                            <button onClick={() => handleStatusChange(inv.invoice_id, 'paid')} className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded" title="Mark Paid">
                              <CheckCircle className="w-4 h-4" />
                            </button>
                          )}
                          {inv.status === 'draft' && (
                            <button onClick={() => handleDelete(inv.invoice_id)} className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded" title="Delete">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
      </div>

      {/* Create/Edit Invoice Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-bold">{editMode ? 'Edit Invoice' : 'Create Invoice'}</h2>
              <button onClick={() => { setShowCreate(false); resetForm(); }} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Customer ID</label>
                  <input type="number" value={formCustomerId} onChange={e => setFormCustomerId(e.target.value)} className="w-full px-3 py-2 border rounded-lg" placeholder="Customer ID" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                  <input type="date" value={formDueDate} onChange={e => setFormDueDate(e.target.value)} className="w-full px-3 py-2 border rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Payment Terms</label>
                  <input type="text" value={formTerms} onChange={e => setFormTerms(e.target.value)} className="w-full px-3 py-2 border rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <input type="text" value={formNotes} onChange={e => setFormNotes(e.target.value)} className="w-full px-3 py-2 border rounded-lg" placeholder="Optional" />
                </div>
              </div>

              {/* Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-semibold text-gray-700">Items</label>
                  <button onClick={addItem} className="text-sm text-blue-600 hover:text-blue-700 font-medium">+ Add Item</button>
                </div>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="py-2 px-3 text-left">Product ID</th>
                        <th className="py-2 px-3 text-left">Description</th>
                        <th className="py-2 px-3 text-right w-20">Qty</th>
                        <th className="py-2 px-3 text-right w-28">Price</th>
                        <th className="py-2 px-3 text-right w-28">Total</th>
                        <th className="py-2 px-3 w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {formItems.map((item, idx) => (
                        <tr key={idx} className="border-t">
                          <td className="py-2 px-3"><input type="number" value={item.product_id || ''} onChange={e => updateItem(idx, 'product_id', parseInt(e.target.value) || 0)} className="w-full px-2 py-1 border rounded" /></td>
                          <td className="py-2 px-3"><input type="text" value={item.description || ''} onChange={e => updateItem(idx, 'description', e.target.value)} className="w-full px-2 py-1 border rounded" /></td>
                          <td className="py-2 px-3"><input type="number" min={1} value={item.quantity} onChange={e => updateItem(idx, 'quantity', parseInt(e.target.value) || 1)} className="w-full px-2 py-1 border rounded text-right" /></td>
                          <td className="py-2 px-3"><input type="number" min={0} step="0.01" value={item.unit_price} onChange={e => updateItem(idx, 'unit_price', parseFloat(e.target.value) || 0)} className="w-full px-2 py-1 border rounded text-right" /></td>
                          <td className="py-2 px-3 text-right font-medium">{fmt(item.total_price)}</td>
                          <td className="py-2 px-3"><button onClick={() => removeItem(idx)} className="text-red-500 hover:text-red-700"><X className="w-4 h-4" /></button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Totals */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Discount</label>
                  <input type="number" min={0} step="0.01" value={formDiscount} onChange={e => setFormDiscount(parseFloat(e.target.value) || 0)} className="w-full px-3 py-2 border rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tax</label>
                  <input type="number" min={0} step="0.01" value={formTax} onChange={e => setFormTax(parseFloat(e.target.value) || 0)} className="w-full px-3 py-2 border rounded-lg" />
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 text-right space-y-1">
                <p className="text-sm text-gray-600">Subtotal: <span className="font-semibold">{fmt(calcSubtotal())}</span></p>
                <p className="text-sm text-gray-600">Tax: <span className="font-semibold">{fmt(formTax)}</span></p>
                <p className="text-sm text-gray-600">Discount: <span className="font-semibold text-red-600">-{fmt(formDiscount)}</span></p>
                <p className="text-lg font-bold text-gray-800">Total: {fmt(calcTotal())}</p>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t">
              <button onClick={() => { setShowCreate(false); resetForm(); }} className="px-4 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={handleSave} disabled={saving || !formCustomerId} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Saving...' : editMode ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetail && selectedInvoice && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <div>
                <h2 className="text-lg font-bold">{selectedInvoice.invoice_number}</h2>
                <p className="text-sm text-gray-500">{fmtDate(selectedInvoice.created_at)}</p>
              </div>
              <div className="flex items-center gap-2">
                {(() => { const b = STATUS_BADGES[selectedInvoice.status] || STATUS_BADGES.draft; return <span className={`px-3 py-1 rounded-full text-sm font-medium ${b.bg} ${b.text}`}>{b.label}</span>; })()}
                <button onClick={() => setShowDetail(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-gray-500">Customer:</span> <span className="font-medium">{selectedInvoice.customer_name}</span></div>
                <div><span className="text-gray-500">Due Date:</span> <span className="font-medium">{fmtDate(selectedInvoice.due_date || '')}</span></div>
                <div><span className="text-gray-500">Terms:</span> <span className="font-medium">{selectedInvoice.payment_terms}</span></div>
                <div><span className="text-gray-500">Created by:</span> <span className="font-medium">{selectedInvoice.created_by_name}</span></div>
              </div>
              {selectedInvoice.notes && <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">{selectedInvoice.notes}</p>}

              {/* Items table */}
              <table className="w-full text-sm border rounded-lg overflow-hidden">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="py-2 px-3 text-left">#</th>
                    <th className="py-2 px-3 text-left">Product</th>
                    <th className="py-2 px-3 text-right">Qty</th>
                    <th className="py-2 px-3 text-right">Price</th>
                    <th className="py-2 px-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedInvoice.items?.map((item, i) => (
                    <tr key={i} className="border-t">
                      <td className="py-2 px-3">{i + 1}</td>
                      <td className="py-2 px-3">{item.product_name || item.description || `Product #${item.product_id}`}</td>
                      <td className="py-2 px-3 text-right">{item.quantity}</td>
                      <td className="py-2 px-3 text-right">{fmt(item.unit_price)}</td>
                      <td className="py-2 px-3 text-right font-medium">{fmt(item.total_price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="text-right space-y-1">
                <p className="text-sm text-gray-600">Subtotal: {fmt(selectedInvoice.subtotal)}</p>
                {selectedInvoice.tax_amount > 0 && <p className="text-sm text-gray-600">Tax: {fmt(selectedInvoice.tax_amount)}</p>}
                {selectedInvoice.discount > 0 && <p className="text-sm text-red-600">Discount: -{fmt(selectedInvoice.discount)}</p>}
                <p className="text-xl font-bold">{fmt(selectedInvoice.total_amount)}</p>
              </div>
            </div>
            <div className="flex justify-end gap-2 p-6 border-t">
              {selectedInvoice.status === 'draft' && (
                <button onClick={() => { handleStatusChange(selectedInvoice.invoice_id, 'sent'); setShowDetail(false); }} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2">
                  <Send className="w-4 h-4" /> Send
                </button>
              )}
              {(selectedInvoice.status === 'sent' || selectedInvoice.status === 'partial') && (
                <button onClick={() => { handleStatusChange(selectedInvoice.invoice_id, 'paid'); setShowDetail(false); }} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" /> Mark Paid
                </button>
              )}
              <button onClick={() => { setShowDetail(false); setSelectedInvoice(selectedInvoice); setShowPrint(true); }} className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2">
                <Printer className="w-4 h-4" /> Print
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print Modal */}
      {showPrint && selectedInvoice && (
        <InvoicePrintModal invoiceId={selectedInvoice.invoice_id} onClose={() => setShowPrint(false)} />
      )}

      {/* From Sale Modal */}
      {showFromSale && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-bold">Generate Invoice from Sale</h2>
              <button onClick={() => { setShowFromSale(false); setSaleId(''); }} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">Sale ID</label>
              <input type="number" value={saleId} onChange={e => setSaleId(e.target.value)} className="w-full px-3 py-2 border rounded-lg" placeholder="Enter Sale ID" />
            </div>
            <div className="flex justify-end gap-3 p-6 border-t">
              <button onClick={() => { setShowFromSale(false); setSaleId(''); }} className="px-4 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={handleFromSale} disabled={saving || !saleId} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Generating...' : 'Generate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Invoices;
