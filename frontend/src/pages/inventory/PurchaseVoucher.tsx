import { useState, useEffect, useCallback } from 'react';
import { Plus, Eye, Trash2, X, Search, ShoppingCart, Printer } from 'lucide-react';
import api from '../../utils/api';
import { printGRN } from '../../utils/printUtils';
import { localToday, localMonthStart } from '../../utils/dateUtils';
import { useToast } from '../../components/Toast';
import DateRangeFilter from '../../components/DateRangeFilter';
import Pagination from '../../components/Pagination';

interface Supplier { supplier_id: number; supplier_name: string; }
interface PO { po_id: number; po_number: string; supplier_id: number; supplier_name: string; }
interface Product { product_id: number; product_name: string; barcode?: string; cost_price?: number; }
interface VoucherItem { product_id: number; product_name: string; quantity_received: number; unit_price: number; }

const PurchaseVoucher = () => {
  const [vouchers, setVouchers]   = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [viewVoucher, setViewVoucher] = useState<any>(null);
  const [dateFrom, setDateFrom]   = useState(localMonthStart());
  const [dateTo, setDateTo]       = useState(localToday());
  const [supplierFilter, setSupplierFilter] = useState('');
  const [page, setPage]           = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const { showToast } = useToast();

  // Form state
  const [mode, setMode]           = useState<'po' | 'manual'>('manual');
  const [pos, setPOs]             = useState<PO[]>([]);
  const [selectedPO, setSelectedPO] = useState('');
  const [formSupplier, setFormSupplier] = useState('');
  const [formDate, setFormDate]   = useState(localToday());
  const [formNotes, setFormNotes] = useState('');
  const [items, setItems]         = useState<VoucherItem[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [productResults, setProductResults] = useState<Product[]>([]);
  const [saving, setSaving]       = useState(false);

  const fetchVouchers = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { from_date: dateFrom, to_date: dateTo, page, limit: 20 };
      if (supplierFilter) params.supplier_id = supplierFilter;
      const res = await api.get('/purchase-vouchers', { params });
      setVouchers(res.data.data || []);
      setTotalPages(res.data.pagination?.totalPages || 1);
      setTotalItems(res.data.pagination?.total || 0);
    } catch { showToast('Failed to load', 'error'); }
    finally { setLoading(false); }
  }, [dateFrom, dateTo, supplierFilter, page]);

  useEffect(() => {
    api.get('/suppliers', { params: { limit: 200 } }).then(r => setSuppliers(r.data.data || []));
    api.get('/purchase-orders', { params: { limit: 200 } }).then(r =>
      setPOs((r.data.data || []).filter((p: any) => p.status !== 'received' && p.status !== 'cancelled'))
    );
  }, []);
  useEffect(() => { fetchVouchers(); }, [fetchVouchers]);

  const loadPOItems = async (poId: string) => {
    if (!poId) { setItems([]); setFormSupplier(''); return; }
    try {
      const res = await api.get(`/purchase-vouchers/po-items/${poId}`);
      const po = pos.find(p => String(p.po_id) === poId);
      if (po) setFormSupplier(String(po.supplier_id));
      setItems((res.data.data || []).map((i: any) => ({
        product_id: i.product_id,
        product_name: i.product_name,
        quantity_received: Number(i.pending_qty) || 1,
        unit_price: Number(i.cost_price) || 0,
      })));
    } catch { showToast('Failed to load PO items', 'error'); }
  };

  const searchProducts = async (q: string) => {
    setProductSearch(q);
    if (q.length < 2) { setProductResults([]); return; }
    const res = await api.get('/products', { params: { search: q, limit: 10 } });
    setProductResults(res.data.data || []);
  };

  const addItem = (p: Product) => {
    if (items.find(i => i.product_id === p.product_id)) return;
    setItems(prev => [...prev, { product_id: p.product_id, product_name: p.product_name, quantity_received: 1, unit_price: Number(p.cost_price || 0) }]);
    setProductSearch(''); setProductResults([]);
  };

  const updateItem = (id: number, field: 'quantity_received' | 'unit_price', val: number) =>
    setItems(prev => prev.map(i => i.product_id === id ? { ...i, [field]: val } : i));

  const resetForm = () => {
    setMode('manual'); setSelectedPO(''); setFormSupplier('');
    setFormDate(localToday()); setFormNotes(''); setItems([]);
    setProductSearch(''); setProductResults([]);
  };

  const handleSubmit = async () => {
    if (!items.length) return showToast('Add at least one item', 'error');
    setSaving(true);
    try {
      const payload: any = {
        supplier_id: formSupplier || null,
        voucher_date: formDate,
        notes: formNotes,
        items,
      };
      if (mode === 'po' && selectedPO) payload.po_id = selectedPO;
      const res = await api.post('/purchase-vouchers', payload);
      showToast(`Purchase Voucher ${res.data.pv_number} created`, 'success');
      setShowForm(false); resetForm(); fetchVouchers();
    } catch (err: any) { showToast(err.response?.data?.message || 'Error', 'error'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this voucher? Stock will be reversed.')) return;
    try { await api.delete(`/purchase-vouchers/${id}`); showToast('Deleted', 'success'); fetchVouchers(); }
    catch (err: any) { showToast(err.response?.data?.message || 'Error', 'error'); }
  };

  const openView = async (id: number) => {
    const res = await api.get(`/purchase-vouchers/${id}`);
    setViewVoucher(res.data);
  };

  const fmt = (n: any) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <ShoppingCart size={20} className="text-indigo-600" /> Purchase Voucher
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Receive goods from PO or create manual purchase entry</p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium">
          <Plus size={18} /> New Voucher
        </button>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center px-6 py-4 border-b">
              <h2 className="font-semibold text-gray-800 text-lg">New Purchase Voucher</h2>
              <button onClick={() => setShowForm(false)}><X size={20} className="text-gray-400" /></button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              {/* Mode tabs */}
              <div className="flex gap-2 mb-5">
                <button onClick={() => { setMode('manual'); setSelectedPO(''); setItems([]); setFormSupplier(''); }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border ${mode === 'manual' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}>
                  Manual Entry
                </button>
                <button onClick={() => setMode('po')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border ${mode === 'po' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}>
                  From Purchase Order
                </button>
              </div>

              {mode === 'po' && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Select Purchase Order *</label>
                  <select value={selectedPO} onChange={e => { setSelectedPO(e.target.value); loadPOItems(e.target.value); }}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none">
                    <option value="">-- Select PO --</option>
                    {pos.map(p => <option key={p.po_id} value={p.po_id}>{p.po_number} — {p.supplier_name}</option>)}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-3 gap-4 mb-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
                  <select value={formSupplier} onChange={e => setFormSupplier(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none">
                    <option value="">-- Select Supplier --</option>
                    {suppliers.map(s => <option key={s.supplier_id} value={s.supplier_id}>{s.supplier_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Voucher Date *</label>
                  <input type="date" value={formDate} onChange={e => setFormDate(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <input type="text" value={formNotes} onChange={e => setFormNotes(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none" placeholder="Optional" />
                </div>
              </div>

              {/* Product Search (manual mode only) */}
              {mode === 'manual' && (
                <div className="relative mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Add Products</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input type="text" value={productSearch} onChange={e => searchProducts(e.target.value)}
                      placeholder="Search by name or barcode..."
                      className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                  </div>
                  {productResults.length > 0 && (
                    <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
                      {productResults.map(p => (
                        <button key={p.product_id} onClick={() => addItem(p)}
                          className="w-full text-left px-4 py-2.5 hover:bg-gray-50 text-sm border-b last:border-0">
                          {p.product_name}
                          {p.barcode && <span className="text-gray-400 ml-2 text-xs">{p.barcode}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Items Table */}
              {items.length > 0 && (
                <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                      <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 uppercase w-28">Qty Received</th>
                      <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 uppercase w-32">Unit Price</th>
                      <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 uppercase w-32">Total</th>
                      <th className="px-4 py-2.5 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {items.map(item => (
                      <tr key={item.product_id}>
                        <td className="px-4 py-2.5 font-medium text-gray-800">{item.product_name}</td>
                        <td className="px-4 py-2.5">
                          <input type="number" min="0.001" step="0.001" value={item.quantity_received}
                            onChange={e => updateItem(item.product_id, 'quantity_received', parseFloat(e.target.value) || 0)}
                            className="w-full text-right border border-gray-200 rounded px-2 py-1 text-sm outline-none" />
                        </td>
                        <td className="px-4 py-2.5">
                          <input type="number" min="0" step="0.01" value={item.unit_price}
                            onChange={e => updateItem(item.product_id, 'unit_price', parseFloat(e.target.value) || 0)}
                            className="w-full text-right border border-gray-200 rounded px-2 py-1 text-sm outline-none" />
                        </td>
                        <td className="px-4 py-2.5 text-right font-medium">{fmt(item.quantity_received * item.unit_price)}</td>
                        <td className="px-4 py-2.5">
                          <button onClick={() => setItems(p => p.filter(i => i.product_id !== item.product_id))}
                            className="text-red-500 hover:text-red-700 text-xs">✕</button>
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-gray-50 font-semibold">
                      <td colSpan={3} className="px-4 py-2.5 text-right text-gray-700">Grand Total</td>
                      <td className="px-4 py-2.5 text-right text-indigo-700">
                        {fmt(items.reduce((s, i) => s + i.quantity_received * i.unit_price, 0))}
                      </td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              )}
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200">Cancel</button>
              <button onClick={handleSubmit} disabled={saving}
                className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60">
                {saving ? 'Saving...' : 'Create Voucher'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Modal */}
      {viewVoucher && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl">
            <div className="flex justify-between items-center px-6 py-4 border-b">
              <h2 className="font-semibold text-gray-800">Voucher: {viewVoucher.pv_number}</h2>
              <div className="flex items-center gap-2">
                <button onClick={() => printGRN(viewVoucher)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-medium hover:bg-indigo-100">
                  <Printer size={15} /> Print GRN
                </button>
                <button onClick={() => setViewVoucher(null)}><X size={20} className="text-gray-400" /></button>
              </div>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
                <div><span className="text-gray-500">Supplier:</span> <span className="font-medium">{viewVoucher.supplier_name || '—'}</span></div>
                <div><span className="text-gray-500">Date:</span> <span className="font-medium">{viewVoucher.voucher_date}</span></div>
                {viewVoucher.po_number && <div><span className="text-gray-500">PO:</span> <span className="font-medium">{viewVoucher.po_number}</span></div>}
                <div><span className="text-gray-500">By:</span> <span className="font-medium">{viewVoucher.created_by_name}</span></div>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Qty</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Unit Price</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(viewVoucher.items || []).map((item: any) => (
                    <tr key={item.item_id}>
                      <td className="px-4 py-2">{item.product_name}</td>
                      <td className="px-4 py-2 text-right">{item.quantity_received}</td>
                      <td className="px-4 py-2 text-right">{fmt(item.unit_price)}</td>
                      <td className="px-4 py-2 text-right font-medium">{fmt(Number(item.quantity_received) * Number(item.unit_price))}</td>
                    </tr>
                  ))}
                  <tr className="bg-gray-50 font-semibold">
                    <td colSpan={3} className="px-4 py-2 text-right">Total</td>
                    <td className="px-4 py-2 text-right text-indigo-700">{fmt(viewVoucher.total_amount)}</td>
                  </tr>
                </tbody>
              </table>
              {viewVoucher.notes && <p className="mt-3 text-sm text-gray-500">Notes: {viewVoucher.notes}</p>}
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-3 items-center">
        <DateRangeFilter dateFrom={dateFrom} dateTo={dateTo} onFromChange={setDateFrom} onToChange={setDateTo} onApply={fetchVouchers} />
        <select value={supplierFilter} onChange={e => { setSupplierFilter(e.target.value); setPage(1); }}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none">
          <option value="">All Suppliers</option>
          {suppliers.map(s => <option key={s.supplier_id} value={s.supplier_id}>{s.supplier_name}</option>)}
        </select>
      </div>

      {/* List */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" /></div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Voucher #</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">PO #</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Supplier</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Items</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">By</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {vouchers.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-400">No purchase vouchers found</td></tr>
              ) : vouchers.map(v => (
                <tr key={v.pv_id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-indigo-700">{v.pv_number}</td>
                  <td className="px-4 py-3 text-gray-500">{v.po_number || '—'}</td>
                  <td className="px-4 py-3 text-gray-800">{v.supplier_name || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{v.voucher_date}</td>
                  <td className="px-4 py-3 text-right">{v.item_count}</td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">{fmt(v.total_amount)}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{v.created_by_name}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => openView(v.pv_id)} className="text-indigo-600 hover:text-indigo-800"><Eye size={15} /></button>
                      <button onClick={() => handleDelete(v.pv_id)} className="text-red-500 hover:text-red-700"><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} totalItems={totalItems} itemsPerPage={20} onItemsPerPageChange={() => {}} />
      </div>
    </div>
  );
};

export default PurchaseVoucher;
