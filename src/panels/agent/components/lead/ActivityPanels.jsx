// Lead detail panels: offers (RE-C-20), site visits, follow-ups and the activity timeline.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarClock, CalendarPlus, CheckCircle2, ClipboardCheck, FilePlus2, HandCoins, ListPlus, Pencil, Send, Undo2, XCircle } from 'lucide-react';
import { Badge, Button, Select, Textarea, useToast } from '@/shared/ui';
import { date, dateTime, rupees, timeAgo, titleCase } from '@/shared/lib/format';
import { t as tt, useT } from '@/shared/i18n';
import { CALL_OUTCOMES, FOLLOWUP_TYPES, LOST_REASONS, errorText, leadApi, offerStatus, stageInfo, useAgentMutation, visitApi, visitStatus } from '@/modules/leads/agentApi';
import { BuyerRoundModal, RecordOfferModal } from '../OfferModals';
import { ScheduleVisitModal, VisitOutcomeModal } from '../VisitModals';
import { CompleteFollowupModal, FollowupModal } from '../FollowupModals';
import { ReasonModal, Section } from '../common';

const propName = (props, id) => { const p = (props || []).find((x) => String(x._id) === String(id)); return p ? `${p.listingNo} · ${p.title}` : tt('agent.common.property'); };
// Translated label for an API value, or the value in title case when there is no key.
const keyOr = (key, v) => { const s = tt(key); return s === key ? titleCase(v || '') : s; };
// Same, but the raw value when there is no key.
const keyRaw = (key, v) => { const s = tt(key); return s === key ? v : s; };
const roundKind = (kind) => keyRaw(`agent.activity.kind.${kind}`, kind);
const label = (list, v) => (list.find((x) => x.value === v) || { label: titleCase(v) }).label;

// ---------------------------------------------------------------- offers

export function OffersPanel({ lead }) {
  const t = useT();
  const toast = useToast();
  const navigate = useNavigate();
  const relay = useAgentMutation(leadApi.relay);
  const withdraw = useAgentMutation(leadApi.withdrawOffer);
  const [record, setRecord] = useState(false);
  const [round, setRound] = useState(null);
  const [withdrawing, setWithdrawing] = useState(null);
  const offers = lead.offers || [];
  const canOffer = ['contacted', 'qualified', 'site_visit_scheduled', 'site_visit_done', 'negotiation'].includes(lead.stage);

  const doRelay = async (o) => { try { await relay.mutateAsync({ offerId: o._id }); toast.success(t('agent.activity.relayed')); } catch (e) { toast.error(errorText(e)); } };
  const doWithdraw = async (note) => { try { await withdraw.mutateAsync({ offerId: withdrawing._id, note }); toast.success(t('agent.activity.withdrawn')); setWithdrawing(null); } catch (e) { toast.error(errorText(e)); } };

  return (
    <Section title={t('agent.activity.offers')} action={<Button size="sm" variant="secondary" icon={HandCoins} disabled={!canOffer || !(lead.properties || []).length} onClick={() => setRecord(true)}>{t('agent.offer.title')}</Button>}>
      {!offers.length ? <p className="py-4 text-center text-sm text-ink-subtle">{t('agent.activity.noOffers')}{!canOffer ? ` ${t('agent.activity.cannotOffer', { stage: stageInfo(lead.stage).label.toLowerCase() })}` : ''}</p> : (
        <ul className="space-y-3">
          {offers.map((o) => {
            const last = o.rounds[o.rounds.length - 1];
            const fromOwner = last && last.by === 'lister';
            const s = offerStatus(o.status);
            return (
              <li key={o._id} className="rounded-md border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm"><span className="font-semibold text-ink">{o.offerNo}</span> <span className="text-ink-subtle">· {propName(lead.properties, o.propertyId)}</span></span>
                  <Badge tone={s.tone}>{s.label}</Badge>
                </div>
                <ol className="mt-2 space-y-1 border-l-2 border-line pl-3 text-xs">
                  {o.rounds.map((r) => (
                    <li key={r.n} className="text-ink-muted">
                      <span className="font-medium text-ink">{r.by === 'lister' ? t('agent.activity.owner') : t('agent.common.buyer')} {roundKind(r.kind)}</span>{r.amount ? ` ${rupees(r.amount)}` : ''}{r.terms && r.terms.token ? ` · ${t('agent.activity.token', { amount: rupees(r.terms.token) })}` : ''}{r.terms && r.terms.possessionDate ? ` · ${t('agent.activity.possession', { date: date(r.terms.possessionDate) })}` : ''}{r.terms && r.terms.inclusions ? ` · ${t('agent.activity.includes', { text: r.terms.inclusions })}` : ''}
                      {r.note ? ` · "${r.note}"` : ''} · {timeAgo(r.at)}{r.by === 'lister' && r.relayedToBuyerAt ? ` · ${t('agent.activity.toldBuyer')}` : ''}
                    </li>
                  ))}
                </ol>
                {o.validUntil && ['awaiting_lister', 'awaiting_buyer'].includes(o.status) && <p className="mt-1 text-xs text-ink-subtle">{t('agent.activity.validUntil', { at: dateTime(o.validUntil) })}</p>}
                <div className="mt-2 flex flex-wrap gap-2">
                  {o.status === 'awaiting_buyer' && fromOwner && !last.relayedToBuyerAt && <Button size="sm" icon={Send} loading={relay.isPending} onClick={() => doRelay(o)}>{t('agent.activity.relay')}</Button>}
                  {o.status === 'awaiting_buyer' && fromOwner && last.relayedToBuyerAt && <>
                    <Button size="sm" icon={CheckCircle2} onClick={() => setRound({ offer: o, kind: 'accept' })}>{t('agent.activity.buyerAccepts')}</Button>
                    <Button size="sm" variant="secondary" onClick={() => setRound({ offer: o, kind: 'counter' })}>{t('agent.activity.buyerCounter')}</Button>
                  </>}
                  {o.status === 'accepted' && fromOwner && !last.relayedToBuyerAt && <Button size="sm" variant="secondary" icon={Send} loading={relay.isPending} onClick={() => doRelay(o)}>{t('agent.activity.relayAcceptance')}</Button>}
                  {o.status === 'accepted' && !o.dealId && <Button size="sm" icon={FilePlus2} onClick={() => navigate(`/agent/deals/new?leadId=${lead._id}&offerId=${o._id}`)}>{t('agent.activity.createDeal')}</Button>}
                  {['awaiting_lister', 'awaiting_buyer'].includes(o.status) && <Button size="sm" variant="ghost" icon={Undo2} onClick={() => setWithdrawing(o)}>{t('agent.activity.withdraw')}</Button>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <RecordOfferModal open={record} onClose={() => setRecord(false)} lead={lead} properties={(lead.properties || []).filter((p) => p.status === 'live' || String(p._id) === String(lead.propertyId))} />
      <BuyerRoundModal open={Boolean(round)} onClose={() => setRound(null)} offer={round && round.offer} kind={round && round.kind} />
      <ReasonModal open={Boolean(withdrawing)} onClose={() => setWithdrawing(null)} title={t('agent.activity.withdrawTitle')} description={t('agent.activity.withdrawDesc')} label={t('agent.common.noteOptional')} min={0} max={300} confirmLabel={t('agent.activity.withdraw')} danger loading={withdraw.isPending} onSubmit={doWithdraw} />
    </Section>
  );
}

// ---------------------------------------------------------------- visits

export function VisitsPanel({ lead }) {
  const t = useT();
  const stage = useAgentMutation(leadApi.stage);
  const [offerFrom, setOfferFrom] = useState(null); // visit outcome with an offer -> record it formally
  // After an outcome: move to negotiation when chosen, and hand an offer amount to "Record buyer offer".
  const afterOutcome = async (body, visit) => {
    if (body.nextStep === 'Negotiation' && !['negotiation', 'booking'].includes(lead.stage)) {
      try { await stage.mutateAsync({ id: lead._id, body: { stage: 'negotiation', note: 'Next step after the visit' } }); } catch (e) { toast.error(errorText(e)); }
    }
    if (body.offerAmount) setOfferFrom({ amount: body.offerAmount, propertyId: visit && visit.propertyId });
  };
  const toast = useToast();
  const confirm = useAgentMutation(visitApi.confirm);
  const cancel = useAgentMutation(visitApi.cancel);
  const [schedule, setSchedule] = useState(false);
  const [requested, setRequested] = useState(null);
  const [resched, setResched] = useState(null);
  const [outcome, setOutcome] = useState(null);
  const [cancelling, setCancelling] = useState(null);
  const visits = lead.visits || [];
  const open = ['new', 'contacted', 'qualified', 'site_visit_scheduled', 'site_visit_done', 'negotiation', 'booking'].includes(lead.stage);
  const doConfirm = async (v) => { try { await confirm.mutateAsync({ id: v._id }); toast.success(t('agent.activity.confirmed')); } catch (e) { toast.error(errorText(e)); } };
  const doCancel = async (reason) => { try { await cancel.mutateAsync({ id: cancelling._id, reason }); toast.success(t('agent.activity.visitCancelled')); setCancelling(null); } catch (e) { toast.error(errorText(e)); } };

  return (
    <Section title={t('agent.activity.visits')} action={<Button size="sm" variant="secondary" icon={CalendarPlus} disabled={!open} onClick={() => setSchedule(true)}>{t('agent.schedule.submit')}</Button>}>
      {!visits.length ? <p className="py-4 text-center text-sm text-ink-subtle">{t('agent.activity.noVisits')}</p> : (
        <ul className="divide-y">
          {visits.map((v) => {
            const s = visitStatus(v.status);
            const live = ['scheduled', 'confirmed'].includes(v.status);
            const past = new Date(v.scheduledAt) <= new Date();
            return (
              <li key={v._id} className="py-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm"><span className="font-medium text-ink">{v.visitNo}</span> · {v.status === 'requested' ? t('agent.activity.requestedAt', { at: v.requestedSlot ? dateTime(v.requestedSlot) : '' }) : dateTime(v.scheduledAt)}</span>
                  <span className="flex items-center gap-1">{v.outsideListerSlots && <Badge tone="warning">{t('agent.activity.override')}</Badge>}<Badge tone={s.tone}>{s.label}</Badge></span>
                </div>
                <p className="text-xs text-ink-subtle">{propName(lead.properties, v.propertyId)}{v.meetingPoint ? ` · ${v.meetingPoint}` : ''}{v.buyerNote ? ` · "${v.buyerNote}"` : ''}{v.pickup && v.pickup.needed ? ` · ${t('agent.activity.pickup')}` : ''}{v.outcome && v.outcome.interest ? ` · ${t('agent.activity.interest', { n: v.outcome.interest })}` : ''}{v.cancelReason ? ` · ${v.cancelReason}` : ''}</p>
                {(v.history || []).length > 0 && <p className="text-xs text-ink-subtle">{t('agent.activity.moved', { n: v.history.length, reason: v.history[v.history.length - 1].reason || '-' })}</p>}
                {v.outcome && (v.outcome.photoUrls || []).length > 0 && (
                  <ul className="mt-1.5 flex flex-wrap gap-1.5" aria-label={t('agent.activity.photosOf', { no: v.visitNo })}>
                    {v.outcome.photoUrls.map((ph, i) => (
                      <li key={ph.id}><a href={ph.url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded border bg-surface-sunken hover:opacity-90">
                        <img src={ph.thumbUrl || ph.url} alt={t('agent.activity.photoN', { n: i + 1 })} className="h-14 w-14 object-cover" loading="lazy" />
                      </a></li>
                    ))}
                  </ul>
                )}
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {v.status === 'requested' && <Button size="sm" icon={CalendarClock} onClick={() => setRequested(v)}>{t('agent.activity.schedule')}</Button>}
                  {v.status === 'scheduled' && <Button size="sm" variant="secondary" icon={CheckCircle2} loading={confirm.isPending} onClick={() => doConfirm(v)}>{t('agent.activity.buyerConfirmed')}</Button>}
                  {live && past && <Button size="sm" icon={ClipboardCheck} onClick={() => setOutcome(v)}>{t('agent.activity.outcome')}</Button>}
                  {live && <Button size="sm" variant="ghost" icon={Pencil} onClick={() => setResched(v)}>{t('agent.activity.reschedule')}</Button>}
                  {(live || v.status === 'requested') && <Button size="sm" variant="ghost" icon={XCircle} onClick={() => setCancelling(v)}>{t('common.cancel')}</Button>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <ScheduleVisitModal open={schedule} onClose={() => setSchedule(false)} lead={lead} properties={lead.properties} />
      <ScheduleVisitModal open={Boolean(requested)} onClose={() => setRequested(null)} lead={lead} requested={requested} properties={lead.properties} />
      <ScheduleVisitModal open={Boolean(resched)} onClose={() => setResched(null)} lead={lead} visit={resched} properties={lead.properties} />
      <VisitOutcomeModal open={Boolean(outcome)} onClose={() => setOutcome(null)} visit={outcome} onDone={(body) => afterOutcome(body, outcome)} />
      <RecordOfferModal open={Boolean(offerFrom)} onClose={() => setOfferFrom(null)} lead={lead} initialAmount={offerFrom && offerFrom.amount} initialPropertyId={offerFrom && offerFrom.propertyId}
        properties={(lead.properties || []).filter((p) => p.status === 'live' || String(p._id) === String(lead.propertyId))} />
      <ReasonModal open={Boolean(cancelling)} onClose={() => setCancelling(null)} title={t('agent.activity.cancelTitle', { no: cancelling ? cancelling.visitNo : t('agent.activity.visit') })} label={t('agent.common.reason')} min={3} max={300} confirmLabel={t('agent.activity.cancelVisit')} danger loading={cancel.isPending} onSubmit={doCancel} />
    </Section>
  );
}

// ---------------------------------------------------------------- follow-ups

export function FollowupsPanel({ lead }) {
  const t = useT();
  const [add, setAdd] = useState(false);
  const [edit, setEdit] = useState(null);
  const [done, setDone] = useState(null);
  const all = lead.followups || [];
  const open = all.filter((f) => f.status === 'open').sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt));
  const closed = all.filter((f) => f.status !== 'open').slice(0, 5);
  const leadRef = { _id: lead._id, leadNo: lead.leadNo, buyerName: lead.buyer && lead.buyer.name };
  return (
    <Section title={t('agent.activity.followups')} action={<Button size="sm" variant="secondary" icon={ListPlus} onClick={() => setAdd(true)}>{t('agent.activity.add')}</Button>}>
      {!open.length && <p className="py-2 text-sm text-ink-subtle">{t('agent.activity.noFollowup')}</p>}
      <ul className="divide-y">
        {open.map((f) => {
          const overdue = new Date(f.dueAt) < new Date();
          return (
            <li key={f._id} className="flex items-center justify-between gap-2 py-2">
              <span className="min-w-0 text-sm">
                <span className={overdue ? 'font-medium text-danger-700' : 'font-medium text-ink'}>{label(FOLLOWUP_TYPES, f.type)} · {dateTime(f.dueAt)}</span>
                {f.note && <span className="block truncate text-xs text-ink-subtle">{f.note}</span>}
              </span>
              <span className="flex shrink-0 gap-1">
                <Button size="sm" variant="ghost" icon={Pencil} aria-label={t('agent.activity.edit')} onClick={() => setEdit(f)} />
                <Button size="sm" variant="secondary" onClick={() => setDone(f)}>{t('agent.followup.outcomes.done')}</Button>
              </span>
            </li>
          );
        })}
      </ul>
      {closed.length > 0 && (
        <details className="mt-2 text-xs text-ink-subtle">
          <summary className="cursor-pointer">{t('agent.activity.recentCompleted')}</summary>
          <ul className="mt-1 space-y-1">{closed.map((f) => <li key={f._id}>{label(FOLLOWUP_TYPES, f.type)} · {dateTime(f.doneAt || f.dueAt)} · {f.status === 'done' ? f.outcome : keyRaw(`agent.activity.fuStatus.${f.status}`, f.status)}</li>)}</ul>
        </details>
      )}
      <FollowupModal open={add} onClose={() => setAdd(false)} lead={leadRef} />
      <FollowupModal open={Boolean(edit)} onClose={() => setEdit(null)} followup={edit} lead={leadRef} />
      <CompleteFollowupModal open={Boolean(done)} onClose={() => setDone(null)} followups={done ? [done] : []} />
    </Section>
  );
}

// ---------------------------------------------------------------- timeline

// One line of the activity timeline (agent.activity.tl.* keys; API text such as notes stays as typed).
function describe(item) {
  const t = tt;
  const d = item.data || {};
  const note = d.note ? ` · ${d.note}` : '';
  switch (item.type) {
    case 'created': return `${t('agent.activity.tl.created')}${d.type ? ` (${keyOr(`agent.activity.tl.src.${d.type}`, d.type)})` : ''}${d.manual ? ` ${t('agent.activity.tl.byHand')}` : ''}`;
    case 'assigned': return `${t('agent.activity.tl.assigned')}${note}`;
    case 'reassigned': return `${t('agent.activity.tl.reassigned')}${note}`;
    case 'stage': return `${t('agent.activity.tl.stage', { from: stageInfo(d.from).label, to: stageInfo(d.to).label })}${d.lostReason ? ` (${label(LOST_REASONS, d.lostReason)})` : ''}${note}`;
    case 'call': return `${t(d.direction === 'inbound' ? 'agent.activity.tl.callIn' : 'agent.activity.tl.callOut', { outcome: label(CALL_OUTCOMES, d.outcome) })}${d.durationSec ? ` · ${t('agent.activity.tl.min', { n: Math.round(d.durationSec / 60) })}` : ''}${note}`;
    case 'note': return d.text;
    case 'visit': return `${t('agent.activity.tl.visit', { no: d.visitNo || '', status: d.status ? keyOr(`agent.activity.tl.visitStatus.${d.status}`, d.status) : '' })}${d.at ? ` ${t('agent.activity.tl.for', { at: dateTime(d.at) })}` : ''}${d.reason ? ` · ${d.reason}` : ''}${d.interest ? ` · ${t('agent.activity.interest', { n: d.interest })}` : ''}${d.nextStep ? ` · ${t('agent.activity.tl.next', { step: d.nextStep })}` : ''}${d.photos ? ` · ${t('agent.activity.tl.photos', { count: d.photos })}` : ''}`;
    case 'whatsapp': return t('agent.activity.tl.whatsapp', { what: d.template === 'visit_confirmation' ? `${t('agent.activity.tl.visitConfirmation')}${d.visitNo ? ` (${d.visitNo})` : ''}` : t('agent.activity.tl.listing', { no: d.listingNo || '' }) });
    case 'offer': return `${t('agent.activity.tl.offer', { no: d.offerNo || '' })}${d.round ? ` ${t('agent.activity.tl.round', { n: d.round })}` : ''}: ${d.by === 'lister' ? t('agent.activity.tl.owner') : t('agent.activity.tl.buyer')} ${d.kind ? roundKind(d.kind) : ''}${d.amount ? ` ${rupees(d.amount)}` : ''}`;
    case 'offer_relayed': return t('agent.activity.tl.offerRelayed', { no: d.offerNo });
    case 'share': return t('agent.activity.tl.share', { tag: keyOr(`agent.activity.tl.tag.${d.tag}`, d.tag), text: d.text });
    case 'listings_shared': return t('agent.activity.tl.listingsShared', { list: (d.listings || []).join(', ') });
    case 'followup': return t('agent.activity.tl.followup', { type: label(FOLLOWUP_TYPES, d.type), at: dateTime(d.dueAt) });
    case 'followup_done': return t('agent.activity.tl.followupDone', { outcome: d.outcome });
    case 'property_linked': return t('agent.activity.tl.linked');
    case 'property_unlinked': return t('agent.activity.tl.unlinked');
    case 'deal': return `${t('agent.activity.tl.deal', { no: d.dealNo, status: d.status ? keyOr(`agent.activity.tl.dealStatus.${d.status}`, d.status) : '' })}${d.reason ? ` · ${d.reason}` : ''}`;
    case 'referral': return `${t('agent.activity.tl.referral', { no: d.refNo })}${d.partner ? ` ${t('agent.activity.tl.to', { partner: d.partner })}` : ''} · ${keyOr(`agent.activity.tl.refStatus.${d.status}`, d.status)}`;
    case 'seeker_flag': return t('agent.activity.tl.seekerFlag', { no: d.flagNo });
    case 'reassign_requested': return t('agent.activity.tl.reassignRequested', { reason: d.reason });
    case 'merged': case 'repeat_enquiry': return `${t('agent.activity.tl.repeat')}${d.source ? ` (${keyOr(`agent.activity.tl.src.${d.source}`, d.source)})` : ''}`;
    case 'updated': return t('agent.activity.tl.updated');
    default: return titleCase(item.type);
  }
}

const GROUPS = ['', 'call', 'note', 'stage', 'visit', 'offer', 'followup', 'deal'];

export function Timeline({ lead }) {
  const t = useT();
  const toast = useToast();
  const note = useAgentMutation(leadApi.note);
  const [text, setText] = useState('');
  const [filter, setFilter] = useState('');
  const items = (lead.timeline || []).filter((x) => !filter || x.type.startsWith(filter));
  const save = async () => { try { await note.mutateAsync({ id: lead._id, text: text.trim() }); setText(''); toast.success(t('agent.activity.noteAdded')); } catch (e) { toast.error(errorText(e)); } };
  return (
    <Section title={t('agent.activity.title')} action={<Select aria-label={t('agent.activity.filter')} className="w-40" value={filter} onChange={(e) => setFilter(e.target.value)} options={GROUPS.map((value) => ({ value, label: t(`agent.activity.group.${value || 'all'}`) }))} />}>
      <div className="mb-4 space-y-2">
        <Textarea aria-label={t('agent.activity.internalNote')} rows={2} maxLength={2000} placeholder={t('agent.activity.notePh')} value={text} onChange={(e) => setText(e.target.value)} />
        <div className="flex justify-end"><Button size="sm" disabled={!text.trim()} loading={note.isPending} onClick={save}>{t('agent.activity.addNote')}</Button></div>
      </div>
      {!items.length ? <p className="py-4 text-center text-sm text-ink-subtle">{t('agent.activity.noActivity')}</p> : (
        <ol className="space-y-3 border-l-2 border-line pl-4">
          {items.map((x) => (
            <li key={x._id || `${x.type}${x.at}`} className="relative">
              <span className="absolute -left-[1.4rem] top-1.5 h-2.5 w-2.5 rounded-full bg-brand-300" aria-hidden />
              <p className="whitespace-pre-line text-sm text-ink">{describe(x)}</p>
              <p className="text-xs text-ink-subtle">{x.byName || t('agent.activity.system')} · {dateTime(x.at)}</p>
            </li>
          ))}
        </ol>
      )}
    </Section>
  );
}
