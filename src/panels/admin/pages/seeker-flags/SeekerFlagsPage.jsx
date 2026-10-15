// RE-F-10 / RE-S-ADM-05 seeker flags (users.manage): buyer phones that
// enquired with too many listers or localities, or were flagged by staff.
// Detail shows the leads involved; the decision clears, throttles or blocks.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { Alert, Badge, Button, Card, CardHeader, Input, Modal, PageHeader, Pagination, Select, Spinner, Table, Tabs, Textarea, useToast } from '@/shared/ui';
import { date, dateTime, titleCase } from '@/shared/lib/format';
import { SEEKER_ACTIONS, SEEKER_RULES, SEEKER_STATUS, useDecideSeekerFlag, useSeekerFlag, useSeekerFlags } from '@/modules/kyc/seekerApi';

const TABS = [{ value: 'open', label: 'Open' }, { value: 'actioned', label: 'Throttled / blocked' }, { value: 'cleared', label: 'Cleared' }];
const DURATIONS = [{ value: '7', label: '7 days' }, { value: '30', label: '30 days' }, { value: '90', label: '90 days' }, { value: 'permanent', label: 'Permanent' }, { value: 'until', label: 'Until a date' }];
const DAY = 86400000;

function FlagDetail({ id, onClose }) {
  const toast = useToast();
  const { data: f, isLoading, error } = useSeekerFlag(id);
  const decide = useDecideSeekerFlag();
  const [action, setAction] = useState('throttle');
  const [duration, setDuration] = useState('30');
  const [until, setUntil] = useState('');
  const [note, setNote] = useState('');
  const [formError, setFormError] = useState(null);

  const days = duration === 'permanent' ? undefined
    : duration === 'until' ? (until ? Math.ceil((new Date(`${until}T23:59:59+05:30`).getTime() - Date.now()) / DAY) : null)
      : Number(duration);
  const daysInvalid = action !== 'dismiss' && duration === 'until' && (days == null || days < 1 || days > 365);

  const submit = async () => {
    setFormError(null);
    try {
      await decide.mutateAsync({ id, body: { action, note: note.trim(), ...(action !== 'dismiss' && days ? { days } : {}) } });
      toast.success({ dismiss: 'Flag cleared; limits lifted', throttle: 'Phone throttled', block: 'Phone blocked' }[action]);
      onClose();
    } catch (e) { setFormError(e.message); }
  };

  return (
    <Modal open onClose={onClose} size="lg" title={f ? `Seeker flag ${f.flagNo}` : 'Seeker flag'} description={f ? `${f.phoneMasked} · ${SEEKER_RULES[f.rule] || f.rule}` : undefined}
      footer={f && <><Button variant="ghost" onClick={onClose}>Close</Button><Button variant={action === 'block' ? 'danger' : 'primary'} disabled={note.trim().length < 10 || daysInvalid} loading={decide.isPending} onClick={submit}>Save decision</Button></>}>
      {isLoading && <div className="flex justify-center py-8"><Spinner /></div>}
      {error && <Alert tone="danger">{error.message}</Alert>}
      {f && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div><p className="text-ink-subtle">Listers</p><p className="font-semibold text-ink">{f.counts?.listers ?? '-'}</p></div>
            <div><p className="text-ink-subtle">Localities</p><p className="font-semibold text-ink">{f.counts?.localities ?? '-'}</p></div>
            <div><p className="text-ink-subtle">Cities</p><p className="font-semibold text-ink">{f.counts?.cities ?? '-'}</p></div>
            <div><p className="text-ink-subtle">Enquiries</p><p className="font-semibold text-ink">{f.counts?.enquiries ?? '-'}</p></div>
          </div>
          <p className="text-xs text-ink-subtle">Window {date(f.window?.from)} - {date(f.window?.to)} · raised {dateTime(f.createdAt)}{f.until ? ` · current restriction until ${dateTime(f.until)}` : ''}</p>
          {f.note && <p className="rounded-md bg-surface-muted p-3 text-sm text-ink-muted">{f.note}</p>}
          <Card padded={false}>
            <div className="p-4 pb-0"><CardHeader title={`Leads (${(f.leads || []).length})`} /></div>
            <ul className="divide-y">
              {(f.leads || []).map((l) => (
                <li key={l._id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm">
                  <span><Link className="font-medium text-brand-700 hover:underline" to={`/admin/leads/${l._id}`}>{l.leadNo}</Link><span className="text-ink-muted"> · {l.propertyId ? `${l.propertyId.listingNo} ${l.propertyId.location?.locality || ''}` : 'No property'}</span></span>
                  <span className="text-xs text-ink-subtle">{titleCase(l.stage)} · {date(l.createdAt)}</span>
                </li>
              ))}
            </ul>
          </Card>
          <div className="space-y-4 border-t pt-4">
            <Select label="Decision" value={action} onChange={(e) => setAction(e.target.value)} options={SEEKER_ACTIONS} />
            {action !== 'dismiss' && (
              <div className="grid gap-3 sm:grid-cols-2">
                <Select label="Duration" value={duration} onChange={(e) => setDuration(e.target.value)} options={DURATIONS} />
                {duration === 'until' && <Input label="Until" type="date" value={until} min={new Date(Date.now() + DAY).toISOString().slice(0, 10)} onChange={(e) => setUntil(e.target.value)} error={daysInvalid && until ? 'Pick a date within the next 365 days' : undefined} />}
              </div>
            )}
            <Textarea label="Note" required rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} hint="10-500 characters. Recorded in the audit log." />
            {formError && <Alert tone="danger">{formError}</Alert>}
          </div>
        </div>
      )}
    </Modal>
  );
}

export default function SeekerFlagsPage() {
  const [status, setStatus] = useState('open');
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState(null);
  const { data, isLoading, error } = useSeekerFlags({ status, page, limit: 20 });

  return (
    <>
      <PageHeader title="Seeker flags" description="Buyer phones with unusual enquiry patterns. Throttled phones get one enquiry a day through the manager queue; blocked phones are refused." />
      <Tabs className="mb-4" value={status} onChange={(v) => { setStatus(v); setPage(1); }} tabs={TABS.map((t) => (t.value === status && data ? { ...t, count: data.meta.total } : t))} />
      {error && <Alert tone="danger" className="mb-4">{error.message}</Alert>}
      <Table loading={isLoading} rows={(data && data.items) || []} onRowClick={(f) => setOpenId(f._id)} empty={status === 'open' ? 'No open flags.' : 'Nothing here.'}
        columns={[
          { key: 'no', header: 'Flag', render: (f) => <span className="font-medium text-ink">{f.flagNo}</span> },
          { key: 'phone', header: 'Phone', render: (f) => <span className="font-mono text-sm">{f.phoneMasked}</span> },
          { key: 'rule', header: 'Rule', render: (f) => <span><Badge tone="warning" icon={ShieldAlert}>{titleCase(f.rule)}</Badge><span className="mt-1 block text-xs text-ink-subtle">{SEEKER_RULES[f.rule]}</span></span> },
          { key: 'counts', header: 'Listers / localities', render: (f) => <span className="text-sm">{f.counts?.listers ?? '-'} / {f.counts?.localities ?? '-'}<span className="block text-xs text-ink-subtle">{f.counts?.enquiries ?? 0} enquiries</span></span> },
          { key: 'at', header: 'Raised', render: (f) => dateTime(f.createdAt) },
          { key: 'status', header: 'Status', render: (f) => { const s = SEEKER_STATUS[f.status] || { label: f.status, tone: 'neutral' }; return <span><Badge tone={s.tone}>{f.status === 'actioned' ? titleCase(f.action) : s.label}</Badge>{f.until && <span className="block text-xs text-ink-subtle">until {date(f.until)}</span>}{f.status === 'open' && f.action && f.action !== 'none' && <span className="block text-xs text-ink-subtle">auto: {f.action}</span>}</span>; } },
          { key: 'act', header: '', render: () => <Button size="sm" variant="secondary">Open</Button> },
        ]} />
      {data && <Pagination page={data.meta.page} pages={data.meta.pages} onChange={setPage} />}
      {openId && <FlagDetail id={openId} onClose={() => setOpenId(null)} />}
    </>
  );
}
