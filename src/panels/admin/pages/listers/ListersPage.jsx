// RE-F-07/08 listers: search, KYC status filter, and per-lister detail with
// suspend / ban / reinstate (listers.manage), listing-limit override and the
// builder brand approval (RE-B-02, listers.verify or listers.manage).
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Ban, BadgeCheck, Flag, PauseCircle, PlayCircle, Search, X } from 'lucide-react';
import { Alert, Badge, Button, Card, CardHeader, Modal, PageHeader, PageSpinner, Pagination, Table, Tabs, Textarea, useToast } from '@/shared/ui';
import { date, dateTime, titleCase } from '@/shared/lib/format';
import { useT } from '@/shared/i18n';
import { useAuth } from '@/modules/auth';
import { FLAG_RULES, kycStatus, useDecideBrand, useListerDetail, useListers, useManualFlag, useSetListerStatus, useSetListingLimit } from '@/modules/kyc/api';

const TABS = (t) => [
  { value: '', label: t('admin.listers.tabs.all') },
  { value: 'verified', label: t('admin.listers.tabs.verified') },
  { value: 'submitted', label: t('admin.listers.tabs.submitted') },
  { value: 'not_started', label: t('admin.listers.tabs.notStarted') },
  { value: 'suspended', label: t('admin.listers.tabs.suspended') },
  { value: 'banned', label: t('admin.listers.tabs.banned') },
];

function ListerList() {
  const t = useT();
  const [kycStatusF, setKyc] = useState('');
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const { data, isLoading } = useListers({ page, limit: 20, sort: '-createdAt', ...(kycStatusF ? { kycStatus: kycStatusF } : {}), ...(query ? { q: query } : {}) });
  return (
    <>
      <PageHeader title={t('admin.listers.title')} description={t('admin.listers.description')} />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <Tabs value={kycStatusF} onChange={(v) => { setKyc(v); setPage(1); }} tabs={TABS(t)} />
        <form onSubmit={(e) => { e.preventDefault(); setQuery(q.trim()); setPage(1); }} className="flex gap-2">
          <input className="h-9 w-56 rounded-md border border-line-strong px-3 text-sm" placeholder={t('admin.listers.searchPlaceholder')} value={q} onChange={(e) => setQ(e.target.value)} aria-label={t('admin.listers.searchLabel')} />
          <Button size="sm" variant="secondary" icon={Search} type="submit">{t('admin.listers.search')}</Button>
        </form>
      </div>
      <Table loading={isLoading} rows={(data && data.items) || []} rowHref={(r) => `/admin/listers/${r._id}`} empty={t('admin.listers.empty')}
        columns={[
          { key: 'name', header: t('admin.listers.col.lister'), render: (r) => <span><span className="block font-medium text-ink">{r.name}</span><span className="text-xs text-ink-subtle">{r.email} · {r.phone}</span></span> },
          { key: 'type', header: t('admin.listers.col.type'), render: (r) => <span>{titleCase(r.listerType)}{r.brand?.name && <span className="block text-xs text-ink-subtle">{r.brand.name}</span>}{r.brand?.pending?.name && <Badge tone="warning" className="mt-0.5">{t('admin.listers.brandPending')}</Badge>}</span> },
          { key: 'kyc', header: 'KYC', render: (r) => { const s = kycStatus(r.kyc?.status); return <Badge tone={s.tone}>{s.label}</Badge>; } },
          { key: 'limit', header: t('admin.listers.col.limit'), render: (r) => (r.listingLimit != null ? r.listingLimit : '-') },
          { key: 'joined', header: t('admin.listers.col.joined'), render: (r) => date(r.createdAt) },
        ]} />
      {data && <Pagination page={data.meta.page} pages={data.meta.pages} onChange={setPage} />}
    </>
  );
}

// RE-B-02: the brand shows publicly as "Verified Builder · <brand>" only once approved.
function BrandCard({ id, brand, canDecide }) {
  const t = useT();
  const toast = useToast();
  const decide = useDecideBrand();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const target = brand.pending || (brand.name && !brand.approved ? brand : null);
  const run = async (body, msg) => {
    try { await decide.mutateAsync({ id, body }); toast.success(msg); setRejecting(false); setReason(''); } catch (e) { toast.error(e.message); }
  };
  return (
    <Card className="lg:col-span-3">
      <CardHeader title={t('admin.listers.brand.title')} description={t('admin.listers.brand.publicBadge', { label: brand.publicLabel })}
        action={target ? <Badge tone="warning">{t('admin.listers.brand.awaiting')}</Badge> : brand.approved ? <Badge tone="success" icon={BadgeCheck}>{t('admin.listers.brand.approved')}</Badge> : null} />
      <div className="flex flex-wrap items-start gap-6 text-sm">
        <div className="flex items-center gap-3">
          {brand.logoUrl ? <img src={brand.logoUrl} alt="" className="h-12 w-12 rounded border object-contain" /> : null}
          <div><p className="text-ink-subtle">{t('admin.listers.brand.current')}</p><p className="font-medium text-ink">{brand.name || t('admin.listers.brand.none')}{brand.name && !brand.approved ? ` ${t('admin.listers.brand.notApproved')}` : ''}</p></div>
        </div>
        {brand.pending && (
          <div className="flex items-center gap-3">
            {brand.pending.logoUrl ? <img src={brand.pending.logoUrl} alt="" className="h-12 w-12 rounded border object-contain" /> : null}
            <div><p className="text-ink-subtle">{t('admin.listers.brand.requested', { date: date(brand.pending.requestedAt) })}</p><p className="font-medium text-ink">{brand.pending.name}</p></div>
          </div>
        )}
        {brand.rejectReason && !target && <p className="text-ink-subtle">{t('admin.listers.brand.lastRejected', { reason: brand.rejectReason })}</p>}
      </div>
      {target && canDecide && (
        <div className="mt-4 flex flex-wrap gap-2 border-t pt-4">
          <Button size="sm" icon={BadgeCheck} loading={decide.isPending && !rejecting} onClick={() => run({ decision: 'approve' }, t('admin.listers.brand.approvedToast'))}>{t('admin.listers.brand.approve', { name: target.name })}</Button>
          <Button size="sm" variant="secondary" icon={X} onClick={() => setRejecting(true)}>{t('admin.listers.reject')}</Button>
        </div>
      )}
      <Modal open={rejecting} onClose={() => setRejecting(false)} size="sm" title={t('admin.listers.brand.rejectTitle')} description={t('admin.listers.brand.rejectDesc')}
        footer={<><Button variant="ghost" onClick={() => setRejecting(false)}>{t('common.cancel')}</Button><Button variant="danger" disabled={reason.trim().length < 3} loading={decide.isPending} onClick={() => run({ decision: 'reject', reason: reason.trim() }, t('admin.listers.brand.rejectedToast'))}>{t('admin.listers.reject')}</Button></>}>
        <Textarea label={t('admin.listers.reason')} rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
      </Modal>
    </Card>
  );
}

function ListerDetail({ id }) {
  const t = useT();
  const toast = useToast();
  const { hasPermission } = useAuth();
  const { data, isLoading, error } = useListerDetail(id);
  const setStatus = useSetListerStatus();
  const setLimit = useSetListingLimit();
  const flag = useManualFlag();
  const [dialog, setDialog] = useState(null);
  const [text, setText] = useState('');
  const [limit, setLimitVal] = useState('');
  if (isLoading) return <PageSpinner />;
  if (error) return <Alert tone="danger">{error.message}</Alert>;
  const { user, kyc, listings, flags, listingLimit, brand } = data;
  const s = kycStatus(kyc.status);
  const manage = hasPermission('listers.manage');
  const act = async (fn, msg) => { try { await fn(); toast.success(msg); setDialog(null); setText(''); } catch (e) { toast.error(e.message); } };
  const D = (k) => t(`admin.listers.dialog.${dialog}.${k}`);
  const statusDialog = ['suspend', 'ban', 'reinstate'].includes(dialog);

  return (
    <>
      <Link to="/admin/listers" className="mb-3 inline-flex items-center gap-1 text-sm text-brand-700 hover:underline"><ArrowLeft className="h-4 w-4" /> {t('admin.listers.title')}</Link>
      <PageHeader title={user.name} description={t('admin.listers.meta', { type: titleCase(user.listerType), email: user.email, phone: user.phone, date: date(user.createdAt) })}
        actions={<>
          <Badge tone={s.tone}>{s.label}</Badge>
          {manage && kyc.status === 'verified' && <Button variant="secondary" icon={PauseCircle} onClick={() => setDialog('suspend')}>{t('admin.listers.suspend')}</Button>}
          {manage && kyc.status === 'suspended' && <Button variant="secondary" icon={PlayCircle} onClick={() => setDialog('reinstate')}>{t('admin.listers.reinstate')}</Button>}
          {manage && kyc.status !== 'banned' && <Button variant="danger" icon={Ban} onClick={() => setDialog('ban')}>{t('admin.listers.ban')}</Button>}
        </>} />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader title={t('admin.listers.listings')} />
          <ul className="space-y-1 text-sm">{(listings || []).length ? listings.map((l) => <li key={l._id} className="flex justify-between"><span>{titleCase(l._id)}</span><span className="font-semibold">{l.n}</span></li>) : <li className="text-ink-subtle">{t('admin.listers.noListings')}</li>}</ul>
          <div className="mt-4 border-t pt-4 text-sm">
            <p className="text-ink-subtle">{t('admin.listers.activeLimit')} <strong className="text-ink">{listingLimit == null ? t('admin.listers.unlimited') : listingLimit}</strong></p>
            {manage && (
              <div className="mt-2 flex gap-2">
                <input className="h-9 w-24 rounded-md border border-line-strong px-2 text-sm" type="number" min={0} placeholder={t('admin.listers.limitNew')} value={limit} onChange={(e) => setLimitVal(e.target.value)} aria-label={t('admin.listers.limitLabel')} />
                <Button size="sm" variant="secondary" disabled={limit === ''} onClick={() => act(() => setLimit.mutateAsync({ id, body: { listingLimit: Number(limit) } }), t('admin.listers.limitUpdated'))}>{t('admin.listers.limitSet')}</Button>
                <Button size="sm" variant="ghost" onClick={() => act(() => setLimit.mutateAsync({ id, body: { listingLimit: null } }), t('admin.listers.limitDefaultToast'))}>{t('admin.listers.limitDefault')}</Button>
              </div>
            )}
          </div>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title={t('admin.listers.brokerFlags')} action={manage ? <Button size="sm" variant="secondary" icon={Flag} onClick={() => setDialog('flag')}>{t('admin.listers.raiseFlag')}</Button> : null} />
          {(flags || []).length ? (
            <ul className="divide-y">{flags.map((f) => (
              <li key={f._id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span><strong>{f.flagNo}</strong> · {FLAG_RULES[f.rule] || f.rule}</span>
                <span className="flex items-center gap-2"><Badge tone={f.status === 'resolved' ? 'neutral' : 'warning'}>{f.status === 'resolved' ? titleCase(f.resolution) : titleCase(f.status)}</Badge><span className="text-xs text-ink-subtle">{dateTime(f.createdAt)}</span></span>
              </li>
            ))}</ul>
          ) : <p className="text-sm text-ink-subtle">{t('admin.listers.noFlags')}</p>}
          {kyc.autoChecks?.length > 0 && <Alert tone="warning" className="mt-4">{t('admin.listers.autoChecks', { codes: kyc.autoChecks.map((c) => c.code).join(', ') })}</Alert>}
        </Card>
        {brand && <BrandCard id={id} brand={brand} canDecide={manage || hasPermission('listers.verify')} />}
      </div>

      <Modal open={statusDialog} onClose={() => setDialog(null)} size="sm"
        title={statusDialog ? D('title') : undefined}
        description={statusDialog ? D('desc') : undefined}
        footer={<><Button variant="ghost" onClick={() => setDialog(null)}>{t('common.cancel')}</Button><Button variant={dialog === 'reinstate' ? 'primary' : 'danger'} disabled={text.trim().length < 3} loading={setStatus.isPending}
          onClick={() => act(() => setStatus.mutateAsync({ id, body: { action: dialog, reason: text.trim() } }), D('toast'))}>{t('common.confirm')}</Button></>}>
        <Textarea label={t('admin.listers.reason')} rows={3} value={text} onChange={(e) => setText(e.target.value)} />
      </Modal>
      <Modal open={dialog === 'flag'} onClose={() => setDialog(null)} size="sm" title={t('admin.listers.flagDialog.title')} description={t('admin.listers.flagDialog.desc')}
        footer={<><Button variant="ghost" onClick={() => setDialog(null)}>{t('common.cancel')}</Button><Button disabled={text.trim().length < 5} loading={flag.isPending} onClick={() => act(() => flag.mutateAsync({ listerId: id, note: text.trim() }), t('admin.listers.flagDialog.toast'))}>{t('admin.listers.raiseFlag')}</Button></>}>
        <Textarea label={t('admin.listers.flagDialog.label')} rows={3} value={text} onChange={(e) => setText(e.target.value)} />
      </Modal>
    </>
  );
}

export default function ListersPage() {
  const { id } = useParams();
  return id ? <ListerDetail id={id} /> : <ListerList />;
}
