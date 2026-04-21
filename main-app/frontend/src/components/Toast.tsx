import React, { createContext, useContext, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

interface Toast {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

interface ToastContextType {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  showToast: (type: Toast['type'], message: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within a ToastProvider');
  return context;
};

const STYLES = {
  success: { bg: 'bg-emerald-600', icon: CheckCircle, bar: 'bg-emerald-400' },
  error:   { bg: 'bg-red-500',     icon: AlertCircle, bar: 'bg-red-300' },
  info:    { bg: 'bg-blue-600',    icon: Info,         bar: 'bg-blue-400' },
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const addToast = useCallback((type: Toast['type'], message: string) => {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    setToasts(prev => {
      const next = [...prev, { id, type, message }];
      return next.length > 5 ? next.slice(-5) : next;
    });
    setTimeout(() => removeToast(id), 3500);
  }, [removeToast]);

  const success = useCallback((m: string) => addToast('success', m), [addToast]);
  const error   = useCallback((m: string) => addToast('error', m),   [addToast]);
  const info    = useCallback((m: string) => addToast('info', m),    [addToast]);
  const showToast = useCallback((type: Toast['type'], message: string) => addToast(type, message), [addToast]);

  return (
    <ToastContext.Provider value={{ success, error, info, showToast }}>
      {children}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
        <AnimatePresence mode="popLayout">
          {toasts.map(toast => {
            const s = STYLES[toast.type];
            const Icon = s.icon;
            return (
              <motion.div
                key={toast.id}
                layout
                initial={{ opacity: 0, x: 80, scale: 0.9 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 80, scale: 0.9, transition: { duration: 0.2 } }}
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                className={`pointer-events-auto relative overflow-hidden flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl min-w-[300px] max-w-[420px] text-white ${s.bg}`}
              >
                {/* progress bar */}
                <motion.div
                  className={`absolute bottom-0 left-0 h-0.5 ${s.bar}`}
                  initial={{ width: '100%' }}
                  animate={{ width: '0%' }}
                  transition={{ duration: 3.5, ease: 'linear' }}
                />
                <div className="flex-shrink-0 bg-white/20 rounded-lg p-1.5">
                  <Icon size={16} />
                </div>
                <span className="flex-1 text-sm font-medium leading-snug">{toast.message}</span>
                <button
                  onClick={() => removeToast(toast.id)}
                  className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity ml-1 p-1 rounded-lg hover:bg-white/20"
                >
                  <X size={14} />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};
