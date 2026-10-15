// RE-S-AGT-14 My performance: own KPIs for a period (default this month):
// conversion %, first-contact SLA met %, visits, deals and commission
// (verified deals only), with a funnel chart in plain SVG.
import { useMemo, useState } from 'react';
import { BarChart3, CalendarCheck2, Clock, Handshake, IndianRupee, Inbox, ListChecks, Target } from 'lucide-react';
import { Card, Input, PageHeader, Select, Skeleton, Stat } from '@/shared/ui';
import { date, rupees } from '@/shared/lib/format';
import { presetRange, useAgentPerformance } from '@/modules/reports/agentApi';
import { ErrorState } from '../../components/common';

const PRESETS = [
  { value: 'this_month', label: 'This month' }, { value: 'last_month', label: 'Last month' }, { value: 'last_30', label: 'Last 30 days' },
  { value: 'last_90', label: 'Last 90 days' }, { value: 'this_year', label: 'This year' }, { value: 'custom', label: 'Custom range' },
];
const pctOf = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0);

function Funnel({ steps }) {
  const max = Math.max(1, ...steps.map((s) => s.value));
  const rowH = 34;
  return (
    <svg viewBox={`0 0 600 ${steps.length * rowH}`} className="h-auto w-full" role="img" aria-label="Lead to deal funnel">
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
      <PageHeader title="My performance" description="Your own numbers. Commission counts verified deals only." />
      <div className="mb-6 grid gap-3 sm:grid-cols-3 lg:w-2/3">
        <Select aria-label="Period" value={preset} onChange={(e) => setPreset(e.target.value)} options={PRESETS} />
        {preset === 'custom' && <>
          <Input aria-label="From" type="date" value={custom.from} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} />
          <Input aria-label="To" type="date" value={custom.to} min={custom.from || undefined} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} />
        </>}
      </div>
      {preset === 'custom' && !params && <p className="mb-4 text-sm text-ink-subtle">Pick both dates. The range can be up to 2 years.</p>}
      {!params ? null : error ? <ErrorState error={error} onRetry={refetch} title="Could not load your KPIs" /> : isLoading || !k ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[1, 2, 3, 4, 5, 6, 7, 8].map((i) => <Skeleton key={i} className="h-24" />)}</div>
      ) : (
        <>
          <p className="mb-3 text-xs text-ink-subtle">{date(k.from)} - {date(k.to)}</p>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat icon={Target} tone="success" label="Conversion" value={`${k.conversionPercent}%`} hint="Verified deals / leads assigned" />
            <Stat icon={Clock} tone={k.slaMetPercent >= 90 ? 'success' : k.slaMetPercent >= 70 ? 'warning' : 'danger'} label="First-contact SLA met" value={`${k.slaMetPercent}%`} hint={`${k.contacted} of ${k.leadsAssigned} contacted`} />
            <Stat icon={CalendarCheck2} tone="info" label="Visits done" value={k.visitsCompleted} hint={`${k.visitsScheduled} scheduled`} />
            <Stat icon={Handshake} tone="brand" label="Deals verified" value={k.dealsVerified} hint={`${k.dealsSubmitted} submitted`} />
            <Stat icon={IndianRupee} tone="accent" label="Commission generated" value={rupees(k.commission)} hint="Verified deals in the period" />
            <Stat icon={Inbox} tone="brand" label="Leads assigned" value={k.leadsAssigned} hint={`${k.openLeads} open now`} />
            <Stat icon={BarChart3} tone="info" label="Lead to visit" value={`${pctOf(k.visitsCompleted, k.leadsAssigned)}%`} hint={`Visit to deal ${pctOf(k.dealsVerified, k.visitsCompleted)}%`} />
            <Stat icon={ListChecks} tone={k.overdueFollowUps ? 'warning' : 'success'} label="Overdue follow-ups" value={k.overdueFollowUps} hint="Right now" />
          </div>
          <Card className="mt-6">
            <h2 className="mb-4 text-base font-semibold text-ink">Funnel</h2>
            <Funnel steps={[
              { label: 'Leads assigned', value: k.leadsAssigned },
              { label: 'Contacted', value: k.contacted, rate: pctOf(k.contacted, k.leadsAssigned) },
              { label: 'Visits scheduled', value: k.visitsScheduled },
              { label: 'Visits done', value: k.visitsCompleted, rate: pctOf(k.visitsCompleted, k.visitsScheduled) },
              { label: 'Deals submitted', value: k.dealsSubmitted },
              { label: 'Deals verified', value: k.dealsVerified, rate: pctOf(k.dealsVerified, k.dealsSubmitted) },
            ]} />
          </Card>
        </>
      )}
    </>
  );
}
