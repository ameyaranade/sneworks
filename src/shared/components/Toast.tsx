import { createContext, useCallback, useContext, useState, ReactNode } from 'react';
import './toast.css';

interface ToastItem {
  id: number;
  message: string;
  type: 'error' | 'success' | 'info';
  action?: { label: string; onClick: () => void };
  duration?: number;
}

interface ToastContextType {
  showToast: (
    message: string,
    type?: 'error' | 'success' | 'info',
    options?: { action?: { label: string; onClick: () => void }; duration?: number },
  ) => void;
}

const ToastContext = createContext<ToastContextType>({ showToast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback(
    (
      message: string,
      type: 'error' | 'success' | 'info' = 'error',
      options?: { action?: { label: string; onClick: () => void }; duration?: number },
    ) => {
      const id = Date.now() + Math.random();
      const duration = options?.duration ?? 3000;
      setToasts((prev) => [...prev, { id, message, type, action: options?.action, duration }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    },
    [],
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast--${t.type}`}>
            <span className="toast-message">{t.message}</span>
            {t.action && (
              <button
                className="toast-action"
                onClick={() => {
                  t.action!.onClick();
                  setToasts((prev) => prev.filter((x) => x.id !== t.id));
                }}
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
