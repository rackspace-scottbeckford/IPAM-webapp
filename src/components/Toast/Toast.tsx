import { useCallback, useEffect, useState } from 'react';
import styles from './Toast.module.css';

export interface ToastMessage {
  id: string;
  type: 'error' | 'info';
  title: string;
  message: string;
}

interface ToastProps {
  toast: ToastMessage;
  onDismiss: (id: string) => void;
  autoDismissMs?: number;
}

function Toast({ toast, onDismiss, autoDismissMs = 5000 }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(toast.id);
    }, autoDismissMs);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss, autoDismissMs]);

  const typeClass = toast.type === 'error' ? styles.toastError : styles.toastInfo;

  return (
    <div
      className={`${styles.toast} ${typeClass}`}
      role="alert"
      aria-live="assertive"
    >
      <div className={styles.toastContent}>
        <p className={styles.toastTitle}>{toast.title}</p>
        <p className={styles.toastMessage}>{toast.message}</p>
      </div>
      <button
        className={styles.toastClose}
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
      >
        ×
      </button>
    </div>
  );
}

/**
 * Toast container that renders all active toast notifications.
 */
export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Expose addToast globally via a simple event-based approach
  useEffect(() => {
    const handler = (event: CustomEvent<ToastMessage>) => {
      setToasts((prev) => [...prev, event.detail]);
    };
    window.addEventListener('toast:show' as string, handler as EventListener);
    return () => {
      window.removeEventListener('toast:show' as string, handler as EventListener);
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className={styles.toastContainer} aria-label="Notifications">
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onDismiss={dismiss} />
      ))}
    </div>
  );
}

/**
 * Show a toast notification. Can be called from anywhere in the app.
 */
export function showToast(type: 'error' | 'info', title: string, message: string): void {
  const toast: ToastMessage = {
    id: `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    title,
    message,
  };
  window.dispatchEvent(new CustomEvent('toast:show', { detail: toast }));
}
