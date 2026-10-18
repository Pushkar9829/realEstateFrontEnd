// RE-S-LIS-01 lister dashboard (GET /api/lister/dashboard): counters, listings
// by status, expiring soon, badges, open leads, upcoming visits, offers waiting
// for an answer and invoices outstanding. KYC status and the onboarding
// checklist stay from phase F1. Buyers appear only as "Buyer N".
import { Link } from 'react-router-dom';
import {
  Activity, BadgeCheck, CalendarClock, CalendarDays, Camera, CheckCircle2, Circle, Clock, Eye, Handshake, Heart, Home, IndianRupee,
  MessageCircle, MessageSquare, Plus, Building2, ShieldCheck, Smartphone, TriangleAlert, Users,
} from 'lucide-react';
import { Alert, Badge, Button, Card, CardHeader, EmptyState, PageHeader, Skeleton } from '@/shared/ui';
import { date, dateTime, rupees, timeAgo, titleCase } from '@/shared/lib/format';
import { cn } from '@/shared/lib/cn';
import { useAuth } from '@/modules/auth';
import { LISTING_STATUS } from '@/modules/listings/api';
import { kycStatus, useOwnKyc } from '@/modules/kyc/api';
import { useOwnProjectCount } from '@/modules/projects/api';
import { useListerDashboard } from '@/modules/reports/listerApi';
import PostPropertyButton from '../../components/PostPropertyButton';
import { lastRound, timeLeft, useListerActivity, useListerOffers, useListerVisits, visitStatus } from '@/modules/leads/listerApi';
import { useT } from '@/shared/i18n';

const STATUS_ORDER = ['live', 'pending_approval', 'changes_requested', 'draft', 'paused', 'expired', 'inactive', 'rejected', 'suspended', 'sold', 'rented'];

function Counter({ label, value, icon: Icon, tone, to, hint, loading }) {
  return (
    <Link to={to} className="group block rounded-lg border bg-white p-5 shadow-sm transition hover:border-brand-300 hover:shadow-md">
      <div className="flex items-center justify-between">
        <span className="text-sm text-ink-subtle">{label}</span>
        <span className={cn('rounded-md p-2', tone)}><Icon className="h-4 w-4" aria-hidden /></span>
      </div>
      {loading ? <Skeleton className="mt-2 h-8 w-16" /> : <p className="mt-2 text-3xl font-semibold text-ink">{value}</p>}
      {hint && <p className="mt-0.5 text-xs text-ink-subtle">{hint}</p>}
    </Link>
  );
}

function ListingsByStatus({ d }) {
  const t = useT();
  const by = d.listings.byStatus || {};
  const keys = STATUS_ORDER.filter((k) => by[k]).concat(Object.keys(by).filter((k) => !STATUS_ORDER.includes(k)));
  if (!keys.length) return <EmptyState icon={Home} className="border-0 py-6" title={t('lister.dashboard.noListings')} action={<PostPropertyButton />} />;
  const max = Math.max(...keys.map((k) => by[k]));
  return (
    <ul className="space-y-2">
      {keys.map((k) => {
        const s = LISTING_STATUS[k] || { label: titleCase(k), tone: 'neutral' };
        return (
          <li key={k} className="grid grid-cols-[9rem_1fr_2.5rem] items-center gap-3 text-sm">
            <Badge tone={s.tone} className="justify-self-start">{s.label}</Badge>
            <span className="h-2 overflow-hidden rounded-full bg-surface-sunken"><span className="block h-full rounded-full bg-brand-500" style={{ width: `${(by[k] / max) * 100}%` }} /></span>
            <span className="text-right font-medium text-ink">{by[k]}</span>
          </li>
        );
      })}
    </ul>
  );
}

function OffersCard() {
  const t = useT();
  const q = useListerOffers({ status: 'awaiting_lister' });
  const rows = (q.data || []).slice(0, 4);
  return (
    <Card>
      <CardHeader title={t('lister.dashboard.offersAwaiting')} action={<Button variant="link" to="/lister/offers">{t('lister.dashboard.allOffers')}</Button>} />
      {q.isLoading ? <Skeleton className="h-20" /> : rows.length === 0 ? <p className="text-sm text-ink-subtle">{t('lister.dashboard.noOffers')}</p> : (
        <ul className="divide-y">
          {rows.map((o) => {
            const r = lastRound(o);
            const left = timeLeft(o.validUntil);
            return (
              <li key={o.id}>
                <Link to={`/lister/offers/${o.id}`} className="flex items-center justify-between gap-3 py-2.5 hover:text-brand-700">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-ink">{rupees(r && r.amount)} · {o.buyer}</span>
                    <span className="block truncate text-xs text-ink-subtle">{o.property && o.property.listingNo} · {o.offerNo}</span>
                  </span>
                  {left && <Badge tone={left === 'expired' ? 'danger' : 'warning'} icon={Clock}>{left === 'expired' ? t('lister.offers.expired') : left}</Badge>}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function VisitsCard() {
  const t = useT();
  const q = useListerVisits({ upcoming: 'true' });
  const week = Date.now() + 7 * 86400000;
  const rows = ((q.data && q.data.items) || []).filter((v) => new Date(v.scheduledAt).getTime() < week).sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt)).slice(0, 5);
  return (
    <Card>
      <CardHeader title={t('lister.dashboard.visitsWeek')} action={<Button variant="link" to="/lister/visits">{t('lister.dashboard.allVisits')}</Button>} />
      {q.isLoading ? <Skeleton className="h-20" /> : rows.length === 0 ? <p className="text-sm text-ink-subtle">{t('lister.dashboard.noVisits')}</p> : (
        <ul className="divide-y">
          {rows.map((v) => {
            const s = visitStatus(v.status);
            return (
              <li key={v.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="min-w-0"><span className="block font-medium text-ink">{dateTime(v.scheduledAt)}</span><span className="block truncate text-xs text-ink-subtle">{v.buyer} · {v.property && v.property.listingNo}</span></span>
                <Badge tone={s.tone}>{s.label}</Badge>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function ActivityCard() {
  const t = useT();
  const q = useListerActivity();
  const rows = (q.data || []).slice(0, 5);
  return (
    <Card>
      <CardHeader title={t('lister.dashboard.activity')} description={t('lister.dashboard.activityDesc')} action={<Button variant="link" to="/lister/leads">{t('panel.nav.listerLeads')}</Button>} />
      {q.isLoading ? <Skeleton className="h-24" /> : rows.length === 0 ? <p className="text-sm text-ink-subtle">{t('lister.dashboard.noActivity')}</p> : (
        <ul className="space-y-3">
          {rows.map((u) => (
            <li key={u.id} className="flex gap-3 text-sm">
              <Activity className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden />
              <span className="min-w-0">
                <span className="block text-ink">{u.text}</span>
                <span className="block text-xs text-ink-subtle">{u.buyer} · {u.property && u.property.listingNo} · {timeAgo(u.createdAt)}{!u.response && ` · ${t('lister.dashboard.awaitingReply')}`}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export default function DashboardPage() {
  const t = useT();
  const { user } = useAuth();
  const isBuilder = user.listerType === 'builder';
  const kycQ = useOwnKyc();
  const kyc = (kycQ.data && kycQ.data.kyc && kycQ.data.kyc.status) || (user.kyc && user.kyc.status) || 'not_started';
  const ks = kycStatus(kyc);
  const projects = useOwnProjectCount(isBuilder);
  const { data: d, isLoading, isError, refetch } = useListerDashboard();
  const by = (d && d.listings.byStatus) || {};
  const live = by.live || 0;
  const photoMissing = d ? Math.max(0, live - d.badges.photoVerified) : 0;

  const steps = [
    { done: user.emailVerified && (user.phoneVerified || !String(user.phone).startsWith('+91')), label: t('lister.dashboard.steps.verifyContact'), icon: Smartphone },
    { done: kyc === 'verified', label: t('lister.dashboard.steps.kyc'), icon: ShieldCheck, to: '/lister/verification' },
    { done: (d && d.listings.total > 0) || (projects.data || 0) > 0, label: isBuilder ? t('lister.dashboard.steps.firstProject') : t('lister.dashboard.steps.firstProperty'), icon: Home, to: isBuilder ? '/lister/projects' : '/lister/listings' },
    { done: Boolean(d && (live > 0 || by.pending_approval > 0)), label: t('lister.dashboard.steps.submit'), icon: BadgeCheck, to: '/lister/listings' },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const pct = Math.round((doneCount / steps.length) * 100);

  return (
    <>
      <PageHeader
        title={t('lister.dashboard.welcome', { name: user.name.split(' ')[0] })}
        description={<span className="inline-flex flex-wrap items-center gap-2">{t('lister.dashboard.accountType', { type: user.listerType ? t(`lister.common.listerType.${user.listerType}`) : titleCase(user.listerType) })} <Badge tone={ks.tone}>{t('lister.dashboard.kycBadge', { status: ks.label })}</Badge>{user.brand && user.brand.name && <Badge tone="brand">{user.brand.name}</Badge>}</span>}
        actions={<>
          {isBuilder && <Button variant="secondary" icon={Building2} to="/lister/projects">{t('lister.dashboard.newProject')}</Button>}
          <PostPropertyButton />
        </>}
      />

      {isError && <Alert tone="danger" className="mb-6" title={t('lister.dashboard.loadError')} action={<Button size="sm" variant="secondary" onClick={() => refetch()}>{t('common.retry')}</Button>} />}

      {kyc !== 'verified' && (
        <Link to="/lister/verification" className="mb-4 flex items-center gap-3 rounded-lg border border-info-100 bg-info-50 p-4 text-sm text-info-700 hover:border-info-600">
          <ShieldCheck className="h-5 w-5 shrink-0" aria-hidden />
          <span className="flex-1"><strong>{t('lister.dashboard.kycTitle', { status: ks.label })}</strong> {t('lister.dashboard.kycText')}</span>
          <span className="font-semibold">{t('lister.common.open')}</span>
        </Link>
      )}
      {(by.changes_requested || 0) > 0 && (
        <Link to="/lister/listings" className="mb-4 flex items-center gap-3 rounded-lg border border-warning-100 bg-warning-50 p-4 text-sm text-warning-700 hover:border-warning-600">
          <TriangleAlert className="h-5 w-5 shrink-0" aria-hidden />
          <span className="flex-1"><strong>{t('lister.dashboard.changesCount', { count: by.changes_requested })}</strong> {t('lister.dashboard.changesText')}</span>
          <span className="font-semibold">{t('lister.common.review')}</span>
        </Link>
      )}
      {d && d.invoices && d.invoices.overdue > 0 && (
        <Link to="/lister/invoices" className="mb-4 flex items-center gap-3 rounded-lg border border-danger-100 bg-danger-50 p-4 text-sm text-danger-700 hover:border-danger-600">
          <IndianRupee className="h-5 w-5 shrink-0" aria-hidden />
          <span className="flex-1"><strong>{t('lister.dashboard.overdueCount', { count: d.invoices.overdue })}</strong> {t('lister.dashboard.overdueText')}</span>
          <span className="font-semibold">{t('panel.nav.listerInvoices')}</span>
        </Link>
      )}

      <div className="mt-2 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Counter loading={isLoading} label={t('lister.dashboard.liveListings')} value={live} hint={d ? t('lister.dashboard.inTotal', { n: d.listings.total }) : undefined} icon={Home} tone="bg-success-50 text-success-700" to="/lister/listings" />
        <Counter loading={isLoading} label={t('lister.dashboard.openLeads')} value={d ? d.leads.open : 0} icon={Users} tone="bg-brand-50 text-brand-700" to="/lister/leads" />
        <Counter loading={isLoading} label={t('lister.dashboard.upcomingVisits')} value={d ? d.visits.upcoming : 0} icon={CalendarDays} tone="bg-info-50 text-info-700" to="/lister/visits" />
        <Counter loading={isLoading} label={t('lister.dashboard.offersAwaiting')} value={d ? d.offers.awaitingYou : 0} icon={Handshake} tone="bg-warning-50 text-warning-700" to="/lister/offers" />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Counter loading={isLoading} label={t('lister.dashboard.views')} value={d ? d.totals.views : 0} icon={Eye} tone="bg-surface-sunken text-ink-muted" to="/lister/listings" />
        <Counter loading={isLoading} label={t('lister.dashboard.shortlists')} value={d ? d.totals.shortlists : 0} icon={Heart} tone="bg-surface-sunken text-ink-muted" to="/lister/listings" />
        <Counter loading={isLoading} label={t('lister.dashboard.enquiries')} value={d ? d.totals.enquiries : 0} icon={MessageSquare} tone="bg-surface-sunken text-ink-muted" to="/lister/leads" />
        <Counter loading={isLoading} label={t('lister.dashboard.whatsappClicks')} value={d ? d.totals.whatsappClicks : 0} icon={MessageCircle} tone="bg-surface-sunken text-ink-muted" to="/lister/listings" />
        <Counter loading={isLoading} label={t('lister.dashboard.invoicesOutstanding')} value={d && d.invoices ? rupees(d.invoices.outstanding || 0) : '-'} icon={IndianRupee} tone="bg-danger-50 text-danger-700" to="/lister/invoices" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="grid gap-6 md:grid-cols-2">
            <OffersCard />
            <VisitsCard />
          </div>
          <Card>
            <CardHeader title={t('lister.dashboard.byStatus')} action={<Button variant="link" to="/lister/listings">{t('panel.nav.listerListings')}</Button>} />
            {isLoading ? <Skeleton className="h-32" /> : d && <ListingsByStatus d={d} />}
          </Card>
          <ActivityCard />
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title={t('lister.dashboard.expiring')} description={t('lister.dashboard.expiringDesc')} />
            {isLoading ? <Skeleton className="h-16" /> : !d || d.listings.expiringSoon.length === 0 ? <p className="text-sm text-ink-subtle">{t('lister.dashboard.noExpiring')}</p> : (
              <ul className="space-y-2">
                {d.listings.expiringSoon.map((p) => (
                  <li key={p._id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0"><span className="block truncate font-medium text-ink">{p.title}</span><span className="text-xs text-ink-subtle">{p.listingNo}</span></span>
                    <Badge tone="warning" icon={CalendarClock}>{date(p.expiresAt)}</Badge>
                  </li>
                ))}
                <li><Button size="sm" variant="secondary" to="/lister/listings">{t('lister.dashboard.renew')}</Button></li>
              </ul>
            )}
          </Card>
          <Card>
            <CardHeader title={t('lister.dashboard.badges')} />
            {isLoading ? <Skeleton className="h-16" /> : d && (
              <>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between"><dt className="inline-flex items-center gap-2 text-ink-subtle"><Camera className="h-4 w-4" />{t('lister.common.photoVerified')}</dt><dd className="font-medium text-ink">{d.badges.photoVerified}</dd></div>
                  <div className="flex justify-between"><dt className="inline-flex items-center gap-2 text-ink-subtle"><BadgeCheck className="h-4 w-4" />{t('lister.common.siteVerified')}</dt><dd className="font-medium text-ink">{d.badges.siteVerified}</dd></div>
                </dl>
                {photoMissing > 0 && (
                  <Alert tone="info" className="mt-4" title={t('lister.dashboard.getPhotoBadge')}>
                    {t('lister.dashboard.photoMissing', { count: photoMissing })} {t('lister.dashboard.startPhotoFrom')} <Link className="font-semibold underline" to="/lister/listings">{t('panel.nav.listerListings')}</Link>.
                  </Alert>
                )}
              </>
            )}
          </Card>
          {doneCount < steps.length && <Card>
            <CardHeader title={t('lister.dashboard.ready')} description={t('lister.dashboard.readyDone', { done: doneCount, total: steps.length })} />
            <div className="mb-4 h-2 overflow-hidden rounded-full bg-surface-sunken" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full rounded-full bg-success-600 transition-all" style={{ width: `${pct}%` }} />
            </div>
            <ul className="space-y-3">
              {steps.map((s) => (
                <li key={s.label} className="flex items-start gap-3">
                  {s.done ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success-600" /> : <Circle className="mt-0.5 h-5 w-5 shrink-0 text-line-strong" />}
                  {s.to && !s.done
                    ? <Link to={s.to} className="text-sm font-medium text-brand-700 hover:underline">{s.label}</Link>
                    : <span className={cn('text-sm', s.done ? 'text-ink-subtle line-through' : 'text-ink')}>{s.label}</span>}
                </li>
              ))}
            </ul>
          </Card>}
        </div>
      </div>
    </>
  );
}
