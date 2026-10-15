// Lead detail panels: offers (RE-C-20), site visits, follow-ups and the activity timeline.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarClock, CalendarPlus, CheckCircle2, ClipboardCheck, FilePlus2, HandCoins, ListPlus, Pencil, Send, Undo2, XCircle } from 'lucide-react';
import { Badge, Button, Select, Textarea, useToast } from '@/shared/ui';
import { date, dateTime, rupees, timeAgo, titleCase } from '@/shared/lib/format';
import { CALL_OUTCOMES, LOST_REASONS, errorText, leadApi, offerStatus, stageInfo, useAgentMutation, visitApi, visitStatus } from '@/modules/leads/agentApi';
import { BuyerRoundModal, RecordOfferModal } from '../OfferModals';
import { ScheduleVisitModal, VisitOutcomeModal } from '../VisitModals';
import { CompleteFollowupModal, FollowupModal } from '../FollowupModals';
import { ReasonModal, Section } from '../common';

const propName = (props, id) => { const p = (props || []).find((x) => String(x._id) === String(id)); return p ? `${p.listingNo} · ${p.title}` : 'Property'; };

// ---------------------------------------------------------------- offers

export function OffersPanel({ lead }) {
  const toast = useToast();
  const navigate = useNavigate();
  const relay = useAgentMutation(leadApi.relay);
  const withdraw = useAgentMutation(leadApi.withdrawOffer);
  const [record, setRecord] = useState(false);
  const [round, setRound] = useState(null);
  const [withdrawing, setWithdrawing] = useState(null);
  const offers = lead.offers || [];
  const canOffer = ['contacted', 'qualified', 'site_visit_scheduled', 'site_visit_done', 'negotiation'].includes(lead.stage);

  const doRelay = async (o) => { try { await relay.mutateAsync({ offerId: o._id }); toast.success('Marked as told to the buyer'); } catch (e) { toast.error(errorText(e)); } };
  const doWithdraw = async (note) => { try { await withdraw.mutateAsync({ offerId: withdrawing._id, note }); toast.success('Offer withdrawn'); setWithdrawing(null); } catch (e) { toast.error(errorText(e)); } };

  return (
    <Section title="Offers" action={<Button size="sm" variant="secondary" icon={HandCoins} disabled={!canOffer || !(lead.properties || []).length} onClick={() => setRecord(true)}>Record buyer offer</Button>}>
      {!offers.length ? <p className="py-4 text-center text-sm text-ink-subtle">No offers yet.{!canOffer ? ` A ${stageInfo(lead.stage).label.toLowerCase()} lead cannot take an offer.` : ''}</p> : (
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
                      <span className="font-medium text-ink">{r.by === 'lister' ? 'Owner' : 'Buyer'} {r.kind}</span>{r.amount ? ` ${rupees(r.amount)}` : ''}{r.terms && r.terms.token ? ` · token ${rupees(r.terms.token)}` : ''}{r.terms && r.terms.possessionDate ? ` · possession ${date(r.terms.possessionDate)}` : ''}{r.terms && r.terms.inclusions ? ` · includes ${r.terms.inclusions}` : ''}
                      {r.note ? ` · "${r.note}"` : ''} · {timeAgo(r.at)}{r.by === 'lister' && r.relayedToBuyerAt ? ' · told buyer' : ''}
                    </li>
                  ))}
                </ol>
                {o.validUntil && ['awaiting_lister', 'awaiting_buyer'].includes(o.status) && <p className="mt-1 text-xs text-ink-subtle">Valid until {dateTime(o.validUntil)}</p>}
                <div className="mt-2 flex flex-wrap gap-2">
                  {o.status === 'awaiting_buyer' && fromOwner && !last.relayedToBuyerAt && <Button size="sm" icon={Send} loading={relay.isPending} onClick={() => doRelay(o)}>Relay to buyer</Button>}
                  {o.status === 'awaiting_buyer' && fromOwner && last.relayedToBuyerAt && <>
                    <Button size="sm" icon={CheckCircle2} onClick={() => setRound({ offer: o, kind: 'accept' })}>Buyer accepts</Button>
                    <Button size="sm" variant="secondary" onClick={() => setRound({ offer: o, kind: 'counter' })}>Buyer counter</Button>
                  </>}
                  {o.status === 'accepted' && fromOwner && !last.relayedToBuyerAt && <Button size="sm" variant="secondary" icon={Send} loading={relay.isPending} onClick={() => doRelay(o)}>Relay acceptance</Button>}
                  {o.status === 'accepted' && !o.dealId && <Button size="sm" icon={FilePlus2} onClick={() => navigate(`/agent/deals/new?leadId=${lead._id}&offerId=${o._id}`)}>Create deal now</Button>}
                  {['awaiting_lister', 'awaiting_buyer'].includes(o.status) && <Button size="sm" variant="ghost" icon={Undo2} onClick={() => setWithdrawing(o)}>Withdraw</Button>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <RecordOfferModal open={record} onClose={() => setRecord(false)} lead={lead} properties={(lead.properties || []).filter((p) => p.status === 'live' || String(p._id) === String(lead.propertyId))} />
      <BuyerRoundModal open={Boolean(round)} onClose={() => setRound(null)} offer={round && round.offer} kind={round && round.kind} />
      <ReasonModal open={Boolean(withdrawing)} onClose={() => setWithdrawing(null)} title="Withdraw offer" description="The buyer no longer stands by this offer. The owner is told." label="Note (optional)" min={0} max={300} confirmLabel="Withdraw" danger loading={withdraw.isPending} onSubmit={doWithdraw} />
    </Section>
  );
}

// ---------------------------------------------------------------- visits

export function VisitsPanel({ lead }) {
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
  const doConfirm = async (v) => { try { await confirm.mutateAsync({ id: v._id }); toast.success('Confirmed for the buyer'); } catch (e) { toast.error(errorText(e)); } };
  const doCancel = async (reason) => { try { await cancel.mutateAsync({ id: cancelling._id, reason }); toast.success('Visit cancelled'); setCancelling(null); } catch (e) { toast.error(errorText(e)); } };

  return (
    <Section title="Site visits" action={<Button size="sm" variant="secondary" icon={CalendarPlus} disabled={!open} onClick={() => setSchedule(true)}>Schedule visit</Button>}>
      {!visits.length ? <p className="py-4 text-center text-sm text-ink-subtle">No visits yet.</p> : (
        <ul className="divide-y">
          {visits.map((v) => {
            const s = visitStatus(v.status);
            const live = ['scheduled', 'confirmed'].includes(v.status);
            const past = new Date(v.scheduledAt) <= new Date();
            return (
              <li key={v._id} className="py-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm"><span className="font-medium text-ink">{v.visitNo}</span> · {v.status === 'requested' ? `requested ${v.requestedSlot ? dateTime(v.requestedSlot) : ''}` : dateTime(v.scheduledAt)}</span>
                  <span className="flex items-center gap-1">{v.outsideListerSlots && <Badge tone="warning">Override</Badge>}<Badge tone={s.tone}>{s.label}</Badge></span>
                </div>
                <p className="text-xs text-ink-subtle">{propName(lead.properties, v.propertyId)}{v.meetingPoint ? ` · ${v.meetingPoint}` : ''}{v.buyerNote ? ` · "${v.buyerNote}"` : ''}{v.pickup && v.pickup.needed ? ' · pickup' : ''}{v.outcome && v.outcome.interest ? ` · interest ${v.outcome.interest}/5` : ''}{v.cancelReason ? ` · ${v.cancelReason}` : ''}</p>
                {(v.history || []).length > 0 && <p className="text-xs text-ink-subtle">Moved {v.history.length}x · last reason: {v.history[v.history.length - 1].reason || '-'}</p>}
                {v.outcome && (v.outcome.photoUrls || []).length > 0 && (
                  <ul className="mt-1.5 flex flex-wrap gap-1.5" aria-label={`Photos of ${v.visitNo}`}>
                    {v.outcome.photoUrls.map((ph, i) => (
                      <li key={ph.id}><a href={ph.url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded border bg-surface-sunken hover:opacity-90">
                        <img src={ph.thumbUrl || ph.url} alt={`Visit photo ${i + 1}`} className="h-14 w-14 object-cover" loading="lazy" />
                      </a></li>
                    ))}
                  </ul>
                )}
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {v.status === 'requested' && <Button size="sm" icon={CalendarClock} onClick={() => setRequested(v)}>Schedule</Button>}
                  {v.status === 'scheduled' && <Button size="sm" variant="secondary" icon={CheckCircle2} loading={confirm.isPending} onClick={() => doConfirm(v)}>Buyer confirmed</Button>}
                  {live && past && <Button size="sm" icon={ClipboardCheck} onClick={() => setOutcome(v)}>Outcome</Button>}
                  {live && <Button size="sm" variant="ghost" icon={Pencil} onClick={() => setResched(v)}>Reschedule</Button>}
                  {(live || v.status === 'requested') && <Button size="sm" variant="ghost" icon={XCircle} onClick={() => setCancelling(v)}>Cancel</Button>}
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
      <ReasonModal open={Boolean(cancelling)} onClose={() => setCancelling(null)} title={`Cancel ${cancelling ? cancelling.visitNo : 'visit'}`} label="Reason" min={3} max={300} confirmLabel="Cancel visit" danger loading={cancel.isPending} onSubmit={doCancel} />
    </Section>
  );
}

// ---------------------------------------------------------------- follow-ups

export function FollowupsPanel({ lead }) {
  const [add, setAdd] = useState(false);
  const [edit, setEdit] = useState(null);
  const [done, setDone] = useState(null);
  const all = lead.followups || [];
  const open = all.filter((f) => f.status === 'open').sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt));
  const closed = all.filter((f) => f.status !== 'open').slice(0, 5);
  const leadRef = { _id: lead._id, leadNo: lead.leadNo, buyerName: lead.buyer && lead.buyer.name };
  return (
    <Section title="Follow-ups" action={<Button size="sm" variant="secondary" icon={ListPlus} onClick={() => setAdd(true)}>Add</Button>}>
      {!open.length && <p className="py-2 text-sm text-ink-subtle">No open follow-up. Add one so the lead does not go stale.</p>}
      <ul className="divide-y">
        {open.map((f) => {
          const overdue = new Date(f.dueAt) < new Date();
          return (
            <li key={f._id} className="flex items-center justify-between gap-2 py-2">
              <span className="min-w-0 text-sm">
                <span className={overdue ? 'font-medium text-danger-700' : 'font-medium text-ink'}>{titleCase(f.type)} · {dateTime(f.dueAt)}</span>
                {f.note && <span className="block truncate text-xs text-ink-subtle">{f.note}</span>}
              </span>
              <span className="flex shrink-0 gap-1">
                <Button size="sm" variant="ghost" icon={Pencil} aria-label="Edit" onClick={() => setEdit(f)} />
                <Button size="sm" variant="secondary" onClick={() => setDone(f)}>Done</Button>
              </span>
            </li>
          );
        })}
      </ul>
      {closed.length > 0 && (
        <details className="mt-2 text-xs text-ink-subtle">
          <summary className="cursor-pointer">Recent completed</summary>
          <ul className="mt-1 space-y-1">{closed.map((f) => <li key={f._id}>{titleCase(f.type)} · {dateTime(f.doneAt || f.dueAt)} · {f.status === 'done' ? f.outcome : f.status}</li>)}</ul>
        </details>
      )}
      <FollowupModal open={add} onClose={() => setAdd(false)} lead={leadRef} />
      <FollowupModal open={Boolean(edit)} onClose={() => setEdit(null)} followup={edit} lead={leadRef} />
      <CompleteFollowupModal open={Boolean(done)} onClose={() => setDone(null)} followups={done ? [done] : []} />
    </Section>
  );
}

// ---------------------------------------------------------------- timeline

const label = (list, v) => (list.find((x) => x.value === v) || { label: titleCase(v) }).label;

function describe(t) {
  const d = t.data || {};
  switch (t.type) {
    case 'created': return `Lead created${d.type ? ` (${titleCase(d.type)})` : ''}${d.manual ? ' by hand' : ''}`;
    case 'assigned': return `Assigned${d.note ? ` · ${d.note}` : ''}`;
    case 'reassigned': return `Reassigned${d.note ? ` · ${d.note}` : ''}`;
    case 'stage': return `Stage ${stageInfo(d.from).label} → ${stageInfo(d.to).label}${d.lostReason ? ` (${label(LOST_REASONS, d.lostReason)})` : ''}${d.note ? ` · ${d.note}` : ''}`;
    case 'call': return `${d.direction === 'inbound' ? 'Inbound' : 'Outbound'} call: ${label(CALL_OUTCOMES, d.outcome)}${d.durationSec ? ` · ${Math.round(d.durationSec / 60)} min` : ''}${d.note ? ` · ${d.note}` : ''}`;
    case 'note': return d.text;
    case 'visit': return `Visit ${d.visitNo || ''} ${titleCase(d.status || '')}${d.at ? ` for ${dateTime(d.at)}` : ''}${d.reason ? ` · ${d.reason}` : ''}${d.interest ? ` · interest ${d.interest}/5` : ''}${d.nextStep ? ` · next: ${d.nextStep}` : ''}${d.photos ? ` · ${d.photos} photo${d.photos > 1 ? 's' : ''}` : ''}`;
    case 'whatsapp': return `WhatsApp sent: ${d.template === 'visit_confirmation' ? `visit confirmation${d.visitNo ? ` (${d.visitNo})` : ''}` : `listing ${d.listingNo || ''}`}`;
    case 'offer': return `Offer ${d.offerNo || ''}${d.round ? ` round ${d.round}` : ''}: ${d.by === 'lister' ? 'owner' : 'buyer'} ${d.kind || ''}${d.amount ? ` ${rupees(d.amount)}` : ''}`;
    case 'offer_relayed': return `Owner reply on ${d.offerNo} relayed to the buyer`;
    case 'share': return `Update shared with the owner (${titleCase(d.tag)}): ${d.text}`;
    case 'listings_shared': return `Listings sent to the buyer: ${(d.listings || []).join(', ')}`;
    case 'followup': return `Follow-up ${titleCase(d.type)} set for ${dateTime(d.dueAt)}`;
    case 'followup_done': return `Follow-up done: ${d.outcome}`;
    case 'property_linked': return 'Property linked';
    case 'property_unlinked': return 'Property unlinked';
    case 'deal': return `Deal ${d.dealNo} ${titleCase(d.status)}${d.reason ? ` · ${d.reason}` : ''}`;
    case 'referral': return `Partner referral ${d.refNo}${d.partner ? ` to ${d.partner}` : ''} · ${titleCase(d.status)}`;
    case 'seeker_flag': return `Seeker flagged (${d.flagNo})`;
    case 'reassign_requested': return `Reassignment requested: ${d.reason}`;
    case 'merged': case 'repeat_enquiry': return `Repeat enquiry${d.source ? ` (${titleCase(d.source)})` : ''}`;
    case 'updated': return 'Lead details updated';
    default: return titleCase(t.type);
  }
}

const GROUPS = [
  { value: '', label: 'All activity' }, { value: 'call', label: 'Calls' }, { value: 'note', label: 'Notes' }, { value: 'stage', label: 'Stage changes' },
  { value: 'visit', label: 'Visits' }, { value: 'offer', label: 'Offers' }, { value: 'followup', label: 'Follow-ups' }, { value: 'deal', label: 'Deals' },
];

export function Timeline({ lead }) {
  const toast = useToast();
  const note = useAgentMutation(leadApi.note);
  const [text, setText] = useState('');
  const [filter, setFilter] = useState('');
  const items = (lead.timeline || []).filter((t) => !filter || t.type.startsWith(filter));
  const save = async () => { try { await note.mutateAsync({ id: lead._id, text: text.trim() }); setText(''); toast.success('Note added'); } catch (e) { toast.error(errorText(e)); } };
  return (
    <Section title="Activity" action={<Select aria-label="Filter activity" className="w-40" value={filter} onChange={(e) => setFilter(e.target.value)} options={GROUPS} />}>
      <div className="mb-4 space-y-2">
        <Textarea aria-label="Internal note" rows={2} maxLength={2000} placeholder="Add an internal note (the buyer and owner never see it)" value={text} onChange={(e) => setText(e.target.value)} />
        <div className="flex justify-end"><Button size="sm" disabled={!text.trim()} loading={note.isPending} onClick={save}>Add note</Button></div>
      </div>
      {!items.length ? <p className="py-4 text-center text-sm text-ink-subtle">No activity of this type.</p> : (
        <ol className="space-y-3 border-l-2 border-line pl-4">
          {items.map((t) => (
            <li key={t._id || `${t.type}${t.at}`} className="relative">
              <span className="absolute -left-[1.4rem] top-1.5 h-2.5 w-2.5 rounded-full bg-brand-300" aria-hidden />
              <p className="whitespace-pre-line text-sm text-ink">{describe(t)}</p>
              <p className="text-xs text-ink-subtle">{t.byName || 'System'} · {dateTime(t.at)}</p>
            </li>
          ))}
        </ol>
      )}
    </Section>
  );
}
