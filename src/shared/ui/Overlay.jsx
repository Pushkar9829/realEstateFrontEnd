// Modal and Drawer built on the native <dialog> element (focus trap, Esc to
// close and the top layer come from the browser).
import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { useT } from '@/shared/i18n';
import Button from './Button';

function useDialog(open, onClose) {
  const ref = useRef(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  useEffect(() => {
    const d = ref.current;
    if (!d) return undefined;
    const cancel = (e) => { e.preventDefault(); onClose && onClose(); };
    d.addEventListener('cancel', cancel);
    return () => d.removeEventListener('cancel', cancel);
  }, [onClose]);
  return ref;
}

export function Modal({ open, onClose, title, description, children, footer, size = 'md' }) {
  const t = useT();
  const ref = useDialog(open, onClose);
  const width = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' }[size];
  return (
    <dialog ref={ref} className={cn('w-[calc(100%-2rem)] rounded-xl bg-white p-0 shadow-lg backdrop:bg-surface-overlay', width)}
      onClick={(e) => { if (e.target === ref.current && onClose) onClose(); }}>
      {open && (
        <div className="flex max-h-[85vh] flex-col">
          <div className="flex items-start justify-between gap-4 border-b px-5 py-4">
            <div>
              <h2 className="text-lg font-semibold text-ink">{title}</h2>
              {description && <p className="mt-0.5 text-sm text-ink-subtle">{description}</p>}
            </div>
            {onClose && <button type="button" onClick={onClose} className="rounded-md p-1 text-ink-subtle hover:bg-surface-sunken hover:text-ink" aria-label={t('common.close')}><X className="h-5 w-5" aria-hidden /></button>}
          </div>
          <div className="overflow-y-auto px-5 py-4">{children}</div>
          {footer && <div className="flex justify-end gap-2 border-t px-5 py-3">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}

// Confirmation step before an irreversible action (submit, verify, issue ...).
export function ConfirmModal({ open, onClose, onConfirm, title, children, confirmLabel, tone = 'primary', loading = false }) {
  const t = useT();
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm"
      footer={<><Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button><Button variant={tone} loading={loading} onClick={onConfirm}>{confirmLabel || t('common.confirm')}</Button></>}>
      <div className="text-sm text-ink-muted">{children}</div>
    </Modal>
  );
}

export function Drawer({ open, onClose, title, children, side = 'left' }) {
  const t = useT();
  const ref = useDialog(open, onClose);
  return (
    <dialog ref={ref} className={cn('m-0 h-full max-h-full w-72 max-w-[85vw] bg-white p-0 shadow-lg backdrop:bg-surface-overlay', side === 'left' ? 'mr-auto' : 'ml-auto')}
      onClick={(e) => { if (e.target === ref.current && onClose) onClose(); }}>
      {open && (
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <span className="font-semibold text-ink">{title}</span>
            <button type="button" onClick={onClose} className="rounded-md p-1 text-ink-subtle hover:bg-surface-sunken" aria-label={t('common.close')}><X className="h-5 w-5" aria-hidden /></button>
          </div>
          <div className="flex-1 overflow-y-auto">{children}</div>
        </div>
      )}
    </dialog>
  );
}
