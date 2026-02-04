import { useState } from 'react';
import { X, ArrowDownCircle, ArrowUpCircle, Loader2 } from 'lucide-react';
import api from '../utils/api';

interface CashMovementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const REASONS = ['Petty Cash', 'Change Float', 'Vendor Payment', 'Tips', 'Other'];

const CashMovementModal: React.FC<CashMovementModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [type, setType] = useState<'cash_in' | 'cash_out'>('cash_in');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) {
      alert('Please enter a valid amount');
      return;
    }
    const finalReason = reason === 'Other' ? customReason : reason;
    if (!finalReason) {
      alert('Please provide a reason');
      return;
    }

    setIsProcessing(true);
    try {
      await api.post('/register/cash-movement', { type, amount: amt, reason: finalReason });
      setAmount('');
      setReason('');
      setCustomReason('');
      onSuccess();
      onClose();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to record movement');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h2 className="text-xl font-bold text-gray-800">Cash Movement</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
        </div>

        <div className="p-6 space-y-5">
          {/* Type Selection */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setType('cash_in')}
              className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${
                type === 'cash_in' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              <ArrowDownCircle size={28} />
              <span className="font-medium">Cash In</span>
            </button>
            <button
              onClick={() => setType('cash_out')}
              className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${
                type === 'cash_out' ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              <ArrowUpCircle size={28} />
              <span className="font-medium">Cash Out</span>
            </button>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Amount ($)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-lg font-bold focus:ring-2 focus:ring-emerald-500 outline-none"
              placeholder="0.00"
              min="0"
              step="0.01"
            />
          </div>

          {/* Reason */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {REASONS.map(r => (
                <button
                  key={r}
                  onClick={() => setReason(r)}
                  className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                    reason === r ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            {reason === 'Other' && (
              <input
                type="text"
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                placeholder="Enter reason..."
              />
            )}
          </div>

          <button
            onClick={handleSubmit}
            disabled={isProcessing}
            className={`w-full font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 text-white ${
              type === 'cash_in' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'
            } disabled:bg-gray-300`}
          >
            {isProcessing ? <Loader2 className="animate-spin" size={20} /> : null}
            Record {type === 'cash_in' ? 'Cash In' : 'Cash Out'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CashMovementModal;
