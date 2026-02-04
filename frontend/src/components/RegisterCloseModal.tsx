import { useState } from 'react';
import { X, Lock, Loader2, AlertTriangle, CheckCircle } from 'lucide-react';
import api from '../utils/api';

interface RegisterCloseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  expectedCash: number;
  register: any;
}

const RegisterCloseModal: React.FC<RegisterCloseModalProps> = ({ isOpen, onClose, onSuccess, expectedCash, register }) => {
  const [closingBalance, setClosingBalance] = useState('');
  const [closeNote, setCloseNote] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  const closingValue = parseFloat(closingBalance) || 0;
  const difference = closingValue - expectedCash;

  const handleClose = async () => {
    if (!closingBalance || parseFloat(closingBalance) < 0) {
      alert('Please enter a valid closing balance');
      return;
    }

    setIsProcessing(true);
    try {
      await api.post('/register/close', {
        closing_balance: parseFloat(closingBalance),
        close_note: closeNote
      });
      setClosingBalance('');
      setCloseNote('');
      onSuccess();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to close register');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-red-50">
          <h2 className="text-xl font-bold text-red-800 flex items-center gap-2">
            <Lock size={22} />
            Close Register
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
        </div>

        <div className="p-6 space-y-5">
          {/* Shift Summary */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
            <h3 className="font-bold text-gray-800 mb-3">Shift Summary</h3>
            <div className="flex justify-between">
              <span className="text-gray-500">Opening Balance:</span>
              <span className="font-medium">${parseFloat(register.opening_balance).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Cash Sales:</span>
              <span className="font-medium text-emerald-600">+${parseFloat(register.cash_sales_total).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Card Sales:</span>
              <span className="font-medium text-blue-600">${parseFloat(register.card_sales_total).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Cash In:</span>
              <span className="font-medium text-emerald-600">+${parseFloat(register.total_cash_in).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Cash Out:</span>
              <span className="font-medium text-red-600">-${parseFloat(register.total_cash_out).toFixed(2)}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-gray-200 font-bold">
              <span>Expected Cash:</span>
              <span>${expectedCash.toFixed(2)}</span>
            </div>
          </div>

          {/* Closing Balance */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Actual Cash Count ($)</label>
            <input
              type="number"
              value={closingBalance}
              onChange={(e) => setClosingBalance(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-lg font-bold focus:ring-2 focus:ring-emerald-500 outline-none"
              placeholder="Count the cash in drawer"
              min="0"
              step="0.01"
            />
          </div>

          {/* Difference */}
          {closingBalance && (
            <div className={`p-4 rounded-xl flex items-center gap-3 ${
              Math.abs(difference) < 0.01 ? 'bg-emerald-50 text-emerald-700' :
              difference > 0 ? 'bg-blue-50 text-blue-700' : 'bg-red-50 text-red-700'
            }`}>
              {Math.abs(difference) < 0.01 ? (
                <CheckCircle size={20} />
              ) : (
                <AlertTriangle size={20} />
              )}
              <div>
                <p className="font-bold">
                  {Math.abs(difference) < 0.01 ? 'Balanced' :
                   difference > 0 ? `Over by $${difference.toFixed(2)}` : `Short by $${Math.abs(difference).toFixed(2)}`}
                </p>
              </div>
            </div>
          )}

          {/* Note */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Closing Note (Optional)</label>
            <textarea
              value={closeNote}
              onChange={(e) => setCloseNote(e.target.value)}
              className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none resize-none h-20"
              placeholder="Any notes about this shift..."
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-3 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleClose}
              disabled={isProcessing || !closingBalance}
              className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-300 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {isProcessing ? <Loader2 className="animate-spin" size={20} /> : <Lock size={20} />}
              Close Register
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterCloseModal;
