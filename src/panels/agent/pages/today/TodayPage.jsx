// RE-S-AGT-01 Today: SLA strip, follow-ups (today and overdue), today's
// visits, outcomes pending, offers to relay, call-back requests, returned
// deals and the availability toggle. Polls every 60 s.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlarmClock, CalendarDays, CheckCircle2, FileWarning, Handshake, Inbox, ListChecks, MapPin, PhoneCall, PhoneIncoming, Send, Sparkles,
} from 'lucide-react';
import { Badge, Button, Card, EmptyState, PageHeader, Skeleton, Stat, useToast } from '@/shared/ui';
import { cn } from '@/shared/lib/cn';
import { date, dateTime, shortRupees, timeAgo } from '@/shared/lib/format';
import { useAuth } from '@/modules/auth';
import { errorText, firstName, leadApi, setAvailability, useAgentDashboard, useAgentMutation, visitStatus } from '@/modules/leads/agentApi';
import { CallLogModal } from '../../components/LeadModals';
import { CompleteFollowupModal } from '../../components/FollowupModals';
import { VisitOutcomeModal } from '../../components/VisitModals';
import { t as tt, useT } from '@/shared/i18n';
import { ErrorState, Section, SlaTimer, timeOnly } from '../../components/common';

const IST = 330 * 60000;
// Hour of the day in IST picks the greeting (agent.today.morning / afternoon / evening).
const greet = () => { const h = new Date(Date.now() + IST).getUTCHours(); return tt(h < 12 ? 'agent.today.morning' : h < 17 ? 'agent.today.afternoon' : 'agent.today.evening'); };
// "Friday, 17/10/2026" (agent.today.weekdays, Sunday first).
const todayText = () => { const names = tt('agent.today.weekdays'); const day = Array.isArray(names) ? names[new Date(Date.now() + IST).getUTCDay()] : ''; return `${day}, ${date(new Date())}`; };
// Follow-up type as sent by the API, shown in the list (agent.today.type.*).
const typeText = (v) => { const k = `agent.today.type.${v}`; const s = tt(k); return s === k ? v : s; };

function AvailabilityToggle({ availability }) {
  const t = useT();
  const toast = useToast();
  const m = useAgentMutation(setAvailability);
  if (!availability) return <Badge tone="neutral">{t('agent.today.noTeam')}</Badge>;
  const on = availability.available !== false;
  const flip = async () => {
    try { await m.mutateAsync({ available: !on }); toast.success(on ? t('panel.availability.nowAway') : t('panel.availability.nowAvailable')); } catch (e) { toast.error(errorText(e)); }
  };
  return (
    <button type="button" onClick={flip} disabled={m.isPending} aria-pressed={on}
      className={cn('inline-flex h-10 items-center gap-2 rounded-md border px-3 text-sm font-medium', on ? 'border-success-100 bg-success-50 text-success-700' : 'border-line-strong bg-surface-sunken text-ink-muted')}>
      <span className={cn('h-2.5 w-2.5 rounded-full', on ? 'bg-success-600' : 'bg-ink-subtle')} aria-hidden />
      {on ? t('panel.availability.available') : t('panel.availability.away')} · {availability.team}
    </button>
  );
}

const Row = ({ children, className }) => <li className={cn('flex flex-wrap items-center justify-between gap-2 py-2.5', className)}>{children}</li>;
const Empty = ({ text }) => <p className="py-6 text-center text-sm text-ink-subtle">{text}</p>;

function FollowupList({ items, overdue, onDone }) {
  const t = useT();
  if (!items.length) return <Empty text={overdue ? t('agent.today.nothingOverdue') : t('agent.today.noneToday')} />;
  return (
    <ul className="divide-y">
      {items.map((f) => (
        <Row key={f._id}>
          <span className="min-w-0">
            <Link to={`/agent/leads/${f.leadId && f.leadId._id}`} className="font-medium text-ink hover:text-brand-700">{f.leadId ? `${f.leadId.leadNo} · ${firstName(f.leadId.buyer && f.leadId.buyer.name)}` : t('agent.common.lead')}</Link>
            <span className="block text-xs text-ink-subtle">{typeText(f.type)} · {overdue ? t('agent.followups.dueAgo', { ago: timeAgo(f.dueAt) }) : timeOnly(f.dueAt)}{f.note ? ` · ${f.note}` : ''}</span>
          </span>
          <Button size="sm" variant="secondary" icon={CheckCircle2} onClick={() => onDone(f)}>{t('agent.followup.outcomes.done')}</Button>
        </Row>
      ))}
    </ul>
  );
}

export default function TodayPage() {
  const t = useT();
  const { user } = useAuth();
  const toast = useToast();
  const { data, isLoading, error, refetch } = useAgentDashboard();
  const relay = useAgentMutation(leadApi.relay);
  const [callLead, setCallLead] = useState(null);
  const [doneFu, setDoneFu] = useState(null);
  const [outcomeVisit, setOutcomeVisit] = useState(null);

  const header = <PageHeader title={`${greet()}, ${firstName(user.name)}`} description={todayText()} actions={data && <AvailabilityToggle availability={data.availability} />} />;
  if (isLoading) return <>{header}<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24" />)}</div><Skeleton className="mt-6 h-64" /></>;
  if (error) return <>{header}<ErrorState error={error} onRetry={refetch} title={t('agent.today.loadError')} /></>;

  const c = data.counts;
  const toRelay = data.offersToRelay.filter((o) => o.lastRound && o.lastRound.by === 'lister' && !o.lastRound.relayedToBuyerAt);
  const nothing = !data.slaDue.length && !data.overdue.length && !data.followUpsToday.length && !data.visitsToday.length && !data.outcomePending.length && !toRelay.length && !data.returnedDeals.length && !data.callBacks.length;
  const doRelay = async (o) => { try { await relay.mutateAsync({ offerId: o._id }); toast.success(t('agent.today.relayed', { no: o.offerNo })); } catch (e) { toast.error(errorText(e)); } };

  return (
    <>
      {header}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={AlarmClock} tone={c.slaDue ? 'danger' : 'success'} label={t('agent.today.firstContactDue')} value={c.slaDue} hint={t('agent.today.newToday', { n: c.newToday })} />
        <Stat icon={ListChecks} tone={c.overdue ? 'warning' : 'brand'} label={t('agent.today.followupsToday')} value={c.followUpsToday} hint={t('agent.today.overdueN', { n: c.overdue })} />
        <Stat icon={CalendarDays} tone="info" label={t('agent.today.visitsToday')} value={c.visitsToday} hint={t('agent.today.outcomePendingN', { n: c.outcomePending })} />
        <Stat icon={Inbox} tone="brand" label={t('agent.today.openLeads')} value={c.open} hint={t('agent.today.toRelayN', { n: c.offersToRelay })} />
      </div>

      {nothing && <EmptyState className="mt-6" icon={Sparkles} title={t('agent.today.noTasks')} description={t('agent.today.noTasksDesc')} action={<Button variant="secondary" to="/agent/leads">{t('agent.today.openMyLeads')}</Button>} />}

      {data.slaDue.length > 0 && (
        <Section className="mt-6" title={t('agent.today.slaTitle')} action={<Badge tone="danger">{data.slaDue.length}</Badge>}>
          <ul className="divide-y">
            {data.slaDue.map((l) => (
              <Row key={l._id} className={l.breached ? 'rounded-md bg-danger-50 px-2' : ''}>
                <span className="min-w-0">
                  <Link to={`/agent/leads/${l._id}`} className="font-medium text-ink hover:text-brand-700">{l.leadNo} · {firstName(l.buyerName)}</Link>
                  <span className="block truncate text-xs text-ink-subtle">{l.buyerPhone} · {l.property ? `${l.property.listingNo} ${l.property.title}` : t('agent.common.noProperty')} · {timeAgo(l.createdAt)}</span>
                </span>
                <span className="flex items-center gap-2"><SlaTimer lead={l} /><Button size="sm" icon={PhoneCall} onClick={() => setCallLead(l)}>{t('agent.lead.logCall')}</Button></span>
              </Row>
            ))}
          </ul>
        </Section>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Section title={t('agent.today.todaysFollowups')} action={<Button size="sm" variant="ghost" to="/agent/follow-ups">{t('agent.deals.tab.all')}</Button>}>
          <FollowupList items={data.followUpsToday} onDone={setDoneFu} />
        </Section>
        <Section title={t('agent.performance.overdue')} action={data.overdue.length ? <Badge tone="warning">{data.overdue.length}</Badge> : null}>
          <FollowupList overdue items={data.overdue} onDone={setDoneFu} />
        </Section>

        <Section title={t('agent.today.todaysVisits')} action={<Button size="sm" variant="ghost" to="/agent/visits">{t('agent.today.calendar')}</Button>}>
          {data.visitsToday.length ? (
            <ul className="divide-y">
              {data.visitsToday.map((v) => (
                <Row key={v._id}>
                  <span className="min-w-0">
                    <span className="font-medium text-ink">{timeOnly(v.scheduledAt)} · {v.propertyId ? v.propertyId.title : v.visitNo}</span>
                    <span className="block text-xs text-ink-subtle">
                      <MapPin className="mr-1 inline h-3 w-3" aria-hidden />{v.propertyId && v.propertyId.location ? v.propertyId.location.locality : ''} · {v.leadId ? <Link className="hover:text-brand-700" to={`/agent/leads/${v.leadId._id}`}>{firstName(v.leadId.buyer && v.leadId.buyer.name)}</Link> : ''}
                    </span>
                  </span>
                  <Badge tone={visitStatus(v.status).tone}>{visitStatus(v.status).label}</Badge>
                </Row>
              ))}
            </ul>
          ) : <Empty text={t('agent.today.noVisits')} />}
        </Section>

        <Section title={t('agent.today.outcomesPending')} action={data.outcomePending.length ? <Badge tone="warning">{data.outcomePending.length}</Badge> : null}>
          {data.outcomePending.length ? (
            <ul className="divide-y">
              {data.outcomePending.map((v) => (
                <Row key={v._id}>
                  <span><span className="font-medium text-ink">{v.visitNo}</span><span className="block text-xs text-ink-subtle">{dateTime(v.scheduledAt)} · {v.leadId ? firstName(v.leadId.buyer && v.leadId.buyer.name) : ''}</span></span>
                  <Button size="sm" variant="secondary" onClick={() => setOutcomeVisit(v)}>{t('agent.visits.recordOutcome')}</Button>
                </Row>
              ))}
            </ul>
          ) : <Empty text={t('agent.today.allRecorded')} />}
        </Section>

        <Section title={t('agent.today.relayTitle')} action={<Handshake className="h-4 w-4 text-ink-subtle" aria-hidden />}>
          {toRelay.length ? (
            <ul className="divide-y">
              {toRelay.map((o) => (
                <Row key={o._id}>
                  <span>
                    <Link to={`/agent/leads/${o.lead && o.lead._id}`} className="font-medium text-ink hover:text-brand-700">{o.offerNo} · {o.lead ? firstName(o.lead.buyer && o.lead.buyer.name) : ''}</Link>
                    <span className="block text-xs text-ink-subtle">{o.lastRound.kind === 'accept' ? t('agent.today.ownerAccepted') : o.lastRound.kind === 'counter' ? t('agent.today.ownerCountered', { amount: shortRupees(o.lastRound.amount) }) : t('agent.today.ownerKind', { kind: o.lastRound.kind })}</span>
                  </span>
                  <Button size="sm" variant="secondary" icon={Send} loading={relay.isPending} onClick={() => doRelay(o)}>{t('agent.today.toldBuyer')}</Button>
                </Row>
              ))}
            </ul>
          ) : <Empty text={t('agent.today.noReplies')} />}
        </Section>

        <Section title={t('agent.today.callBacks')} action={<PhoneIncoming className="h-4 w-4 text-ink-subtle" aria-hidden />}>
          {data.callBacks.length ? (
            <ul className="divide-y">
              {data.callBacks.map((cb) => (
                <Row key={cb.visitNo}>
                  <Link to={`/agent/leads/${cb.lead && cb.lead._id}`} className="font-medium text-ink hover:text-brand-700">{cb.lead ? `${cb.lead.leadNo} · ${firstName(cb.lead.buyer && cb.lead.buyer.name)}` : cb.visitNo}</Link>
                  <span className="text-xs text-ink-subtle">{t('agent.today.after', { no: cb.visitNo })}{cb.interest ? ` · ${t('agent.activity.interest', { n: cb.interest })}` : ''}</span>
                </Row>
              ))}
            </ul>
          ) : <Empty text={t('agent.today.noCallBacks')} />}
        </Section>
      </div>

      {data.returnedDeals.length > 0 && (
        <Card className="mt-6">
          <div className="mb-3 flex items-center gap-2"><FileWarning className="h-5 w-5 text-warning-600" aria-hidden /><h2 className="text-base font-semibold text-ink">{t('agent.today.returnedDeals')}</h2></div>
          <ul className="divide-y">
            {data.returnedDeals.map((d) => (
              <Row key={d._id}>
                <Link to={`/agent/deals/${d._id}`} className="font-medium text-ink hover:text-brand-700">{d.dealNo}</Link>
                <span className="text-xs text-ink-subtle">{d.returnNote || t('agent.today.openDeal')} · {timeAgo(d.updatedAt)}</span>
              </Row>
            ))}
          </ul>
        </Card>
      )}

      {data.slaDue.length === 0 && c.open > 0 && <p className="mt-6 text-sm text-ink-subtle">{t('agent.today.allContacted')} {c.newToday ? `${t('agent.today.newToday', { n: c.newToday })}.` : ''}</p>}
      <p className="mt-2 text-xs text-ink-subtle">{t('agent.today.refreshes')}</p>

      <CallLogModal open={Boolean(callLead)} onClose={() => setCallLead(null)} lead={callLead} />
      <CompleteFollowupModal open={Boolean(doneFu)} onClose={() => setDoneFu(null)} followups={doneFu ? [doneFu] : []} />
      <VisitOutcomeModal open={Boolean(outcomeVisit)} onClose={() => setOutcomeVisit(null)} visit={outcomeVisit} />
    </>
  );
}
