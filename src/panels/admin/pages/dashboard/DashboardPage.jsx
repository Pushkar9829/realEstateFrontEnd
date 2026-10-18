// RE-S-ADM-01 admin dashboard from GET /api/admin/dashboard: lead, visit, deal
// receivable, offer and commission counters (month and financial year),
// overdue invoices, deals past the verification SLA, paused listings, review queues, integration health and a 30-day
// trend from the nightly snapshot. Managers get the team view (lead, visit,
// deal, offer, commission and receivable tiles only). KYC and broker-flag counts and the oldest
// approvals come from their own modules.
import { Link } from 'react-router-dom';
import {
  AlertTriangle, BadgeCheck, Building2, Camera, ChevronRight, CalendarDays, CalendarRange, ClipboardCheck, FileWarning, Flag, Handshake, Hourglass, Inbox, IndianRupee, MessageSquareQuote, PauseCircle, Plug, RefreshCw, ShieldCheck, Timer, UserX, Wallet,
} from 'lucide-react';
import { Alert, Badge, Button, Card, CardHeader, EmptyState, PageHeader, Skeleton, Table } from '@/shared/ui';
import { cn } from '@/shared/lib/cn';
import { date, rupees, timeAgo, titleCase } from '@/shared/lib/format';
import { useAuth } from '@/modules/auth';
import { useApprovalQueue } from '@/modules/listings/api';
import { useBrokerFlagCount, useKycQueueCount } from '@/modules/kyc/api';
import { useAdminDashboard } from '@/modules/reports/adminApi';
import { useT } from '@/shared/i18n';
import { Sparkline } from '../reports/charts';

const SLA_TONE = { green: 'success', amber: 'warning', red: 'danger' };

// A tile that links to its queue says so in words ("Open queue"), not only on
// hover, and an alert is marked with an icon and text, not only red.
function Tile({ label, hint, value, loading, icon: Icon, tone, to, alert, cta }) {
  const t = useT();
  const body = (
    <>
      <span className={cn('rounded-md p-2.5', tone)}><Icon className="h-5 w-5" aria-hidden /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm text-ink-subtle">{label}</span>
        {loading ? <Skeleton className="mt-1 h-8 w-12" /> : (
          <span className={cn('mt-0.5 flex items-center gap-1.5 text-3xl font-semibold', alert ? 'text-danger-700' : 'text-ink')}>
            {value == null ? '-' : value}
            {alert && <><AlertTriangle className="h-5 w-5" aria-hidden /><span className="sr-only">{t('admin.dashboard.needsAttention')}</span></>}
          </span>
        )}
        {hint && <span className="mt-0.5 block text-xs text-ink-subtle">{hint}</span>}
        {to && <span className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-brand-700 group-hover:underline">{cta || t('admin.dashboard.open')}<ChevronRight className="h-4 w-4" aria-hidden /></span>}
      </span>
    </>
  );
  const cls = 'group flex items-start gap-4 rounded-lg border bg-white p-5 shadow-sm transition';
  return to ? <Link to={to} className={cn(cls, 'hover:border-brand-300 hover:shadow-md focus-visible:ring-2 focus-visible:ring-brand-500', alert && 'border-danger-100')}>{body}</Link> : <div className={cls}>{body}</div>;
}

function TileGroup({ title, description, tiles, isLoading }) {
  if (!tiles.length) return null;
  return (
    <section className="mb-6" aria-label={title}>
      <h2 className="text-base font-semibold text-ink">{title}</h2>
      {description && <p className="text-sm text-ink-subtle">{description}</p>}
      <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {tiles.map((x) => <Tile key={x.id} loading={x.loading ?? isLoading} {...x} />)}
      </div>
    </section>
  );
}

function Trend({ label, values, format = (v) => v }) {
  const t = useT();
  const total = values.reduce((a, v) => a + (Number(v) || 0), 0);
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div>
        <p className="text-sm text-ink-subtle">{label}</p>
        <p className="text-lg font-semibold text-ink">{format(total)}</p>
      </div>
      <Sparkline values={values} label={t('admin.dashboard.trendLabel', { label })} />
    </div>
  );
}

export default function DashboardPage() {
  const t = useT();
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

  const T = (k, vars) => t(`admin.dashboard.tiles.${k}`, vars);
  const cta = (k) => t(`admin.dashboard.cta.${k}`);
  const tiles = [
    { id: 'leadsToday', group: 'today', cta: cta('openLeads'), label: T('leadsToday'), value: v(d?.leads.today), icon: Inbox, tone: 'bg-brand-50 text-brand-700', to: can('leads.view_all') ? '/admin/leads' : undefined },
    { id: 'unassigned', group: 'action', cta: cta('assignLeads'), label: T('unassigned'), value: v(d?.leads.unassigned), icon: UserX, tone: 'bg-warning-50 text-warning-700', to: can('leads.assign') ? '/admin/sla' : undefined, alert: d && d.leads.unassigned > 0 },
    { id: 'slaBreached', group: 'action', cta: cta('openLeadQueue'), label: T('slaBreached'), value: v(d?.leads.slaBreached), icon: Timer, tone: 'bg-danger-50 text-danger-700', to: can('leads.assign') ? '/admin/sla' : undefined, alert: d && d.leads.slaBreached > 0 },
    { id: 'visitsToday', group: 'today', cta: cta('openVisits'), label: T('visitsToday'), value: v(d?.visits.today), icon: CalendarDays, tone: 'bg-info-50 text-info-700', to: can('sitevisits.view') ? '/admin/visits' : undefined },
    { id: 'dealsAwaiting', group: 'action', cta: cta('verifyDeals'), label: T('dealsAwaiting'), value: v(d?.deals.awaitingVerification), hint: T('dealsAwaitingHint', { n: (d && d.deals.slaHours) || 72 }), icon: BadgeCheck, tone: 'bg-success-50 text-success-700', to: '/admin/deals' },
    { id: 'dealsBeyondSla', group: 'action', cta: cta('verifyDeals'), label: T('dealsBeyondSla'), value: v(d?.deals.beyondSla), hint: d ? T('dealsBeyondSlaHint', { n: d.deals.slaHours }) : undefined, icon: Hourglass, tone: 'bg-danger-50 text-danger-700', to: '/admin/deals', alert: d && d.deals.beyondSla > 0 },
    { id: 'offersAwaiting', group: 'today', label: T('offersAwaiting'), value: v(d?.offers?.awaitingOwner), hint: T('offersAwaitingHint'), icon: Handshake, tone: 'bg-warning-50 text-warning-700' },
    { id: 'commissionMonth', group: 'business', cta: cta('commissionReport'), label: T('commissionMonth'), value: d && d.commission ? rupees(d.commission.month.commission) : null, hint: d && d.commission ? T('dealsSince', { n: d.commission.month.deals, date: date(d.commission.month.from) }) : undefined, icon: IndianRupee, tone: 'bg-success-50 text-success-700', to: can('reports.view') ? '/admin/reports/commission' : undefined },
    { id: 'commissionFy', group: 'business', cta: cta('commissionReport'), label: T('commissionFy'), value: d && d.commission ? rupees(d.commission.financialYear.commission) : null, hint: d && d.commission ? T('dealsSince', { n: d.commission.financialYear.deals, date: date(d.commission.financialYear.from) }) : undefined, icon: CalendarRange, tone: 'bg-brand-50 text-brand-700', to: can('reports.view') ? '/admin/reports/commission' : undefined },
    { id: 'receivables', group: 'business', cta: cta('openReceivables'), label: T('receivables'), value: d ? rupees(d.receivables.outstanding) : null, hint: d ? T('receivablesHint', { open: d.receivables.open, overdue: d.receivables.overdue }) : undefined, icon: Wallet, tone: 'bg-accent-50 text-accent-700', to: can('receivables.manage') ? '/admin/receivables' : undefined, alert: d && d.receivables.overdue > 0 },
    { id: 'invoicesOverdue', group: 'action', cta: cta('openReceivables'), label: T('invoicesOverdue'), value: v(d?.receivables.invoicesOverdue?.count), hint: d && d.receivables.invoicesOverdue ? T('invoicesOverdueHint', { amount: rupees(d.receivables.invoicesOverdue.amount) }) : undefined, icon: FileWarning, tone: 'bg-danger-50 text-danger-700', to: can('receivables.manage') ? '/admin/receivables' : undefined, alert: d && d.receivables.invoicesOverdue && d.receivables.invoicesOverdue.count > 0 },
    ...(!team ? [
      can('properties.approve') && { id: 'listingsToApprove', group: 'action', cta: cta('openQueue'), label: T('listingsToApprove'), value: v(q.listings), hint: T('decide24'), icon: ClipboardCheck, tone: 'bg-brand-50 text-brand-700', to: '/admin/approvals' },
      can('projects.approve') && { id: 'projectsToApprove', group: 'action', cta: cta('openQueue'), label: T('projectsToApprove'), value: v(q.projects), hint: T('reraRequired'), icon: Building2, tone: 'bg-accent-50 text-accent-700', to: '/admin/projects' },
      can('verification.review') && { id: 'photoVerifications', group: 'action', cta: cta('openQueue'), label: T('photoVerifications'), value: v(q.photoVerification), icon: Camera, tone: 'bg-info-50 text-info-700', to: '/admin/photo-verification' },
      can('properties.manage') && { id: 'pausedListings', group: 'business', cta: cta('openListings'), label: T('pausedListings'), value: v(d?.listings?.paused), hint: T('pausedListingsHint'), icon: PauseCircle, tone: 'bg-surface-sunken text-ink-muted', to: '/admin/listings' },
      can('properties.manage') && { id: 'reportedListings', group: 'action', cta: cta('reviewReports'), label: T('reportedListings'), value: v(q.reportedListings), icon: MessageSquareQuote, tone: 'bg-warning-50 text-warning-700', to: '/admin/feedback' },
      can('listers.verify') && { id: 'kyc', group: 'action', cta: cta('openQueue'), label: T('kyc'), value: kyc.isError ? null : kyc.data, loading: kyc.isLoading, hint: T('decide48'), icon: ShieldCheck, tone: 'bg-info-50 text-info-700', to: '/admin/kyc' },
      can('listers.manage') && { id: 'brokerFlags', group: 'action', cta: cta('reviewFlags'), label: T('brokerFlags'), value: flags.isError ? null : flags.data, loading: flags.isLoading, icon: Flag, tone: 'bg-danger-50 text-danger-700', to: '/admin/trust' },
    ] : []),
  ].filter(Boolean)
    // The financial-year tile repeats the month tile early in the year: show it only when it adds something.
    .filter((x) => !(x.id === 'commissionFy' && d && d.commission && d.commission.financialYear.commission === d.commission.month.commission));
  // "Needs action": alerts first, then the fullest queues; empty queues last.
  const waiting = (x) => (typeof x.value === 'number' ? x.value : 0);
  const action = tiles.filter((x) => x.group === 'action').sort((a, b) => Number(Boolean(b.alert)) - Number(Boolean(a.alert)) || waiting(b) - waiting(a));
  const today = tiles.filter((x) => x.group === 'today');
  const business = tiles.filter((x) => x.group === 'business');
  const sla = (level) => [SLA_TONE[level] || 'success', t(`admin.approvals.sla.${SLA_TONE[level] ? level : 'green'}`)];

  return (
    <>
      <PageHeader title={t('admin.dashboard.title')} description={t('admin.dashboard.welcome', { name: auth.user.name.split(' ')[0] })}
        actions={<>
          <Badge tone={team ? 'info' : 'brand'}>{team ? t('admin.dashboard.teamView') : titleCase(auth.user.role)}</Badge>
          <Button size="sm" variant="ghost" icon={RefreshCw} loading={isFetching} onClick={() => refetch()}>{t('admin.dashboard.refresh')}</Button>
        </>} />
      {error && <Alert tone="danger" className="mb-4" title={t('admin.dashboard.loadError')} action={<Button size="sm" variant="ghost" onClick={() => refetch()}>{t('common.retry')}</Button>}>{error.message}</Alert>}

      <TileGroup title={t('admin.dashboard.groups.action')} description={t('admin.dashboard.groups.actionDesc')} tiles={action} isLoading={isLoading} />
      <TileGroup title={t('admin.dashboard.groups.today')} tiles={today} isLoading={isLoading} />
      <TileGroup title={t('admin.dashboard.groups.business')} description={t('admin.dashboard.groups.businessDesc')} tiles={business} isLoading={isLoading} />

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title={t('admin.dashboard.trend.title')} description={trend.length ? t('admin.dashboard.trend.range', { from: date(trend[0].day), to: date(trend[trend.length - 1].day) }) : t('admin.dashboard.trend.fromSnapshot')} />
          {isLoading ? <Skeleton className="h-40 w-full" /> : trend.length < 2 ? (
            <EmptyState title={t('admin.dashboard.trend.emptyTitle')} description={t('admin.dashboard.trend.emptyText')} className="border-0 py-8" />
          ) : (
            <div className="grid gap-x-8 divide-y sm:grid-cols-2 sm:divide-y-0">
              <Trend label={t('admin.dashboard.trend.leads')} values={trend.map((x) => x.leads)} />
              <Trend label={t('admin.dashboard.trend.visits')} values={trend.map((x) => x.visits)} />
              <Trend label={t('admin.dashboard.trend.deals')} values={trend.map((x) => x.dealsVerified)} />
              <Trend label={t('admin.dashboard.trend.commission')} values={trend.map((x) => x.commission)} format={rupees} />
            </div>
          )}
        </Card>

        {!team && (
          <Card>
            <CardHeader title={t('admin.dashboard.integ.title')} description={t('admin.dashboard.integ.desc')} action={can('integrations.manage') ? <Link className="text-sm text-brand-700 hover:underline" to="/admin/integrations">{t('admin.dashboard.open')}</Link> : null} />
            {isLoading ? <Skeleton className="h-16 w-full" /> : integ ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm"><span className="inline-flex items-center gap-2 text-ink-muted"><Plug className="h-4 w-4" /> {t('admin.dashboard.integ.pending')}</span><span className="font-semibold text-ink">{integ.outboxPending}</span></div>
                <div className="flex items-center justify-between text-sm"><span className="inline-flex items-center gap-2 text-ink-muted"><AlertTriangle className="h-4 w-4" /> {t('admin.dashboard.integ.dead')}</span><span className={cn('font-semibold', integ.outboxDead ? 'text-danger-700' : 'text-ink')}>{integ.outboxDead}</span></div>
                {integ.outboxDead > 0 ? <Alert tone="danger">{t('admin.dashboard.integ.deadAlert')}</Alert> : <Alert tone="success">{t('admin.dashboard.integ.noDead')}</Alert>}
              </div>
            ) : <p className="text-sm text-ink-subtle">-</p>}
          </Card>
        )}

        {!team && can('properties.approve') && (
          <Card className="xl:col-span-3">
            <CardHeader title={t('admin.dashboard.oldest.title')} description={t('admin.dashboard.oldest.desc')} action={<Badge tone="neutral" icon={Timer}>{t('admin.dashboard.oldest.sla')}</Badge>} />
            {queue.data && queue.data.items.length === 0 ? (
              <EmptyState icon={ClipboardCheck} title={t('admin.dashboard.oldest.emptyTitle')} description={t('admin.dashboard.oldest.emptyText')} className="border-0 py-8" />
            ) : (
              <Table loading={queue.isLoading} rows={(queue.data && queue.data.items) || []} rowHref={(r) => `/admin/approvals/${r._id}`} columns={[
                { key: 'title', header: t('admin.dashboard.oldest.colListing'), render: (r) => <span><span className="block max-w-xs truncate">{r.title}</span><span className="text-xs font-normal text-ink-subtle">{r.listingNo} · {r.location && r.location.city}</span></span> },
                { key: 'lister', header: t('admin.dashboard.oldest.colLister'), render: (r) => (r.listerId ? <span className="text-ink-muted">{r.listerId.name} <span className="text-xs">({titleCase(r.listerId.listerType)})</span></span> : '-') },
                { key: 'submittedAt', header: t('admin.dashboard.oldest.colWaiting'), render: (r) => timeAgo(r.submittedAt) },
                { key: 'sla', header: 'SLA', render: (r) => { const [tone, label] = sla(r.sla && r.sla.level); return <Badge tone={tone}>{label}</Badge>; } },
              ]} />
            )}
          </Card>
        )}
      </div>
    </>
  );
}
