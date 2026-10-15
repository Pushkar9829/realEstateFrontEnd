import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { cn } from '@/shared/lib/cn';

const ToastContext = createContext(null);
const ICON = { success: CheckCircle2, error: AlertCircle, info: Info };
const TONE = { success: 'border-success-100', error: 'border-danger-100', info: 'border-info-100' };
const ICON_TONE = { success: 'text-success-600', error: 'text-danger-600', info: 'text-info-600' };

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const dismiss = useCallback((id) => setItems((xs) => xs.filter((x) => x.id !== id)), []);
  const push = useCallback((tone, message, opts = {}) => {
    const id = Math.random().toString(36).slice(2);
    setItems((xs) => [...xs.slice(-3), { id, tone, message, title: opts.title }]);
    setTimeout(() => dismiss(id), opts.duration || 5000);
  }, [dismiss]);
  const api = useMemo(() => ({
    success: (m, o) => push('success', m, o),
    error: (m, o) => push('error', m, o),
    info: (m, o) => push('info', m, o),
  }), [push]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4 sm:items-end sm:pr-6" aria-live="polite">
        {items.map((t) => {
          const Icon = ICON[t.tone];
          return (
            <div key={t.id} className={cn('pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border bg-white p-3 shadow-lg', TONE[t.tone])}>
              <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', ICON_TONE[t.tone])} aria-hidden />
              <div className="flex-1 text-sm">
                {t.title && <p className="font-semibold text-ink">{t.title}</p>}
                <p className="text-ink-muted">{t.message}</p>
              </div>
              <button type="button" onClick={() => dismiss(t.id)} className="text-ink-subtle hover:text-ink" aria-label="Dismiss"><X className="h-4 w-4" /></button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
