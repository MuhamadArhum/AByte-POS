import { useState, useEffect, useCallback } from 'react';
import { Clock, CheckCircle, Trash2, Printer, Search, Archive, RotateCcw, FileText, DollarSign, User, Calendar, CreditCard, Package, ArrowLeft, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { printReceipt } from '../../utils/receiptPrinter';
import Pagination from '../../components/Pagination';

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
          search: doneSearch
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
  }, [donePage, doneItemsPerPage, doneSearch]);

  useEffect(() => {
    if (activeTab === 'pending') fetchPending();
  }, [activeTab, fetchPending]);

  useEffect(() => {
    if (activeTab === 'done') fetchDone();
  }, [activeTab, fetchDone]);

  const handlePrintOrder = async (saleId: number) => {
    try {
      const [saleRes, settingsRes] = await Promise.all([
        api.get(`/sales/${saleId}`),
        api.get('/settings')
      ]);
      printReceipt(saleRes.data, settingsRes.data, saleRes.data.cashier_name || 'Staff', saleRes.data.customer_name);
    } catch (error) {
      console.error('Failed to print order', error);
      alert('Failed to print order');
    }
  };

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

  const handleDelete = async (saleId: number) => {
    if (!confirm('Are you sure you want to delete this pending order?')) return;
    try {
      await api.delete(`/sales/${saleId}`);
      fetchPending();
    } catch (error) {
      console.error('Failed to delete pending order', error);
      alert('Failed to delete pending order');
    }
  };

  const handlePayPending = (sale: any) => {
    // Navigate to POS with pending sale data
    navigate('/pos', { state: { pendingSale: sale } });
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
                <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-2.5 rounded-xl shadow-lg">
                  <FileText size={28} className="text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-800">Orders Management</h1>
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
              onClick={() => { setActiveTab('done'); setDonePage(1); }}
              className={`flex items-center gap-2.5 px-6 py-3 rounded-xl font-semibold transition-all duration-200 ${
                activeTab === 'done'
                  ? 'bg-gradient-to-r from-emerald-600 to-emerald-700 text-white shadow-lg shadow-emerald-200'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200'
              }`}
            >
              <CheckCircle size={20} />
              <span>Completed Orders</span>
              {doneTotalItems > 0 && (
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  activeTab === 'done' ? 'bg-white/20' : 'bg-emerald-100 text-emerald-700'
                }`}>
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
                        <p className="font-bold text-lg text-gray-800">Order #{sale.sale_id}</p>
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
                          ${parseFloat(sale.total_amount).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500 flex items-center gap-1.5">
                          <User size={16} className="text-indigo-600" />
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
                      <button
                        onClick={() => handleDelete(sale.sale_id)}
                        className="p-2.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 hover:scale-110 transition-all duration-200 border border-red-200"
                        title="Delete Order"
                      >
                        <Trash2 size={18} />
                      </button>
                      <button
                        onClick={() => handlePrintOrder(sale.sale_id)}
                        className="p-2.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 hover:scale-110 transition-all duration-200 border border-blue-200"
                        title="Print Order"
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
            {/* Search Bar */}
            <div className="mb-5">
              <div className="relative max-w-xl">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="Search by Order ID, Customer Name, or Amount..."
                  className="w-full pl-12 pr-4 py-3.5 bg-white border-2 border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all shadow-sm text-gray-700 placeholder-gray-400"
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
                              Order #
                            </div>
                          </th>
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
                          <tr key={sale.sale_id} className="hover:bg-gradient-to-r hover:from-emerald-50/30 hover:to-blue-50/30 transition-all duration-150">
                            <td className="px-6 py-4 font-bold text-gray-900">#{sale.sale_id}</td>
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
                              ${parseFloat(sale.total_amount).toFixed(2)}
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
                                <button
                                  onClick={() => handlePrintOrder(sale.sale_id)}
                                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-200 border border-transparent hover:border-blue-200"
                                  title="Print Receipt"
                                >
                                  <Printer size={18} />
                                </button>
                                <button
                                  onClick={() => handleRefund(sale.sale_id)}
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
    </div>
  );
};

export default Orders;
