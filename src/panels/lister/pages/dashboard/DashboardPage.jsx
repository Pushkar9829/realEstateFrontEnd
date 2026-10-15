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
import { lastRound, timeLeft, useListerActivity, useListerOffers, useListerVisits, visitStatus } from '@/modules/leads/listerApi';

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
  const by = d.listings.byStatus || {};
  const keys = STATUS_ORDER.filter((k) => by[k]).concat(Object.keys(by).filter((k) => !STATUS_ORDER.includes(k)));
  if (!keys.length) return <EmptyState icon={Home} className="border-0 py-6" title="No listings yet" action={<Button icon={Plus} to="/lister/listings">Post a property</Button>} />;
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
  const q = useListerOffers({ status: 'awaiting_lister' });
  const rows = (q.data || []).slice(0, 4);
  return (
    <Card>
      <CardHeader title="Offers awaiting you" action={<Button variant="link" to="/lister/offers">All offers</Button>} />
      {q.isLoading ? <Skeleton className="h-20" /> : rows.length === 0 ? <p className="text-sm text-ink-subtle">No offers waiting for your answer.</p> : (
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
                  {left && <Badge tone={left === 'expired' ? 'danger' : 'warning'} icon={Clock}>{left}</Badge>}
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
  const q = useListerVisits({ upcoming: 'true' });
  const week = Date.now() + 7 * 86400000;
  const rows = ((q.data && q.data.items) || []).filter((v) => new Date(v.scheduledAt).getTime() < week).sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt)).slice(0, 5);
  return (
    <Card>
      <CardHeader title="Visits this week" action={<Button variant="link" to="/lister/visits">All visits</Button>} />
      {q.isLoading ? <Skeleton className="h-20" /> : rows.length === 0 ? <p className="text-sm text-ink-subtle">No visits in the next 7 days.</p> : (
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
  const q = useListerActivity();
  const rows = (q.data || []).slice(0, 5);
  return (
    <Card>
      <CardHeader title="Recent activity" description="Updates shared by our agents" action={<Button variant="link" to="/lister/leads">Leads and visits</Button>} />
      {q.isLoading ? <Skeleton className="h-24" /> : rows.length === 0 ? <p className="text-sm text-ink-subtle">No activity yet.</p> : (
        <ul className="space-y-3">
          {rows.map((u) => (
            <li key={u.id} className="flex gap-3 text-sm">
              <Activity className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden />
              <span className="min-w-0">
                <span className="block text-ink">{u.text}</span>
                <span className="block text-xs text-ink-subtle">{u.buyer} · {u.property && u.property.listingNo} · {timeAgo(u.createdAt)}{!u.response && ' · awaiting your reply'}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export default function DashboardPage() {
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
    { done: user.emailVerified && (user.phoneVerified || !String(user.phone).startsWith('+91')), label: 'Verify your email and mobile', icon: Smartphone },
    { done: kyc === 'verified', label: 'Complete verification (KYC) and the no-broker declaration', icon: ShieldCheck, to: '/lister/verification' },
    { done: (d && d.listings.total > 0) || (projects.data || 0) > 0, label: isBuilder ? 'Create your first project or listing' : 'Post your first property', icon: Home, to: isBuilder ? '/lister/projects' : '/lister/listings' },
    { done: Boolean(d && (live > 0 || by.pending_approval > 0)), label: 'Accept commission terms and submit for review', icon: BadgeCheck, to: '/lister/listings' },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const pct = Math.round((doneCount / steps.length) * 100);

  return (
    <>
      <PageHeader
        title={`Welcome, ${user.name.split(' ')[0]}`}
        description={<span className="inline-flex flex-wrap items-center gap-2">{titleCase(user.listerType)} account <Badge tone={ks.tone}>KYC: {ks.label}</Badge>{user.brand && user.brand.name && <Badge tone="brand">{user.brand.name}</Badge>}</span>}
        actions={<>
          {isBuilder && <Button variant="secondary" icon={Building2} to="/lister/projects">New project</Button>}
          <Button icon={Plus} to="/lister/listings">Post a property</Button>
        </>}
      />

      {isError && <Alert tone="danger" className="mb-6" title="Could not load your dashboard" action={<Button size="sm" variant="secondary" onClick={() => refetch()}>Retry</Button>} />}

      {kyc !== 'verified' && (
        <Link to="/lister/verification" className="mb-4 flex items-center gap-3 rounded-lg border border-info-100 bg-info-50 p-4 text-sm text-info-700 hover:border-info-600">
          <ShieldCheck className="h-5 w-5 shrink-0" aria-hidden />
          <span className="flex-1"><strong>Verification (KYC): {ks.label}.</strong> You can draft and submit listings now; they go live only after KYC is verified.</span>
          <span className="font-semibold">Open</span>
        </Link>
      )}
      {(by.changes_requested || 0) > 0 && (
        <Link to="/lister/listings" className="mb-4 flex items-center gap-3 rounded-lg border border-warning-100 bg-warning-50 p-4 text-sm text-warning-700 hover:border-warning-600">
          <TriangleAlert className="h-5 w-5 shrink-0" aria-hidden />
          <span className="flex-1"><strong>{by.changes_requested} listing{by.changes_requested > 1 ? 's need' : ' needs'} changes</strong> requested by our review team.</span>
          <span className="font-semibold">Review</span>
        </Link>
      )}
      {d && d.invoices && d.invoices.overdue > 0 && (
        <Link to="/lister/invoices" className="mb-4 flex items-center gap-3 rounded-lg border border-danger-100 bg-danger-50 p-4 text-sm text-danger-700 hover:border-danger-600">
          <IndianRupee className="h-5 w-5 shrink-0" aria-hidden />
          <span className="flex-1"><strong>{d.invoices.overdue} invoice{d.invoices.overdue > 1 ? 's are' : ' is'} overdue.</strong> Pay and upload the proof, or raise a dispute.</span>
          <span className="font-semibold">Invoices</span>
        </Link>
      )}

      <div className="mt-2 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Counter loading={isLoading} label="Live listings" value={live} hint={d ? `${d.listings.total} in total` : undefined} icon={Home} tone="bg-success-50 text-success-700" to="/lister/listings" />
        <Counter loading={isLoading} label="Open leads" value={d ? d.leads.open : 0} icon={Users} tone="bg-brand-50 text-brand-700" to="/lister/leads" />
        <Counter loading={isLoading} label="Upcoming visits" value={d ? d.visits.upcoming : 0} icon={CalendarDays} tone="bg-info-50 text-info-700" to="/lister/visits" />
        <Counter loading={isLoading} label="Offers awaiting you" value={d ? d.offers.awaitingYou : 0} icon={Handshake} tone="bg-warning-50 text-warning-700" to="/lister/offers" />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Counter loading={isLoading} label="Views" value={d ? d.totals.views : 0} icon={Eye} tone="bg-surface-sunken text-ink-muted" to="/lister/listings" />
        <Counter loading={isLoading} label="Shortlists" value={d ? d.totals.shortlists : 0} icon={Heart} tone="bg-surface-sunken text-ink-muted" to="/lister/listings" />
        <Counter loading={isLoading} label="Enquiries" value={d ? d.totals.enquiries : 0} icon={MessageSquare} tone="bg-surface-sunken text-ink-muted" to="/lister/leads" />
        <Counter loading={isLoading} label="WhatsApp clicks" value={d ? d.totals.whatsappClicks : 0} icon={MessageCircle} tone="bg-surface-sunken text-ink-muted" to="/lister/listings" />
        <Counter loading={isLoading} label="Invoices outstanding" value={d && d.invoices ? rupees(d.invoices.outstanding || 0) : '-'} icon={IndianRupee} tone="bg-danger-50 text-danger-700" to="/lister/invoices" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="grid gap-6 md:grid-cols-2">
            <OffersCard />
            <VisitsCard />
          </div>
          <Card>
            <CardHeader title="Listings by status" action={<Button variant="link" to="/lister/listings">My listings</Button>} />
            {isLoading ? <Skeleton className="h-32" /> : d && <ListingsByStatus d={d} />}
          </Card>
          <ActivityCard />
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Expiring soon" description="Live listings expiring in the next 7 days" />
            {isLoading ? <Skeleton className="h-16" /> : !d || d.listings.expiringSoon.length === 0 ? <p className="text-sm text-ink-subtle">Nothing expiring this week.</p> : (
              <ul className="space-y-2">
                {d.listings.expiringSoon.map((p) => (
                  <li key={p._id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0"><span className="block truncate font-medium text-ink">{p.title}</span><span className="text-xs text-ink-subtle">{p.listingNo}</span></span>
                    <Badge tone="warning" icon={CalendarClock}>{date(p.expiresAt)}</Badge>
                  </li>
                ))}
                <li><Button size="sm" variant="secondary" to="/lister/listings">Renew from My listings</Button></li>
              </ul>
            )}
          </Card>
          <Card>
            <CardHeader title="Badges" />
            {isLoading ? <Skeleton className="h-16" /> : d && (
              <>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between"><dt className="inline-flex items-center gap-2 text-ink-subtle"><Camera className="h-4 w-4" />Photo verified</dt><dd className="font-medium text-ink">{d.badges.photoVerified}</dd></div>
                  <div className="flex justify-between"><dt className="inline-flex items-center gap-2 text-ink-subtle"><BadgeCheck className="h-4 w-4" />Site verified</dt><dd className="font-medium text-ink">{d.badges.siteVerified}</dd></div>
                </dl>
                {photoMissing > 0 && (
                  <Alert tone="info" className="mt-4" title="Get the Photo verified badge">
                    {photoMissing} live listing{photoMissing > 1 ? 's' : ''} without it. Start photo verification from <Link className="font-semibold underline" to="/lister/listings">My listings</Link>.
                  </Alert>
                )}
              </>
            )}
          </Card>
          {doneCount < steps.length && <Card>
            <CardHeader title="Get ready to list" description={`${doneCount} of ${steps.length} done`} />
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
