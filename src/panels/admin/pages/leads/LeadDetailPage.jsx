// RE-S-ADM-12 lead detail (admin view): assign / reassign, reopen a lost lead,
// recycle an old lost lead, merge duplicates, decide reassignment requests,
// the full timeline and the audited contact reveal.
import { useState } from 'react';
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

function timelineText(t, names) {
  const d = t.data || {};
  const who = (id) => (id ? names[String(id)] || 'another agent' : null);
  if (t.type === 'stage') return [`${leadStage(d.from).label} → ${leadStage(d.to).label}`, d.lostReason && `lost: ${titleCase(d.lostReason)}`, d.note].filter(Boolean).join(' · ');
  if (t.type === 'assigned' || t.type === 'reassigned') return [d.from && `from ${who(d.from)}`, d.to && `to ${who(d.to)}`, d.note].filter(Boolean).join(' · ');
  if (t.type === 'call') return [titleCase(d.outcome), d.durationSec ? `${Math.round(d.durationSec / 60)} min` : null, d.note].filter(Boolean).join(' · ');
  if (t.type === 'merged') return `Merged from ${d.from}`;
  if (t.type === 'merged_into') return `Merged into ${d.into}`;
  if (t.type === 'recycled') return `Recycled as ${d.into}`;
  if (t.type === 'created') return [titleCase(d.type), d.from && `from ${d.from}`, d.manual && 'logged manually'].filter(Boolean).join(' · ');
  return d.note || d.text || d.comment || '';
}

function MergeModal({ open, onClose, lead }) {
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
      toast.success(`${lead.leadNo} merged into ${target.leadNo}`);
      onClose();
      navigate(`/admin/leads/${target._id}`);
    } catch (e) { setErr(e.message); }
  };
  return (
    <Modal open={open} onClose={onClose} size="lg" title={`Merge ${lead.leadNo} into another lead`}
      description="Only leads of the same buyer phone can be merged. This lead closes as a duplicate; its visits, follow-ups and offers move to the target."
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button icon={GitMerge} disabled={!target} loading={merge.isPending} onClick={submit}>Merge into {target ? target.leadNo : '…'}</Button></>}>
      <form className="mb-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); setTerm(q.trim()); setTarget(null); }}>
        <Input className="flex-1" aria-label="Find lead" leading={<Search className="h-4 w-4" />} placeholder="Lead number, buyer name or phone" value={q} onChange={(e) => setQ(e.target.value)} />
        <Button type="submit" variant="secondary">Find</Button>
      </form>
      {found.isLoading && term && <p className="text-sm text-ink-subtle">Searching…</p>}
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r._id}>
            <label className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 ${target && target._id === r._id ? 'border-brand-600 bg-brand-50' : ''}`}>
              <input type="radio" name="merge-target" className="mt-1" checked={Boolean(target && target._id === r._id)} onChange={() => setTarget(r)} />
              <span className="text-sm">
                <span className="font-medium text-ink">{r.leadNo}</span> · {r.buyerName} · {r.buyerPhone}
                <span className="block text-xs text-ink-subtle">{leadStage(r.stage).label} · {r.property ? `${r.property.listingNo} ${r.property.title}` : 'No property'} · created {dateTime(r.createdAt)}</span>
              </span>
            </label>
          </li>
        ))}
        {!found.isLoading && term && rows.length === 0 && <li className="text-sm text-ink-subtle">No other leads found.</li>}
      </ul>
      {err && <Alert tone="danger" className="mt-3">{err}</Alert>}
    </Modal>
  );
}

export default function LeadDetailPage() {
  const { id } = useParams();
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
  (l.timeline || []).forEach((t) => { if (t.by && t.byName) names[String(t.by)] = t.byName; });
  const stage = leadStage(l.stage);
  const sla = leadSla(l);
  const lost = l.stage === 'closed_lost';
  const openRequests = (l.reassignRequests || []).filter((r) => r.status === 'open');
  const asAdmin = user.role !== 'manager';
  const canReveal = user.role === 'manager' || hasPermission('contacts.view');

  const reveal = async (field) => {
    setRevealing(field);
    try { const r = await revealBuyerContact(l._id, field, { asAdmin }); setRevealed((x) => ({ ...x, [field]: r.value || 'Not given' })); } catch (e) { toast.error(e.message); } finally { setRevealing(null); }
  };
  const doReopen = async () => {
    try { await reopen.mutateAsync({ id: l._id, note: note.trim() }); toast.success('Lead reopened'); setModal(null); setNote(''); } catch (e) { toast.error(e.message); }
  };
  const doRecycle = async () => {
    try { const n = await recycle.mutateAsync(l._id); toast.success(`New lead ${n.leadNo} created and routed`); setModal(null); navigate(`/admin/leads/${n._id}`); } catch (e) { toast.error(e.message); }
  };

  return (
    <>
      <Link to="/admin/leads" className="mb-3 inline-flex items-center gap-1 text-sm text-brand-700 hover:underline"><ArrowLeft className="h-4 w-4" /> All leads</Link>
      <PageHeader title={`${l.leadNo} · ${l.buyer?.name || l.buyerName}`} breadcrumb={[l.buyerLabel, (l.sources || []).map(titleCase).join(', ')].filter(Boolean).join(' · ')}
        actions={<>
          <Badge tone={stage.tone}>{stage.label}</Badge>
          {l.priority && <Badge tone={LEAD_PRIORITIES[l.priority]}>{titleCase(l.priority)}</Badge>}
          {!lost && l.stage !== 'closed_won' && <Button icon={UserPlus} onClick={() => setModal('assign')}>{l.assignedTo ? 'Reassign' : 'Assign'}</Button>}
          {lost && <Button variant="secondary" icon={RotateCcw} onClick={() => setModal('reopen')}>Reopen</Button>}
          {lost && <Button variant="secondary" icon={Recycle} onClick={() => setModal('recycle')}>Recycle as new lead</Button>}
          {!lost && <Button variant="secondary" icon={GitMerge} onClick={() => setModal('merge')}>Merge duplicate</Button>}
        </>} />
      {lost && <Alert tone="warning" className="mb-4">Lost{l.lostReason ? `: ${titleCase(l.lostReason)}` : ''}{l.lostNote ? ` · ${l.lostNote}` : ''}. Reopen within the reopen window, or recycle an older lost lead as a new one.</Alert>}
      {l.throttled && <Alert tone="warning" className="mb-4">This buyer's phone is throttled by a seeker flag.</Alert>}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card>
            <CardHeader title="Timeline" description="Newest first. Every assignment, stage change, call and note." />
            <form className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end" onSubmit={async (e) => {
              e.preventDefault();
              if (!noteText.trim()) return;
              try { await addNote.mutateAsync({ id: l._id, text: noteText.trim() }); setNoteText(''); toast.success('Note added'); } catch (err) { toast.error(err.message); }
            }}>
              <Textarea className="flex-1" label="Add a note" rows={2} placeholder="Visible to the agent and managers on this lead" value={noteText} onChange={(e) => setNoteText(e.target.value)} />
              <Button type="submit" variant="secondary" loading={addNote.isPending} disabled={!noteText.trim()}>Add note</Button>
            </form>
            <ol className="space-y-3">
              {(l.timeline || []).map((t, i) => (
                <li key={t._id || i} className="flex gap-3">
                  <History className="mt-0.5 h-4 w-4 shrink-0 text-ink-subtle" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-ink"><span className="font-medium">{titleCase(t.type)}</span>{timelineText(t, names) && <span className="text-ink-muted"> · {timelineText(t, names)}</span>}</p>
                    <p className="text-xs text-ink-subtle">{t.byName || 'System'} · {dateTime(t.at)}</p>
                  </div>
                </li>
              ))}
              {!(l.timeline || []).length && <li className="text-sm text-ink-subtle">No activity yet.</li>}
            </ol>
          </Card>

          <Card>
            <CardHeader title={`Site visits (${(l.visits || []).length})`} />
            <ul className="divide-y">
              {(l.visits || []).map((v) => { const s = visitStatus(v.status); return (
                <li key={v._id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <span>{v.visitNo} · {dateTime(v.scheduledAt)}{v.outcome?.interest ? ` · interest ${v.outcome.interest}/5` : ''}</span>
                  <Badge tone={s.tone}>{s.label}</Badge>
                </li>
              ); })}
              {!(l.visits || []).length && <li className="py-2 text-sm text-ink-subtle">No visits.</li>}
            </ul>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader title="Follow-ups" />
              <ul className="space-y-2 text-sm">
                {(l.followups || []).slice(0, 10).map((f) => <li key={f._id} className="flex justify-between gap-2"><span>{titleCase(f.type)}{f.note ? ` · ${f.note}` : ''}</span><span className="shrink-0 text-xs text-ink-subtle">{titleCase(f.status)} · {dateTime(f.dueAt)}</span></li>)}
                {!(l.followups || []).length && <li className="text-ink-subtle">None.</li>}
              </ul>
            </Card>
            <Card>
              <CardHeader title="Offers" />
              <ul className="space-y-2 text-sm">
                {(l.offers || []).map((o) => { const last = (o.rounds || [])[o.rounds.length - 1]; return <li key={o._id} className="flex justify-between gap-2"><span>{o.offerNo}{last?.amount ? ` · ${rupees(last.amount)}` : ''}</span><Badge>{titleCase(o.status)}</Badge></li>; })}
                {!(l.offers || []).length && <li className="text-ink-subtle">None.</li>}
              </ul>
            </Card>
          </div>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Buyer" description="Contacts are masked. Every reveal is recorded in the audit log." />
            <dl className="divide-y">
              <Row label="Name">{l.buyer?.name}</Row>
              <Row label="Phone"><span className="inline-flex flex-wrap items-center gap-2">{revealed.phone || l.buyer?.phone}{canReveal && !revealed.phone && <Button size="sm" variant="ghost" icon={Eye} loading={revealing === 'phone'} onClick={() => reveal('phone')}>Reveal</Button>}{revealed.phone && <a className="text-brand-700" href={`tel:${revealed.phone}`} aria-label="Call"><Phone className="h-4 w-4" /></a>}</span></Row>
              <Row label="Email">{l.buyer?.hasEmail ? <span className="inline-flex flex-wrap items-center gap-2">{revealed.email || 'Hidden'}{canReveal && !revealed.email && <Button size="sm" variant="ghost" icon={Eye} loading={revealing === 'email'} onClick={() => reveal('email')}>Reveal</Button>}</span> : 'Not given'}</Row>
              <Row label="Referral code">{l.referralCode}</Row>
              <Row label="WhatsApp">{l.whatsappOptIn ? 'Opted in' : 'Not opted in'}</Row>
            </dl>
            {!canReveal && <p className="mt-2 text-xs text-ink-subtle">Contact reveal needs the contacts.view permission (or managing this lead's team).</p>}
          </Card>

          <Card>
            <CardHeader title="Assignment and SLA" />
            <dl className="divide-y">
              <Row label="Agent">{l.assignedTo ? names[String(l.assignedTo)] || 'Assigned' : <Badge tone="warning">Unassigned</Badge>}</Row>
              <Row label="First contact"><Badge tone={sla.tone}>{sla.label}</Badge>{l.slaDueAt && <span className="ml-2 text-xs text-ink-subtle">by {dateTime(l.slaDueAt)}</span>}</Row>
              <Row label="Contacted at">{l.firstContactAt ? dateTime(l.firstContactAt) : null}</Row>
              <Row label="Call attempts">{String(l.callAttempts || 0)}</Row>
              <Row label="Created">{dateTime(l.createdAt)}</Row>
              <Row label="Last activity">{dateTime(l.lastActivityAt)}</Row>
            </dl>
          </Card>

          {openRequests.length > 0 && (
            <Card>
              <CardHeader title="Reassignment requests" description="Raised by the assigned agent." />
              <ul className="space-y-3">{openRequests.map((r) => <ReassignRequest key={r._id} lead={l} r={r} agentOptions={agentOptions} />)}</ul>
            </Card>
          )}

          <Card>
            <CardHeader title="Requirement" />
            <dl className="divide-y">
              <Row label="Purpose">{titleCase(l.requirement?.purpose)}</Row>
              <Row label="City">{l.requirement?.city}</Row>
              <Row label="Localities">{(l.requirement?.localities || []).join(', ')}</Row>
              <Row label="BHK">{(l.requirement?.bhk || []).join(', ')}</Row>
              <Row label="Budget">{l.requirement?.budgetMin || l.requirement?.budgetMax ? `${l.requirement.budgetMin ? shortRupees(l.requirement.budgetMin * 100) : 'any'} - ${l.requirement.budgetMax ? shortRupees(l.requirement.budgetMax * 100) : 'any'}` : null}</Row>
              <Row label="Notes">{l.requirement?.notes}</Row>
            </dl>
          </Card>

          <Card>
            <CardHeader title="Properties" />
            <ul className="space-y-2 text-sm">
              {(l.properties || []).map((p) => <li key={p._id}><span className="font-medium text-ink">{p.title}</span><span className="block text-xs text-ink-subtle">{p.listingNo} · {p.location?.locality} · {titleCase(p.status)}{String(p._id) === String(l.propertyId) ? ' · enquired' : ' · linked'}</span></li>)}
              {!(l.properties || []).length && <li className="text-ink-subtle">No property linked.</li>}
            </ul>
          </Card>
        </div>
      </div>

      <AssignModal open={modal === 'assign'} onClose={() => setModal(null)} leadIds={[l._id]} currentAgentId={l.assignedTo ? String(l.assignedTo) : undefined} />
      {modal === 'merge' && <MergeModal open onClose={() => setModal(null)} lead={l} />}
      <Modal open={modal === 'reopen'} onClose={() => setModal(null)} title={`Reopen ${l.leadNo}`} description="The lead goes back to its stage before it was lost."
        footer={<><Button variant="ghost" onClick={() => setModal(null)}>Cancel</Button><Button disabled={note.trim().length < 3} loading={reopen.isPending} onClick={doReopen}>Reopen</Button></>}>
        <Textarea label="Why reopen?" required rows={3} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />
      </Modal>
      <Modal open={modal === 'recycle'} onClose={() => setModal(null)} title={`Recycle ${l.leadNo}`} description="Creates a new lead with source Recycled, copies the requirement and routes it again. This lead keeps a link."
        footer={<><Button variant="ghost" onClick={() => setModal(null)}>Cancel</Button><Button icon={Recycle} loading={recycle.isPending} onClick={doRecycle}>Create new lead</Button></>}>
        <p className="text-sm text-ink-muted">Only lost leads older than the reopen window can be recycled; newer ones should be reopened.</p>
      </Modal>
    </>
  );
}
