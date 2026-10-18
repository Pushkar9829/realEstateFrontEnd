// RE-S-ADM-12 lead detail (admin view): assign / reassign, reopen a lost lead,
// recycle an old lost lead, merge duplicates, decide reassignment requests,
// the full timeline and the audited contact reveal.
import { useState } from 'react';
import { useT } from '@/shared/i18n';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Eye, GitMerge, History, Phone, RotateCcw, Recycle, Search, UserPlus } from 'lucide-react';
import { Alert, Badge, Button, Card, CardHeader, Input, Modal, PageHeader, PageSpinner, Textarea, useToast } from '@/shared/ui';
import { dateTime, rupees, shortRupees, titleCase } from '@/shared/lib/format';
import { useAuth } from '@/modules/auth';
import { useAgentOptions } from '@/modules/teams/api';
import {
  LEAD_PRIORITIES, leadSla, useAddLeadNote, leadStage, revealBuyerContact, useAdminLead, useAdminLeads, useMergeLead, useRecycleLead, useReopenLead, visitStatus,
} from '@/modules/leads/adminApi';
import AssignModal from './AssignModal';
import ReassignRequest from './ReassignRequestCard';

function Row({ label, children }) {
  return (
    <div className="flex gap-4 py-2 text-sm">
      <dt className="w-32 shrink-0 text-ink-subtle">{label}</dt>
      <dd className="min-w-0 text-ink">{children || '-'}</dd>
    </div>
  );
}

function timelineText(ev, names, t) {
  const d = ev.data || {};
  const who = (id) => (id ? names[String(id)] || t('admin.leads.detail.tl.anotherAgent') : null);
  if (ev.type === 'stage') return [`${leadStage(d.from).label} → ${leadStage(d.to).label}`, d.lostReason && t('admin.leads.detail.tl.lost', { reason: titleCase(d.lostReason) }), d.note].filter(Boolean).join(' · ');
  if (ev.type === 'assigned' || ev.type === 'reassigned') return [d.from && t('admin.leads.detail.tl.from', { name: who(d.from) }), d.to && t('admin.leads.detail.tl.to', { name: who(d.to) }), d.note].filter(Boolean).join(' · ');
  if (ev.type === 'call') return [titleCase(d.outcome), d.durationSec ? t('admin.leads.detail.tl.minutes', { n: Math.round(d.durationSec / 60) }) : null, d.note].filter(Boolean).join(' · ');
  if (ev.type === 'merged') return t('admin.leads.detail.tl.mergedFrom', { from: d.from });
  if (ev.type === 'merged_into') return t('admin.leads.detail.tl.mergedInto', { into: d.into });
  if (ev.type === 'recycled') return t('admin.leads.detail.tl.recycledAs', { into: d.into });
  if (ev.type === 'created') return [titleCase(d.type), d.from && t('admin.leads.detail.tl.from', { name: d.from }), d.manual && t('admin.leads.detail.tl.loggedManually')].filter(Boolean).join(' · ');
  return d.note || d.text || d.comment || '';
}

function MergeModal({ open, onClose, lead }) {
  const t = useT();
  const toast = useToast();
  const navigate = useNavigate();
  const merge = useMergeLead();
  const [q, setQ] = useState(lead.buyerName || '');
  const [term, setTerm] = useState(lead.buyerName || '');
  const [target, setTarget] = useState(null);
  const [err, setErr] = useState(null);
  const found = useAdminLeads({ q: term, limit: 10 }, { enabled: open && term.trim().length >= 2 });
  const rows = ((found.data && found.data.items) || []).filter((r) => r._id !== lead._id);
  const submit = async () => {
    setErr(null);
    try {
      await merge.mutateAsync({ id: lead._id, intoLeadId: target._id });
      toast.success(t('admin.leads.detail.merge.done', { from: lead.leadNo, into: target.leadNo }));
      onClose();
      navigate(`/admin/leads/${target._id}`);
    } catch (e) { setErr(e.message); }
  };
  return (
    <Modal open={open} onClose={onClose} size="lg" title={t('admin.leads.detail.merge.title', { no: lead.leadNo })}
      description={t('admin.leads.detail.merge.description')}
      footer={<><Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button><Button icon={GitMerge} disabled={!target} loading={merge.isPending} onClick={submit}>{t('admin.leads.detail.merge.submit', { no: target ? target.leadNo : '…' })}</Button></>}>
      <form className="mb-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); setTerm(q.trim()); setTarget(null); }}>
        <Input className="flex-1" aria-label={t('admin.leads.detail.merge.findLead')} leading={<Search className="h-4 w-4" />} placeholder={t('admin.leads.searchPlaceholder')} value={q} onChange={(e) => setQ(e.target.value)} />
        <Button type="submit" variant="secondary">{t('admin.leads.detail.merge.find')}</Button>
      </form>
      {found.isLoading && term && <p className="text-sm text-ink-subtle">{t('admin.leads.detail.merge.searching')}</p>}
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r._id}>
            <label className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 ${target && target._id === r._id ? 'border-brand-600 bg-brand-50' : ''}`}>
              <input type="radio" name="merge-target" className="mt-1" checked={Boolean(target && target._id === r._id)} onChange={() => setTarget(r)} />
              <span className="text-sm">
                <span className="font-medium text-ink">{r.leadNo}</span> · {r.buyerName} · {r.buyerPhone}
                <span className="block text-xs text-ink-subtle">{leadStage(r.stage).label} · {r.property ? `${r.property.listingNo} ${r.property.title}` : t('admin.leads.detail.merge.noProperty')} · {t('admin.leads.detail.merge.createdOn', { date: dateTime(r.createdAt) })}</span>
              </span>
            </label>
          </li>
        ))}
        {!found.isLoading && term && rows.length === 0 && <li className="text-sm text-ink-subtle">{t('admin.leads.detail.merge.noneFound')}</li>}
      </ul>
      {err && <Alert tone="danger" className="mt-3">{err}</Alert>}
    </Modal>
  );
}

export default function LeadDetailPage() {
  const { id } = useParams();
  const t = useT();
  const toast = useToast();
  const navigate = useNavigate();
  const { user, hasPermission } = useAuth();
  const addNote = useAddLeadNote();
  const [noteText, setNoteText] = useState('');
  const { data: l, isLoading, error } = useAdminLead(id);
  const { agents, options: agentOptions } = useAgentOptions();
  const reopen = useReopenLead();
  const recycle = useRecycleLead();
  const [modal, setModal] = useState(null);
  const [note, setNote] = useState('');
  const [revealed, setRevealed] = useState({});
  const [revealing, setRevealing] = useState(null);

  if (isLoading) return <PageSpinner />;
  if (error) return <Alert tone="danger">{error.message}</Alert>;

  const names = Object.fromEntries(agents.map((a) => [String(a.agentId), a.name]));
  (l.timeline || []).forEach((ev) => { if (ev.by && ev.byName) names[String(ev.by)] = ev.byName; });
  const stage = leadStage(l.stage);
  const sla = leadSla(l);
  const lost = l.stage === 'closed_lost';
  const openRequests = (l.reassignRequests || []).filter((r) => r.status === 'open');
  const asAdmin = user.role !== 'manager';
  const canReveal = user.role === 'manager' || hasPermission('contacts.view');

  const reveal = async (field) => {
    setRevealing(field);
    try { const r = await revealBuyerContact(l._id, field, { asAdmin }); setRevealed((x) => ({ ...x, [field]: r.value || t('admin.leads.detail.notGiven') })); } catch (e) { toast.error(e.message); } finally { setRevealing(null); }
  };
  const doReopen = async () => {
    try { await reopen.mutateAsync({ id: l._id, note: note.trim() }); toast.success(t('admin.leads.detail.reopened')); setModal(null); setNote(''); } catch (e) { toast.error(e.message); }
  };
  const doRecycle = async () => {
    try { const n = await recycle.mutateAsync(l._id); toast.success(t('admin.leads.detail.recycled', { no: n.leadNo })); setModal(null); navigate(`/admin/leads/${n._id}`); } catch (e) { toast.error(e.message); }
  };

  return (
    <>
      <Link to="/admin/leads" className="mb-3 inline-flex items-center gap-1 text-sm text-brand-700 hover:underline"><ArrowLeft className="h-4 w-4" /> {t('panel.nav.adminLeads')}</Link>
      <PageHeader title={`${l.leadNo} · ${l.buyer?.name || l.buyerName}`} breadcrumb={[l.buyerLabel, (l.sources || []).map(titleCase).join(', ')].filter(Boolean).join(' · ')}
        actions={<>
          <Badge tone={stage.tone}>{stage.label}</Badge>
          {l.priority && <Badge tone={LEAD_PRIORITIES[l.priority]}>{titleCase(l.priority)}</Badge>}
          {!lost && l.stage !== 'closed_won' && <Button icon={UserPlus} onClick={() => setModal('assign')}>{l.assignedTo ? t('admin.leads.reassignBtn') : t('admin.leads.assignBtn')}</Button>}
          {lost && <Button variant="secondary" icon={RotateCcw} onClick={() => setModal('reopen')}>{t('admin.leads.detail.reopen')}</Button>}
          {lost && <Button variant="secondary" icon={Recycle} onClick={() => setModal('recycle')}>{t('admin.leads.detail.recycleAsNew')}</Button>}
          {!lost && <Button variant="secondary" icon={GitMerge} onClick={() => setModal('merge')}>{t('admin.leads.detail.mergeDuplicate')}</Button>}
        </>} />
      {lost && <Alert tone="warning" className="mb-4">{t('admin.leads.detail.lostLabel')}{l.lostReason ? `: ${titleCase(l.lostReason)}` : ''}{l.lostNote ? ` · ${l.lostNote}` : ''}{t('admin.leads.detail.lostHint')}</Alert>}
      {l.throttled && <Alert tone="warning" className="mb-4">{t('admin.leads.detail.throttledAlert')}</Alert>}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card>
            <CardHeader title={t('admin.leads.detail.timeline')} description={t('admin.leads.detail.timelineDescription')} />
            <form className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end" onSubmit={async (e) => {
              e.preventDefault();
              if (!noteText.trim()) return;
              try { await addNote.mutateAsync({ id: l._id, text: noteText.trim() }); setNoteText(''); toast.success(t('admin.leads.detail.noteAdded')); } catch (err) { toast.error(err.message); }
            }}>
              <Textarea className="flex-1" label={t('admin.leads.detail.addANote')} rows={2} placeholder={t('admin.leads.detail.notePlaceholder')} value={noteText} onChange={(e) => setNoteText(e.target.value)} />
              <Button type="submit" variant="secondary" loading={addNote.isPending} disabled={!noteText.trim()}>{t('admin.leads.detail.addNote')}</Button>
            </form>
            <ol className="space-y-3">
              {(l.timeline || []).map((ev, i) => (
                <li key={ev._id || i} className="flex gap-3">
                  <History className="mt-0.5 h-4 w-4 shrink-0 text-ink-subtle" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-ink"><span className="font-medium">{titleCase(ev.type)}</span>{timelineText(ev, names, t) && <span className="text-ink-muted"> · {timelineText(ev, names, t)}</span>}</p>
                    <p className="text-xs text-ink-subtle">{ev.byName || t('admin.leads.detail.system')} · {dateTime(ev.at)}</p>
                  </div>
                </li>
              ))}
              {!(l.timeline || []).length && <li className="text-sm text-ink-subtle">{t('admin.leads.detail.noActivity')}</li>}
            </ol>
          </Card>

          <Card>
            <CardHeader title={t('admin.leads.detail.siteVisits', { n: (l.visits || []).length })} />
            <ul className="divide-y">
              {(l.visits || []).map((v) => { const s = visitStatus(v.status); return (
                <li key={v._id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <span>{v.visitNo} · {dateTime(v.scheduledAt)}{v.outcome?.interest ? t('admin.leads.detail.interest', { n: v.outcome.interest }) : ''}</span>
                  <Badge tone={s.tone}>{s.label}</Badge>
                </li>
              ); })}
              {!(l.visits || []).length && <li className="py-2 text-sm text-ink-subtle">{t('admin.leads.detail.noVisits')}</li>}
            </ul>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader title={t('admin.leads.detail.followUps')} />
              <ul className="space-y-2 text-sm">
                {(l.followups || []).slice(0, 10).map((f) => <li key={f._id} className="flex justify-between gap-2"><span>{titleCase(f.type)}{f.note ? ` · ${f.note}` : ''}</span><span className="shrink-0 text-xs text-ink-subtle">{titleCase(f.status)} · {dateTime(f.dueAt)}</span></li>)}
                {!(l.followups || []).length && <li className="text-ink-subtle">{t('admin.leads.detail.none')}</li>}
              </ul>
            </Card>
            <Card>
              <CardHeader title={t('admin.leads.detail.offers')} />
              <ul className="space-y-2 text-sm">
                {(l.offers || []).map((o) => { const last = (o.rounds || [])[o.rounds.length - 1]; return <li key={o._id} className="flex justify-between gap-2"><span>{o.offerNo}{last?.amount ? ` · ${rupees(last.amount)}` : ''}</span><Badge>{titleCase(o.status)}</Badge></li>; })}
                {!(l.offers || []).length && <li className="text-ink-subtle">{t('admin.leads.detail.none')}</li>}
              </ul>
            </Card>
          </div>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title={t('admin.leads.detail.buyer')} description={t('admin.leads.detail.buyerDescription')} />
            <dl className="divide-y">
              <Row label={t('admin.leads.detail.name')}>{l.buyer?.name}</Row>
              <Row label={t('admin.leads.detail.phone')}><span className="inline-flex flex-wrap items-center gap-2">{revealed.phone || l.buyer?.phone}{canReveal && !revealed.phone && <Button size="sm" variant="ghost" icon={Eye} loading={revealing === 'phone'} onClick={() => reveal('phone')}>{t('admin.leads.detail.reveal')}</Button>}{revealed.phone && <a className="text-brand-700" href={`tel:${revealed.phone}`} aria-label={t('admin.leads.detail.call')}><Phone className="h-4 w-4" /></a>}</span></Row>
              <Row label={t('admin.leads.detail.email')}>{l.buyer?.hasEmail ? <span className="inline-flex flex-wrap items-center gap-2">{revealed.email || t('admin.leads.detail.hidden')}{canReveal && !revealed.email && <Button size="sm" variant="ghost" icon={Eye} loading={revealing === 'email'} onClick={() => reveal('email')}>{t('admin.leads.detail.reveal')}</Button>}</span> : t('admin.leads.detail.notGiven')}</Row>
              <Row label={t('admin.leads.detail.referralCode')}>{l.referralCode}</Row>
              <Row label="WhatsApp">{l.whatsappOptIn ? t('admin.leads.detail.optedIn') : t('admin.leads.detail.notOptedIn')}</Row>
            </dl>
            {!canReveal && <p className="mt-2 text-xs text-ink-subtle">{t('admin.leads.detail.revealNeedsPermission')}</p>}
          </Card>

          <Card>
            <CardHeader title={t('admin.leads.detail.assignmentSla')} />
            <dl className="divide-y">
              <Row label={t('admin.leads.agent')}>{l.assignedTo ? names[String(l.assignedTo)] || t('admin.leads.detail.assigned') : <Badge tone="warning">{t('admin.leads.unassigned')}</Badge>}</Row>
              <Row label={t('admin.leads.detail.firstContact')}><Badge tone={sla.tone}>{sla.label}</Badge>{l.slaDueAt && <span className="ml-2 text-xs text-ink-subtle">{t('admin.leads.detail.by', { date: dateTime(l.slaDueAt) })}</span>}</Row>
              <Row label={t('admin.leads.detail.contactedAt')}>{l.firstContactAt ? dateTime(l.firstContactAt) : null}</Row>
              <Row label={t('admin.leads.detail.callAttempts')}>{String(l.callAttempts || 0)}</Row>
              <Row label={t('admin.leads.created')}>{dateTime(l.createdAt)}</Row>
              <Row label={t('admin.leads.lastActivity')}>{dateTime(l.lastActivityAt)}</Row>
            </dl>
          </Card>

          {openRequests.length > 0 && (
            <Card>
              <CardHeader title={t('admin.leads.reassignRequests')} description={t('admin.leads.detail.reassignDescription')} />
              <ul className="space-y-3">{openRequests.map((r) => <ReassignRequest key={r._id} lead={l} r={r} agentOptions={agentOptions} />)}</ul>
            </Card>
          )}

          <Card>
            <CardHeader title={t('admin.leads.detail.requirement')} />
            <dl className="divide-y">
              <Row label={t('admin.leads.detail.purpose')}>{titleCase(l.requirement?.purpose)}</Row>
              <Row label={t('admin.leads.detail.city')}>{l.requirement?.city}</Row>
              <Row label={t('admin.leads.detail.localities')}>{(l.requirement?.localities || []).join(', ')}</Row>
              <Row label="BHK">{(l.requirement?.bhk || []).join(', ')}</Row>
              <Row label={t('admin.leads.detail.budget')}>{l.requirement?.budgetMin || l.requirement?.budgetMax ? `${l.requirement.budgetMin ? shortRupees(l.requirement.budgetMin * 100) : t('admin.leads.detail.anyBudget')} - ${l.requirement.budgetMax ? shortRupees(l.requirement.budgetMax * 100) : t('admin.leads.detail.anyBudget')}` : null}</Row>
              <Row label={t('admin.leads.detail.notes')}>{l.requirement?.notes}</Row>
            </dl>
          </Card>

          <Card>
            <CardHeader title={t('admin.leads.detail.properties')} />
            <ul className="space-y-2 text-sm">
              {(l.properties || []).map((p) => <li key={p._id}><span className="font-medium text-ink">{p.title}</span><span className="block text-xs text-ink-subtle">{p.listingNo} · {p.location?.locality} · {titleCase(p.status)}{String(p._id) === String(l.propertyId) ? t('admin.leads.detail.enquiredSuffix') : t('admin.leads.detail.linkedSuffix')}</span></li>)}
              {!(l.properties || []).length && <li className="text-ink-subtle">{t('admin.leads.detail.noPropertyLinked')}</li>}
            </ul>
          </Card>
        </div>
      </div>

      <AssignModal open={modal === 'assign'} onClose={() => setModal(null)} leadIds={[l._id]} currentAgentId={l.assignedTo ? String(l.assignedTo) : undefined} />
      {modal === 'merge' && <MergeModal open onClose={() => setModal(null)} lead={l} />}
      <Modal open={modal === 'reopen'} onClose={() => setModal(null)} title={t('admin.leads.detail.reopenTitle', { no: l.leadNo })} description={t('admin.leads.detail.reopenDescription')}
        footer={<><Button variant="ghost" onClick={() => setModal(null)}>{t('common.cancel')}</Button><Button disabled={note.trim().length < 3} loading={reopen.isPending} onClick={doReopen}>{t('admin.leads.detail.reopen')}</Button></>}>
        <Textarea label={t('admin.leads.detail.whyReopen')} required rows={3} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />
      </Modal>
      <Modal open={modal === 'recycle'} onClose={() => setModal(null)} title={t('admin.leads.detail.recycleTitle', { no: l.leadNo })} description={t('admin.leads.detail.recycleDescription')}
        footer={<><Button variant="ghost" onClick={() => setModal(null)}>{t('common.cancel')}</Button><Button icon={Recycle} loading={recycle.isPending} onClick={doRecycle}>{t('admin.leads.detail.createNewLead')}</Button></>}>
        <p className="text-sm text-ink-muted">{t('admin.leads.detail.recycleNote')}</p>
      </Modal>
    </>
  );
}
