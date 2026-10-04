import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';

interface Toast {
  id: number;
  tone: 'success' | 'error';
  title: string;
  text?: string;
}

interface ToastApi {
  success: (title: string, text?: string) => void;
  error: (title: string, text?: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((tone: Toast['tone'], title: string, text?: string) => {
    const id = nextId++;
    setToasts((current) => [...current.slice(-2), { id, tone, title, text }]);
    window.setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 4500);
  }, []);

  const api = useMemo<ToastApi>(
    () => ({ success: (title, text) => push('success', title, text), error: (title, text) => push('error', title, text) }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-stack" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.tone}`} role="status">
            <span className="toast-icon">{toast.tone === 'success' ? <CheckCircle2 /> : <XCircle />}</span>
            <div>
              <div className="toast-title">{toast.title}</div>
              {toast.text && <div className="toast-text">{toast.text}</div>}
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside ToastProvider');
  return context;
}
