// RE-S-ADM-01 admin dashboard from GET /api/admin/dashboard: lead, visit, deal
// receivable, offer and commission counters (month and financial year),
// overdue invoices, deals past the verification SLA, paused listings, review queues, integration health and a 30-day
// trend from the nightly snapshot. Managers get the team view (lead, visit,
// deal, offer, commission and receivable tiles only). KYC and broker-flag counts and the oldest
// approvals come from their own modules.
import { Link } from 'react-router-dom';
import {
  AlertTriangle, BadgeCheck, Building2, Camera, CalendarDays, CalendarRange, ClipboardCheck, FileWarning, Flag, Handshake, Hourglass, Inbox, IndianRupee, MessageSquareQuote, PauseCircle, Plug, RefreshCw, ShieldCheck, Timer, UserX, Wallet,
} from 'lucide-react';
import { Alert, Badge, Button, Card, CardHeader, EmptyState, PageHeader, Skeleton, Table } from '@/shared/ui';
import { cn } from '@/shared/lib/cn';
import { date, rupees, timeAgo, titleCase } from '@/shared/lib/format';
import { useAuth } from '@/modules/auth';
import { useApprovalQueue } from '@/modules/listings/api';
import { useBrokerFlagCount, useKycQueueCount } from '@/modules/kyc/api';
import { useAdminDashboard } from '@/modules/reports/adminApi';
import { Sparkline } from '../reports/charts';

const SLA = { green: ['success', 'On time'], amber: ['warning', 'Due soon'], red: ['danger', 'Overdue'] };

function Tile({ label, hint, value, loading, icon: Icon, tone, to, alert }) {
  const body = (
    <>
      <span className={cn('rounded-md p-2.5', tone)}><Icon className="h-5 w-5" aria-hidden /></span>
      <span className="flex-1">
        <span className="block text-sm text-ink-subtle">{label}</span>
        {loading ? <Skeleton className="mt-1 h-8 w-12" /> : <span className={cn('mt-0.5 block text-3xl font-semibold', alert ? 'text-danger-700' : 'text-ink')}>{value == null ? '-' : value}</span>}
        {hint && <span className="mt-0.5 block text-xs text-ink-subtle">{hint}</span>}
      </span>
    </>
  );
  const cls = 'group flex items-start gap-4 rounded-lg border bg-white p-5 shadow-sm transition';
  return to ? <Link to={to} className={cn(cls, 'hover:border-brand-300 hover:shadow-md')}>{body}</Link> : <div className={cls}>{body}</div>;
}

function Trend({ label, values, format = (v) => v }) {
  const total = values.reduce((a, v) => a + (Number(v) || 0), 0);
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div>
        <p className="text-sm text-ink-subtle">{label}</p>
        <p className="text-lg font-semibold text-ink">{format(total)}</p>
      </div>
      <Sparkline values={values} label={`${label} trend`} />
    </div>
  );
}

export default function DashboardPage() {
  const auth = useAuth();
  const can = auth.hasPermission;
  const { data: d, isLoading, error, refetch, isFetching } = useAdminDashboard();
  const kyc = useKycQueueCount(can('listers.verify'));
  const flags = useBrokerFlagCount(can('listers.manage'));
  const queue = useApprovalQueue({ limit: 5 }, can('properties.approve'));
  const team = d ? d.scope === 'team' : auth.user.role === 'manager';
  const q = (d && d.queues) || {};
  const integ = d && d.integrations;
  const trend = (d && d.trend) || [];
  const v = (x) => (d ? x : null);

  const tiles = [
    { label: 'New leads today', value: v(d?.leads.today), icon: Inbox, tone: 'bg-brand-50 text-brand-700', to: can('leads.view_all') ? '/admin/leads' : undefined },
    { label: 'Unassigned leads', value: v(d?.leads.unassigned), icon: UserX, tone: 'bg-warning-50 text-warning-700', to: can('leads.assign') ? '/admin/sla' : undefined, alert: d && d.leads.unassigned > 0 },
    { label: 'SLA breaches (new leads)', value: v(d?.leads.slaBreached), icon: Timer, tone: 'bg-danger-50 text-danger-700', to: can('leads.assign') ? '/admin/sla' : undefined, alert: d && d.leads.slaBreached > 0 },
    { label: 'Visits today', value: v(d?.visits.today), icon: CalendarDays, tone: 'bg-info-50 text-info-700', to: can('sitevisits.view') ? '/admin/visits' : undefined },
    { label: 'Deals awaiting verification', value: v(d?.deals.awaitingVerification), hint: `Verify within ${(d && d.deals.slaHours) || 72} hours`, icon: BadgeCheck, tone: 'bg-success-50 text-success-700', to: '/admin/deals' },
    { label: 'Deals past the verification SLA', value: v(d?.deals.beyondSla), hint: d ? `Submitted over ${d.deals.slaHours} hours ago` : undefined, icon: Hourglass, tone: 'bg-danger-50 text-danger-700', to: '/admin/deals', alert: d && d.deals.beyondSla > 0 },
    { label: 'Offers awaiting the owner', value: v(d?.offers?.awaitingOwner), hint: 'Waiting for the lister to answer', icon: Handshake, tone: 'bg-warning-50 text-warning-700' },
    { label: 'Commission verified this month', value: d && d.commission ? rupees(d.commission.month.commission) : null, hint: d && d.commission ? `${d.commission.month.deals} deals since ${date(d.commission.month.from)}` : undefined, icon: IndianRupee, tone: 'bg-success-50 text-success-700', to: can('reports.view') ? '/admin/reports/commission' : undefined },
    { label: 'Commission verified this financial year', value: d && d.commission ? rupees(d.commission.financialYear.commission) : null, hint: d && d.commission ? `${d.commission.financialYear.deals} deals since ${date(d.commission.financialYear.from)}` : undefined, icon: CalendarRange, tone: 'bg-brand-50 text-brand-700', to: can('reports.view') ? '/admin/reports/commission' : undefined },
    { label: 'Receivables outstanding', value: d ? rupees(d.receivables.outstanding) : null, hint: d ? `${d.receivables.open} open · ${d.receivables.overdue} overdue` : undefined, icon: Wallet, tone: 'bg-accent-50 text-accent-700', to: can('receivables.manage') ? '/admin/receivables' : undefined, alert: d && d.receivables.overdue > 0 },
    { label: 'Invoices overdue', value: v(d?.receivables.invoicesOverdue?.count), hint: d && d.receivables.invoicesOverdue ? `${rupees(d.receivables.invoicesOverdue.amount)} past the due date` : undefined, icon: FileWarning, tone: 'bg-danger-50 text-danger-700', to: can('receivables.manage') ? '/admin/receivables' : undefined, alert: d && d.receivables.invoicesOverdue && d.receivables.invoicesOverdue.count > 0 },
    ...(!team ? [
      can('properties.approve') && { label: 'Listings to approve', value: v(q.listings), hint: 'Decide within 24 hours', icon: ClipboardCheck, tone: 'bg-brand-50 text-brand-700', to: '/admin/approvals' },
      can('projects.approve') && { label: 'Projects to approve', value: v(q.projects), hint: 'RERA check required', icon: Building2, tone: 'bg-accent-50 text-accent-700', to: '/admin/projects' },
      can('verification.review') && { label: 'Photo verifications', value: v(q.photoVerification), icon: Camera, tone: 'bg-info-50 text-info-700', to: '/admin/photo-verification' },
      can('properties.manage') && { label: 'Paused listings', value: v(d?.listings?.paused), hint: 'Paused by the lister or an admin', icon: PauseCircle, tone: 'bg-surface-sunken text-ink-muted', to: '/admin/listings' },
      can('properties.manage') && { label: 'Open reported listings', value: v(q.reportedListings), icon: MessageSquareQuote, tone: 'bg-warning-50 text-warning-700', to: '/admin/feedback' },
      can('listers.verify') && { label: 'KYC waiting for review', value: kyc.isError ? null : kyc.data, loading: kyc.isLoading, hint: 'Decide within 48 hours', icon: ShieldCheck, tone: 'bg-info-50 text-info-700', to: '/admin/kyc' },
      can('listers.manage') && { label: 'Open broker flags', value: flags.isError ? null : flags.data, loading: flags.isLoading, icon: Flag, tone: 'bg-danger-50 text-danger-700', to: '/admin/trust' },
    ] : []),
  ].filter(Boolean);

  return (
    <>
      <PageHeader title="Dashboard" description={`Welcome back, ${auth.user.name.split(' ')[0]}. Here is what needs attention today.`}
        actions={<>
          <Badge tone={team ? 'info' : 'brand'}>{team ? 'Team view' : titleCase(auth.user.role)}</Badge>
          <Button size="sm" variant="ghost" icon={RefreshCw} loading={isFetching} onClick={() => refetch()}>Refresh</Button>
        </>} />
      {error && <Alert tone="danger" className="mb-4" title="Some counters could not load" action={<Button size="sm" variant="ghost" onClick={() => refetch()}>Retry</Button>}>{error.message}</Alert>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {tiles.map((t) => <Tile key={t.label} loading={t.loading ?? isLoading} {...t} />)}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Last 30 days" description={trend.length ? `Nightly snapshot, ${date(trend[0].day)} to ${date(trend[trend.length - 1].day)}.` : 'From the nightly KPI snapshot.'} />
          {isLoading ? <Skeleton className="h-40 w-full" /> : trend.length < 2 ? (
            <EmptyState title="No trend yet" description="The nightly snapshot job records daily KPIs; the chart appears after two days of data." className="border-0 py-8" />
          ) : (
            <div className="grid gap-x-8 divide-y sm:grid-cols-2 sm:divide-y-0">
              <Trend label="Leads" values={trend.map((x) => x.leads)} />
              <Trend label="Visits completed" values={trend.map((x) => x.visits)} />
              <Trend label="Deals verified" values={trend.map((x) => x.dealsVerified)} />
              <Trend label="Commission verified" values={trend.map((x) => x.commission)} format={rupees} />
            </div>
          )}
        </Card>

        {!team && (
          <Card>
            <CardHeader title="Integration health" description="MLM outbox delivery." action={can('integrations.manage') ? <Link className="text-sm text-brand-700 hover:underline" to="/admin/integrations">Open</Link> : null} />
            {isLoading ? <Skeleton className="h-16 w-full" /> : integ ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm"><span className="inline-flex items-center gap-2 text-ink-muted"><Plug className="h-4 w-4" /> Pending events</span><span className="font-semibold text-ink">{integ.outboxPending}</span></div>
                <div className="flex items-center justify-between text-sm"><span className="inline-flex items-center gap-2 text-ink-muted"><AlertTriangle className="h-4 w-4" /> Dead events</span><span className={cn('font-semibold', integ.outboxDead ? 'text-danger-700' : 'text-ink')}>{integ.outboxDead}</span></div>
                {integ.outboxDead > 0 ? <Alert tone="danger">Some events stopped retrying. Review and retry them.</Alert> : <Alert tone="success">No dead events.</Alert>}
              </div>
            ) : <p className="text-sm text-ink-subtle">-</p>}
          </Card>
        )}

        {!team && can('properties.approve') && (
          <Card className="xl:col-span-3">
            <CardHeader title="Oldest in the approval queue" description="Listings waiting longest for a decision." action={<Badge tone="neutral" icon={Timer}>SLA 24 h</Badge>} />
            {queue.data && queue.data.items.length === 0 ? (
              <EmptyState icon={ClipboardCheck} title="Queue is clear" description="No listings are waiting for approval." className="border-0 py-8" />
            ) : (
              <Table loading={queue.isLoading} rows={(queue.data && queue.data.items) || []} columns={[
                { key: 'title', header: 'Listing', render: (r) => <Link to={`/admin/approvals/${r._id}`} className="hover:underline"><span className="block max-w-xs truncate font-medium text-ink">{r.title}</span><span className="text-xs text-ink-subtle">{r.listingNo} · {r.location && r.location.city}</span></Link> },
                { key: 'lister', header: 'Lister', render: (r) => (r.listerId ? <span className="text-ink-muted">{r.listerId.name} <span className="text-xs">({titleCase(r.listerId.listerType)})</span></span> : '-') },
                { key: 'submittedAt', header: 'Waiting', render: (r) => timeAgo(r.submittedAt) },
                { key: 'sla', header: 'SLA', render: (r) => { const [tone, label] = SLA[(r.sla && r.sla.level) || 'green']; return <Badge tone={tone}>{label}</Badge>; } },
              ]} />
            )}
          </Card>
        )}
      </div>
    </>
  );
}
