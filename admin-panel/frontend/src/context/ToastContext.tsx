import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from 'react';
import { CheckCircle, XCircle, X, Info } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';
interface ToastItem { id: number; type: ToastType; message: string; }
interface ToastCtx  { toast: (type: ToastType, message: string) => void; }

const ToastContext = createContext<ToastCtx>({ toast: () => {} });

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const toast = useCallback((type: ToastType, message: string) => {
    const id = ++counter.current;
    setToasts(p => [...p, { id, type, message }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 4000);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts(p => p.filter(t => t.id !== id));
  }, []);

  const iconMap = { success: CheckCircle, error: XCircle, info: Info };
  const colorMap = {
    success: 'border-emerald-200 text-emerald-800',
    error:   'border-red-200   text-red-700',
    info:    'border-blue-200  text-blue-700',
  };
  const iconColorMap = {
    success: 'text-emerald-500',
    error:   'text-red-500',
    info:    'text-blue-500',
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none" style={{ minWidth: 280 }}>
        {toasts.map(t => {
          const Icon = iconMap[t.type];
          return (
            <div
              key={t.id}
              className={`flex items-center gap-3 pl-4 pr-3 py-3 rounded-2xl shadow-xl text-sm font-medium pointer-events-auto border bg-white ${colorMap[t.type]}`}
            >
              <Icon size={16} className={`flex-shrink-0 ${iconColorMap[t.type]}`} />
              <span className="flex-1">{t.message}</span>
              <button
                onClick={() => dismiss(t.id)}
                className="text-slate-400 hover:text-slate-600 p-0.5 transition"
              >
                <X size={13} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
