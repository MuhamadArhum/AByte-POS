import React, { useState, useEffect } from 'react';
import { X, CreditCard, Banknote, Smartphone, Check, Loader2, Printer, Tag, Star, BookOpen } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { printReceipt, printToThermalPrinter, isThermalPrinterAvailable } from '../utils/receiptPrinter';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  pendingSale?: any;
  selectedCustomer?: any;
  appliedBundles?: any[];
}

const CheckoutModal: React.FC<CheckoutModalProps> = ({ isOpen, onClose, onSuccess, pendingSale, selectedCustomer, appliedBundles = [] }) => {
  const { cart, total, clearCart, subtotal, taxAmount, additionalAmount, taxRate, additionalRate } = useCart();
  const { user } = useAuth();
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'online' | 'split' | 'credit'>('cash');
  const [amountPaid, setAmountPaid] = useState('');
  const [splitCash, setSplitCash] = useState('');
  const [splitCard, setSplitCard] = useState('');
  const [discount, setDiscount] = useState('');
  const [note, setNote] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [successSale, setSuccessSale] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);

  // Coupon state
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [couponError, setCouponError] = useState('');
  const [applyingCoupon, setApplyingCoupon] = useState(false);

  // Loyalty state
  const [loyaltyInfo, setLoyaltyInfo] = useState<any>(null);
  const [redeemPoints, setRedeemPoints] = useState(false);
  const [pointsToRedeem, setPointsToRedeem] = useState('');

  // Credit sale state
  const [creditDueDate, setCreditDueDate] = useState('');

  useEffect(() => {
    if (isOpen) {
      setSuccessSale(null);
      setAmountPaid('');
      setSplitCash('');
      setSplitCard('');
      setDiscount('');
      setNote('');
      setPaymentMethod('cash');
      setCouponCode('');
      setAppliedCoupon(null);
      setCouponError('');
      setRedeemPoints(false);
      setPointsToRedeem('');
      setCreditDueDate('');
      fetchSettings();
      if (selectedCustomer && selectedCustomer.customer_id !== 1) {
        fetchLoyaltyInfo(selectedCustomer.customer_id);
      } else {
        setLoyaltyInfo(null);
      }
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

  const fetchLoyaltyInfo = async (customerId: number) => {
    try {
      const [configRes, pointsRes] = await Promise.all([
        api.get('/loyalty/config'),
        api.get(`/loyalty/customer/${customerId}`)
      ]);
      if (configRes.data?.is_active) {
        setLoyaltyInfo({
          config: configRes.data,
          points: pointsRes.data?.loyalty_points || 0
        });
      } else {
        setLoyaltyInfo(null);
      }
    } catch {
      setLoyaltyInfo(null);
    }
  };

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    setApplyingCoupon(true);
    setCouponError('');
    try {
      const res = await api.post('/coupons/validate', {
        code: couponCode.trim(),
        order_total: baseTotal
      });
      setAppliedCoupon(res.data);
      setCouponError('');
    } catch (err: any) {
      setCouponError(err.response?.data?.message || 'Invalid coupon');
      setAppliedCoupon(null);
    } finally {
      setApplyingCoupon(false);
    }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode('');
    setCouponError('');
  };

  if (!isOpen) return null;

  const baseTotal = pendingSale ? parseFloat(pendingSale.total_amount) : total;
  const discountValue = parseFloat(discount) || 0;
  const couponDiscount = appliedCoupon ? parseFloat(appliedCoupon.discount_amount) : 0;

  // Loyalty redemption calculation
  let loyaltyDiscount = 0;
  if (redeemPoints && loyaltyInfo) {
    const pts = parseInt(pointsToRedeem) || 0;
    const maxPts = Math.min(pts, loyaltyInfo.points, loyaltyInfo.config.min_redeem_points ? Math.max(pts, 0) : pts);
    loyaltyDiscount = maxPts * parseFloat(loyaltyInfo.config.amount_per_point || 0);
  }

  const finalTotal = Math.max(0, baseTotal - discountValue - couponDiscount - loyaltyDiscount);
  const changeDue = paymentMethod === 'split' || paymentMethod === 'credit'
    ? 0
    : Math.max(0, (parseFloat(amountPaid) || 0) - finalTotal);

  const handleCheckout = async () => {
    // Validate credit sale
    if (paymentMethod === 'credit') {
      if (!selectedCustomer || selectedCustomer.customer_id === 1) {
        alert('Credit sales require a named customer (not Walk-in).');
        return;
      }
      if (!creditDueDate) {
        alert('Please set a due date for the credit sale.');
        return;
      }
    }

    setIsProcessing(true);
    try {
      let finalAmountPaid = parseFloat(amountPaid) || finalTotal;
      let paymentMethodStr: string = paymentMethod;
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
      }

      if (paymentMethod === 'credit') {
        finalAmountPaid = 0;
        paymentMethodStr = 'credit';
      }

      if (pendingSale) {
        await api.put(`/sales/${pendingSale.sale_id}/complete`, {
          payment_method: paymentMethodStr,
          amount_paid: finalAmountPaid,
          note: noteStr
        });
        const fullSaleRes = await api.get(`/sales/${pendingSale.sale_id}`);
        setSuccessSale(fullSaleRes.data);
      } else {
        // Build loyalty redeem points
        let loyaltyRedeemPts = 0;
        if (redeemPoints && loyaltyInfo) {
          loyaltyRedeemPts = parseInt(pointsToRedeem) || 0;
          loyaltyRedeemPts = Math.min(loyaltyRedeemPts, loyaltyInfo.points);
        }

        const payload: any = {
          items: cart.map(item => ({
            product_id: item.product_id,
            product_name: item.product_name,
            quantity: item.quantity,
            unit_price: item.price,
            variant_id: item.variant_id || null,
            variant_name: item.variant_name || null
          })),
          customer_id: selectedCustomer?.customer_id || 1,
          discount: discountValue,
          total_amount: finalTotal,
          payment_method: paymentMethodStr,
          amount_paid: finalAmountPaid,
          user_id: user?.user_id,
          status: paymentMethod === 'credit' ? 'completed' : 'completed',
          tax_percent: taxRate,
          additional_charges_percent: additionalRate,
          note: noteStr,
          applied_bundles: appliedBundles || []
        };

        // Coupon
        if (appliedCoupon) {
          payload.coupon_code = couponCode.trim();
          payload.coupon_discount = couponDiscount;
        }

        // Loyalty
        if (loyaltyRedeemPts > 0) {
          payload.loyalty_redeem_points = loyaltyRedeemPts;
        }

        // Credit sale
        if (paymentMethod === 'credit') {
          payload.is_credit = true;
          payload.credit_due_date = creditDueDate;
        }

        const res = await api.post('/sales', payload);
        setSuccessSale({
          ...res.data,
          amount_paid: finalAmountPaid
        });

        clearCart();
      }

      onSuccess();
    } catch (error: any) {
      console.error('Checkout failed', error);
      alert(error.response?.data?.message || 'Checkout failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePrint = async () => {
    if (!successSale) return;
    if (isThermalPrinterAvailable()) {
      await printToThermalPrinter(
        successSale,
        settings,
        user?.name || 'Staff',
        selectedCustomer?.customer_name
      );
    } else {
      printReceipt(
        successSale,
        settings,
        user?.name || 'Staff',
        selectedCustomer?.customer_name
      );
    }
  };

  if (successSale) {
    const changeDueAmount = paymentMethod === 'credit' ? 0 : Math.max(0, parseFloat(successSale.amount_paid || 0) - parseFloat(successSale.total_amount || 0));
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200 p-8 text-center">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4 text-emerald-600">
            <Check size={32} />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            {paymentMethod === 'credit' ? 'Credit Sale Recorded!' : 'Payment Successful!'}
          </h2>
          {paymentMethod === 'credit' ? (
            <p className="text-gray-500 mb-8">
              Amount Due: <span className="font-bold text-orange-600">${finalTotal.toFixed(2)}</span>
              <br />
              <span className="text-sm">Due: {creditDueDate}</span>
            </p>
          ) : (
            <p className="text-gray-500 mb-8">
              Change Due: <span className="font-bold text-emerald-600">${changeDueAmount.toFixed(2)}</span>
            </p>
          )}

          {successSale.loyalty_points_earned > 0 && (
            <p className="text-amber-600 text-sm mb-4">
              <Star size={14} className="inline mr-1" />
              {successSale.loyalty_points_earned} loyalty points earned!
            </p>
          )}

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
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50 shrink-0">
          <h2 className="text-xl font-bold text-gray-800">Checkout</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto">
          {/* Price Summary */}
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
            {couponDiscount > 0 && (
              <div className="flex justify-between items-center text-green-600">
                <span className="flex items-center gap-1"><Tag size={14} /> Coupon</span>
                <span>- ${couponDiscount.toFixed(2)}</span>
              </div>
            )}
            {loyaltyDiscount > 0 && (
              <div className="flex justify-between items-center text-amber-600">
                <span className="flex items-center gap-1"><Star size={14} /> Points</span>
                <span>- ${loyaltyDiscount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between items-center text-lg pt-2 border-t border-gray-200">
              <span className="font-bold text-gray-800">Net Payable</span>
              <span className="font-bold text-2xl text-emerald-600">${finalTotal.toFixed(2)}</span>
            </div>
          </div>

          {/* Coupon Section */}
          {!pendingSale && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-1"><Tag size={14} /> Coupon Code</label>
              {appliedCoupon ? (
                <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl px-4 py-2">
                  <div>
                    <span className="font-bold text-green-700">{couponCode}</span>
                    <span className="text-green-600 text-sm ml-2">-${couponDiscount.toFixed(2)} off</span>
                  </div>
                  <button onClick={removeCoupon} className="text-red-400 hover:text-red-600"><X size={16} /></button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={couponCode}
                    onChange={(e) => { setCouponCode(e.target.value.toUpperCase()); setCouponError(''); }}
                    className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none uppercase"
                    placeholder="Enter code"
                  />
                  <button
                    onClick={handleApplyCoupon}
                    disabled={applyingCoupon || !couponCode.trim()}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white rounded-lg font-medium text-sm"
                  >
                    {applyingCoupon ? '...' : 'Apply'}
                  </button>
                </div>
              )}
              {couponError && <p className="text-red-500 text-xs">{couponError}</p>}
            </div>
          )}

          {/* Loyalty Points Section */}
          {loyaltyInfo && !pendingSale && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-amber-800 flex items-center gap-1"><Star size={14} /> Loyalty Points</span>
                <span className="font-bold text-amber-700">{loyaltyInfo.points} pts</span>
              </div>
              {loyaltyInfo.points >= (loyaltyInfo.config.min_redeem_points || 0) && loyaltyInfo.points > 0 && (
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-sm text-amber-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={redeemPoints}
                      onChange={(e) => {
                        setRedeemPoints(e.target.checked);
                        if (!e.target.checked) setPointsToRedeem('');
                      }}
                      className="rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                    />
                    Redeem
                  </label>
                  {redeemPoints && (
                    <input
                      type="number"
                      value={pointsToRedeem}
                      onChange={(e) => {
                        const val = Math.min(parseInt(e.target.value) || 0, loyaltyInfo.points);
                        setPointsToRedeem(val > 0 ? String(val) : '');
                      }}
                      max={loyaltyInfo.points}
                      className="w-24 px-2 py-1 border border-amber-300 rounded text-right focus:ring-amber-500 outline-none text-sm"
                      placeholder={`Max ${loyaltyInfo.points}`}
                    />
                  )}
                  {redeemPoints && loyaltyDiscount > 0 && (
                    <span className="text-xs text-amber-600">= ${loyaltyDiscount.toFixed(2)} off</span>
                  )}
                </div>
              )}
              {loyaltyInfo.points < (loyaltyInfo.config.min_redeem_points || 0) && (
                <p className="text-xs text-amber-600">Min {loyaltyInfo.config.min_redeem_points} points to redeem</p>
              )}
            </div>
          )}

          {/* Payment Method */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-gray-700">Payment Method</label>
            <div className="grid grid-cols-4 gap-2">
              <button
                onClick={() => setPaymentMethod('cash')}
                className={`p-3 rounded-xl border flex flex-col items-center gap-1 transition-all ${
                  paymentMethod === 'cash'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                    : 'border-gray-200 hover:border-gray-300 text-gray-600'
                }`}
              >
                <Banknote size={20} />
                <span className="text-xs font-medium">Cash</span>
              </button>
              <button
                onClick={() => setPaymentMethod('card')}
                className={`p-3 rounded-xl border flex flex-col items-center gap-1 transition-all ${
                  paymentMethod === 'card'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                    : 'border-gray-200 hover:border-gray-300 text-gray-600'
                }`}
              >
                <CreditCard size={20} />
                <span className="text-xs font-medium">Card</span>
              </button>
              <button
                onClick={() => setPaymentMethod('online')}
                className={`p-3 rounded-xl border flex flex-col items-center gap-1 transition-all ${
                  paymentMethod === 'online'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                    : 'border-gray-200 hover:border-gray-300 text-gray-600'
                }`}
              >
                <Smartphone size={20} />
                <span className="text-xs font-medium">Online</span>
              </button>
              <button
                onClick={() => setPaymentMethod('credit')}
                className={`p-3 rounded-xl border flex flex-col items-center gap-1 transition-all ${
                  paymentMethod === 'credit'
                    ? 'border-orange-500 bg-orange-50 text-orange-700'
                    : 'border-gray-200 hover:border-gray-300 text-gray-600'
                }`}
              >
                <BookOpen size={20} />
                <span className="text-xs font-medium">Credit</span>
              </button>
            </div>
            <button
                onClick={() => setPaymentMethod('split')}
                className={`w-full mt-1 p-2 rounded-xl border flex items-center justify-center gap-2 transition-all ${
                  paymentMethod === 'split'
                    ? 'border-orange-500 bg-orange-50 text-orange-700'
                    : 'border-gray-200 hover:border-gray-300 text-gray-600'
                }`}
              >
                <span className="font-bold text-lg">½</span>
                <span className="text-sm font-medium">Split Payment (Cash + Card)</span>
            </button>
          </div>

          {/* Note */}
          <div className="space-y-2">
             <label className="text-sm font-medium text-gray-700">Note <span className="text-xs text-gray-400 font-normal">(Optional)</span></label>
             <textarea
               value={note}
               onChange={(e) => setNote(e.target.value)}
               placeholder="Add a note to this sale..."
               className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all resize-none h-16"
             />
          </div>

          {/* Credit Due Date */}
          {paymentMethod === 'credit' && (
            <div className="space-y-2 bg-orange-50 border border-orange-200 rounded-xl p-3">
              <label className="text-sm font-medium text-orange-800">Due Date *</label>
              <input
                type="date"
                value={creditDueDate}
                onChange={(e) => setCreditDueDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="w-full px-3 py-2 border border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
              />
              {selectedCustomer?.customer_id === 1 || !selectedCustomer ? (
                <p className="text-xs text-red-600">Select a named customer for credit sales</p>
              ) : null}
            </div>
          )}

          {/* Payment Input */}
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
          ) : paymentMethod === 'credit' ? (
            <div className="text-center text-orange-700 text-sm font-medium py-2">
              Full amount of ${finalTotal.toFixed(2)} will be recorded as credit
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
            disabled={isProcessing || (paymentMethod !== 'credit' && paymentMethod !== 'split' && amountPaid ? parseFloat(amountPaid) < finalTotal : false)}
            className={`w-full font-bold py-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 ${
              paymentMethod === 'credit'
                ? 'bg-orange-600 hover:bg-orange-700 shadow-orange-600/20 text-white disabled:bg-gray-300 disabled:cursor-not-allowed'
                : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20 text-white disabled:bg-gray-300 disabled:cursor-not-allowed'
            }`}
          >
            {isProcessing ? (
              <Loader2 className="animate-spin" size={24} />
            ) : (
              <>
                <Check size={24} />
                {paymentMethod === 'credit' ? 'Record Credit Sale' : 'Complete Payment'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CheckoutModal;
