// RE-S-PUB-13 my enquiries and visits (buyer): enquiry list with the
// simplified journey, detail with visit cards (confirm / cancel / ask for a
// new slot), offers relayed by the agent and requirement requests.
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarCheck, CalendarClock, Check, ChevronRight, ClipboardList, HandCoins, Inbox, MapPin, MessageSquareText, Phone, UserRound, X } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { date, dateTime, rupees } from '@/shared/lib/format';
import { Alert, Button, EmptyState, Input, Modal, Skeleton, Textarea, useToast } from '@/shared/ui';
import { PUBLIC_FORM_SKIN } from '@/shared/layouts/AuthLayout';
import { useT } from '@/shared/i18n';
import useDocumentMeta from '@/shared/hooks/useDocumentMeta';
import env from '@/config/env';
import { useAuth } from '@/modules/auth';
import { JOURNEY, useMyEnquiries, useMyEnquiry, useVisitAction, visitStatus } from '@/modules/leads/publicApi';
import { ErrorState, hotlineHref } from '../../components/States';
import { Pill, TokenNotice } from '../tokens/TokenFrame';

const CARD = 'rounded-2xl bg-white shadow-card ring-1 ring-navy-900/5';

const STATUS_TONE = { Received: 'info', 'In touch': 'brand', 'Visit scheduled': 'warning', Visited: 'brand', Negotiating: 'accent', Booked: 'success', Closed: 'neutral' };
// Journey stages arrive from the API in English; known ones are shown translated.
const STAGE_KEY = { Received: 'received', 'In touch': 'inTouch', 'Visit scheduled': 'visitScheduled', Visited: 'visited', Negotiating: 'negotiating', Booked: 'booked', Closed: 'closed' };
const stageLabel = (t, s) => (STAGE_KEY[s] ? t(`account.stage.${STAGE_KEY[s]}`) : s);
function visitLabel(t, status) {
  const key = `account.visitStatus.${status}`;
  const v = t(key);
  return v === key ? visitStatus(status).label : v;
}

export function Journey({ steps = JOURNEY, step = 0, closed, status }) {
  const t = useT();
  const lost = closed && status === 'Closed';
  return (
    <ol className="flex items-start overflow-x-auto pb-1" aria-label={t('account.enquiries.progress')}>
      {steps.map((s, i) => {
        const done = i < step || (i === step && closed && !lost);
        const current = i === step && !done;
        return (
          <li key={s} className="flex min-w-[76px] flex-1 flex-col items-center text-center">
            <div className="flex w-full items-center">
              <span className={cn('h-px flex-1', i === 0 ? 'bg-transparent' : i <= step ? 'bg-gold-500' : 'bg-navy-900/15')} />
              <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold', done ? 'bg-navy-900 text-gold-300' : current ? 'bg-gold-50 text-gold-800 ring-2 ring-gold-500' : 'bg-sand-100 text-navy-500 ring-1 ring-inset ring-navy-900/10')}>
                {done ? <Check className="h-4 w-4" /> : i + 1}
              </span>
              <span className={cn('h-px flex-1', i === steps.length - 1 ? 'bg-transparent' : i < step ? 'bg-gold-500' : 'bg-navy-900/15')} />
            </div>
            <span className={cn('mt-1.5 text-[11px] leading-tight', current || done ? 'font-semibold text-navy-900' : 'text-navy-500')}>{stageLabel(t, s)}</span>
          </li>
        );
      })}
    </ol>
  );
}

function PropertyMini({ property, requirement }) {
  const t = useT();
  if (!property) {
    const city = (requirement && requirement.city) || t('account.enquiries.anyCity');
    return (
      <div className="flex items-center gap-3">
        <span className="flex h-14 w-16 shrink-0 items-center justify-center rounded-xl bg-gold-50 text-gold-700 ring-1 ring-gold-200"><ClipboardList className="h-5 w-5" aria-hidden /></span>
        <div className="min-w-0 text-sm"><p className="font-semibold text-navy-900">{t('account.enquiries.propertyRequest')}</p><p className="text-xs text-navy-500">{requirement ? t(requirement.purpose === 'rent' ? 'account.enquiries.requestRent' : 'account.enquiries.requestBuy', { city }) : t('account.enquiries.general')}</p></div>
      </div>
    );
  }
  const body = (
    <div className="flex items-center gap-3">
      {property.cover ? <img src={property.cover} alt="" className="h-14 w-16 shrink-0 rounded-xl object-cover" /> : <span className="h-14 w-16 shrink-0 rounded-xl bg-sand-200" />}
      <div className="min-w-0 text-sm">
        <p className="truncate font-semibold text-navy-900">{property.title}</p>
        <p className="flex items-center gap-1 truncate text-xs text-navy-500"><MapPin className="h-3 w-3 shrink-0 text-gold-700" aria-hidden />{[property.locality, property.city].filter(Boolean).join(', ')} · {property.listingNo}</p>
        {!property.available && <Pill className="mt-1">{t('account.enquiries.noLongerListed')}</Pill>}
      </div>
    </div>
  );
  return property.slug ? <Link to={`/property/${property.slug}`} className="block hover:opacity-90">{body}</Link> : body;
}

function RescheduleModal({ visit, onClose, onSubmit, busy }) {
  const t = useT();
  const [day, setDay] = useState('');
  const [time, setTime] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState(null);
  const today = new Date().toISOString().slice(0, 10);
  const max = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const submit = (e) => {
    e.preventDefault();
    if (!day || !time) { setError(t('account.enquiries.errChooseSlot')); return; }
    const [h, m] = time.split(':').map(Number);
    if (h < 8 || h * 60 + m > 19 * 60 + 30) { setError(t('account.enquiries.errHours')); return; }
    // The note is read by our sales team, so it stays in English.
    onSubmit(`Preferred: ${day} ${time}${reason.trim() ? `. ${reason.trim()}` : ''}`.slice(0, 300));
  };
  return (
    <Modal open={Boolean(visit)} onClose={onClose} title={t('account.enquiries.newTimeTitle')} description={visit ? t('account.enquiries.visitNo', { no: visit.visitNo }) : undefined}
      footer={<><Button variant="ghost" className="!rounded-full" onClick={onClose}>{t('common.cancel')}</Button><Button type="submit" form="reschedule" variant="navy" className="!rounded-full px-5" loading={busy}>{t('account.enquiries.sendRequest')}</Button></>}>
      <form id="reschedule" onSubmit={submit} className={`space-y-4 ${PUBLIC_FORM_SKIN}`}>
        <div className="grid grid-cols-2 gap-3">
          <Input label={t('account.enquiries.preferredDate')} type="date" required min={today} max={max} value={day} onChange={(e) => setDay(e.target.value)} />
          <Input label={t('account.enquiries.preferredTime')} type="time" required step="1800" min="08:00" max="19:30" value={time} onChange={(e) => setTime(e.target.value)} hint={t('account.enquiries.timeHint')} />
        </div>
        <Textarea label={t('account.enquiries.reasonOptional')} rows={3} maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} hint={`${reason.length}/200`} />
        {error && <Alert tone="danger">{error}</Alert>}
        <p className="text-xs text-navy-500">{t('account.enquiries.agentWillCall')}</p>
      </form>
    </Modal>
  );
}

function VisitCard({ v, leadId }) {
  const t = useT();
  const act = useVisitAction(leadId);
  const toast = useToast();
  const [cancel, setCancel] = useState(false);
  const [reason, setReason] = useState('');
  const [resched, setResched] = useState(false);
  const s = visitStatus(v.status);
  const run = (action, body, msg) => act.mutate({ id: v.id, action, body }, {
    onSuccess: () => { toast.success(msg); setCancel(false); setResched(false); },
    onError: (e) => toast.error(e.code === 'CANCEL_CUTOFF' ? t('account.enquiries.tooClose', { hotline: env.hotline }) : e.message),
  });
  const canChange = ['requested', 'scheduled', 'confirmed'].includes(v.status);
  return (
    <div className={`${CARD} p-5`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="flex items-center gap-2 font-display text-lg font-medium text-navy-900"><CalendarClock className="h-4 w-4 text-gold-700" aria-hidden />{dateTime(v.scheduledAt)}</p>
          <p className="mt-0.5 text-xs text-navy-500">{t('account.enquiries.visitNo', { no: v.visitNo })}{v.meetingPoint ? ` · ${v.meetingPoint}` : ''}{v.buyerNote ? ` · ${v.buyerNote}` : ''}</p>
        </div>
        <Pill tone={s.tone}>{visitLabel(t, v.status)}</Pill>
      </div>
      {v.status === 'requested' && <p className="mt-2 text-xs text-navy-500">{t('account.enquiries.requestedNote')}</p>}
      {(v.canConfirm || v.canCancel || canChange) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {v.canConfirm && <Button size="sm" variant="gold" className="!rounded-full px-4 font-semibold" icon={Check} loading={act.isPending && act.variables && act.variables.action === 'confirm'} onClick={() => run('confirm', null, t('account.enquiries.confirmedToast'))}>{t('account.enquiries.confirm')}</Button>}
          {canChange && <Button size="sm" variant="outline" className="!rounded-full px-4" icon={CalendarCheck} onClick={() => setResched(true)}>{t('account.enquiries.newTimeTitle')}</Button>}
          {v.canCancel && <Button size="sm" variant="ghost" className="!rounded-full px-4 text-navy-600" icon={X} onClick={() => setCancel(true)}>{t('account.enquiries.cancelVisit')}</Button>}
        </div>
      )}
      {v.status === 'completed' && !v.feedbackGiven && <Alert tone="info" className="mt-3">{t('account.enquiries.feedbackPrompt')}</Alert>}
      {v.status === 'completed' && v.feedbackGiven && <p className="mt-2 text-xs text-success-700">{t('account.enquiries.feedbackThanks')}</p>}
      <RescheduleModal visit={resched ? v : null} onClose={() => setResched(false)} busy={act.isPending} onSubmit={(note) => run('reschedule', { note }, t('account.enquiries.requestSentToast'))} />
      <Modal open={cancel} onClose={() => setCancel(false)} size="sm" title={t('account.enquiries.cancelTitle')}
        footer={<><Button variant="ghost" className="!rounded-full" onClick={() => setCancel(false)}>{t('account.enquiries.keepIt')}</Button><Button variant="danger" className="!rounded-full px-5" loading={act.isPending} onClick={() => run('cancel', reason.trim() ? { reason: reason.trim() } : {}, t('account.enquiries.cancelledToast'))}>{t('account.enquiries.cancelVisit')}</Button></>}>
        <div className={PUBLIC_FORM_SKIN}><Textarea label={t('account.enquiries.reasonOptional')} rows={3} maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} /></div>
      </Modal>
    </div>
  );
}

function EnquiryDetail({ id }) {
  const t = useT();
  const q = useMyEnquiry(id);
  if (q.isLoading) return <div className="space-y-3"><Skeleton className="h-24 w-full rounded-2xl" /><Skeleton className="h-16 w-full rounded-2xl" /><Skeleton className="h-32 w-full rounded-2xl" /></div>;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} title={q.error.status === 404 ? t('account.enquiries.notFound') : undefined} />;
  const l = q.data;
  return (
    <div className="space-y-8">
      <div className={`${CARD} p-5 sm:p-6`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <PropertyMini property={l.property} />
          <div className="text-right text-xs text-navy-500"><p className="font-display text-base font-medium text-navy-900">{t('account.enquiries.reference', { no: l.leadNo })}</p><p>{t('account.enquiries.sent', { date: date(l.createdAt) })}</p></div>
        </div>
        <div className="mt-6"><Journey steps={l.journey} step={l.step} closed={l.closed} status={l.status} /></div>
        {l.status === 'Closed' && <Alert tone="info" className="mt-4">{t('account.enquiries.closedNote')}</Alert>}
        <div className="mt-5 flex flex-wrap items-center gap-4 border-t border-navy-900/10 pt-4 text-sm text-navy-500">
          {l.agent && <span className="inline-flex items-center gap-1.5"><UserRound className="h-4 w-4 text-gold-700" aria-hidden />{t('account.enquiries.yourAgent')} <span className="font-semibold text-navy-900">{l.agent}</span></span>}
          <a href={hotlineHref()} className="inline-flex items-center gap-1.5 transition-colors hover:text-gold-700"><Phone className="h-4 w-4 text-gold-700" aria-hidden />{t('account.enquiries.quote', { hotline: env.hotline, no: l.leadNo })}</a>
        </div>
      </div>

      <section>
        <h2 className="mb-3 font-display text-2xl font-medium text-navy-900">{t('account.enquiries.siteVisits')}</h2>
        {l.visits.length ? <div className="space-y-3">{l.visits.map((v) => <VisitCard key={v.id} v={v} leadId={l.id} />)}</div>
          : <p className="rounded-2xl border border-dashed border-navy-900/15 bg-white p-5 text-sm text-navy-500">{t('account.enquiries.noVisits')} {l.property && l.property.slug && <Link to={`/property/${l.property.slug}?action=visit`} className="font-semibold text-navy-900 underline decoration-gold-400 underline-offset-4 hover:text-gold-700">{t('account.enquiries.requestVisit')}</Link>}</p>}
      </section>

      {l.offers.length > 0 && (
        <section>
          <h2 className="mb-3 font-display text-2xl font-medium text-navy-900">{t('account.enquiries.offers')}</h2>
          <div className="space-y-2">
            {l.offers.map((o) => (
              <div key={o.offerNo} className={`${CARD} flex flex-wrap items-center justify-between gap-2 p-5`}>
                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-gold-50 p-2.5 text-gold-700 ring-1 ring-gold-200"><HandCoins className="h-4 w-4" aria-hidden /></span>
                  <div className="text-sm"><p className="font-semibold text-navy-900">{o.status}</p><p className="text-xs text-navy-500">{t('account.enquiries.offerNo', { no: o.offerNo })}{o.rounds > 1 ? ` · ${t('account.enquiries.rounds', { count: o.rounds })}` : ''}</p></div>
                </div>
                {o.lastAmount != null && <p className="font-display text-lg font-semibold text-navy-900">{rupees(o.lastAmount)}</p>}
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-navy-500">{t('account.enquiries.offersNote')}</p>
        </section>
      )}
    </div>
  );
}

export default function MyEnquiriesPage() {
  const { id } = useParams();
  const t = useT();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isBuyer = user && user.role === 'buyer';
  const list = useMyEnquiries(isBuyer);
  const rows = (isBuyer && list.data) || [];
  useDocumentMeta({ title: t('account.meta.myEnquiries'), noindex: true });

  if (!isBuyer) {
    return (
      <TokenNotice icon={Inbox} title={t('account.enquiries.buyerOnlyTitle')} description={t('account.enquiries.buyerOnlyText')} action={<Button variant="navy" size="lg" className="!rounded-full px-6" to="/">{t('account.enquiries.goHome')}</Button>} />
    );
  }

  return (
    <div className="bg-sand-50">
      <header className="relative isolate overflow-hidden bg-navy-950">
        <img src="/images/stock/living-minimal.webp" alt="" aria-hidden className="absolute inset-0 -z-10 h-full w-full object-cover opacity-25" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-navy-950 via-navy-950/85 to-navy-950/40" aria-hidden />
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-12 sm:px-6 lg:flex-row lg:items-end lg:justify-between lg:py-14">
          <div>
            <nav aria-label={t('pages.common.breadcrumb')} className="flex items-center gap-1.5 text-sm text-navy-300">
              <Link to="/" className="transition-colors hover:text-white">{t('pages.common.home')}</Link>
              <ChevronRight className="h-3.5 w-3.5" aria-hidden />
              <span className="text-navy-200">{t('account.enquiries.title')}</span>
            </nav>
            <h1 className="mt-5 font-display text-4xl font-medium leading-tight tracking-tight text-white sm:text-5xl">{t('account.enquiries.title')}</h1>
            <p className="mt-3 max-w-2xl text-navy-200">{t('account.enquiries.description')}</p>
          </div>
          <Button variant="glass" size="lg" className="self-start !rounded-full lg:self-auto" icon={ClipboardList} to="/request-property">{t('account.enquiries.requestProperty')}</Button>
        </div>
      </header>
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[380px_minmax(0,1fr)] lg:py-14">
        <div className={cn(id && 'hidden lg:block')}>
          {list.isLoading ? <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}</div>
            : list.isError ? <ErrorState error={list.error} onRetry={() => list.refetch()} />
            : !rows.length ? <EmptyState icon={MessageSquareText} title={t('account.enquiries.emptyTitle')} description={t('account.enquiries.emptyText')} className="!rounded-2xl border-navy-900/15" action={<Button variant="gold" className="!rounded-full px-6 font-semibold" to="/search">{t('account.enquiries.browse')}</Button>} />
            : (
              <ul className="space-y-3">
                {rows.map((l) => (
                  <li key={l.id}>
                    <button type="button" onClick={() => navigate(`/my-enquiries/${l.id}`)} aria-current={id === String(l.id) ? 'true' : undefined}
                      className={cn('w-full rounded-2xl bg-white p-4 text-left shadow-card ring-1 transition duration-300 hover:-translate-y-0.5 hover:shadow-lift', id === String(l.id) ? 'ring-2 ring-gold-500' : 'ring-navy-900/5')}>
                      <PropertyMini property={l.property} requirement={l.requirement} />
                      <div className="mt-3 flex items-center justify-between gap-2 border-t border-navy-900/5 pt-3 text-xs">
                        <span className="text-navy-500">{l.leadNo} · {date(l.createdAt)}</span>
                        <Pill tone={STATUS_TONE[l.status] || 'neutral'}>{stageLabel(t, l.status)}</Pill>
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
              <Button variant="ghost" icon={ArrowLeft} className="mb-4 !rounded-full px-3 text-navy-700 lg:hidden" onClick={() => navigate('/my-enquiries')}>{t('account.enquiries.allEnquiries')}</Button>
              <EnquiryDetail id={id} />
            </>
          ) : rows.length > 0 ? (
            <div className="flex h-full min-h-[240px] items-center justify-center rounded-2xl border border-dashed border-navy-900/15 bg-white/60 p-6 text-center font-display text-lg text-navy-500">{t('account.enquiries.choose')}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
