// RE-S-AGT-03 Pipeline board: open leads by stage. Drag a card (native HTML5
// drag and drop) or use its "Move to" menu. Moves that need data open a modal
// first (lost reason, back-move note, visit scheduling, create deal); simple
// moves are optimistic and roll back with the API's reason.
import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Ban, ChevronLeft, ChevronRight, KanbanSquare, Trophy } from 'lucide-react';
import { Button, EmptyState, Modal, PageHeader, Select, Skeleton, useToast } from '@/shared/ui';
import { cn } from '@/shared/lib/cn';
import { timeAgo } from '@/shared/lib/format';
import { OPEN_STAGES, PRIORITIES, agentKeys, budgetText, errorText, firstName, isBackMove, leadApi, priorityInfo, stageInfo, useAgentMutation, useLeadBoard } from '@/modules/leads/agentApi';
import { useT } from '@/shared/i18n';
import { StageChangeModal } from '../../components/LeadModals';
import { ScheduleVisitModal } from '../../components/VisitModals';
import { ErrorState, SlaTimer } from '../../components/common';

const PRIORITY_DOT = { hot: 'bg-danger-600', warm: 'bg-warning-600', cold: 'bg-info-600' };
const PAGE = 30;

function LeadCard({ lead, onMove, dragging, setDragging }) {
  const t = useT();
  const options = [...OPEN_STAGES, 'closed_lost'].filter((s) => s !== lead.stage).map((s) => ({ value: s, label: stageInfo(s).label }));
  return (
    <li draggable onDragStart={(e) => { e.dataTransfer.setData('text/plain', lead._id); e.dataTransfer.effectAllowed = 'move'; setDragging(lead._id); }} onDragEnd={() => setDragging(null)}
      className={cn('cursor-grab rounded-md border bg-white p-3 shadow-sm active:cursor-grabbing', dragging === lead._id && 'opacity-50')}>
      <div className="flex items-start justify-between gap-2">
        <Link to={`/agent/leads/${lead._id}`} className="font-medium text-ink hover:text-brand-700">{firstName(lead.buyerName)}</Link>
        <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', PRIORITY_DOT[lead.priority] || 'bg-ink-subtle')} title={t('agent.pipeline.priorityTitle', { p: String(priorityInfo(lead.priority).label).toLowerCase() })} />
      </div>
      <p className="truncate text-xs text-ink-subtle">{lead.property ? lead.property.title : lead.leadNo}</p>
      {budgetText(lead.requirement) && <p className="text-xs text-ink-muted">{budgetText(lead.requirement)}</p>}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-1">
        <span className="text-xs text-ink-subtle">{timeAgo(lead.lastActivityAt)}</span>
        {lead.stage === 'new' && <SlaTimer compact lead={lead} />}
      </div>
      <select aria-label={t('agent.pipeline.moveLead', { no: lead.leadNo })} value="" onChange={(e) => e.target.value && onMove(lead, e.target.value)}
        className="mt-2 block h-7 w-full rounded border border-line bg-surface-muted px-1 text-xs text-ink-muted lg:hidden">
        <option value="">{t('agent.pipeline.moveTo')}</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </li>
  );
}

function Column({ stage, rows, onDrop, children, tone, icon: Icon, hint }) {
  const [over, setOver] = useState(false);
  const s = stageInfo(stage);
  return (
    <section onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); const id = e.dataTransfer.getData('text/plain'); if (id) onDrop(id, stage); }}
      id={`col-${stage}`} className={cn('flex w-64 shrink-0 scroll-ml-4 flex-col rounded-lg border p-2 transition-colors', over ? 'border-brand-500 bg-brand-50' : tone || 'bg-surface-muted')} aria-label={s.label}>
      <header className="mb-2 flex items-center justify-between px-1">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">{Icon && <Icon className="h-4 w-4" aria-hidden />}{s.label}</h2>
        {rows && <span className="rounded-full bg-white px-2 text-xs text-ink-muted">{rows.length}</span>}
      </header>
      {hint && <p className="px-1 pb-2 text-xs text-ink-subtle">{hint}</p>}
      {children}
    </section>
  );
}

export default function PipelinePage() {
  const t = useT();
  const navigate = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();
  const { data, isLoading, error, refetch } = useLeadBoard();
  const stage = useAgentMutation(leadApi.stage);
  const board = useRef(null);
  const [priority, setPriority] = useState('');
  const [purpose, setPurpose] = useState('');
  const [city, setCity] = useState('');
  const [limits, setLimits] = useState({});
  const [dragging, setDragging] = useState(null);
  const [pending, setPending] = useState(null); // { kind, lead, to }

  const all = data ? OPEN_STAGES.flatMap((s) => data[s] || []) : [];
  const cities = [...new Set(all.map((l) => (l.property && l.property.city) || (l.requirement && l.requirement.city)).filter(Boolean))];
  const keep = (l) => (!priority || l.priority === priority)
    && (!purpose || ((l.property && l.property.purpose) || (l.requirement && l.requirement.purpose)) === purpose)
    && (!city || ((l.property && l.property.city) || (l.requirement && l.requirement.city)) === city);

  const moveNow = async (lead, to) => {
    const prev = qc.getQueryData(agentKeys.board);
    qc.setQueryData(agentKeys.board, (old) => {
      if (!old) return old;
      const next = { ...old, [lead.stage]: (old[lead.stage] || []).filter((x) => x._id !== lead._id) };
      if (OPEN_STAGES.includes(to)) next[to] = [{ ...lead, stage: to }, ...(old[to] || [])];
      return next;
    });
    try {
      await stage.mutateAsync({ id: lead._id, body: { stage: to } });
      toast.success(t('agent.pipeline.moved', { name: firstName(lead.buyerName), stage: stageInfo(to).label }));
    } catch (e) {
      qc.setQueryData(agentKeys.board, prev);
      toast.error(errorText(e), { title: t('agent.pipeline.notAllowed') });
    }
  };

  const onMove = (lead, to) => {
    if (!lead || lead.stage === to) return;
    if (to === 'closed_won') { toast.error(t('agent.pipeline.wonOnly'), { title: t('agent.pipeline.notAllowed') }); return; }
    if (to === 'booking') { setPending({ kind: 'deal', lead, to }); return; }
    if (to === 'site_visit_scheduled') { setPending({ kind: 'visit', lead, to }); return; }
    if (to === 'closed_lost' || isBackMove(lead.stage, to)) { setPending({ kind: 'stage', lead, to }); return; }
    moveNow(lead, to);
  };
  const onDrop = (id, to) => onMove(all.find((l) => l._id === id), to);
  const jump = (s) => { const el = document.getElementById(`col-${s}`); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' }); };
  const scrollBy = (dir) => { if (board.current) board.current.scrollBy({ left: dir * 280, behavior: 'smooth' }); };

  const header = <PageHeader title={t('panel.nav.agentPipeline')} description={t('agent.pipeline.desc')} />;
  if (isLoading) return <>{header}<div className="flex gap-3 overflow-hidden">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-96 w-72 shrink-0" />)}</div></>;
  if (error) return <>{header}<ErrorState error={error} onRetry={refetch} title={t('agent.pipeline.loadError')} /></>;

  const p = pending && pending.lead;
  const visitProps = p && p.propertyId && p.property ? [{ _id: p.propertyId, ...p.property }] : [];
  return (
    <>
      {header}
      <div className="mb-4 grid gap-3 sm:grid-cols-3 lg:w-2/3">
        <Select aria-label={t('agent.leads.priority')} placeholder={t('agent.leads.anyPriority')} value={priority} onChange={(e) => setPriority(e.target.value)} options={PRIORITIES} />
        <Select aria-label={t('agent.req.purpose')} placeholder={t('agent.pipeline.buyAndRent')} value={purpose} onChange={(e) => setPurpose(e.target.value)} options={[{ value: 'sale', label: t('agent.purpose.sale') }, { value: 'rent', label: t('agent.purpose.rent') }]} />
        <Select aria-label={t('agent.req.city')} placeholder={t('common.allCities')} value={city} onChange={(e) => setCity(e.target.value)} options={cities.map((c) => ({ value: c, label: c }))} />
      </div>
      {all.length === 0 ? <EmptyState icon={KanbanSquare} title={t('agent.pipeline.emptyTitle')} description={t('agent.pipeline.emptyDesc')} /> : (<>
        {/* Every stage at a glance: the board scrolls sideways, so later stages are one tap away (audit A3). */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <nav aria-label={t('agent.pipeline.stages')} className="flex min-w-0 flex-1 flex-wrap gap-1.5">
            {OPEN_STAGES.concat(['closed_won', 'closed_lost']).map((s) => (
              <button key={s} type="button" onClick={() => jump(s)} className="inline-flex items-center gap-1 rounded-full border bg-white px-2.5 py-1 text-xs text-ink-muted hover:border-brand-300 hover:text-ink">
                {stageInfo(s).label}{data[s] ? <span className="rounded-full bg-surface-sunken px-1.5 font-medium text-ink">{(data[s] || []).filter(keep).length}</span> : null}
              </button>
            ))}
          </nav>
          <span className="flex gap-1">
            <Button size="sm" variant="secondary" icon={ChevronLeft} aria-label={t('agent.pipeline.scrollLeft')} onClick={() => scrollBy(-1)} />
            <Button size="sm" variant="secondary" icon={ChevronRight} aria-label={t('agent.pipeline.scrollRight')} onClick={() => scrollBy(1)} />
          </span>
        </div>
        <div className="relative">
        <div ref={board} className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-4 sm:mx-0 sm:px-0">
          {OPEN_STAGES.map((s) => {
            const rows = (data[s] || []).filter(keep);
            const lim = limits[s] || PAGE;
            return (
              <Column key={s} stage={s} rows={rows} onDrop={onDrop}>
                <ul className="flex min-h-[4rem] flex-col gap-2">
                  {rows.slice(0, lim).map((l) => <LeadCard key={l._id} lead={l} onMove={onMove} dragging={dragging} setDragging={setDragging} />)}
                </ul>
                {rows.length > lim && <Button size="sm" variant="ghost" className="mt-2" onClick={() => setLimits((x) => ({ ...x, [s]: lim + PAGE }))}>{t('agent.pipeline.loadMore', { n: rows.length - lim })}</Button>}
                {!rows.length && <p className="py-4 text-center text-xs text-ink-subtle">{t('agent.pipeline.dropHere')}</p>}
              </Column>
            );
          })}
          <div className="flex shrink-0 flex-col gap-3">
            <Column stage="closed_won" onDrop={onDrop} icon={Trophy} tone="bg-success-50" hint={t('agent.pipeline.wonHint')} />
            <Column stage="closed_lost" onDrop={onDrop} icon={Ban} tone="bg-danger-50" hint={t('agent.pipeline.lostHint')} />
          </div>
        </div>
        <span className="pointer-events-none absolute inset-y-0 right-0 hidden w-10 bg-gradient-to-l from-surface-muted to-transparent sm:block" aria-hidden />
        </div>
      </>)}

      <StageChangeModal open={Boolean(pending && pending.kind === 'stage')} onClose={() => setPending(null)} lead={pending && pending.kind === 'stage' ? pending.lead : null} to={pending && pending.to} />
      <ScheduleVisitModal open={Boolean(pending && pending.kind === 'visit' && visitProps.length)} onClose={() => setPending(null)} lead={p} properties={visitProps} />
      <Modal open={Boolean(pending && (pending.kind === 'deal' || (pending.kind === 'visit' && !visitProps.length)))} onClose={() => setPending(null)} size="sm"
        title={pending && pending.kind === 'deal' ? t('agent.pipeline.dealTitle') : t('agent.pipeline.linkTitle')}
        description={pending && pending.kind === 'deal' ? t('agent.pipeline.dealDesc') : t('agent.pipeline.linkDesc')}
        footer={<><Button variant="ghost" onClick={() => setPending(null)}>{t('agent.pipeline.notNow')}</Button>
          <Button onClick={() => { const l = pending.lead; setPending(null); navigate(pending.kind === 'deal' ? `/agent/deals/new?leadId=${l._id}` : `/agent/leads/${l._id}`); }}>{pending && pending.kind === 'deal' ? t('agent.lead.createDeal') : t('agent.pipeline.openLead')}</Button></>}>
        <p className="text-sm text-ink-muted">{p ? `${p.leadNo} · ${p.buyerName}` : ''}</p>
      </Modal>
    </>
  );
}
