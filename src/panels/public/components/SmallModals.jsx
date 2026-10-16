// Save-search (RE-S-PUB-02/12) and report-listing (RE-S-PUB-04) modals.
import { useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Alert, Button, Checkbox, Input, Modal, Select, Textarea, useToast } from '@/shared/ui';
import { useT } from '@/shared/i18n';
import { FREQUENCIES, REPORT_REASONS, cleanFilters, describeFilters, useCreateSavedSearch, useEditSavedSearch, useReportListing } from '@/modules/search/api';

// Option labels by value, falling back to the module's English label for unknown values.
const optLabels = (t, ns, list) => list.map((o) => { const k = `property.${ns}.${o.value}`; const v = t(k); return { ...o, label: v === k ? o.label : v }; });

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
    <Modal open={open} onClose={onClose} title={saved ? t('property.saveSearch.editTitle') : t('property.saveSearch.title')} description={t('property.saveSearch.description')}
      footer={<><Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button><Button type="submit" form="save-search" loading={busy}>{t('common.save')}</Button></>}>
      <form id="save-search" onSubmit={submit} className="space-y-4">
        <Input label={t('property.saveSearch.name')} required value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
        <div className="flex flex-wrap gap-1.5">{describeFilters(f).map((d) => <span key={d} className="rounded-full bg-surface-sunken px-2.5 py-0.5 text-xs text-ink-muted">{d}</span>)}</div>
        <Select label={t('property.saveSearch.frequency')} value={frequency} onChange={(e) => setFrequency(e.target.value)} options={optLabels(t, 'frequencies', FREQUENCIES)} hint={t('property.saveSearch.frequencyHint')} />
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-ink">{t('property.saveSearch.sendBy')}</legend>
          {CHANNELS.map((c) => (
            <Checkbox key={c.value} label={t(c.label)} checked={channels.includes(c.value)}
              onChange={(e) => setChannels((cs) => (e.target.checked ? [...cs, c.value] : cs.filter((x) => x !== c.value)))} />
          ))}
        </fieldset>
        {error && <Alert tone="danger">{error}</Alert>}
      </form>
    </Modal>
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
    <Modal open={open} onClose={onClose} title={t('property.reportModal.title')} description={listingNo ? t('property.reportModal.listing', { no: listingNo }) : undefined}
      footer={report.isSuccess ? <Button onClick={onClose}>{t('common.close')}</Button> : <><Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button><Button variant="danger" type="submit" form="report-listing" loading={report.isPending}>{t('property.reportModal.send')}</Button></>}>
      {report.isSuccess ? (
        <div className="py-4 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-success-600" aria-hidden />
          <p className="mt-2 font-semibold text-ink">{t('property.reportModal.thanks', { no: report.data.reportNo })}</p>
          <p className="mt-1 text-sm text-ink-muted">{t('property.reportModal.reviews')}</p>
        </div>
      ) : (
        <form id="report-listing" onSubmit={submit} className="space-y-4">
          <Select label={t('property.reportModal.reason')} required placeholder={t('property.reportModal.chooseReason')} value={reason} onChange={(e) => setReason(e.target.value)} options={optLabels(t, 'reasons', REPORT_REASONS)} />
          <Textarea label={t('property.reportModal.details')} rows={4} maxLength={500} value={details} onChange={(e) => setDetails(e.target.value)} hint={`${details.length}/500`} />
          {error && <Alert tone="danger">{error}</Alert>}
        </form>
      )}
    </Modal>
  );
}
