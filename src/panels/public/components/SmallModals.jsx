// Save-search (RE-S-PUB-02/12) and report-listing (RE-S-PUB-04) modals.
import { useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Alert, Button, Checkbox, Input, Modal, Select, Textarea, useToast } from '@/shared/ui';
import { FREQUENCIES, REPORT_REASONS, cleanFilters, describeFilters, useCreateSavedSearch, useEditSavedSearch, useReportListing } from '@/modules/search/api';

const CHANNELS = [{ value: 'email', label: 'Email' }, { value: 'in_app', label: 'In-app notification' }];

// Create (filters given) or edit (saved given) a saved search.
export function SaveSearchModal({ open, onClose, filters, saved }) {
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
    setName(describeFilters(f).slice(0, 3).join(', ').slice(0, 60) || 'My search');
    setFrequency('daily'); setChannels(['email', 'in_app']);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const busy = create.isPending || edit.isPending;
  const submit = async (e) => {
    e.preventDefault();
    if (name.trim().length < 2) { setError('Give the search a name (2-60 characters)'); return; }
    if (!channels.length) { setError('Choose at least one channel'); return; }
    try {
      if (saved) await edit.mutateAsync({ id: saved._id, body: { name: name.trim(), frequency, channels } });
      else await create.mutateAsync({ name: name.trim(), filters: f, frequency, channels });
      toast.success(saved ? 'Saved search updated' : 'Search saved. We will alert you about new matches.');
      onClose();
    } catch (err) { setError(err.fieldErrors.name || err.message); }
  };

  return (
    <Modal open={open} onClose={onClose} title={saved ? 'Edit saved search' : 'Save this search'} description="Get alerts when new matching properties go live."
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" form="save-search" loading={busy}>Save</Button></>}>
      <form id="save-search" onSubmit={submit} className="space-y-4">
        <Input label="Name" required value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
        <div className="flex flex-wrap gap-1.5">{describeFilters(f).map((d) => <span key={d} className="rounded-full bg-surface-sunken px-2.5 py-0.5 text-xs text-ink-muted">{d}</span>)}</div>
        <Select label="Alert frequency" value={frequency} onChange={(e) => setFrequency(e.target.value)} options={FREQUENCIES} hint="Daily digests go out at 8 am, weekly ones on Monday 8 am." />
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-ink">Send alerts by</legend>
          {CHANNELS.map((c) => (
            <Checkbox key={c.value} label={c.label} checked={channels.includes(c.value)}
              onChange={(e) => setChannels((cs) => (e.target.checked ? [...cs, c.value] : cs.filter((x) => x !== c.value)))} />
          ))}
        </fieldset>
        {error && <Alert tone="danger">{error}</Alert>}
      </form>
    </Modal>
  );
}

export function ReportModal({ open, onClose, propertyId, listingNo }) {
  const report = useReportListing(propertyId);
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [error, setError] = useState(null);
  useEffect(() => { if (open) { setReason(''); setDetails(''); setError(null); report.reset(); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = (e) => {
    e.preventDefault();
    if (!reason) { setError('Choose a reason'); return; }
    report.mutate({ reason, ...(details.trim() ? { details: details.trim() } : {}) }, { onError: (err) => setError(err.message) });
  };

  return (
    <Modal open={open} onClose={onClose} title="Report this listing" description={listingNo ? `Listing ${listingNo}` : undefined}
      footer={report.isSuccess ? <Button onClick={onClose}>Close</Button> : <><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="danger" type="submit" form="report-listing" loading={report.isPending}>Send report</Button></>}>
      {report.isSuccess ? (
        <div className="py-4 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-success-600" aria-hidden />
          <p className="mt-2 font-semibold text-ink">Thank you. Report {report.data.reportNo} received.</p>
          <p className="mt-1 text-sm text-ink-muted">Our trust and safety team reviews every report.</p>
        </div>
      ) : (
        <form id="report-listing" onSubmit={submit} className="space-y-4">
          <Select label="Reason" required placeholder="Choose a reason" value={reason} onChange={(e) => setReason(e.target.value)} options={REPORT_REASONS} />
          <Textarea label="Details (optional)" rows={4} maxLength={500} value={details} onChange={(e) => setDetails(e.target.value)} hint={`${details.length}/500`} />
          {error && <Alert tone="danger">{error}</Alert>}
        </form>
      )}
    </Modal>
  );
}
