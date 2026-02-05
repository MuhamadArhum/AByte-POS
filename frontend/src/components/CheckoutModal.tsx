import React, { useState, useEffect } from 'react';
import { X, CreditCard, Banknote, Smartphone, Check, Loader2, Printer } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { printReceipt } from '../utils/receiptPrinter';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  pendingSale?: any;
  selectedCustomer?: any;
}

const CheckoutModal: React.FC<CheckoutModalProps> = ({ isOpen, onClose, onSuccess, pendingSale, selectedCustomer }) => {
  const { cart, total, clearCart, subtotal, taxAmount, additionalAmount, taxRate, additionalRate } = useCart();
  const { user } = useAuth();
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'online' | 'split'>('cash');
  const [amountPaid, setAmountPaid] = useState('');
  const [splitCash, setSplitCash] = useState('');
  const [splitCard, setSplitCard] = useState('');
  const [discount, setDiscount] = useState('');
  const [note, setNote] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [successSale, setSuccessSale] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);

  useEffect(() => {
    if (isOpen) {
      setSuccessSale(null);
      setAmountPaid('');
      setSplitCash('');
      setSplitCard('');
      setDiscount('');
      setNote('');
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

  const baseTotal = pendingSale ? parseFloat(pendingSale.total_amount) : total;
  const discountValue = parseFloat(discount) || 0;
  const finalTotal = Math.max(0, baseTotal - discountValue);
  const changeDue = paymentMethod === 'split' 
    ? 0 // Split is exact usually, or we can calc change from cash part
    : Math.max(0, (parseFloat(amountPaid) || 0) - finalTotal);

  const handleCheckout = async () => {
    setIsProcessing(true);
    try {
      // Validate Split
      let finalAmountPaid = parseFloat(amountPaid) || finalTotal;
      let paymentMethodStr = paymentMethod;
      let noteStr = note;

      if (paymentMethod === 'split') {
        const cash = parseFloat(splitCash) || 0;
        const card = parseFloat(splitCard) || 0;
        if (Math.abs((cash + card) - finalTotal) > 0.01) {
          alert(`Split amounts ($${(cash + card).toFixed(2)}) do not match Total ($${finalTotal.toFixed(2)})`);
          setIsProcessing(false);
          return;
        }
        finalAmountPaid = finalTotal;
        noteStr = `${note ? note + ' | ' : ''}Split: Cash $${cash.toFixed(2)}, Card $${card.toFixed(2)}`;
        // For backend simplicity, we still send 'split' or 'cash' as main method, 
        // but here we append details to note. 
        // Ideally backend should have split columns, but note is a good fallback.
      }

      if (pendingSale) {
        // Complete Pending Sale
        await api.put(`/sales/${pendingSale.sale_id}/complete`, {
          payment_method: paymentMethodStr,
          amount_paid: finalAmountPaid,
          note: noteStr
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
          customer_id: selectedCustomer?.customer_id || 1,
          discount: discountValue,
          total_amount: finalTotal,
          payment_method: paymentMethodStr,
          amount_paid: finalAmountPaid,
          user_id: user?.user_id,
          status: 'completed',
          tax_percent: taxRate,
          additional_charges_percent: additionalRate,
          note: noteStr
        };

        const res = await api.post('/sales', payload);
        setSuccessSale({
          ...res.data, // Should include items from backend response
          amount_paid: finalAmountPaid
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
    printReceipt(
      successSale,
      settings,
      user?.name || 'Staff',
      selectedCustomer?.customer_name
    );
  };

  if (successSale) {
    const changeDueAmount = Math.max(0, parseFloat(successSale.amount_paid || 0) - parseFloat(successSale.total_amount || 0));
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200 p-8 text-center">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4 text-emerald-600">
            <Check size={32} />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Payment Successful!</h2>
          <p className="text-gray-500 mb-8">
            Change Due: <span className="font-bold text-emerald-600">${changeDueAmount.toFixed(2)}</span>
          </p>

          <div className="flex gap-4">
            <button
              onClick={() => {
                onClose();
                setSuccessSale(null);
              }}
              className="flex-1 flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold py-3 rounded-xl transition-colors"
            >
              Paid
            </button>
            <button
              onClick={() => {
                handlePrint();
                onClose();
                setSuccessSale(null);
              }}
              className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl transition-colors"
            >
              <Printer size={20} />
              Paid & Print
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
          <div className="space-y-2 bg-gray-50 p-4 rounded-xl border border-gray-100">
            <div className="flex justify-between items-center text-gray-600">
              <span>Subtotal</span>
              <span>${baseTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center text-gray-600">
               <span className="flex items-center gap-1">Discount <span className="text-xs text-gray-400">(Optional)</span></span>
               <div className="flex items-center gap-1 w-28">
                 <span className="text-gray-400">- $</span>
                 <input 
                   type="number"
                   value={discount}
                   onChange={(e) => setDiscount(e.target.value)}
                   className="w-full px-2 py-1 border border-gray-200 rounded text-right focus:border-emerald-500 outline-none"
                   placeholder="0.00"
                 />
               </div>
            </div>
            <div className="flex justify-between items-center text-lg pt-2 border-t border-gray-200">
              <span className="font-bold text-gray-800">Net Payable</span>
              <span className="font-bold text-2xl text-emerald-600">${finalTotal.toFixed(2)}</span>
            </div>
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
            <button
                onClick={() => setPaymentMethod('split')}
                className={`w-full mt-2 p-2 rounded-xl border flex items-center justify-center gap-2 transition-all ${
                  paymentMethod === 'split' 
                    ? 'border-orange-500 bg-orange-50 text-orange-700' 
                    : 'border-gray-200 hover:border-gray-300 text-gray-600'
                }`}
              >
                <span className="font-bold text-lg">½</span>
                <span className="text-sm font-medium">Split Payment (Cash + Card)</span>
            </button>
          </div>

          <div className="space-y-3">
             <label className="text-sm font-medium text-gray-700">Note <span className="text-xs text-gray-400 font-normal">(Optional)</span></label>
             <textarea
               value={note}
               onChange={(e) => setNote(e.target.value)}
               placeholder="Add a note to this sale..."
               className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all resize-none h-20"
             />
          </div>

          {paymentMethod === 'split' ? (
             <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cash ($)</label>
                <input
                  type="number"
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none font-bold"
                  value={splitCash}
                  onChange={(e) => setSplitCash(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Card ($)</label>
                <input
                  type="number"
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none font-bold"
                  value={splitCard}
                  onChange={(e) => setSplitCard(e.target.value)}
                  placeholder="0.00"
                />
              </div>
             </div>
          ) : (
             <div className="space-y-2">
               <label className="text-sm font-medium text-gray-700">Amount Paid</label>
               <div className="relative">
                 <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium">$</span>
                 <input
                   type="number"
                   value={amountPaid}
                   onChange={(e) => setAmountPaid(e.target.value)}
                   className="w-full pl-8 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all font-bold text-lg"
                   placeholder={finalTotal.toFixed(2)}
                 />
               </div>
               <div className="flex justify-between items-center text-sm">
                 <span className="text-gray-500">Change Due</span>
                 <span className="font-bold text-gray-800">${changeDue.toFixed(2)}</span>
               </div>
             </div>
          )}

          <button
            onClick={handleCheckout}
            disabled={isProcessing || (amountPaid ? parseFloat(amountPaid) < finalTotal : false)}
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
