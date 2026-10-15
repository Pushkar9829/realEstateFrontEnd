// RE-S-PUB-13 my enquiries and visits (buyer): enquiry list with the
// simplified journey, detail with visit cards (confirm / cancel / ask for a
// new slot), offers relayed by the agent and requirement requests.
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarCheck, CalendarClock, Check, ClipboardList, HandCoins, Inbox, MapPin, MessageSquareText, Phone, UserRound, X } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { date, dateTime, rupees } from '@/shared/lib/format';
import { Alert, Badge, Button, Card, EmptyState, Input, Modal, PageHeader, Skeleton, Textarea, useToast } from '@/shared/ui';
import env from '@/config/env';
import { useAuth } from '@/modules/auth';
import { JOURNEY, useMyEnquiries, useMyEnquiry, useVisitAction, visitStatus } from '@/modules/leads/publicApi';
import { ErrorState, hotlineHref } from '../../components/States';

const STATUS_TONE = { Received: 'info', 'In touch': 'brand', 'Visit scheduled': 'warning', Visited: 'brand', Negotiating: 'accent', Booked: 'success', Closed: 'neutral' };

export function Journey({ steps = JOURNEY, step = 0, closed, status }) {
  const lost = closed && status === 'Closed';
  return (
    <ol className="flex items-start overflow-x-auto pb-1" aria-label="Enquiry progress">
      {steps.map((s, i) => {
        const done = i < step || (i === step && closed && !lost);
        const current = i === step && !done;
        return (
          <li key={s} className="flex min-w-[76px] flex-1 flex-col items-center text-center">
            <div className="flex w-full items-center">
              <span className={cn('h-0.5 flex-1', i === 0 ? 'bg-transparent' : i <= step ? 'bg-brand-600' : 'bg-line-strong')} />
              <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold', done ? 'bg-brand-600 text-white' : current ? 'bg-brand-50 text-brand-700 ring-2 ring-brand-600' : 'bg-surface-sunken text-ink-subtle')}>
                {done ? <Check className="h-4 w-4" /> : i + 1}
              </span>
              <span className={cn('h-0.5 flex-1', i === steps.length - 1 ? 'bg-transparent' : i < step ? 'bg-brand-600' : 'bg-line-strong')} />
            </div>
            <span className={cn('mt-1.5 text-[11px] leading-tight', current || done ? 'font-medium text-ink' : 'text-ink-subtle')}>{s}</span>
          </li>
        );
      })}
    </ol>
  );
}

function PropertyMini({ property, requirement }) {
  if (!property) {
    return (
      <div className="flex items-center gap-3">
        <span className="flex h-14 w-16 items-center justify-center rounded bg-brand-50 text-brand-600"><ClipboardList className="h-5 w-5" aria-hidden /></span>
        <div className="text-sm"><p className="font-medium text-ink">Property request</p><p className="text-xs text-ink-subtle">{requirement ? `${requirement.purpose === 'rent' ? 'Rent' : 'Buy'} in ${requirement.city || 'any city'}` : 'General enquiry'}</p></div>
      </div>
    );
  }
  const body = (
    <div className="flex items-center gap-3">
      {property.cover ? <img src={property.cover} alt="" className="h-14 w-16 shrink-0 rounded object-cover" /> : <span className="h-14 w-16 shrink-0 rounded bg-surface-sunken" />}
      <div className="min-w-0 text-sm">
        <p className="truncate font-medium text-ink">{property.title}</p>
        <p className="flex items-center gap-1 truncate text-xs text-ink-subtle"><MapPin className="h-3 w-3" aria-hidden />{[property.locality, property.city].filter(Boolean).join(', ')} · {property.listingNo}</p>
        {!property.available && <Badge className="mt-1">No longer listed</Badge>}
      </div>
    </div>
  );
  return property.slug ? <Link to={`/property/${property.slug}`} className="block hover:opacity-90">{body}</Link> : body;
}

function RescheduleModal({ visit, onClose, onSubmit, busy }) {
  const [day, setDay] = useState('');
  const [time, setTime] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState(null);
  const today = new Date().toISOString().slice(0, 10);
  const max = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const submit = (e) => {
    e.preventDefault();
    if (!day || !time) { setError('Choose a preferred date and time'); return; }
    const [h, m] = time.split(':').map(Number);
    if (h < 8 || h * 60 + m > 19 * 60 + 30) { setError('Visits run between 8 am and 8 pm'); return; }
    onSubmit(`Preferred: ${day} ${time}${reason.trim() ? `. ${reason.trim()}` : ''}`.slice(0, 300));
  };
  return (
    <Modal open={Boolean(visit)} onClose={onClose} title="Ask for a new time" description={visit ? `Visit ${visit.visitNo}` : undefined}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" form="reschedule" loading={busy}>Send request</Button></>}>
      <form id="reschedule" onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Input label="Preferred date" type="date" required min={today} max={max} value={day} onChange={(e) => setDay(e.target.value)} />
          <Input label="Preferred time" type="time" required step="1800" min="08:00" max="19:30" value={time} onChange={(e) => setTime(e.target.value)} hint="Between 8 am and 8 pm" />
        </div>
        <Textarea label="Reason (optional)" rows={3} maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} hint={`${reason.length}/200`} />
        {error && <Alert tone="danger">{error}</Alert>}
        <p className="text-xs text-ink-subtle">Your agent will call you to confirm the new slot.</p>
      </form>
    </Modal>
  );
}

function VisitCard({ v, leadId }) {
  const act = useVisitAction(leadId);
  const toast = useToast();
  const [cancel, setCancel] = useState(false);
  const [reason, setReason] = useState('');
  const [resched, setResched] = useState(false);
  const s = visitStatus(v.status);
  const run = (action, body, msg) => act.mutate({ id: v.id, action, body }, {
    onSuccess: () => { toast.success(msg); setCancel(false); setResched(false); },
    onError: (e) => toast.error(e.code === 'CANCEL_CUTOFF' ? `Too close to the visit. Please call ${env.hotline}.` : e.message),
  });
  const canChange = ['requested', 'scheduled', 'confirmed'].includes(v.status);
  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-ink"><CalendarClock className="h-4 w-4 text-brand-600" aria-hidden />{dateTime(v.scheduledAt)}</p>
          <p className="mt-0.5 text-xs text-ink-subtle">Visit {v.visitNo}{v.meetingPoint ? ` · ${v.meetingPoint}` : ''}{v.buyerNote ? ` · ${v.buyerNote}` : ''}</p>
        </div>
        <Badge tone={s.tone}>{s.label}</Badge>
      </div>
      {v.status === 'requested' && <p className="mt-2 text-xs text-ink-muted">Our agent will call you to fix the exact time with the owner.</p>}
      {(v.canConfirm || v.canCancel || canChange) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {v.canConfirm && <Button size="sm" icon={Check} loading={act.isPending && act.variables && act.variables.action === 'confirm'} onClick={() => run('confirm', null, 'Visit confirmed. See you there!')}>Confirm</Button>}
          {canChange && <Button size="sm" variant="secondary" icon={CalendarCheck} onClick={() => setResched(true)}>Ask for a new time</Button>}
          {v.canCancel && <Button size="sm" variant="ghost" icon={X} onClick={() => setCancel(true)}>Cancel visit</Button>}
        </div>
      )}
      {v.status === 'completed' && !v.feedbackGiven && <Alert tone="info" className="mt-3">How was the visit? Open the feedback link we sent you by SMS or email, it takes a minute.</Alert>}
      {v.status === 'completed' && v.feedbackGiven && <p className="mt-2 text-xs text-success-700">Thanks for your feedback.</p>}
      <RescheduleModal visit={resched ? v : null} onClose={() => setResched(false)} busy={act.isPending} onSubmit={(note) => run('reschedule', { note }, 'Request sent. Your agent will call you.')} />
      <Modal open={cancel} onClose={() => setCancel(false)} size="sm" title="Cancel this visit?"
        footer={<><Button variant="ghost" onClick={() => setCancel(false)}>Keep it</Button><Button variant="danger" loading={act.isPending} onClick={() => run('cancel', reason.trim() ? { reason: reason.trim() } : {}, 'Visit cancelled')}>Cancel visit</Button></>}>
        <Textarea label="Reason (optional)" rows={3} maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} />
      </Modal>
    </div>
  );
}

function EnquiryDetail({ id }) {
  const q = useMyEnquiry(id);
  if (q.isLoading) return <div className="space-y-3"><Skeleton className="h-24 w-full" /><Skeleton className="h-16 w-full" /><Skeleton className="h-32 w-full" /></div>;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} title={q.error.status === 404 ? 'Enquiry not found' : undefined} />;
  const l = q.data;
  return (
    <div className="space-y-5">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <PropertyMini property={l.property} />
          <div className="text-right text-xs text-ink-subtle"><p className="font-semibold text-ink">Reference {l.leadNo}</p><p>Sent {date(l.createdAt)}</p></div>
        </div>
        <div className="mt-5"><Journey steps={l.journey} step={l.step} closed={l.closed} status={l.status} /></div>
        {l.status === 'Closed' && <Alert tone="info" className="mt-4">This enquiry is closed. Call us if you want to restart it.</Alert>}
        <div className="mt-4 flex flex-wrap items-center gap-4 border-t pt-3 text-sm text-ink-muted">
          {l.agent && <span className="inline-flex items-center gap-1.5"><UserRound className="h-4 w-4" aria-hidden />Your agent: <span className="font-medium text-ink">{l.agent}</span></span>}
          <a href={hotlineHref()} className="inline-flex items-center gap-1.5 hover:text-brand-700"><Phone className="h-4 w-4" aria-hidden />{env.hotline} (quote {l.leadNo})</a>
        </div>
      </Card>

      <section>
        <h2 className="mb-2 text-base font-semibold text-ink">Site visits</h2>
        {l.visits.length ? <div className="space-y-3">{l.visits.map((v) => <VisitCard key={v.id} v={v} leadId={l.id} />)}</div>
          : <p className="rounded-lg border border-dashed bg-white p-4 text-sm text-ink-muted">No visits yet. {l.property && l.property.slug && <Link to={`/property/${l.property.slug}?action=visit`} className="font-medium text-brand-700 hover:underline">Request a site visit</Link>}</p>}
      </section>

      {l.offers.length > 0 && (
        <section>
          <h2 className="mb-2 text-base font-semibold text-ink">Offers</h2>
          <div className="space-y-2">
            {l.offers.map((o) => (
              <div key={o.offerNo} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-white p-4">
                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-accent-50 p-2 text-accent-700"><HandCoins className="h-4 w-4" aria-hidden /></span>
                  <div className="text-sm"><p className="font-medium text-ink">{o.status}</p><p className="text-xs text-ink-subtle">Offer {o.offerNo}{o.rounds > 1 ? ` · ${o.rounds} rounds` : ''}</p></div>
                </div>
                {o.lastAmount != null && <p className="text-sm font-semibold text-ink">{rupees(o.lastAmount)}</p>}
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-ink-subtle">Owner replies are shared here once your agent has discussed them with you.</p>
        </section>
      )}
    </div>
  );
}

export default function MyEnquiriesPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isBuyer = user && user.role === 'buyer';
  const list = useMyEnquiries(isBuyer);
  const rows = (isBuyer && list.data) || [];

  if (!isBuyer) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <EmptyState icon={Inbox} title="Enquiries are for buyer accounts" description="Leads on your own listings are in your panel. To enquire on other properties, use a buyer account." action={<Button to="/">Go home</Button>} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <PageHeader title="My enquiries and visits" description="Track every enquiry, confirm site visits and see offers from owners."
        actions={<Button variant="secondary" icon={ClipboardList} to="/request-property">Request a property</Button>} />
      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <div className={cn(id && 'hidden lg:block')}>
          {list.isLoading ? <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
            : list.isError ? <ErrorState error={list.error} onRetry={() => list.refetch()} />
            : !rows.length ? <EmptyState icon={MessageSquareText} title="You have not enquired yet" description="Find a home you like and tap Contact. Our team takes it from there." action={<Button to="/search">Browse properties</Button>} />
            : (
              <ul className="space-y-2">
                {rows.map((l) => (
                  <li key={l.id}>
                    <button type="button" onClick={() => navigate(`/my-enquiries/${l.id}`)} aria-current={id === String(l.id) ? 'true' : undefined}
                      className={cn('w-full rounded-lg border bg-white p-3 text-left shadow-sm transition hover:border-brand-300', id === String(l.id) && 'border-brand-500 ring-2 ring-brand-500/20')}>
                      <PropertyMini property={l.property} requirement={l.requirement} />
                      <div className="mt-2 flex items-center justify-between text-xs">
                        <span className="text-ink-subtle">{l.leadNo} · {date(l.createdAt)}</span>
                        <Badge tone={STATUS_TONE[l.status] || 'neutral'}>{l.status}</Badge>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
        </div>
        <div className={cn(!id && 'hidden lg:block')}>
          {id ? (
            <>
              <Button variant="link" icon={ArrowLeft} className="mb-3 lg:hidden" onClick={() => navigate('/my-enquiries')}>All enquiries</Button>
              <EnquiryDetail id={id} />
            </>
          ) : rows.length > 0 ? (
            <div className="flex h-full min-h-[200px] items-center justify-center rounded-lg border border-dashed bg-white p-6 text-sm text-ink-subtle">Choose an enquiry to see its progress and visits.</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
