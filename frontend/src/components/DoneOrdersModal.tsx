import React, { useEffect, useState, useCallback } from 'react';
import { X, Archive, Search, FileText, CheckCircle, RotateCcw, Printer, Eye, DollarSign, Calendar, User, CreditCard, Package, ChevronRight } from 'lucide-react';
import api from '../utils/api';
import Pagination from './Pagination';
import { printReceipt } from '../utils/receiptPrinter';

interface DoneOrdersModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface OrderDetail {
  sale_id: number;
  sale_date: string;
  customer_name: string;
  total_amount: string;
  payment_method: string;
  status: string;
  cashier_name?: string;
  items?: Array<{
    product_name: string;
    quantity: number;
    price: string;
    subtotal: string;
  }>;
}

const DoneOrdersModal: React.FC<DoneOrdersModalProps> = ({ isOpen, onClose }) => {
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<OrderDetail | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const fetchSales = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/sales', {
        params: {
          page: currentPage,
          limit: itemsPerPage,
          status: 'completed,refunded',
          search: searchTerm
        }
      });
      
      if (res.data.pagination) {
        setSales(res.data.data);
        setTotalItems(res.data.pagination.total);
        setTotalPages(res.data.pagination.totalPages);
      } else {
        setSales(res.data);
      }
    } catch (error) {
      console.error("Failed to fetch sales", error);
    } finally {
      setLoading(false);
    }
  }, [currentPage, itemsPerPage, searchTerm]);

  const fetchOrderDetails = async (saleId: number) => {
    setLoadingDetails(true);
    try {
      const res = await api.get(`/sales/${saleId}`);
      setSelectedOrder(res.data);
    } catch (error) {
      console.error("Failed to fetch order details", error);
      alert('Failed to load order details');
    } finally {
      setLoadingDetails(false);
    }
  };

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
      setSelectedOrder(null);
      fetchSales();
    } catch (error) {
      console.error("Failed to refund order", error);
      alert('Failed to refund order');
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchSales();
      setSelectedOrder(null);
    }
  }, [isOpen, fetchSales]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-7xl h-[90vh] flex flex-col overflow-hidden border-2 border-gray-200 animate-in zoom-in-95 duration-300">
        
        {/* Header */}
        <div className="p-6 border-b-2 border-gray-100 bg-gradient-to-r from-emerald-50 via-white to-teal-50">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 p-2.5 rounded-xl shadow-lg">
                <CheckCircle size={28} className="text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-800">Completed Orders</h2>
                <p className="text-sm text-gray-500 mt-0.5">View and manage completed transactions</p>
              </div>
            </div>
            <button 
              onClick={onClose} 
              className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-2 rounded-xl transition-all duration-200"
            >
              <X size={28} />
            </button>
          </div>
        </div>

        {/* Search Bar & Stats */}
        <div className="p-5 border-b-2 border-gray-100 bg-white">
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-xl">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Search by Order ID, Customer Name, or Amount..."
                className="w-full pl-12 pr-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all shadow-sm"
                value={searchTerm}
                onChange={handleSearch}
              />
            </div>
            {!loading && (
              <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border-2 border-emerald-200 rounded-xl px-5 py-3">
                <p className="text-xs text-emerald-600 font-semibold uppercase">Total Orders</p>
                <p className="text-2xl font-bold text-emerald-700">{totalItems}</p>
              </div>
            )}
          </div>
        </div>
        
        {/* Content - Split View */}
        <div className="flex-1 overflow-hidden flex">
          {/* Left Side - Orders List */}
          <div className="flex-1 overflow-auto p-6 bg-gray-50">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-16 w-16 border-4 border-emerald-200 border-t-emerald-600 mx-auto mb-4"></div>
                  <p className="text-gray-500 font-medium">Loading orders...</p>
                </div>
              </div>
            ) : sales.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400">
                <div className="bg-gray-100 p-8 rounded-full mb-4">
                  <Archive size={64} className="opacity-30" />
                </div>
                <p className="text-xl font-semibold text-gray-500">No Completed Orders</p>
                <p className="text-sm text-gray-400 mt-2">Orders will appear here once completed</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-white border-2 border-gray-200 rounded-xl shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-gradient-to-r from-gray-50 to-gray-100 text-gray-700 text-sm uppercase tracking-wider">
                        <tr>
                          <th className="px-6 py-4 font-bold border-b-2 border-gray-200">
                            <div className="flex items-center gap-2">
                              <Package size={16} />
                              Order
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
                        {sales.map(sale => (
                          <tr 
                            key={sale.sale_id} 
                            className={`transition-all cursor-pointer ${
                              selectedOrder?.sale_id === sale.sale_id
                                ? 'bg-emerald-50 hover:bg-emerald-100'
                                : 'hover:bg-gray-50'
                            }`}
                            onClick={() => fetchOrderDetails(sale.sale_id)}
                          >
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
                            <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-end gap-2">
                                <button 
                                  onClick={() => fetchOrderDetails(sale.sale_id)}
                                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-all border border-transparent hover:border-blue-200"
                                  title="View Details"
                                >
                                  <Eye size={18} />
                                </button>
                                <button 
                                  onClick={() => handlePrintOrder(sale.sale_id)}
                                  className="p-2 text-gray-600 hover:bg-gray-50 rounded-lg transition-all border border-transparent hover:border-gray-200"
                                  title="Print Receipt"
                                >
                                  <Printer size={18} />
                                </button>
                                <button 
                                  onClick={() => handleRefund(sale.sale_id)}
                                  disabled={sale.status === 'refunded'}
                                  className={`p-2 rounded-lg transition-all border ${
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
                {totalPages > 0 && (
                  <Pagination 
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                    totalItems={totalItems}
                    itemsPerPage={itemsPerPage}
                    onItemsPerPageChange={(newLimit) => {
                      setItemsPerPage(newLimit);
                      setCurrentPage(1);
                    }}
                  />
                )}
              </div>
            )}
          </div>

          {/* Right Side - Order Details */}
          {selectedOrder && (
            <div className="w-[450px] border-l-2 border-gray-200 bg-white overflow-y-auto">
              {loadingDetails ? (
                <div className="flex items-center justify-center h-full">
                  <div className="animate-spin rounded-full h-12 w-12 border-4 border-emerald-200 border-t-emerald-600"></div>
                </div>
              ) : (
                <div className="p-6 space-y-5">
                  {/* Header */}
                  <div className="flex items-center justify-between pb-4 border-b-2 border-gray-100">
                    <div>
                      <h3 className="text-xl font-bold text-gray-800">Order Details</h3>
                      <p className="text-sm text-gray-500">Order #{selectedOrder.sale_id}</p>
                    </div>
                    <button
                      onClick={() => setSelectedOrder(null)}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-all"
                    >
                      <X size={20} />
                    </button>
                  </div>

                  {/* Status Badge */}
                  <div className={`p-4 rounded-xl border-2 ${
                    selectedOrder.status === 'refunded'
                      ? 'bg-gradient-to-r from-red-50 to-red-100 border-red-200'
                      : 'bg-gradient-to-r from-emerald-50 to-emerald-100 border-emerald-200'
                  }`}>
                    <p className="text-xs font-semibold uppercase mb-1 opacity-75">Status</p>
                    <p className={`text-lg font-bold capitalize ${
                      selectedOrder.status === 'refunded' ? 'text-red-700' : 'text-emerald-700'
                    }`}>
                      {selectedOrder.status}
                    </p>
                  </div>

                  {/* Order Info */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <Calendar size={18} className="text-gray-500" />
                      <div>
                        <p className="text-xs text-gray-500 font-medium">Date & Time</p>
                        <p className="text-sm font-semibold text-gray-800">
                          {new Date(selectedOrder.sale_date).toLocaleString()}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <User size={18} className="text-gray-500" />
                      <div>
                        <p className="text-xs text-gray-500 font-medium">Customer</p>
                        <p className="text-sm font-semibold text-gray-800">
                          {selectedOrder.customer_name || 'Walk-in Customer'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <CreditCard size={18} className="text-gray-500" />
                      <div>
                        <p className="text-xs text-gray-500 font-medium">Payment Method</p>
                        <p className="text-sm font-semibold text-gray-800 capitalize">
                          {selectedOrder.payment_method}
                        </p>
                      </div>
                    </div>

                    {selectedOrder.cashier_name && (
                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <User size={18} className="text-gray-500" />
                        <div>
                          <p className="text-xs text-gray-500 font-medium">Cashier</p>
                          <p className="text-sm font-semibold text-gray-800">
                            {selectedOrder.cashier_name}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Items List */}
                  {selectedOrder.items && selectedOrder.items.length > 0 && (
                    <div>
                      <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                        <Package size={18} />
                        Items ({selectedOrder.items.length})
                      </h4>
                      <div className="space-y-2">
                        {selectedOrder.items.map((item, index) => (
                          <div key={index} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                            <div className="flex justify-between items-start mb-1">
                              <p className="font-semibold text-gray-800 text-sm flex-1">
                                {item.product_name}
                              </p>
                              <p className="font-bold text-gray-800">
                                ${parseFloat(item.subtotal).toFixed(2)}
                              </p>
                            </div>
                            <p className="text-xs text-gray-500">
                              {item.quantity} × ${parseFloat(item.price).toFixed(2)}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Total */}
                  <div className="pt-4 border-t-2 border-gray-200">
                    <div className="flex justify-between items-center p-4 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl border-2 border-emerald-200">
                      <span className="font-bold text-gray-800 text-lg">Total Amount</span>
                      <span className="font-bold text-3xl text-emerald-700">
                        ${parseFloat(selectedOrder.total_amount).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="space-y-2 pt-4">
                    <button
                      onClick={() => handlePrintOrder(selectedOrder.sale_id)}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all shadow-md"
                    >
                      <Printer size={18} />
                      Print Receipt
                    </button>
                    {selectedOrder.status !== 'refunded' && (
                      <button
                        onClick={() => handleRefund(selectedOrder.sale_id)}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl transition-all shadow-md"
                      >
                        <RotateCcw size={18} />
                        Refund Order
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DoneOrdersModal;