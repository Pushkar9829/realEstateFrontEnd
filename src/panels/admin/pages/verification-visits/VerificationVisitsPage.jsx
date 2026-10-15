// RE-S-ADM-32 verification visits (RE-D-13, Could; verification.schedule):
// lister requests and admin-created field visits that grant the Site
// verified badge. List or day-by-day agenda; schedule a requested visit or a
// new one, reschedule / reassign, cancel. API errors are shown with their code.
import { useState } from 'react';
import { CalendarDays, CalendarPlus, List, Search, X } from 'lucide-react';
import { Alert, Badge, Button, Card, CardHeader, EmptyState, Input, Modal, PageHeader, Pagination, Select, Table, Tabs, Textarea, useToast } from '@/shared/ui';
import { cn } from '@/shared/lib/cn';
import { date, dateTime } from '@/shared/lib/format';
import { useAuth } from '@/modules/auth';
import { useStaff } from '@/modules/teams/api';
import {
  VISIT_ERRORS, useCancelVerificationVisit, useListingLookup, usePatchVerificationVisit, useScheduleVerificationVisit, useVerificationVisits, verificationVisitStatus,
} from '@/modules/approvals/siteVisitsApi';

const TABS = [
  { value: 'requested', label: 'Requested' },
  { value: 'scheduled,lister_absent', label: 'Scheduled' },
  { value: 'verified,not_verified,cancelled', label: 'Closed' },
  { value: '', label: 'All' },
];
const OID = /^[a-f0-9]{24}$/;
const istDay = (v) => new Date(new Date(v).getTime() + 330 * 60000).toISOString().slice(0, 10);
const toIso = (d, t) => (d && t ? `${d}T${t}:00+05:30` : undefined);
const splitIst = (v) => { if (!v) return ['', '']; const s = new Date(new Date(v).getTime() + 330 * 60000).toISOString(); return [s.slice(0, 10), s.slice(11, 16)]; };

function ApiErrorBox({ error }) {
  if (!error) return null;
  const hint = VISIT_ERRORS[error.code];
  return (
    <Alert tone="danger" title={error.message}>
      {hint && <p>{hint}</p>}
      {error.code && error.code !== 'UNKNOWN' && <p className="mt-1 font-mono text-xs">{error.code}</p>}
    </Alert>
  );
}

// Visiting agent: from the staff list (agents with verification.field) when
// the user may list staff, else by user id.
function ExecutivePicker({ value, onChange, executives, canList, error }) {
  if (canList) {
    return <Select label="Visiting agent" required placeholder={executives.length ? 'Choose an agent' : 'No agents with verification.field'} value={value} onChange={(e) => onChange(e.target.value)} error={error}
      options={executives.map((u) => ({ value: String(u._id), label: `${u.name}${u.email ? ` · ${u.email}` : ''}` }))} hint="In-house agents holding the verification.field permission." />;
  }
  return <Input label="Visiting agent id" required placeholder="User id (24 characters)" value={value} onChange={(e) => onChange(e.target.value.trim())} error={error} hint="Staff lookup needs staff.manage. The agent must hold verification.field." />;
}

function ListingPicker({ value, onChange }) {
  const [q, setQ] = useState('');
  const [term, setTerm] = useState('');
  const found = useListingLookup(term);
  const rows = (found.data && found.data.items) || [];
  return (
    <div className="space-y-2">
      <div className="flex items-end gap-2">
        <Input className="flex-1" label="Listing" required leading={<Search className="h-4 w-4" />} placeholder="Listing number, title or id" value={q} onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (OID.test(q.trim())) onChange({ _id: q.trim(), listingNo: q.trim() }); else setTerm(q.trim()); } }} />
        <Button variant="secondary" onClick={() => (OID.test(q.trim()) ? onChange({ _id: q.trim(), listingNo: q.trim() }) : setTerm(q.trim()))}>Find</Button>
      </div>
      {value && <p className="text-sm text-ink">Selected: <span className="font-medium">{value.listingNo}</span>{value.title ? ` · ${value.title}` : ''} <button type="button" className="text-brand-700 hover:underline" onClick={() => onChange(null)}>change</button></p>}
      {!value && term && (
        <ul className="max-h-48 divide-y overflow-y-auto rounded-md border">
          {found.isLoading && <li className="px-3 py-2 text-sm text-ink-subtle">Searching…</li>}
          {found.error && <li className="px-3 py-2 text-sm text-danger-700">{found.error.message}</li>}
          {rows.map((p) => (
            <li key={p._id}><button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-surface-muted" onClick={() => onChange(p)}>
              <span className="font-medium text-ink">{p.listingNo}</span> · {p.title}<span className="block text-xs text-ink-subtle">{[p.location?.locality, p.location?.city].filter(Boolean).join(', ')} · {p.status}</span>
            </button></li>
          ))}
          {!found.isLoading && !found.error && rows.length === 0 && <li className="px-3 py-2 text-sm text-ink-subtle">No live or pending listing found.</li>}
        </ul>
      )}
    </div>
  );
}

function ScheduleModal({ visit, onClose, executives, canList }) {
  const toast = useToast();
  const schedule = useScheduleVerificationVisit();
  const [listing, setListing] = useState(null);
  const [day, setDay] = useState('');
  const [time, setTime] = useState('11:00');
  const [executiveId, setExecutiveId] = useState('');
  const [notes, setNotes] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [err, setErr] = useState(null);
  const fe = (err && err.fieldErrors) || {};

  const submit = async () => {
    setErr(null);
    try {
      await schedule.mutateAsync({
        ...(visit ? { visitId: visit._id } : { propertyId: listing && listing._id }), scheduledAt: toIso(day, time), executiveId,
        ...(notes.trim() ? { notes: notes.trim() } : {}), ...(overrideReason.trim() ? { overrideReason: overrideReason.trim() } : {}),
      });
      toast.success('Visit scheduled; the lister and the visiting agent are notified');
      onClose();
    } catch (e) { setErr(e); }
  };

  return (
    <Modal open onClose={onClose} size="lg" title={visit ? `Schedule ${visit.visitNo}` : 'New verification visit'}
      description={visit ? `${visit.propertyId?.listingNo || ''} · ${visit.propertyId?.title || ''}${visit.notes ? ` · lister note: ${visit.notes}` : ''}` : 'For a live or pending-approval listing in a city where site visits are offered.'}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button icon={CalendarPlus} disabled={(!visit && !listing) || !day || !time || !executiveId} loading={schedule.isPending} onClick={submit}>Schedule</Button></>}>
      <div className="space-y-4">
        {!visit && <ListingPicker value={listing} onChange={setListing} />}
        {!visit && fe.propertyId && <p className="text-xs text-danger-600">{fe.propertyId}</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="Date" type="date" required value={day} min={istDay(Date.now())} onChange={(e) => setDay(e.target.value)} error={fe.scheduledAt} />
          <Input label="Time (IST)" type="time" required value={time} onChange={(e) => setTime(e.target.value)} hint="Inside the lister's visit availability." />
        </div>
        <ExecutivePicker value={executiveId} onChange={setExecutiveId} executives={executives} canList={canList} error={fe.executiveId} />
        <Textarea label="Notes" rows={2} maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} />
        <Input label="Override reason" value={overrideReason} maxLength={300} onChange={(e) => setOverrideReason(e.target.value)} hint="Only when the time is outside the lister's slots (5-300 characters)." error={fe.overrideReason} />
        <ApiErrorBox error={err} />
      </div>
    </Modal>
  );
}

function RescheduleModal({ visit, onClose, executives, canList }) {
  const toast = useToast();
  const patch = usePatchVerificationVisit();
  const [d0, t0] = splitIst(visit.scheduledAt);
  const [day, setDay] = useState(d0);
  const [time, setTime] = useState(t0 || '11:00');
  const [executiveId, setExecutiveId] = useState(String(visit.executiveId?._id || ''));
  const [notes, setNotes] = useState(visit.notes || '');
  const [overrideReason, setOverrideReason] = useState('');
  const [err, setErr] = useState(null);
  const fe = (err && err.fieldErrors) || {};
  const whenChanged = toIso(day, time) && (day !== d0 || time !== t0 || visit.status === 'lister_absent');

  const submit = async () => {
    setErr(null);
    const body = {};
    if (whenChanged) body.scheduledAt = toIso(day, time);
    if (executiveId && executiveId !== String(visit.executiveId?._id || '')) body.executiveId = executiveId;
    if (notes !== (visit.notes || '')) body.notes = notes;
    if (overrideReason.trim()) body.overrideReason = overrideReason.trim();
    try {
      await patch.mutateAsync({ id: visit._id, body });
      toast.success('Visit updated');
      onClose();
    } catch (e) { setErr(e); }
  };

  return (
    <Modal open onClose={onClose} size="lg" title={`Reschedule or reassign ${visit.visitNo}`}
      description={visit.status === 'lister_absent' ? 'The lister was absent: one reschedule is allowed.' : `Now ${dateTime(visit.scheduledAt)} with ${visit.executiveId?.name || 'no agent'}.`}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button loading={patch.isPending} onClick={submit}>Save</Button></>}>
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="Date" type="date" value={day} min={istDay(Date.now())} onChange={(e) => setDay(e.target.value)} error={fe.scheduledAt} />
          <Input label="Time (IST)" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
        <ExecutivePicker value={executiveId} onChange={setExecutiveId} executives={executives} canList={canList} error={fe.executiveId} />
        <Textarea label="Notes" rows={2} maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} />
        <Input label="Override reason" value={overrideReason} maxLength={300} onChange={(e) => setOverrideReason(e.target.value)} hint="Only when the new time is outside the lister's slots." error={fe.overrideReason} />
        <ApiErrorBox error={err} />
      </div>
    </Modal>
  );
}

function CancelModal({ visit, onClose }) {
  const toast = useToast();
  const cancel = useCancelVerificationVisit();
  const [reason, setReason] = useState('');
  const [err, setErr] = useState(null);
  const submit = async () => {
    setErr(null);
    try { await cancel.mutateAsync({ id: visit._id, reason: reason.trim() }); toast.success('Visit cancelled'); onClose(); } catch (e) { setErr(e); }
  };
  return (
    <Modal open onClose={onClose} title={`Cancel ${visit.visitNo}`} description="The lister and the visiting agent are notified."
      footer={<><Button variant="ghost" onClick={onClose}>Keep visit</Button><Button variant="danger" disabled={reason.trim().length < 5} loading={cancel.isPending} onClick={submit}>Cancel visit</Button></>}>
      <div className="space-y-3">
        <Textarea label="Reason" required rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} hint="5-500 characters." />
        <ApiErrorBox error={err} />
      </div>
    </Modal>
  );
}

export default function VerificationVisitsPage() {
  const { hasPermission } = useAuth();
  const canList = hasPermission('staff.manage');
  const [status, setStatus] = useState('requested');
  const [view, setView] = useState('list');
  const [page, setPage] = useState(1);
  const [range, setRange] = useState({ from: '', to: '' });
  const [modal, setModal] = useState(null); // { kind, visit }
  const agenda = view === 'agenda';
  const params = {
    page, limit: agenda ? 100 : 20, sort: agenda ? 'scheduledAt' : '-createdAt', ...(status ? { status } : {}),
    ...(range.from ? { from: `${range.from}T00:00:00+05:30` } : {}), ...(range.to ? { to: `${range.to}T23:59:59+05:30` } : {}),
  };
  const { data, isLoading, error } = useVerificationVisits(params);
  const staffQ = useStaff({ status: 'active' }, { enabled: canList });
  const executives = ((staffQ.data && staffQ.data.items) || []).filter((u) => ['agent', 'manager'].includes(u.role) && (u.permissions || []).includes('verification.field'));
  const rows = (data && data.items) || [];

  const days = agenda ? rows.filter((v) => v.scheduledAt).reduce((m, v) => { const k = istDay(v.scheduledAt); (m[k] = m[k] || []).push(v); return m; }, {}) : {};
  const unscheduled = agenda ? rows.filter((v) => !v.scheduledAt) : [];

  const actions = (v) => (
    <span className="flex justify-end gap-1">
      {v.status === 'requested' && <Button size="sm" onClick={() => setModal({ kind: 'schedule', visit: v })}>Schedule</Button>}
      {['scheduled', 'lister_absent'].includes(v.status) && <Button size="sm" variant="secondary" onClick={() => setModal({ kind: 'reschedule', visit: v })}>{v.status === 'lister_absent' ? 'Reschedule' : 'Change'}</Button>}
      {['requested', 'scheduled'].includes(v.status) && <Button size="sm" variant="ghost" onClick={() => setModal({ kind: 'cancel', visit: v })}>Cancel</Button>}
    </span>
  );
  const close = () => setModal(null);

  return (
    <>
      <PageHeader title="Verification visits" description="Field visits by in-house agents that grant the Site verified badge. Visits must fit the lister's availability unless overridden."
        actions={<>
          <div className="inline-flex rounded-md border bg-white p-0.5" role="group" aria-label="View">
            <button type="button" onClick={() => { setView('list'); setPage(1); }} className={cn('inline-flex items-center gap-1 rounded px-2.5 py-1.5 text-sm', !agenda ? 'bg-brand-50 text-brand-700' : 'text-ink-subtle')}><List className="h-4 w-4" /> List</button>
            <button type="button" onClick={() => { setView('agenda'); setPage(1); }} className={cn('inline-flex items-center gap-1 rounded px-2.5 py-1.5 text-sm', agenda ? 'bg-brand-50 text-brand-700' : 'text-ink-subtle')}><CalendarDays className="h-4 w-4" /> Agenda</button>
          </div>
          <Button icon={CalendarPlus} onClick={() => setModal({ kind: 'schedule', visit: null })}>New visit</Button>
        </>} />
      <Tabs className="mb-4" value={status} onChange={(v) => { setStatus(v); setPage(1); }} tabs={TABS.map((t) => (t.value === status && data ? { ...t, count: data.meta.total } : t))} />
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Input label="Scheduled from" type="date" value={range.from} onChange={(e) => { setRange((r) => ({ ...r, from: e.target.value })); setPage(1); }} />
        <Input label="Scheduled to" type="date" value={range.to} onChange={(e) => { setRange((r) => ({ ...r, to: e.target.value })); setPage(1); }} />
        {(range.from || range.to) && <Button variant="ghost" size="sm" icon={X} onClick={() => setRange({ from: '', to: '' })}>Clear dates</Button>}
      </div>
      {error && <div className="mb-4"><ApiErrorBox error={error} /></div>}

      {agenda ? (
        isLoading ? <p className="text-sm text-ink-subtle">Loading…</p> : !rows.length ? <EmptyState icon={CalendarDays} title="No visits" description="Nothing in this view." /> : (
          <div className="space-y-4">
            {Object.keys(days).sort().map((d) => (
              <Card key={d}>
                <CardHeader title={date(`${d}T12:00:00+05:30`)} description={`${days[d].length} visit${days[d].length > 1 ? 's' : ''}`} />
                <ul className="divide-y">
                  {days[d].map((v) => { const s = verificationVisitStatus(v.status); return (
                    <li key={v._id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                      <div className="min-w-0 text-sm">
                        <p><span className="font-medium text-ink">{splitIst(v.scheduledAt)[1]}</span> · {v.visitNo} · <Badge tone={s.tone}>{s.label}</Badge></p>
                        <p className="truncate text-xs text-ink-subtle">{v.propertyId?.listingNo} {v.propertyId?.title} · {[v.propertyId?.location?.locality, v.propertyId?.location?.city].filter(Boolean).join(', ')} · {v.executiveId?.name || 'no agent'}</p>
                      </div>
                      {actions(v)}
                    </li>
                  ); })}
                </ul>
              </Card>
            ))}
            {unscheduled.length > 0 && (
              <Card>
                <CardHeader title="Not scheduled yet" />
                <ul className="divide-y">{unscheduled.map((v) => <li key={v._id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm"><span>{v.visitNo} · {v.propertyId?.listingNo} {v.propertyId?.title}</span>{actions(v)}</li>)}</ul>
              </Card>
            )}
          </div>
        )
      ) : (
        <Table loading={isLoading} rows={rows} empty="No visits here."
          columns={[
            { key: 'no', header: 'Visit', render: (v) => <span><span className="block font-medium text-ink">{v.visitNo}</span><span className="text-xs text-ink-subtle">{v.requestedBy && String(v.requestedBy) === String(v.listerId) ? 'Lister request' : 'Created by admin'} · {date(v.createdAt)}</span></span> },
            { key: 'listing', header: 'Listing', render: (v) => (v.propertyId ? <span className="block max-w-xs text-sm"><span className="block truncate">{v.propertyId.title}</span><span className="text-xs text-ink-subtle">{v.propertyId.listingNo} · {[v.propertyId.location?.locality, v.propertyId.location?.city].filter(Boolean).join(', ')}</span></span> : '-') },
            { key: 'when', header: 'Scheduled', render: (v) => (v.scheduledAt ? <span className="whitespace-nowrap text-sm">{dateTime(v.scheduledAt)}</span> : <span className="text-xs text-ink-subtle">-</span>) },
            { key: 'agent', header: 'Visiting agent', render: (v) => v.executiveId?.name || '-' },
            { key: 'status', header: 'Status', render: (v) => { const s = verificationVisitStatus(v.status); return <span><Badge tone={s.tone}>{s.label}</Badge>{(v.cancelReason || v.remarks) && <span className="block max-w-[12rem] truncate text-xs text-ink-subtle">{v.cancelReason || v.remarks}</span>}</span>; } },
            { key: 'act', header: '', render: actions },
          ]} />
      )}
      {data && <Pagination page={data.meta.page} pages={data.meta.pages} onChange={setPage} />}

      {modal?.kind === 'schedule' && <ScheduleModal visit={modal.visit} onClose={close} executives={executives} canList={canList} />}
      {modal?.kind === 'reschedule' && <RescheduleModal visit={modal.visit} onClose={close} executives={executives} canList={canList} />}
      {modal?.kind === 'cancel' && <CancelModal visit={modal.visit} onClose={close} />}
    </>
  );
}
