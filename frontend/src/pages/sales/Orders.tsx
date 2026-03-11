import { useState, useEffect, useCallback } from 'react';
import { Clock, CheckCircle, Printer, Search, Archive, RotateCcw, FileText, DollarSign, User, Calendar, CreditCard, Package, ArrowLeft, RefreshCw, Eye, EyeOff, Lock, Edit2, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { printReceipt } from '../../utils/receiptPrinter';
import Pagination from '../../components/Pagination';

// ─── Bill Preview Modal ────────────────────────────────────────────────────────
const BillPreviewModal = ({ saleId, onClose }: { saleId: number; onClose: () => void }) => {
  const [sale, setSale] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [saleRes, settingsRes] = await Promise.all([
          api.get(`/sales/${saleId}`),
          api.get('/settings')
        ]);
        setSale(saleRes.data);
        setSettings(settingsRes.data);
      } catch (err) {
        console.error('Failed to load sale details', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [saleId]);

  const handlePrint = () => {
    if (!sale || !settings) return;
    printReceipt(sale, settings, sale.cashier_name || 'Staff', sale.customer_name);
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl p-8 text-center shadow-2xl">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-emerald-200 border-t-emerald-600 mx-auto mb-3"></div>
          <p className="text-gray-500">Loading receipt...</p>
        </div>
      </div>
    );
  }

  if (!sale) return null;

  const items: any[] = sale.items || [];
  const subtotal = items.reduce((sum: number, item: any) => sum + parseFloat(item.unit_price) * parseFloat(item.quantity), 0);
  const taxPercent = parseFloat(sale.tax_percent || 0);
  const taxAmount = subtotal * taxPercent / 100;
  const additionalPercent = parseFloat(sale.additional_charges_percent || 0);
  const additionalAmount = subtotal * additionalPercent / 100;
  const discount = parseFloat(sale.discount || 0);
  const grandTotal = parseFloat(sale.total_amount || 0);
  const cs = settings?.currency_symbol || 'Rs.';

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-base font-semibold text-gray-800">Bill Preview</h2>
            {sale.token_no && (
              <p className="text-sm text-amber-600 font-bold">Token #{sale.token_no}</p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <X size={22} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Info row */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-gray-400 text-xs mb-0.5">Order</p>
              <p className="font-bold text-gray-800">
                {sale.invoice_no ? sale.invoice_no : `#${sale.sale_id}`}
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-gray-400 text-xs mb-0.5">Date</p>
              <p className="font-semibold text-gray-700">
                {new Date(sale.sale_date).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-gray-400 text-xs mb-0.5">Customer</p>
              <p className="font-semibold text-gray-700">{sale.customer_name || 'Walk-in'}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-gray-400 text-xs mb-0.5">Cashier</p>
              <p className="font-semibold text-gray-700">{sale.cashier_name || 'Staff'}</p>
            </div>
          </div>

          {/* Items table */}
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-gray-600 font-semibold">Item</th>
                  <th className="px-3 py-2 text-center text-gray-600 font-semibold">Qty</th>
                  <th className="px-3 py-2 text-right text-gray-600 font-semibold">Price</th>
                  <th className="px-3 py-2 text-right text-gray-600 font-semibold">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item: any, idx: number) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-800 font-medium">{item.product_name}</td>
                    <td className="px-3 py-2 text-center text-gray-600">{item.quantity}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{cs} {parseFloat(item.unit_price).toFixed(2)}</td>
                    <td className="px-3 py-2 text-right font-semibold text-gray-800">{cs} {(parseFloat(item.unit_price) * parseFloat(item.quantity)).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="space-y-2 bg-gray-50 rounded-xl p-4">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Subtotal</span>
              <span>{cs} {subtotal.toFixed(2)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-sm text-red-600">
                <span>Discount</span>
                <span>- {cs} {discount.toFixed(2)}</span>
              </div>
            )}
            {taxPercent > 0 && (
              <div className="flex justify-between text-sm text-gray-600">
                <span>Tax ({taxPercent}%)</span>
                <span>{cs} {taxAmount.toFixed(2)}</span>
              </div>
            )}
            {additionalPercent > 0 && (
              <div className="flex justify-between text-sm text-gray-600">
                <span>Additional Charges ({additionalPercent}%)</span>
                <span>{cs} {additionalAmount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-bold text-gray-900 border-t border-gray-200 pt-2 mt-2">
              <span>Grand Total</span>
              <span className="text-emerald-600">{cs} {grandTotal.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex items-center gap-3 shrink-0">
          <div className="flex-1 text-xs text-gray-400">
            Press <kbd className="bg-white border border-gray-200 px-1.5 py-0.5 rounded font-mono font-bold">Ctrl+P</kbd> for quick print
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-100 font-medium text-sm transition-colors"
          >
            Close
          </button>
          <button
            onClick={() => { handlePrint(); onClose(); }}
            className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold text-sm transition-colors shadow-md"
          >
            <Printer size={16} />
            Print
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Password Gate Modal ───────────────────────────────────────────────────────
const PasswordModal = ({
  title,
  onSuccess,
  onClose,
  correctPassword
}: {
  title: string;
  onSuccess: () => void;
  onClose: () => void;
  correctPassword: string;
}) => {
  const [input, setInput] = useState('');
  const [showInput, setShowInput] = useState(false);
  const [error, setError] = useState('');

  const handleVerify = () => {
    if (input === correctPassword) {
      onSuccess();
    } else {
      setError('Incorrect password. Please try again.');
      setInput('');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
            <Lock size={20} className="text-amber-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-800">{title}</h3>
            <p className="text-xs text-gray-500">Enter the password to continue</p>
          </div>
        </div>

        <div className="relative mb-3">
          <input
            type={showInput ? 'text' : 'password'}
            value={input}
            onChange={e => { setInput(e.target.value); setError(''); }}
            onKeyDown={e => { if (e.key === 'Enter') handleVerify(); }}
            placeholder="Enter password..."
            className="w-full pl-4 pr-10 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all"
            autoFocus
          />
          <button
            type="button"
            onClick={() => setShowInput(!showInput)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            {showInput ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>

        {error && (
          <p className="text-red-500 text-sm mb-3">{error}</p>
        )}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleVerify}
            className="flex-1 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-semibold transition-colors"
          >
            Unlock
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Main Orders Component ─────────────────────────────────────────────────────
const Orders = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'pending' | 'done'>('pending');

  // Pending tab state
  const [pendingSales, setPendingSales] = useState<any[]>([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [pendingPage, setPendingPage] = useState(1);
  const [pendingItemsPerPage, setPendingItemsPerPage] = useState(12);
  const [pendingTotalItems, setPendingTotalItems] = useState(0);
  const [pendingTotalPages, setPendingTotalPages] = useState(0);

  // Done tab state
  const [doneSales, setDoneSales] = useState<any[]>([]);
  const [doneLoading, setDoneLoading] = useState(false);
  const [donePage, setDonePage] = useState(1);
  const [doneItemsPerPage, setDoneItemsPerPage] = useState(15);
  const [doneTotalItems, setDoneTotalItems] = useState(0);
  const [doneTotalPages, setDoneTotalPages] = useState(0);
  const [doneSearch, setDoneSearch] = useState('');
  const todayStr = new Date().toISOString().split('T')[0];
  const [doneDateFrom, setDoneDateFrom] = useState(todayStr);
  const [doneDateTo, setDoneDateTo] = useState(todayStr);

  // Bill preview
  const [previewSaleId, setPreviewSaleId] = useState<number | null>(null);

  // Password gate
  const [completedUnlocked, setCompletedUnlocked] = useState(false);
  const [passwordModal, setPasswordModal] = useState<{ type: 'view_completed' | 'refund'; pendingRefundId?: number } | null>(null);
  const [settingsPasswords, setSettingsPasswords] = useState({ view_completed: '', refund: '' });

  // Fetch settings on mount to get passwords
  useEffect(() => {
    api.get('/settings').then(res => {
      setSettingsPasswords({
        view_completed: res.data.view_completed_orders_password || '',
        refund: res.data.refund_password || ''
      });
    }).catch(() => {});
  }, []);

  const fetchPending = useCallback(async () => {
    setPendingLoading(true);
    try {
      const res = await api.get('/sales/pending', {
        params: { page: pendingPage, limit: pendingItemsPerPage }
      });
      if (res.data.pagination) {
        setPendingSales(res.data.data);
        setPendingTotalItems(res.data.pagination.total);
        setPendingTotalPages(res.data.pagination.totalPages);
      } else {
        setPendingSales(res.data);
      }
    } catch (error) {
      console.error('Failed to fetch pending sales', error);
    } finally {
      setPendingLoading(false);
    }
  }, [pendingPage, pendingItemsPerPage]);

  const fetchDone = useCallback(async () => {
    setDoneLoading(true);
    try {
      const res = await api.get('/sales', {
        params: {
          page: donePage,
          limit: doneItemsPerPage,
          status: 'completed,refunded',
          search: doneSearch,
          date_from: doneDateFrom,
          date_to: doneDateTo,
        }
      });
      if (res.data.pagination) {
        setDoneSales(res.data.data);
        setDoneTotalItems(res.data.pagination.total);
        setDoneTotalPages(res.data.pagination.totalPages);
      } else {
        setDoneSales(res.data);
      }
    } catch (error) {
      console.error('Failed to fetch done sales', error);
    } finally {
      setDoneLoading(false);
    }
  }, [donePage, doneItemsPerPage, doneSearch, doneDateFrom, doneDateTo]);

  useEffect(() => {
    if (activeTab === 'pending') fetchPending();
  }, [activeTab, fetchPending]);

  useEffect(() => {
    if (activeTab === 'done') fetchDone();
  }, [activeTab, fetchDone]);

  const handleRefund = async (saleId: number) => {
    if (!confirm(`Are you sure you want to refund Order #${saleId}? This will restore stock.`)) return;
    try {
      await api.post(`/sales/${saleId}/refund`);
      alert('Order refunded successfully');
      fetchDone();
    } catch (error) {
      console.error('Failed to refund order', error);
      alert('Failed to refund order');
    }
  };

  const handleRefundClick = (saleId: number) => {
    if (settingsPasswords.refund) {
      setPasswordModal({ type: 'refund', pendingRefundId: saleId });
    } else {
      handleRefund(saleId);
    }
  };

  const handlePayPending = (sale: any) => {
    navigate('/pos', { state: { pendingSale: sale } });
  };

  const handleEditPending = (sale: any) => {
    navigate('/pos', { state: { editOrder: sale } });
  };

  const handleCompletedTabClick = () => {
    if (settingsPasswords.view_completed && !completedUnlocked) {
      setPasswordModal({ type: 'view_completed' });
    } else {
      setActiveTab('done');
      setDonePage(1);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white border-b-2 border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-[1920px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/pos')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-600"
              >
                <ArrowLeft size={24} />
              </button>
              <div className="flex items-center gap-3">
                <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 p-2.5 rounded-xl shadow-lg">
                  <FileText size={28} className="text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold tracking-tight text-gray-900">Orders Management</h1>
                  <p className="text-sm text-gray-500">Track and manage all your orders</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => activeTab === 'pending' ? fetchPending() : fetchDone()}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
              >
                <RefreshCw size={18} />
                Refresh
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-3 mt-4">
            <button
              onClick={() => { setActiveTab('pending'); setPendingPage(1); }}
              className={`flex items-center gap-2.5 px-6 py-3 rounded-xl font-semibold transition-all duration-200 ${
                activeTab === 'pending'
                  ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-200'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200'
              }`}
            >
              <Clock size={20} />
              <span>Pending Orders</span>
              {pendingTotalItems > 0 && (
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  activeTab === 'pending' ? 'bg-white/20' : 'bg-orange-100 text-orange-700'
                }`}>
                  {pendingTotalItems}
                </span>
              )}
            </button>
            <button
              onClick={handleCompletedTabClick}
              className={`flex items-center gap-2.5 px-6 py-3 rounded-xl font-semibold transition-all duration-200 ${
                activeTab === 'done'
                  ? 'bg-gradient-to-r from-emerald-600 to-emerald-700 text-white shadow-lg shadow-emerald-200'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200'
              }`}
            >
              <CheckCircle size={20} />
              {settingsPasswords.view_completed && !completedUnlocked && <Lock size={14} className="opacity-60" />}
              <span>Completed Orders</span>
              {doneTotalItems > 0 && activeTab === 'done' && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-white/20">
                  {doneTotalItems}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-[1920px] mx-auto px-6 py-6">
        {activeTab === 'pending' ? (
          /* PENDING TAB */
          pendingLoading ? (
            <div className="flex items-center justify-center h-[60vh]">
              <div className="text-center">
                <div className="animate-spin rounded-full h-16 w-16 border-4 border-orange-200 border-t-orange-600 mx-auto mb-4"></div>
                <p className="text-gray-500 font-medium">Loading pending orders...</p>
              </div>
            </div>
          ) : pendingSales.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[60vh] text-gray-400">
              <div className="bg-gray-100 p-8 rounded-full mb-4">
                <Archive size={64} className="opacity-30" />
              </div>
              <p className="text-xl font-semibold text-gray-500">No Pending Orders</p>
              <p className="text-sm text-gray-400 mt-2">All orders have been completed</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-5">
                {pendingSales.map(sale => (
                  <div
                    key={sale.sale_id}
                    className="bg-white border-2 border-gray-200 rounded-xl p-5 hover:shadow-xl hover:border-orange-300 transition-all duration-200 hover:-translate-y-1"
                  >
                    {/* Header */}
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        {sale.token_no ? (
                          <p className="text-2xl font-black text-amber-600">Token {sale.token_no}</p>
                        ) : (
                          <p className="font-bold text-lg text-gray-800">Order #{sale.sale_id}</p>
                        )}
                        <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                          <Calendar size={12} />
                          {new Date(sale.sale_date).toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                      <span className="bg-gradient-to-r from-orange-100 to-orange-200 text-orange-700 text-xs px-3 py-1.5 rounded-full font-bold shadow-sm border border-orange-300">
                        Pending
                      </span>
                    </div>

                    {/* Details */}
                    <div className="py-3 border-t border-b border-gray-100 my-3 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500 flex items-center gap-1.5">
                          <DollarSign size={16} className="text-emerald-600" />
                          Total Amount
                        </span>
                        <span className="font-bold text-lg text-emerald-600">
                          Rs. {parseFloat(sale.total_amount).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500 flex items-center gap-1.5">
                          <User size={16} className="text-emerald-600" />
                          Customer
                        </span>
                        <span className="font-medium text-gray-800">
                          {sale.customer_name || 'Walk-in'}
                        </span>
                      </div>
                      {sale.note && (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 mt-2">
                          <p className="text-xs text-amber-800 font-medium italic">
                            Note: {sale.note}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 mt-4">
                      {/* Edit button */}
                      <button
                        onClick={() => handleEditPending(sale)}
                        className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 hover:scale-110 transition-all duration-200 border border-emerald-200"
                        title="Edit Order"
                      >
                        <Edit2 size={18} />
                      </button>
                      {/* Bill Preview / Print button */}
                      <button
                        onClick={() => setPreviewSaleId(sale.sale_id)}
                        className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 hover:scale-110 transition-all duration-200 border border-emerald-200"
                        title="Preview & Print"
                      >
                        <Printer size={18} />
                      </button>
                      <button
                        onClick={() => handlePayPending(sale)}
                        className="flex-1 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white py-2.5 rounded-lg font-semibold hover:from-emerald-700 hover:to-emerald-800 transition-all duration-200 shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                      >
                        <CreditCard size={18} />
                        Pay & Complete
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {pendingTotalPages > 0 && (
                <div className="mt-6 bg-white rounded-xl p-4 border border-gray-200">
                  <Pagination
                    currentPage={pendingPage}
                    totalPages={pendingTotalPages}
                    onPageChange={setPendingPage}
                    totalItems={pendingTotalItems}
                    itemsPerPage={pendingItemsPerPage}
                    onItemsPerPageChange={(newLimit) => {
                      setPendingItemsPerPage(newLimit);
                      setPendingPage(1);
                    }}
                  />
                </div>
              )}
            </>
          )
        ) : (
          /* DONE TAB */
          <>
            {/* Date Filter + Search Bar */}
            <div className="mb-5 flex flex-wrap items-center gap-3">
              {/* Presets */}
              <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1 shadow-sm">
                {[{label:'Today',key:'today'},{label:'This Week',key:'week'},{label:'This Month',key:'month'}].map(p => (
                  <button key={p.key} onClick={() => {
                    const d = new Date();
                    let from = todayStr, to = todayStr;
                    if (p.key === 'week') from = new Date(d.getTime() - 6 * 86400000).toISOString().split('T')[0];
                    else if (p.key === 'month') from = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
                    setDoneDateFrom(from);
                    setDoneDateTo(to);
                    setDonePage(1);
                  }} className="px-3 py-1.5 rounded-lg text-sm font-semibold text-gray-600 hover:bg-emerald-50 hover:text-emerald-700 transition-all">
                    {p.label}
                  </button>
                ))}
              </div>
              {/* Date Inputs */}
              <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm">
                <Calendar size={16} className="text-gray-400" />
                <input type="date" value={doneDateFrom} onChange={e => { setDoneDateFrom(e.target.value); setDonePage(1); }}
                  className="text-sm text-gray-700 outline-none border-none bg-transparent" />
                <span className="text-gray-400 text-sm">—</span>
                <input type="date" value={doneDateTo} onChange={e => { setDoneDateTo(e.target.value); setDonePage(1); }}
                  className="text-sm text-gray-700 outline-none border-none bg-transparent" />
              </div>
              {/* Search */}
              <div className="relative flex-1 min-w-[220px]">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="Search by Invoice No, Order ID, Customer Name, or Amount..."
                  className="w-full pl-12 pr-4 py-3 bg-white border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all shadow-sm text-gray-700 placeholder-gray-400"
                  value={doneSearch}
                  onChange={(e) => { setDoneSearch(e.target.value); setDonePage(1); }}
                />
              </div>
            </div>

            {/* Table */}
            {doneLoading ? (
              <div className="flex items-center justify-center h-[50vh]">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-16 w-16 border-4 border-emerald-200 border-t-emerald-600 mx-auto mb-4"></div>
                  <p className="text-gray-500 font-medium">Loading completed orders...</p>
                </div>
              </div>
            ) : doneSales.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[50vh] text-gray-400">
                <div className="bg-gray-100 p-8 rounded-full mb-4">
                  <Archive size={64} className="opacity-30" />
                </div>
                <p className="text-xl font-semibold text-gray-500">No Completed Orders Found</p>
                <p className="text-sm text-gray-400 mt-2">Try adjusting your search criteria</p>
              </div>
            ) : (
              <>
                <div className="bg-white border-2 border-gray-200 rounded-xl shadow-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-gradient-to-r from-gray-50 to-gray-100 text-gray-700 text-sm uppercase tracking-wider">
                        <tr>
                          <th className="px-6 py-4 font-bold border-b-2 border-gray-200">
                            <div className="flex items-center gap-2">
                              <Package size={16} />
                              Invoice / Order
                            </div>
                          </th>
                          <th className="px-6 py-4 font-bold border-b-2 border-gray-200">Token No</th>
                          <th className="px-6 py-4 font-bold border-b-2 border-gray-200">
                            <div className="flex items-center gap-2">
                              <Calendar size={16} />
                              Date & Time
                            </div>
                          </th>
                          <th className="px-6 py-4 font-bold border-b-2 border-gray-200">
                            <div className="flex items-center gap-2">
                              <User size={16} />
                              Customer
                            </div>
                          </th>
                          <th className="px-6 py-4 font-bold border-b-2 border-gray-200">
                            <div className="flex items-center gap-2">
                              <DollarSign size={16} />
                              Amount
                            </div>
                          </th>
                          <th className="px-6 py-4 font-bold border-b-2 border-gray-200">
                            <div className="flex items-center gap-2">
                              <CreditCard size={16} />
                              Payment
                            </div>
                          </th>
                          <th className="px-6 py-4 font-bold border-b-2 border-gray-200">Status</th>
                          <th className="px-6 py-4 font-bold border-b-2 border-gray-200 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {doneSales.map(sale => (
                          <tr key={sale.sale_id} className="hover:bg-gradient-to-r hover:from-emerald-50/30 hover:to-emerald-50/30 transition-all duration-150">
                            <td className="px-6 py-4">
                              {sale.invoice_no ? (
                                <span className="font-bold text-emerald-700">{sale.invoice_no}</span>
                              ) : (
                                <span className="font-bold text-gray-900">#{sale.sale_id}</span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-gray-600 text-sm">
                              {sale.token_no ? (
                                <span className="px-2 py-1 bg-amber-50 border border-amber-200 rounded-lg font-bold text-amber-700 text-xs">
                                  {sale.token_no}
                                </span>
                              ) : (
                                <span className="text-gray-300">—</span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-gray-600 text-sm">
                              {new Date(sale.sale_date).toLocaleString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </td>
                            <td className="px-6 py-4 text-gray-700 font-medium">
                              {sale.customer_name || 'Walk-in Customer'}
                            </td>
                            <td className="px-6 py-4 font-bold text-lg text-emerald-600">
                              Rs. {parseFloat(sale.total_amount).toFixed(2)}
                            </td>
                            <td className="px-6 py-4">
                              <span className="px-3 py-1.5 bg-gradient-to-r from-emerald-50 to-emerald-100 text-emerald-700 text-xs rounded-full font-bold capitalize border border-emerald-200 shadow-sm">
                                {sale.payment_method}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`px-3 py-1.5 text-xs rounded-full font-bold capitalize border shadow-sm ${
                                sale.status === 'refunded'
                                  ? 'bg-gradient-to-r from-red-50 to-red-100 text-red-700 border-red-200'
                                  : 'bg-gradient-to-r from-emerald-50 to-emerald-100 text-emerald-700 border-emerald-200'
                              }`}>
                                {sale.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                {/* Eye: Bill Preview */}
                                <button
                                  onClick={() => setPreviewSaleId(sale.sale_id)}
                                  className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all duration-200 border border-transparent hover:border-emerald-200"
                                  title="View Bill"
                                >
                                  <Eye size={18} />
                                </button>
                                {/* Print */}
                                <button
                                  onClick={() => setPreviewSaleId(sale.sale_id)}
                                  className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all duration-200 border border-transparent hover:border-emerald-200"
                                  title="Print Receipt"
                                >
                                  <Printer size={18} />
                                </button>
                                {/* Refund */}
                                <button
                                  onClick={() => handleRefundClick(sale.sale_id)}
                                  disabled={sale.status === 'refunded'}
                                  className={`p-2 transition-all duration-200 rounded-lg border ${
                                    sale.status === 'refunded'
                                      ? 'text-gray-300 cursor-not-allowed border-transparent'
                                      : 'text-red-600 hover:bg-red-50 border-transparent hover:border-red-200'
                                  }`}
                                  title={sale.status === 'refunded' ? 'Already Refunded' : 'Refund Order'}
                                >
                                  <RotateCcw size={18} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Pagination */}
                {doneTotalPages > 0 && (
                  <div className="mt-6 bg-white rounded-xl p-4 border border-gray-200">
                    <Pagination
                      currentPage={donePage}
                      totalPages={doneTotalPages}
                      onPageChange={setDonePage}
                      totalItems={doneTotalItems}
                      itemsPerPage={doneItemsPerPage}
                      onItemsPerPageChange={(newLimit) => {
                        setDoneItemsPerPage(newLimit);
                        setDonePage(1);
                      }}
                    />
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* Bill Preview Modal */}
      {previewSaleId !== null && (
        <BillPreviewModal
          saleId={previewSaleId}
          onClose={() => setPreviewSaleId(null)}
        />
      )}

      {/* Password Gate Modal */}
      {passwordModal && (
        <PasswordModal
          title={passwordModal.type === 'view_completed' ? 'Completed Orders' : 'Refund Authorization'}
          correctPassword={
            passwordModal.type === 'view_completed'
              ? settingsPasswords.view_completed
              : settingsPasswords.refund
          }
          onSuccess={() => {
            if (passwordModal.type === 'view_completed') {
              setCompletedUnlocked(true);
              setActiveTab('done');
              setDonePage(1);
            } else if (passwordModal.type === 'refund' && passwordModal.pendingRefundId) {
              handleRefund(passwordModal.pendingRefundId);
            }
            setPasswordModal(null);
          }}
          onClose={() => setPasswordModal(null)}
        />
      )}
    </div>
  );
};

export default Orders;
