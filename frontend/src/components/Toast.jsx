import { useEffect, useState } from 'react';
import { CheckCircle2, Info, X, XCircle } from 'lucide-react';

const listeners = new Set();
let toastId = 0;

export function toast(message, type = 'success') {
  const id = ++toastId;
  listeners.forEach((listener) => listener({ id, message, type }));
  return id;
}

const ICONS = { success: CheckCircle2, error: XCircle, info: Info };

export default function ToastHost() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const listener = (item) => {
      setToasts((prev) => [...prev, item]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== item.id));
      }, 4000);
    };
    listeners.add(listener);
    return () => listeners.delete(listener);
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="toast-host" aria-live="polite">
      {toasts.map(({ id, message, type }) => {
        const Icon = ICONS[type] || Info;
        return (
          <div key={id} className={`toast toast-${type}`}>
            <Icon size={16} />
            <span>{message}</span>
            <button
              type="button"
              className="toast-close"
              aria-label="Dismiss"
              onClick={() => setToasts((prev) => prev.filter((t) => t.id !== id))}
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
