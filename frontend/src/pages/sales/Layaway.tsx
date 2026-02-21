import { useState, useEffect, useCallback } from 'react';
import { Archive, Plus, Search, DollarSign, Clock, CheckCircle, XCircle, X, Eye, Trash2, Printer } from 'lucide-react';
import { printReport, buildTable, buildStatsCards } from '../../utils/reportPrinter';
import api from '../../utils/api';
import Pagination from '../../components/Pagination';

interface LayawayOrder {
  layaway_id: number;
  layaway_number: string;
  customer_name: string;
  customer_id: number;
  total_amount: number;
  deposit_amount: number;
  paid_amount: number;
  balance_due: number;
  expiry_date: string;
  status: string;
  created_at: string;
  items?: any[];
  payments?: any[];
}

const STATUS_BADGES: Record<string, { label: string; bg: string; text: string }> = {
  active: { label: 'Active', bg: 'bg-blue-100', text: 'text-blue-700' },
  completed: { label: 'Completed', bg: 'bg-green-100', text: 'text-green-700' },
  cancelled: { label: 'Cancelled', bg: 'bg-red-100', text: 'text-red-700' },
  expired: { label: 'Expired', bg: 'bg-yellow-100', text: 'text-yellow-700' },
};

const Layaway = () => {
  const [orders, setOrders] = useState<LayawayOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [stats, setStats] = useState({ active_count: 0, total_reserved_value: 0, expiring_soon: 0, completed_count: 0 });

  // Modals
  const [showCreate, setShowCreate] = useState(false);
  const [paymentModal, setPaymentModal] = useState<LayawayOrder | null>(null);
  const [detailModal, setDetailModal] = useState<LayawayOrder | null>(null);

  // Create form
  const [customers, setCustomers] = useState<any[]>([]);
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [formCustomer, setFormCustomer] = useState('');
  const [formItems, setFormItems] = useState<{ product_id: number; product_name: string; quantity: number; unit_price: number }[]>([]);
  const [formDeposit, setFormDeposit] = useState('');
  const [formTax, setFormTax] = useState('0');
  const [formExpiry, setFormExpiry] = useState('');
  const [formNotes, setFormNotes] = useState('');

  // Payment form
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('Cash');
  const [payNotes, setPayNotes] = useState('');

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      const res = await api.get('/layaway', { params });
      setOrders(res.data.data || []);
      if (res.data.pagination) { setTotalItems(res.data.pagination.total); setTotalPages(res.data.pagination.totalPages); }
    } catch (err) { console.error(err); } finally { setLoading(false); }
  }, [page, limit, search, statusFilter]);

  const fetchStats = async () => {
    try { const res = await api.get('/layaway/stats'); setStats(res.data); } catch (err) { console.error(err); }
  };

  useEffect(() => { fetchStats(); }, []);
  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const openCreate = async () => {
    try {
      const [cRes, pRes] = await Promise.all([api.get('/customers?limit=100'), api.get('/products?limit=200')]);
      setCustomers((cRes.data.data || []).filter((c: any) => c.customer_id !== 1));
      setAllProducts(pRes.data.data || []);
    } catch (err) { console.error(err); }
    setFormCustomer(''); setFormItems([]); setFormDeposit(''); setFormTax('0'); setFormExpiry(''); setFormNotes('');
    setShowCreate(true);
  };

  const addProduct = (p: any) => {
    if (formItems.find(i => i.product_id === p.product_id)) return;
    setFormItems([...formItems, { product_id: p.product_id, product_name: p.product_name, quantity: 1, unit_price: parseFloat(p.price) }]);
    setProductSearch('');
  };

  const handleCreate = async () => {
    if (!formCustomer || formItems.length === 0) return alert('Select a customer and add items');
    if (!formDeposit || parseFloat(formDeposit) <= 0) return alert('Deposit amount required');
    try {
      await api.post('/layaway', {
        customer_id: parseInt(formCustomer),
        items: formItems.map(i => ({ product_id: i.product_id, quantity: i.quantity, unit_price: i.unit_price })),
        deposit_amount: parseFloat(formDeposit),
        tax_amount: parseFloat(formTax) || 0,
        expiry_date: formExpiry || null,
        notes: formNotes || null,
      });
      setShowCreate(false); fetchOrders(); fetchStats();
    } catch (err: any) { alert(err.response?.data?.message || 'Failed'); }
  };

  const handlePayment = async () => {
    if (!paymentModal || !payAmount || parseFloat(payAmount) <= 0) return alert('Enter a valid amount');
    try {
      await api.post(`/layaway/${paymentModal.layaway_id}/payment`, {
        amount: parseFloat(payAmount), payment_method: payMethod, notes: payNotes || null
      });
      setPaymentModal(null); fetchOrders(); fetchStats();
    } catch (err: any) { alert(err.response?.data?.message || 'Failed'); }
  };

  const handleCancel = async (id: number) => {
    if (!window.confirm('Cancel this layaway? Reserved stock will be restored.')) return;
    try { await api.put(`/layaway/${id}/cancel`); fetchOrders(); fetchStats(); }
    catch (err: any) { alert(err.response?.data?.message || 'Failed'); }
  };

  const viewDetail = async (id: number) => {
    try { const res = await api.get(`/layaway/${id}`); setDetailModal(res.data); }
    catch (err) { console.error(err); }
  };

  const subtotal = formItems.reduce((s, i) => s + i.quantity * i.unit_price, 0);
  const filteredProducts = allProducts.filter(p => p.product_name.toLowerCase().includes(productSearch.toLowerCase()));

  const handlePrint = () => {
    let content = buildStatsCards([
      { label: 'Active', value: String(stats.active_count) },
      { label: 'Reserved Value', value: `$${Number(stats.total_reserved_value).toFixed(2)}` },
      { label: 'Expiring Soon', value: String(stats.expiring_soon) },
      { label: 'Completed', value: String(stats.completed_count) },
    ]);
    const rows = orders.map(o => [
      o.layaway_number, o.customer_name, `$${Number(o.total_amount).toFixed(2)}`, `$${Number(o.paid_amount).toFixed(2)}`,
      `$${Number(o.balance_due).toFixed(2)}`, o.expiry_date ? new Date(o.expiry_date).toLocaleDateString() : '-', o.status
    ]);
    content += buildTable(['Layaway #', 'Customer', 'Total', 'Paid', 'Balance', 'Expiry', 'Status'], rows, { alignRight: [2, 3, 4] });
    printReport({ title: 'Layaway Orders Report', content });
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3"><Archive className="text-amber-600" size={32} /> Layaway</h1>
          <p className="text-gray-500 mt-1">Manage layaway orders with installment payments</p>
        </div>
        <div className="flex gap-3">
          <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition" disabled={orders.length === 0}><Printer size={18} /> Print</button>
          <button onClick={openCreate} className="flex items-center gap-2 bg-amber-600 text-white px-4 py-2.5 rounded-xl hover:bg-amber-700 transition-colors"><Plus size={20} /> New Layaway</button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-3"><div className="p-3 bg-blue-50 rounded-xl"><Archive size={24} className="text-blue-600" /></div>
          <div><p className="text-2xl font-bold text-blue-600">{stats.active_count}</p><p className="text-sm text-gray-500">Active</p></div></div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-3"><div className="p-3 bg-amber-50 rounded-xl"><DollarSign size={24} className="text-amber-600" /></div>
          <div><p className="text-2xl font-bold text-amber-600">${Number(stats.total_reserved_value).toFixed(2)}</p><p className="text-sm text-gray-500">Reserved Value</p></div></div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-3"><div className="p-3 bg-red-50 rounded-xl"><Clock size={24} className="text-red-600" /></div>
          <div><p className="text-2xl font-bold text-red-600">{stats.expiring_soon}</p><p className="text-sm text-gray-500">Expiring Soon</p></div></div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-3"><div className="p-3 bg-green-50 rounded-xl"><CheckCircle size={24} className="text-green-600" /></div>
          <div><p className="text-2xl font-bold text-green-600">{stats.completed_count}</p><p className="text-sm text-gray-500">Completed</p></div></div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex flex-wrap gap-4 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input type="text" placeholder="Search by layaway# or customer..." className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="px-3 py-2 border border-gray-200 rounded-lg text-sm">
            <option value="">All Status</option><option value="active">Active</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option>
          </select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-12"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-600"></div></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Layaway #</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Paid</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Balance</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expiry</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {orders.map((o) => {
                  const badge = STATUS_BADGES[o.status] || STATUS_BADGES.active;
                  return (
                    <tr key={o.layaway_id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono font-medium text-amber-700">{o.layaway_number}</td>
                      <td className="px-4 py-3 text-gray-700">{o.customer_name}</td>
                      <td className="px-4 py-3 text-right">${Number(o.total_amount).toFixed(2)}</td>
                      <td className="px-4 py-3 text-right text-green-600 font-medium">${Number(o.paid_amount).toFixed(2)}</td>
                      <td className="px-4 py-3 text-right font-bold text-amber-600">${Number(o.balance_due).toFixed(2)}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{o.expiry_date ? new Date(o.expiry_date).toLocaleDateString() : '-'}</td>
                      <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>{badge.label}</span></td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <button onClick={() => viewDetail(o.layaway_id)} className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg" title="View"><Eye size={16} /></button>
                          {o.status === 'active' && <>
                            <button onClick={() => { setPaymentModal(o); setPayAmount(''); setPayMethod('Cash'); setPayNotes(''); }} className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg" title="Make Payment"><DollarSign size={16} /></button>
                            <button onClick={() => handleCancel(o.layaway_id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg" title="Cancel"><XCircle size={16} /></button>
                          </>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {orders.length === 0 && <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-400"><Archive size={40} className="mx-auto mb-3 text-gray-300" /><p>No layaway orders found</p></td></tr>}
              </tbody>
            </table>
          </div>
        )}
        <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} totalItems={totalItems} itemsPerPage={limit} onItemsPerPageChange={(v) => { setLimit(v); setPage(1); }} />
      </div>

      {/* Detail Modal */}
      {detailModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <div><h2 className="text-xl font-bold">{detailModal.layaway_number}</h2><p className="text-sm text-gray-500">{detailModal.customer_name}</p></div>
              <button onClick={() => setDetailModal(null)} className="p-2 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
            </div>
            <div className="p-6">
              {detailModal.items && (
                <table className="w-full text-sm mb-4">
                  <thead className="bg-gray-50"><tr><th className="px-3 py-2 text-left">Product</th><th className="px-3 py-2 text-right">Qty</th><th className="px-3 py-2 text-right">Price</th><th className="px-3 py-2 text-right">Total</th></tr></thead>
                  <tbody className="divide-y">{detailModal.items.map((item: any, idx: number) => (
                    <tr key={idx}><td className="px-3 py-2">{item.product_name}</td><td className="px-3 py-2 text-right">{item.quantity}</td><td className="px-3 py-2 text-right">${Number(item.unit_price).toFixed(2)}</td><td className="px-3 py-2 text-right">${Number(item.total_price).toFixed(2)}</td></tr>
                  ))}</tbody>
                </table>
              )}
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-gray-50 p-3 rounded-lg text-center"><p className="text-xs text-gray-500">Total</p><p className="font-bold">${Number(detailModal.total_amount).toFixed(2)}</p></div>
                <div className="bg-green-50 p-3 rounded-lg text-center"><p className="text-xs text-green-600">Paid</p><p className="font-bold text-green-700">${Number(detailModal.paid_amount).toFixed(2)}</p></div>
                <div className="bg-amber-50 p-3 rounded-lg text-center"><p className="text-xs text-amber-600">Balance</p><p className="font-bold text-amber-700">${Number(detailModal.balance_due).toFixed(2)}</p></div>
              </div>
              {detailModal.payments && detailModal.payments.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2 text-sm">Payment History</h3>
                  <div className="space-y-2">{detailModal.payments.map((p: any, idx: number) => (
                    <div key={idx} className="flex justify-between items-center text-sm bg-gray-50 p-2 rounded-lg">
                      <span className="text-gray-500">{new Date(p.payment_date).toLocaleDateString()}</span>
                      <span className="text-gray-500">{p.payment_method}</span>
                      <span className="font-medium text-green-600">${Number(p.amount).toFixed(2)}</span>
                    </div>
                  ))}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {paymentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b">
              <div><h2 className="text-xl font-bold">Make Payment</h2><p className="text-sm text-gray-500">{paymentModal.layaway_number}</p></div>
              <button onClick={() => setPaymentModal(null)} className="p-2 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center"><p className="text-sm text-amber-600">Balance Due</p><p className="text-2xl font-bold text-amber-700">${Number(paymentModal.balance_due).toFixed(2)}</p></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Amount</label><input type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none" min="0.01" step="0.01" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label><select value={payMethod} onChange={(e) => setPayMethod(e.target.value)} className="w-full px-3 py-2 border rounded-lg"><option value="Cash">Cash</option><option value="Card">Card</option><option value="Online">Online</option></select></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Notes</label><textarea value={payNotes} onChange={(e) => setPayNotes(e.target.value)} rows={2} className="w-full px-3 py-2 border rounded-lg" /></div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t">
              <button onClick={() => setPaymentModal(null)} className="px-4 py-2 text-gray-700 border rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={handlePayment} className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700">Make Payment</button>
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-bold">New Layaway Order</h2>
              <button onClick={() => setShowCreate(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Customer</label>
                  <select value={formCustomer} onChange={(e) => setFormCustomer(e.target.value)} className="w-full px-3 py-2 border rounded-lg"><option value="">Select Customer</option>{customers.map((c: any) => <option key={c.customer_id} value={c.customer_id}>{c.customer_name}</option>)}</select></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date</label><input type="date" value={formExpiry} onChange={(e) => setFormExpiry(e.target.value)} className="w-full px-3 py-2 border rounded-lg" /></div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Add Products</label>
                <input type="text" placeholder="Search products..." value={productSearch} onChange={(e) => setProductSearch(e.target.value)} className="w-full px-3 py-2 border rounded-lg" />
                {productSearch && <div className="border rounded-lg mt-1 max-h-32 overflow-y-auto bg-white shadow-lg">{filteredProducts.slice(0, 10).map((p: any) => (
                  <button key={p.product_id} onClick={() => addProduct(p)} className="w-full text-left px-3 py-2 hover:bg-amber-50 text-sm flex justify-between"><span>{p.product_name}</span><span className="text-gray-400">${Number(p.price).toFixed(2)}</span></button>
                ))}</div>}
              </div>
              {formItems.length > 0 && (
                <table className="w-full text-sm border rounded-lg overflow-hidden">
                  <thead className="bg-gray-50"><tr><th className="px-3 py-2 text-left">Product</th><th className="px-3 py-2 text-right w-24">Qty</th><th className="px-3 py-2 text-right w-32">Price</th><th className="px-3 py-2 text-right w-28">Total</th><th className="px-3 py-2 w-10"></th></tr></thead>
                  <tbody className="divide-y">{formItems.map((item, idx) => (
                    <tr key={idx}>
                      <td className="px-3 py-2">{item.product_name}</td>
                      <td className="px-3 py-2"><input type="number" min="1" value={item.quantity} onChange={(e) => { const u = [...formItems]; u[idx].quantity = parseInt(e.target.value) || 1; setFormItems(u); }} className="w-full px-2 py-1 border rounded text-right" /></td>
                      <td className="px-3 py-2"><input type="number" min="0" step="0.01" value={item.unit_price} onChange={(e) => { const u = [...formItems]; u[idx].unit_price = parseFloat(e.target.value) || 0; setFormItems(u); }} className="w-full px-2 py-1 border rounded text-right" /></td>
                      <td className="px-3 py-2 text-right font-medium">${(item.quantity * item.unit_price).toFixed(2)}</td>
                      <td className="px-3 py-2"><button onClick={() => setFormItems(formItems.filter((_, i) => i !== idx))} className="text-red-500 hover:bg-red-50 rounded p-1"><Trash2 size={14} /></button></td>
                    </tr>
                  ))}</tbody>
                </table>
              )}
              <div className="grid grid-cols-3 gap-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Tax Amount</label><input type="number" min="0" step="0.01" value={formTax} onChange={(e) => setFormTax(e.target.value)} className="w-full px-3 py-2 border rounded-lg" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Deposit Amount</label><input type="number" min="0" step="0.01" value={formDeposit} onChange={(e) => setFormDeposit(e.target.value)} className="w-full px-3 py-2 border rounded-lg" placeholder="Required" /></div>
                <div className="flex items-end"><div className="w-full bg-amber-50 border border-amber-200 rounded-lg p-2 text-center"><p className="text-xs text-amber-600">Total</p><p className="text-lg font-bold text-amber-800">${(subtotal + (parseFloat(formTax) || 0)).toFixed(2)}</p></div></div>
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Notes</label><textarea value={formNotes} onChange={(e) => setFormNotes(e.target.value)} rows={2} className="w-full px-3 py-2 border rounded-lg" /></div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-gray-700 border rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={handleCreate} className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700">Create Layaway</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Layaway;
