// RE-S-AGT-07 Site visit calendar: week view and list, the "Requested by
// buyers" inbox, and a visit sheet with confirm / reschedule / outcome / cancel.
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, ClipboardCheck, ExternalLink, Inbox, List, MapPin, Pencil, XCircle } from 'lucide-react';
import { Badge, Button, Checkbox, EmptyState, Modal, PageHeader, Skeleton, Tabs, useToast } from '@/shared/ui';
import { cn } from '@/shared/lib/cn';
import { dateTime } from '@/shared/lib/format';
import { useAuth } from '@/modules/auth';
import { VISIT_STATUS, errorText, firstName, useAgentMutation, useVisitCalendar, visitApi, visitStatus } from '@/modules/leads/agentApi';
import { ScheduleVisitModal, VisitOutcomeModal } from '../../components/VisitModals';
import { ErrorState, ReasonModal, dayLabel, istKey, istMidnight, timeOnly } from '../../components/common';

const DAY = 86400000;
const TONE = {
  scheduled: 'border-brand-200 bg-brand-50', confirmed: 'border-success-100 bg-success-50', completed: 'border-line bg-surface-muted',
  no_show: 'border-warning-100 bg-warning-50', cancelled: 'border-line bg-surface-sunken opacity-70', requested: 'border-info-100 bg-info-50',
};
// Monday 00:00 IST of the week containing d.
function weekStart(d = new Date()) {
  const mid = istMidnight(d);
  const dow = new Date(mid.getTime() + 330 * 60000).getUTCDay();
  return new Date(mid.getTime() - ((dow + 6) % 7) * DAY);
}

function VisitCard({ v, onOpen }) {
  return (
    <button type="button" onClick={() => onOpen(v)} className={cn('w-full rounded-md border p-2 text-left text-xs hover:shadow-md', TONE[v.status] || 'bg-white')}>
      <span className="flex items-center justify-between gap-1 font-semibold text-ink">{timeOnly(v.scheduledAt)}{v.outsideListerSlots && <Badge tone="warning">Override</Badge>}</span>
      <span className="block truncate text-ink">{v.propertyId ? v.propertyId.title : v.visitNo}</span>
      <span className="block truncate text-ink-subtle">{v.leadId ? firstName(v.leadId.buyer && v.leadId.buyer.name) : ''} · {visitStatus(v.status).label}</span>
    </button>
  );
}

function VisitSheet({ visit, onClose, onAction }) {
  const toast = useToast();
  const confirm = useAgentMutation(visitApi.confirm);
  if (!visit) return null;
  const live = ['scheduled', 'confirmed'].includes(visit.status);
  const past = new Date(visit.scheduledAt) <= new Date();
  const p = visit.propertyId || {};
  const addr = p.location ? [p.location.addressLine, p.location.locality].filter(Boolean).join(', ') : '';
  const doConfirm = async () => { try { await confirm.mutateAsync({ id: visit._id }); toast.success('Confirmed for the buyer'); onClose(); } catch (e) { toast.error(errorText(e)); } };
  return (
    <Modal open onClose={onClose} title={visit.visitNo} description={`${dateTime(visit.scheduledAt)} · ${visit.durationMin || 30} min`}
      footer={<Button variant="ghost" onClick={onClose}>Close</Button>}>
      <div className="space-y-3 text-sm">
        <div className="flex items-center gap-2"><Badge tone={visitStatus(visit.status).tone}>{visitStatus(visit.status).label}</Badge>{visit.outsideListerSlots && <Badge tone="warning">Outside owner slots: {visit.overrideReason}</Badge>}</div>
        <p><span className="font-medium text-ink">{p.listingNo} · {p.title}</span>{addr && <span className="block text-ink-subtle"><MapPin className="mr-1 inline h-3.5 w-3.5" />{addr}</span>}</p>
        {addr && <a className="inline-flex items-center gap-1 text-brand-600 hover:underline" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`}>Directions <ExternalLink className="h-3.5 w-3.5" /></a>}
        {visit.leadId && <p>Buyer: <Link className="font-medium text-brand-700 hover:underline" to={`/agent/leads/${visit.leadId._id}`}>{visit.leadId.leadNo} · {visit.leadId.buyer && visit.leadId.buyer.name}</Link></p>}
        {visit.meetingPoint && <p className="text-ink-muted">Meeting point: {visit.meetingPoint}{visit.pickup && visit.pickup.needed ? ` · pickup ${visit.pickup.address || ''}` : ''}</p>}
        {visit.cancelReason && <p className="text-ink-muted">Cancelled: {visit.cancelReason}</p>}
        {visit.outcome && visit.outcome.result && <p className="text-ink-muted">Outcome: {visit.outcome.result}{visit.outcome.interest ? ` · interest ${visit.outcome.interest}/5` : ''}{visit.outcome.nextStep ? ` · ${visit.outcome.nextStep}` : ''}</p>}
        <div className="flex flex-wrap gap-2 border-t pt-3">
          {visit.status === 'scheduled' && <Button size="sm" variant="secondary" icon={CheckCircle2} loading={confirm.isPending} onClick={doConfirm}>Buyer confirmed by phone</Button>}
          {live && past && <Button size="sm" icon={ClipboardCheck} onClick={() => onAction('outcome', visit)}>Record outcome</Button>}
          {live && <Button size="sm" variant="ghost" icon={Pencil} onClick={() => onAction('reschedule', visit)}>Reschedule</Button>}
          {live && <Button size="sm" variant="ghost" icon={XCircle} onClick={() => onAction('cancel', visit)}>Cancel</Button>}
        </div>
      </div>
    </Modal>
  );
}

export default function VisitsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [start, setStart] = useState(() => weekStart());
  const [view, setView] = useState('week');
  const [team, setTeam] = useState(false);
  const [hideCancelled, setHideCancelled] = useState(false);
  const [open, setOpen] = useState(null);
  const [action, setAction] = useState(null); // { kind, visit }
  const cancel = useAgentMutation(visitApi.cancel);
  const params = useMemo(() => ({ from: start.toISOString(), to: new Date(start.getTime() + 7 * DAY).toISOString(), ...(team ? { team: 'true' } : {}) }), [start, team]);
  const { data, isLoading, error, refetch } = useVisitCalendar(params);
  const items = ((data && data.items) || []).filter((v) => !hideCancelled || v.status !== 'cancelled');
  const requested = (data && data.requested) || [];
  const days = Array.from({ length: 7 }, (_, i) => new Date(start.getTime() + i * DAY));
  const todayKey = istKey(new Date());
  const doAction = (kind, visit) => { setOpen(null); setAction({ kind, visit }); };
  const doCancel = async (reason) => { try { await cancel.mutateAsync({ id: action.visit._id, reason }); toast.success('Visit cancelled'); setAction(null); } catch (e) { toast.error(errorText(e)); } };

  return (
    <>
      <PageHeader title="Site visits" description={`${dayLabel(days[0])} - ${dayLabel(days[6])}`}
        actions={<>
          <Button variant="secondary" icon={ChevronLeft} aria-label="Previous week" onClick={() => setStart((s) => new Date(s.getTime() - 7 * DAY))} />
          <Button variant="secondary" onClick={() => setStart(weekStart())}>This week</Button>
          <Button variant="secondary" icon={ChevronRight} aria-label="Next week" onClick={() => setStart((s) => new Date(s.getTime() + 7 * DAY))} />
        </>} />

      {requested.length > 0 && (
        <div className="mb-4 rounded-lg border border-info-100 bg-info-50 p-3">
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-info-700"><Inbox className="h-4 w-4" />Requested by buyers ({requested.length})</p>
          <ul className="space-y-2">
            {requested.map((v) => (
              <li key={v._id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-white px-3 py-2 text-sm">
                <span><span className="font-medium text-ink">{v.propertyId ? v.propertyId.title : v.visitNo}</span><span className="block text-xs text-ink-subtle">{v.leadId ? `${v.leadId.leadNo} · ${firstName(v.leadId.buyer && v.leadId.buyer.name)}` : ''}{v.requestedSlot ? ` · wants ${dateTime(v.requestedSlot)}` : ''}</span></span>
                <Button size="sm" icon={CalendarClock} onClick={() => setAction({ kind: 'schedule', visit: v })}>Schedule</Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Tabs value={view} onChange={setView} tabs={[{ value: 'week', label: 'Week' }, { value: 'list', label: 'List' }]} className="border-b-0" />
        <div className="flex flex-wrap items-center gap-4">
          <Checkbox label="Hide cancelled" checked={hideCancelled} onChange={(e) => setHideCancelled(e.target.checked)} />
          {user.role === 'manager' && <Checkbox label="My team" checked={team} onChange={(e) => setTeam(e.target.checked)} />}
        </div>
      </div>
      <div className="mb-3 flex flex-wrap gap-2 text-xs">{Object.entries(VISIT_STATUS).map(([k, s]) => <span key={k} className={cn('rounded border px-2 py-0.5', TONE[k])}>{s.label}</span>)}</div>

      {error ? <ErrorState error={error} onRetry={refetch} title="Could not load visits" /> : isLoading ? <Skeleton className="h-80" /> : view === 'week' ? (
        <div className="grid gap-2 md:grid-cols-7">
          {days.map((d) => {
            const key = istKey(d);
            const list = items.filter((v) => istKey(v.scheduledAt) === key);
            return (
              <div key={key} className={cn('min-h-[8rem] rounded-lg border bg-white p-2', key === todayKey && 'border-brand-500 ring-1 ring-brand-500')}>
                <p className={cn('mb-2 text-xs font-semibold', key === todayKey ? 'text-brand-700' : 'text-ink-subtle')}>{dayLabel(d)}</p>
                <div className="space-y-1.5">{list.map((v) => <VisitCard key={v._id} v={v} onOpen={setOpen} />)}</div>
                {!list.length && <p className="text-xs text-ink-subtle md:hidden">No visits</p>}
              </div>
            );
          })}
        </div>
      ) : !items.length ? <EmptyState icon={CalendarDays} title="No visits scheduled" description="Schedule visits from a lead. Buyer requests appear in the inbox above." /> : (
        <ul className="divide-y rounded-lg border bg-white shadow-sm">
          {items.map((v) => (
            <li key={v._id}>
              <button type="button" onClick={() => setOpen(v)} className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left hover:bg-surface-muted">
                <span className="w-28 shrink-0 text-sm font-medium text-ink">{dayLabel(v.scheduledAt)}<span className="block text-xs text-ink-subtle">{timeOnly(v.scheduledAt)}</span></span>
                <span className="min-w-0 flex-1 text-sm"><span className="block truncate text-ink">{v.propertyId ? `${v.propertyId.listingNo} · ${v.propertyId.title}` : v.visitNo}</span>
                  <span className="block truncate text-xs text-ink-subtle">{v.propertyId && v.propertyId.location ? v.propertyId.location.locality : ''} · {v.leadId ? firstName(v.leadId.buyer && v.leadId.buyer.name) : ''}</span></span>
                <Badge tone={visitStatus(v.status).tone}>{visitStatus(v.status).label}</Badge>
              </button>
            </li>
          ))}
        </ul>
      )}
      {view === 'week' && !isLoading && !error && !items.length && <p className="mt-3 flex items-center gap-2 text-sm text-ink-subtle"><List className="h-4 w-4" />No visits this week.</p>}

      <VisitSheet visit={open} onClose={() => setOpen(null)} onAction={doAction} />
      <ScheduleVisitModal open={Boolean(action && action.kind === 'schedule')} onClose={() => setAction(null)} requested={action && action.kind === 'schedule' ? action.visit : null} />
      <ScheduleVisitModal open={Boolean(action && action.kind === 'reschedule')} onClose={() => setAction(null)} visit={action && action.kind === 'reschedule' ? action.visit : null} />
      <VisitOutcomeModal open={Boolean(action && action.kind === 'outcome')} onClose={() => setAction(null)} visit={action && action.kind === 'outcome' ? action.visit : null} />
      <ReasonModal open={Boolean(action && action.kind === 'cancel')} onClose={() => setAction(null)} title="Cancel visit" label="Reason" min={3} max={300} confirmLabel="Cancel visit" danger loading={cancel.isPending} onSubmit={doCancel} />
    </>
  );
}
