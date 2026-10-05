import { useState, createContext, useContext } from 'react';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

const ToastContext = createContext(null);

const toastStyles = {
  success: { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-50 border-green-200' },
  error: { icon: AlertCircle, color: 'text-red-500', bg: 'bg-red-50 border-red-200' },
  info: { icon: Info, color: 'text-blue-500', bg: 'bg-blue-50 border-blue-200' },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const showToast = (message, type = 'info', duration = 4000) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed top-4 left-4 z-[100] space-y-3">
        {toasts.map((toast) => {
          const { icon: Icon, color, bg } = toastStyles[toast.type] || toastStyles.info;
          return (
            <div key={toast.id} className={`${bg} border rounded-lg shadow-lg p-4 flex items-start gap-3 max-w-sm`}>
              <Icon className={`w-5 h-5 shrink-0 ${color}`} />
              <div className="text-sm text-gray-800 font-medium flex-1" dir="rtl">{toast.message}</div>
              <button onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
}
