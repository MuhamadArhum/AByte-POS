import React, { useState, useEffect } from 'react';
import { X, CreditCard, Banknote, Smartphone, Check, Loader2, Printer } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  pendingSale?: any;
}

const CheckoutModal: React.FC<CheckoutModalProps> = ({ isOpen, onClose, onSuccess, pendingSale }) => {
  const { cart, total, clearCart, subtotal, taxAmount, additionalAmount, taxRate, additionalRate } = useCart();
  const { user } = useAuth();
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'online'>('cash');
  const [amountPaid, setAmountPaid] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [successSale, setSuccessSale] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);

  useEffect(() => {
    if (isOpen) {
      setSuccessSale(null);
      setAmountPaid('');
      setPaymentMethod('cash');
      fetchSettings();
    }
  }, [isOpen]);

  const fetchSettings = async () => {
    try {
      const res = await api.get('/settings');
      setSettings(res.data);
    } catch (error) {
      console.error('Failed to fetch settings', error);
    }
  };

  if (!isOpen) return null;

  const currentTotal = pendingSale ? parseFloat(pendingSale.total_amount) : total;

  const handleCheckout = async () => {
    setIsProcessing(true);
    try {
      if (pendingSale) {
        // Complete Pending Sale
        await api.put(`/sales/${pendingSale.sale_id}/complete`, {
          payment_method: paymentMethod,
          amount_paid: parseFloat(amountPaid) || currentTotal
        });

        // Fetch full details for receipt
        const fullSaleRes = await api.get(`/sales/${pendingSale.sale_id}`);
        setSuccessSale(fullSaleRes.data);
      } else {
        // New Sale
        const payload = {
          items: cart.map(item => ({
            product_id: item.product_id,
            product_name: item.product_name,
            quantity: item.quantity,
            unit_price: item.price
          })),
          discount: 0, // Implement discount if needed
          total_amount: total,
          payment_method: paymentMethod,
          amount_paid: parseFloat(amountPaid) || total,
          user_id: user?.user_id,
          status: 'completed',
          tax_percent: taxRate,
          additional_charges_percent: additionalRate
        };

        const res = await api.post('/sales', payload);
        setSuccessSale({
          ...res.data, // Should include items from backend response
          amount_paid: parseFloat(amountPaid) || total
        });
        
        clearCart();
      }
      
      onSuccess(); 
    } catch (error) {
      console.error('Checkout failed', error);
      alert('Checkout failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePrint = () => {
    if (!successSale) return;
    
    const printWindow = window.open('', '', 'width=400,height=600');
    if (!printWindow) return;

    const receiptHtml = `
      <html>
        <head>
          <title>Receipt</title>
          <style>
            body { font-family: 'Courier New', monospace; padding: 20px; text-align: center; font-size: 14px; }
            .header { margin-bottom: 20px; border-bottom: 1px dashed #000; padding-bottom: 10px; }
            .store-name { font-size: 20px; font-weight: bold; margin: 0; }
            .items { text-align: left; width: 100%; border-bottom: 1px dashed #000; padding-bottom: 10px; margin-bottom: 10px; }
            .item-row { display: flex; justify-content: space-between; margin-bottom: 5px; }
            .totals { text-align: right; margin-bottom: 20px; }
            .footer { margin-top: 20px; font-size: 12px; }
            @media print { .no-print { display: none; } }
          </style>
        </head>
        <body>
          <div class="header">
            <p class="store-name">${settings?.store_name || 'AByte POS'}</p>
            <p>${settings?.address || ''}</p>
            <p>${settings?.phone || ''}</p>
            <p>Sale #${successSale.sale_id} | ${new Date().toLocaleString()}</p>
            <p>Cashier: ${user?.name || 'Staff'}</p>
          </div>
          <div class="items">
            ${successSale.items.map((item: any) => `
              <div class="item-row">
                <span>${item.product_name} x${item.quantity}</span>
                <span>$${(item.unit_price * item.quantity).toFixed(2)}</span>
              </div>
            `).join('')}
          </div>
          <div class="totals">
            ${successSale.tax_amount > 0 ? `<p>Tax (${successSale.tax_percent}%): $${parseFloat(successSale.tax_amount).toFixed(2)}</p>` : ''}
            ${successSale.additional_charges_amount > 0 ? `<p>Add. Charges (${successSale.additional_charges_percent}%): $${parseFloat(successSale.additional_charges_amount).toFixed(2)}</p>` : ''}
            <p><strong>Total: $${parseFloat(successSale.total_amount).toFixed(2)}</strong></p>
            <p>Paid: $${parseFloat(successSale.amount_paid).toFixed(2)}</p>
            <p>Change: $${(successSale.amount_paid - successSale.total_amount).toFixed(2)}</p>
            <p>Method: ${successSale.payment_method?.toUpperCase()}</p>
          </div>
          <div class="footer">
            <p>${settings?.receipt_footer || 'Thank you for shopping with us!'}</p>
          </div>
          <script>
            window.onload = function() { window.print(); setTimeout(function(){ window.close(); }, 500); }
          </script>
        </body>
      </html>
    `;
    printWindow.document.write(receiptHtml);
    printWindow.document.close();
  };

  if (successSale) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200 p-8 text-center">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4 text-emerald-600">
            <Check size={32} />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Payment Successful!</h2>
          <p className="text-gray-500 mb-8">
            Change Due: <span className="font-bold text-emerald-600">${(successSale.amount_paid - successSale.total_amount).toFixed(2)}</span>
          </p>
          
          <div className="flex gap-4">
            <button
              onClick={handlePrint}
              className="flex-1 flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold py-3 rounded-xl transition-colors"
            >
              <Printer size={20} />
              Print Receipt
            </button>
            <button
              onClick={() => {
                onClose();
                setSuccessSale(null);
              }}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h2 className="text-xl font-bold text-gray-800">Checkout</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="flex justify-between items-center text-lg">
            <span className="text-gray-600">Total Amount</span>
            <span className="font-bold text-2xl text-emerald-600">${currentTotal.toFixed(2)}</span>
          </div>

          <div className="space-y-3">
            <label className="text-sm font-medium text-gray-700">Payment Method</label>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => setPaymentMethod('cash')}
                className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${
                  paymentMethod === 'cash' 
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700' 
                    : 'border-gray-200 hover:border-gray-300 text-gray-600'
                }`}
              >
                <Banknote size={24} />
                <span className="text-xs font-medium">Cash</span>
              </button>
              <button
                onClick={() => setPaymentMethod('card')}
                className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${
                  paymentMethod === 'card' 
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700' 
                    : 'border-gray-200 hover:border-gray-300 text-gray-600'
                }`}
              >
                <CreditCard size={24} />
                <span className="text-xs font-medium">Card</span>
              </button>
              <button
                onClick={() => setPaymentMethod('online')}
                className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${
                  paymentMethod === 'online' 
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700' 
                    : 'border-gray-200 hover:border-gray-300 text-gray-600'
                }`}
              >
                <Smartphone size={24} />
                <span className="text-xs font-medium">Online</span>
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-sm font-medium text-gray-700">Amount Paid ($)</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="text-gray-500">$</span>
              </div>
              <input
                type="number"
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value)}
                placeholder={currentTotal.toFixed(2)}
                className="w-full pl-8 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
              />
            </div>
            {amountPaid && parseFloat(amountPaid) < currentTotal && (
              <p className="text-xs text-red-500 flex items-center gap-1">
                <X size={12} />
                Insufficient amount
              </p>
            )}
          </div>

          <button
            onClick={handleCheckout}
            disabled={isProcessing || (amountPaid ? parseFloat(amountPaid) < currentTotal : false)}
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2"
          >
            {isProcessing ? (
              <Loader2 className="animate-spin" size={24} />
            ) : (
              <>
                <Check size={24} />
                Complete Payment
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CheckoutModal;
