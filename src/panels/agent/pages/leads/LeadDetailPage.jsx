// RE-S-AGT-04 Lead detail: header (stage, priority, SLA), buyer card with the
// audited reveal, requirement, properties and matches, offers, visits,
// follow-ups, activity, and side actions (reassignment, home-loan referral,
// owner update, WhatsApp template, create deal). The status strip shows the
// linked deal, team, seeker flag and the next open follow-up.
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowRightLeft, CalendarClock, FilePlus2, Handshake, Landmark, MessageCircle, MessageSquareShare, MoreHorizontal, PhoneCall, ShieldOff, Shuffle, Users } from 'lucide-react';
import { Alert, Badge, Button, EmptyState, PageHeader, Select, Skeleton, useToast } from '@/shared/ui';
import { date, dateTime, timeAgo, titleCase } from '@/shared/lib/format';
import { dealStatus } from '@/modules/deals/agentApi';
import { OPEN_STAGES, PRIORITIES, SOURCES, errorText, leadApi, useAgentLead, useAgentMutation } from '@/modules/leads/agentApi';
import { CallLogModal, StageChangeModal } from '../../components/LeadModals';
import { LoanReferralModal, ShareUpdateModal, WhatsAppTemplateModal } from '../../components/ExtraModals';
import BuyerCard from '../../components/lead/BuyerCard';
import RequirementCard from '../../components/lead/RequirementCard';
import PropertiesPanel from '../../components/lead/PropertiesPanel';
import { FollowupsPanel, OffersPanel, Timeline, VisitsPanel } from '../../components/lead/ActivityPanels';
import { ErrorState, ReasonModal, SlaTimer, StageBadge } from '../../components/common';

function MoreMenu({ items }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <Button variant="secondary" icon={MoreHorizontal} aria-expanded={open} onClick={() => setOpen((o) => !o)}>More</Button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden />
          <div role="menu" className="absolute right-0 z-20 mt-1 w-60 rounded-lg border bg-white py-1 shadow-lg">
            {items.map(({ label, icon: Icon, onClick, disabled }) => (
              <button key={label} role="menuitem" type="button" disabled={disabled} onClick={() => { setOpen(false); onClick(); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink hover:bg-surface-muted disabled:opacity-50">
                <Icon className="h-4 w-4" />{label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function LeadDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { data: lead, isLoading, error, refetch } = useAgentLead(id);
  const patch = useAgentMutation(leadApi.patch);
  const reassign = useAgentMutation(leadApi.reassign);
  const [modal, setModal] = useState('');
  const close = () => setModal('');

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-16" /><div className="grid gap-4 lg:grid-cols-3"><Skeleton className="h-72 lg:col-span-2" /><Skeleton className="h-72" /></div></div>;
  if (error && (error.status === 403 || error.status === 404)) {
    return <EmptyState icon={ShieldOff} title="This lead is not assigned to you" description="Leads are visible to their assigned agent and the team manager. Ask your manager if you need access." action={<Button variant="secondary" to="/agent/leads">Back to my leads</Button>} />;
  }
  if (error) return <ErrorState error={error} onRetry={refetch} title="Could not load the lead" />;

  const isOpen = OPEN_STAGES.includes(lead.stage);
  const openRequest = (lead.reassignRequests || []).find((r) => r.status === 'open');
  const setPriority = async (p) => { try { await patch.mutateAsync({ id: lead._id, body: { priority: p } }); toast.success('Priority updated'); } catch (e) { toast.error(errorText(e)); } };
  const requestReassign = async (reason) => { try { await reassign.mutateAsync({ id: lead._id, reason }); toast.success('Your manager has been asked to reassign this lead'); close(); } catch (e) { toast.error(errorText(e)); } };
  const callLead = { _id: lead._id, leadNo: lead.leadNo, buyerName: lead.buyer.name, stage: lead.stage };
  const wa = lead.whatsapp || { allowed: false, reason: 'WhatsApp is not available' };
  const seeker = lead.seekerFlag;
  const next = lead.nextFollowUp;
  const ds = lead.deal ? dealStatus(lead.deal.status) : null;

  return (
    <>
      <PageHeader breadcrumb={<Link to="/agent/leads" className="hover:text-ink">My leads</Link>} title={`${lead.buyer.name}`}
        description={`${lead.leadNo} · ${(lead.sources || []).map((s) => SOURCES[s] || s).join(', ')} · created ${date(lead.createdAt)} · last activity ${timeAgo(lead.lastActivityAt)}`}
        actions={<>
          <Button variant="secondary" icon={PhoneCall} onClick={() => setModal('call')}>Log call</Button>
          <span title={wa.allowed ? 'Send an approved WhatsApp template' : wa.reason} className="inline-flex">
            <Button variant="secondary" icon={MessageCircle} disabled={!wa.allowed || !isOpen} aria-label={wa.allowed ? 'WhatsApp' : `WhatsApp unavailable: ${wa.reason}`} onClick={() => setModal('whatsapp')}>WhatsApp</Button>
          </span>
          <Button icon={FilePlus2} variant={['negotiation', 'booking'].includes(lead.stage) ? 'primary' : 'secondary'} disabled={!isOpen} onClick={() => navigate(`/agent/deals/new?leadId=${lead._id}`)}>Create deal</Button>
          <MoreMenu items={[
            { label: 'Update the owner (masked)', icon: MessageSquareShare, onClick: () => setModal('share'), disabled: !(lead.properties || []).length },
            { label: 'Home-loan referral', icon: Landmark, onClick: () => setModal('loan') },
            { label: openRequest ? 'Reassignment requested' : 'Ask manager to reassign', icon: Shuffle, onClick: () => setModal('reassign'), disabled: Boolean(openRequest) },
          ]} />
        </>} />

      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-lg border bg-white p-3 shadow-sm">
        <StageBadge stage={lead.stage} />
        <Button size="sm" variant="ghost" icon={ArrowRightLeft} disabled={!isOpen} onClick={() => setModal('stage')}>Change stage</Button>
        <span className="h-5 w-px bg-line" aria-hidden />
        <Select aria-label="Priority" className="w-28" value={lead.priority} disabled={patch.isPending} onChange={(e) => setPriority(e.target.value)} options={PRIORITIES} />
        {(lead.stage === 'new' || lead.slaBreachedAt) && <SlaTimer lead={lead} />}
        {lead.referralCode && <Badge tone="accent">Referral {lead.referralCode}</Badge>}
        {lead.throttled && <Badge tone="danger">Throttled seeker</Badge>}
        {seeker && seeker.flagged && <Badge tone={seeker.status === 'cleared' ? 'neutral' : 'danger'}>Seeker flag {seeker.flagNo} · {titleCase(seeker.status)}{seeker.action && seeker.action !== 'none' ? ` (${seeker.action})` : ''}</Badge>}
        {openRequest && <Badge tone="warning">Reassignment requested {timeAgo(openRequest.at)}</Badge>}
      </div>

      <dl className="mb-6 grid gap-3 rounded-lg border bg-white p-3 text-sm shadow-sm sm:grid-cols-3">
        <div className="flex items-start gap-2">
          <Handshake className="mt-0.5 h-4 w-4 shrink-0 text-ink-subtle" aria-hidden />
          <div><dt className="text-xs text-ink-subtle">Deal</dt>
            <dd>{lead.deal ? <Link to={`/agent/deals/${lead.deal._id}`} className="font-medium text-brand-700 hover:underline">{lead.deal.dealNo}</Link> : <span className="text-ink-subtle">No deal yet</span>}
              {ds && <> <Badge tone={ds.tone}>{ds.label}</Badge></>}</dd></div>
        </div>
        <div className="flex items-start gap-2">
          <Users className="mt-0.5 h-4 w-4 shrink-0 text-ink-subtle" aria-hidden />
          <div><dt className="text-xs text-ink-subtle">Agent and team</dt>
            <dd className="text-ink">{(lead.agent && lead.agent.name) || 'Unassigned'}{lead.team ? ` · ${lead.team.name}` : ''}</dd></div>
        </div>
        <div className="flex items-start gap-2">
          <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-ink-subtle" aria-hidden />
          <div><dt className="text-xs text-ink-subtle">Next follow-up</dt>
            <dd className={next && new Date(next.dueAt) < new Date() ? 'font-medium text-danger-700' : 'text-ink'}>{next ? `${titleCase(next.type)} · ${dateTime(next.dueAt)}` : <span className="text-ink-subtle">None open</span>}</dd></div>
        </div>
      </dl>

      {lead.stage === 'closed_lost' && <Alert tone="warning" className="mb-4" title="This lead is closed as lost">{lead.lostReason ? `Reason: ${lead.lostReason.replace(/_/g, ' ')}` : ''}{lead.lostNote ? ` · ${lead.lostNote}` : ''}</Alert>}
      {lead.stage === 'closed_won' && <Alert tone="success" className="mb-4" title="Won: the deal is verified" />}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <PropertiesPanel lead={lead} />
          <OffersPanel lead={lead} />
          <VisitsPanel lead={lead} />
          <Timeline lead={lead} />
        </div>
        <div className="min-w-0 space-y-6">
          <BuyerCard lead={lead} onCall={() => setModal('call')} />
          <RequirementCard lead={lead} />
          <FollowupsPanel lead={lead} />
        </div>
      </div>

      <CallLogModal open={modal === 'call'} onClose={close} lead={callLead} />
      <StageChangeModal open={modal === 'stage'} onClose={close} lead={lead} />
      <ShareUpdateModal open={modal === 'share'} onClose={close} lead={lead} properties={lead.properties || []} />
      <LoanReferralModal open={modal === 'loan'} onClose={close} lead={lead} />
      <WhatsAppTemplateModal open={modal === 'whatsapp'} onClose={close} lead={lead} />
      <ReasonModal open={modal === 'reassign'} onClose={close} title="Ask your manager to reassign" description="Your manager is notified and decides. You keep the lead until then." label="Reason" min={5} max={300} confirmLabel="Send request" loading={reassign.isPending} onSubmit={requestReassign} />
    </>
  );
}
