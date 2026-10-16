// Save-search (RE-S-PUB-02/12) and report-listing (RE-S-PUB-04) modals, and
// PublicModal: the public-site dialog shell (same behaviour as the shared
// Modal: native <dialog>, Esc and backdrop click close it) with the premium
// look: rounded-3xl, display-font title, sand inputs with a gold focus ring.
import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, X } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { Alert, Button, Checkbox, Input, Select, Textarea, useToast } from '@/shared/ui';
import { useT } from '@/shared/i18n';
import { FREQUENCIES, REPORT_REASONS, cleanFilters, describeFilters, useCreateSavedSearch, useEditSavedSearch, useReportListing } from '@/modules/search/api';

// Option labels by value, falling back to the module's English label for unknown values.
const optLabels = (t, ns, list) => list.map((o) => { const k = `property.${ns}.${o.value}`; const v = t(k); return { ...o, label: v === k ? o.label : v }; });

// Restyles the shared form controls (Field-based inputs carry an id; OTP boxes sit in role=group).
export const FORM_SKIN = cn(
  '[&_label]:text-navy-800',
  '[&_input[id]:not([type=checkbox])]:h-11 [&_input[id]:not([type=checkbox])]:rounded-xl [&_input[id]:not([type=checkbox])]:border-sand-300 [&_input[id]:not([type=checkbox])]:bg-sand-100 [&_input[id]:not([type=checkbox])]:text-navy-900 [&_input[id]:not([type=checkbox])]:shadow-none',
  '[&_select]:h-11 [&_select]:rounded-xl [&_select]:border-sand-300 [&_select]:bg-sand-100 [&_select]:text-navy-900 [&_select]:shadow-none',
  '[&_textarea]:rounded-xl [&_textarea]:border-sand-300 [&_textarea]:bg-sand-100 [&_textarea]:text-navy-900 [&_textarea]:shadow-none',
  '[&_input[id]:not([type=checkbox]):focus]:border-gold-500 [&_input[id]:not([type=checkbox]):focus]:bg-white [&_input[id]:not([type=checkbox]):focus]:ring-gold-500/30',
  '[&_select:focus]:border-gold-500 [&_select:focus]:bg-white [&_select:focus]:ring-gold-500/30 [&_textarea:focus]:border-gold-500 [&_textarea:focus]:bg-white [&_textarea:focus]:ring-gold-500/30',
  '[&_input[id][aria-invalid=true]:not([type=checkbox])]:border-danger-600 [&_select[aria-invalid=true]]:border-danger-600 [&_textarea[aria-invalid=true]]:border-danger-600',
  '[&_input[id]:not([type=checkbox]):disabled]:bg-sand-200 [&_input[id]:not([type=checkbox]):disabled]:text-navy-400',
  '[&_input[type=checkbox]]:border-navy-900/25 [&_input[type=checkbox]]:text-gold-600 [&_input[type=checkbox]:focus]:ring-gold-500',
  '[&_[role=group]_input]:rounded-xl [&_[role=group]_input]:border-sand-300 [&_[role=group]_input]:bg-sand-100 [&_[role=group]_input]:font-display [&_[role=group]_input]:text-navy-900 [&_[role=group]_input:focus]:border-gold-500 [&_[role=group]_input:focus]:bg-white [&_[role=group]_input:focus]:ring-gold-500/30',
);

export function PublicModal({ open, onClose, title, description, children, footer, size = 'md' }) {
  const ref = useRef(null);
  const t = useT();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  useEffect(() => {
    const d = ref.current;
    if (!d) return undefined;
    const cancel = (e) => { e.preventDefault(); if (onClose) onClose(); };
    d.addEventListener('cancel', cancel);
    return () => d.removeEventListener('cancel', cancel);
  }, [onClose]);
  const width = { sm: 'max-w-sm', md: 'max-w-xl', lg: 'max-w-2xl' }[size];
  return (
    <dialog ref={ref} className={cn('w-[calc(100%-1.5rem)] overflow-hidden rounded-3xl bg-white p-0 text-navy-900 shadow-lift ring-1 ring-navy-900/5 backdrop:bg-navy-950/60 backdrop:backdrop-blur-sm', width)}
      onClick={(e) => { if (e.target === ref.current && onClose) onClose(); }}>
      {open && (
        <div className="flex max-h-[90vh] flex-col">
          <div className="h-1 shrink-0 bg-gradient-to-r from-gold-600 via-gold-300 to-gold-600" aria-hidden />
          <div className="flex items-start justify-between gap-4 px-5 pb-3 pt-6 sm:px-8 sm:pt-7">
            <div className="min-w-0">
              <h2 className="font-display text-2xl font-medium leading-tight tracking-tight text-navy-900 sm:text-[1.7rem]">{title}</h2>
              {description && <p className="mt-1.5 text-sm leading-relaxed text-navy-500">{description}</p>}
            </div>
            {onClose && <button type="button" onClick={onClose} className="-mr-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sand-100 text-navy-500 transition-colors hover:bg-sand-200 hover:text-navy-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-500" aria-label={t('common.close')}><X className="h-5 w-5" /></button>}
          </div>
          <div className={cn('overflow-y-auto px-5 pb-6 pt-3 sm:px-8 sm:pb-8', FORM_SKIN)}>{children}</div>
          {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-sand-200 bg-sand-50 px-5 py-4 sm:px-8">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}

const CHANNELS = [{ value: 'email', label: 'property.saveSearch.email' }, { value: 'in_app', label: 'property.saveSearch.inApp' }];

// Create (filters given) or edit (saved given) a saved search.
export function SaveSearchModal({ open, onClose, filters, saved }) {
  const t = useT();
  const toast = useToast();
  const create = useCreateSavedSearch();
  const edit = useEditSavedSearch();
  const [name, setName] = useState('');
  const [frequency, setFrequency] = useState('daily');
  const [channels, setChannels] = useState(['email', 'in_app']);
  const [error, setError] = useState(null);
  const f = saved ? saved.filters : cleanFilters(filters);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (saved) { setName(saved.name); setFrequency(saved.frequency); setChannels(saved.channels || ['email', 'in_app']); return; }
    setName(describeFilters(f).slice(0, 3).join(', ').slice(0, 60) || t('property.saveSearch.defaultName'));
    setFrequency('daily'); setChannels(['email', 'in_app']);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const busy = create.isPending || edit.isPending;
  const submit = async (e) => {
    e.preventDefault();
    if (name.trim().length < 2) { setError(t('property.saveSearch.errName')); return; }
    if (!channels.length) { setError(t('property.saveSearch.errChannel')); return; }
    try {
      if (saved) await edit.mutateAsync({ id: saved._id, body: { name: name.trim(), frequency, channels } });
      else await create.mutateAsync({ name: name.trim(), filters: f, frequency, channels });
      toast.success(saved ? t('property.saveSearch.updated') : t('property.saveSearch.saved'));
      onClose();
    } catch (err) { setError(err.fieldErrors.name || err.message); }
  };

  return (
    <PublicModal open={open} onClose={onClose} title={saved ? t('property.saveSearch.editTitle') : t('property.saveSearch.title')} description={t('property.saveSearch.description')}
      footer={<><Button variant="ghost" onClick={onClose} className="rounded-full text-navy-600">{t('common.cancel')}</Button><Button variant="gold" type="submit" form="save-search" loading={busy} className="rounded-full px-6 font-semibold">{t('common.save')}</Button></>}>
      <form id="save-search" onSubmit={submit} className="space-y-4">
        <Input label={t('property.saveSearch.name')} required value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
        <div className="flex flex-wrap gap-1.5">{describeFilters(f).map((d) => <span key={d} className="rounded-full bg-gold-50 px-3 py-1 text-xs font-medium text-gold-800 ring-1 ring-inset ring-gold-200">{d}</span>)}</div>
        <Select label={t('property.saveSearch.frequency')} value={frequency} onChange={(e) => setFrequency(e.target.value)} options={optLabels(t, 'frequencies', FREQUENCIES)} hint={t('property.saveSearch.frequencyHint')} />
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-navy-800">{t('property.saveSearch.sendBy')}</legend>
          {CHANNELS.map((c) => (
            <Checkbox key={c.value} label={t(c.label)} checked={channels.includes(c.value)}
              onChange={(e) => setChannels((cs) => (e.target.checked ? [...cs, c.value] : cs.filter((x) => x !== c.value)))} />
          ))}
        </fieldset>
        {error && <Alert tone="danger">{error}</Alert>}
      </form>
    </PublicModal>
  );
}

export function ReportModal({ open, onClose, propertyId, listingNo }) {
  const t = useT();
  const report = useReportListing(propertyId);
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [error, setError] = useState(null);
  useEffect(() => { if (open) { setReason(''); setDetails(''); setError(null); report.reset(); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = (e) => {
    e.preventDefault();
    if (!reason) { setError(t('property.reportModal.chooseReason')); return; }
    report.mutate({ reason, ...(details.trim() ? { details: details.trim() } : {}) }, { onError: (err) => setError(err.message) });
  };

  return (
    <PublicModal open={open} onClose={onClose} title={t('property.reportModal.title')} description={listingNo ? t('property.reportModal.listing', { no: listingNo }) : undefined}
      footer={report.isSuccess ? <Button variant="navy" onClick={onClose} className="rounded-full px-6">{t('common.close')}</Button> : <><Button variant="ghost" onClick={onClose} className="rounded-full text-navy-600">{t('common.cancel')}</Button><Button variant="gold" type="submit" form="report-listing" loading={report.isPending} className="rounded-full px-6 font-semibold">{t('property.reportModal.send')}</Button></>}>
      {report.isSuccess ? (
        <div className="py-4 text-center">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gold-50 ring-1 ring-gold-200"><CheckCircle2 className="h-8 w-8 text-gold-700" aria-hidden /></span>
          <p className="mt-4 font-display text-xl font-medium text-navy-900">{t('property.reportModal.thanks', { no: report.data.reportNo })}</p>
          <p className="mt-1 text-sm text-navy-500">{t('property.reportModal.reviews')}</p>
        </div>
      ) : (
        <form id="report-listing" onSubmit={submit} className="space-y-4">
          <Select label={t('property.reportModal.reason')} required placeholder={t('property.reportModal.chooseReason')} value={reason} onChange={(e) => setReason(e.target.value)} options={optLabels(t, 'reasons', REPORT_REASONS)} />
          <Textarea label={t('property.reportModal.details')} rows={4} maxLength={500} value={details} onChange={(e) => setDetails(e.target.value)} hint={`${details.length}/500`} />
          {error && <Alert tone="danger">{error}</Alert>}
        </form>
      )}
    </PublicModal>
  );
}
