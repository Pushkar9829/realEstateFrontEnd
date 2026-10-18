// RE-S-AGT-14 My performance: own KPIs for a period (default this month):
// conversion %, first-contact SLA met %, visits, deals and commission
// (verified deals only), with a funnel chart in plain SVG.
import { useMemo, useState } from 'react';
import { BarChart3, CalendarCheck2, Clock, Handshake, IndianRupee, Inbox, ListChecks, Target } from 'lucide-react';
import { Card, Input, PageHeader, Select, Skeleton, Stat } from '@/shared/ui';
import { date, rupees } from '@/shared/lib/format';
import { presetRange, useAgentPerformance } from '@/modules/reports/agentApi';
import { useT } from '@/shared/i18n';
import { ErrorState } from '../../components/common';

// Labels: agent.performance.preset.<value>.
const PRESETS = ['this_month', 'last_month', 'last_30', 'last_90', 'this_year', 'custom'];
const pctOf = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0);

function Funnel({ steps }) {
  const t = useT();
  const max = Math.max(1, ...steps.map((s) => s.value));
  const rowH = 34;
  return (
    <svg viewBox={`0 0 600 ${steps.length * rowH}`} className="h-auto w-full" role="img" aria-label={t('agent.performance.funnelAria')}>
      {steps.map((s, i) => {
        const w = Math.max(2, (s.value / max) * 380);
        const y = i * rowH;
        return (
          <g key={s.label}>
            <text x="0" y={y + 21} className="fill-ink-muted" fontSize="13">{s.label}</text>
            <rect x="170" y={y + 6} width={w} height="22" rx="4" className={i === steps.length - 1 ? 'fill-success-600' : 'fill-brand-500'} />
            <text x={176 + w} y={y + 21} className="fill-ink" fontSize="13" fontWeight="600">{s.value}{s.rate != null ? ` (${s.rate}%)` : ''}</text>
          </g>
        );
      })}
    </svg>
  );
}

export default function PerformancePage() {
  const t = useT();
  const [preset, setPreset] = useState('this_month');
  const [custom, setCustom] = useState({ from: '', to: '' });
  const params = useMemo(() => {
    if (preset === 'custom') {
      if (!custom.from || !custom.to) return null;
      return { from: new Date(`${custom.from}T00:00:00+05:30`).toISOString(), to: new Date(`${custom.to}T23:59:59+05:30`).toISOString() };
    }
    const r = presetRange(preset);
    return { from: r.from.toISOString(), to: r.to.toISOString() };
  }, [preset, custom]);
  const { data: k, isLoading, error, refetch } = useAgentPerformance(params || {}, Boolean(params));

  return (
    <>
      <PageHeader title={t('agent.performance.title')} description={t('agent.performance.desc')} />
      <div className="mb-6 grid gap-3 sm:grid-cols-3 lg:w-2/3">
        <Select aria-label={t('agent.performance.period')} value={preset} onChange={(e) => setPreset(e.target.value)} options={PRESETS.map((value) => ({ value, label: t(`agent.performance.preset.${value}`) }))} />
        {preset === 'custom' && <>
          <Input aria-label={t('agent.performance.from')} type="date" value={custom.from} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} />
          <Input aria-label={t('agent.performance.to')} type="date" value={custom.to} min={custom.from || undefined} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} />
        </>}
      </div>
      {preset === 'custom' && !params && <p className="mb-4 text-sm text-ink-subtle">{t('agent.performance.pickDates')}</p>}
      {!params ? null : error ? <ErrorState error={error} onRetry={refetch} title={t('agent.performance.loadError')} /> : isLoading || !k ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[1, 2, 3, 4, 5, 6, 7, 8].map((i) => <Skeleton key={i} className="h-24" />)}</div>
      ) : (
        <>
          <p className="mb-3 text-xs text-ink-subtle">{date(k.from)} - {date(k.to)}</p>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat icon={Target} tone="success" label={t('agent.performance.conversion')} value={`${k.conversionPercent}%`} hint={t('agent.performance.conversionHint')} />
            <Stat icon={Clock} tone={k.slaMetPercent >= 90 ? 'success' : k.slaMetPercent >= 70 ? 'warning' : 'danger'} label={t('agent.performance.slaMet')} value={`${k.slaMetPercent}%`} hint={t('agent.performance.contactedOf', { n: k.contacted, total: k.leadsAssigned })} />
            <Stat icon={CalendarCheck2} tone="info" label={t('agent.performance.visitsDone')} value={k.visitsCompleted} hint={t('agent.performance.scheduledN', { n: k.visitsScheduled })} />
            <Stat icon={Handshake} tone="brand" label={t('agent.performance.dealsVerified')} value={k.dealsVerified} hint={t('agent.performance.submittedN', { n: k.dealsSubmitted })} />
            <Stat icon={IndianRupee} tone="accent" label={t('agent.performance.commission')} value={rupees(k.commission)} hint={t('agent.performance.commissionHint')} />
            <Stat icon={Inbox} tone="brand" label={t('agent.performance.leadsAssigned')} value={k.leadsAssigned} hint={t('agent.performance.openNow', { n: k.openLeads })} />
            <Stat icon={BarChart3} tone="info" label={t('agent.performance.leadToVisit')} value={`${pctOf(k.visitsCompleted, k.leadsAssigned)}%`} hint={t('agent.performance.visitToDeal', { n: pctOf(k.dealsVerified, k.visitsCompleted) })} />
            <Stat icon={ListChecks} tone={k.overdueFollowUps ? 'warning' : 'success'} label={t('agent.performance.overdue')} value={k.overdueFollowUps} hint={t('agent.performance.rightNow')} />
          </div>
          <Card className="mt-6">
            <h2 className="mb-4 text-base font-semibold text-ink">{t('agent.performance.funnel')}</h2>
            <Funnel steps={[
              { label: t('agent.performance.leadsAssigned'), value: k.leadsAssigned },
              { label: t('agent.stage.contacted'), value: k.contacted, rate: pctOf(k.contacted, k.leadsAssigned) },
              { label: t('agent.performance.visitsScheduled'), value: k.visitsScheduled },
              { label: t('agent.performance.visitsDone'), value: k.visitsCompleted, rate: pctOf(k.visitsCompleted, k.visitsScheduled) },
              { label: t('agent.performance.dealsSubmitted'), value: k.dealsSubmitted },
              { label: t('agent.performance.dealsVerified'), value: k.dealsVerified, rate: pctOf(k.dealsVerified, k.dealsSubmitted) },
            ]} />
          </Card>
        </>
      )}
    </>
  );
}
