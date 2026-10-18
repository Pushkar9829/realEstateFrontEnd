// RE-S-ADM-22 buyers and privacy (users.manage): buyer accounts with a detail
// view (consent ledger, block / unblock, anonymise), the deletion request
// queue with the 30-day due date and decisions (in progress / completed =
// anonymise / rejected, with a note), and a consent lookup by user ID.
import { useState } from 'react';
import { Ban, CheckCircle2, Gavel, Search, ShieldOff, UserX } from 'lucide-react';
import { Alert, Badge, Button, ConfirmModal, Input, Modal, PageHeader, Pagination, Select, Spinner, Table, Tabs, Textarea, useToast } from '@/shared/ui';
import { date, dateTime, titleCase } from '@/shared/lib/format';
import { CONSENT_PURPOSES, DELETION_STATUS, isMissingEndpoint, useAnonymiseBuyer, useBuyer, useBuyers, useDecideDeletion, useDeletionRequests, useSetBuyerStatus, useUserConsents } from '@/modules/auth/adminApi';
import { useT } from '@/shared/i18n';

const OID = /^[a-f0-9]{24}$/i;
const DAY = 86400000;

function Consents({ userId }) {
  const t = useT();
  const { data, isLoading, error } = useUserConsents(userId);
  if (isLoading) return <div className="py-4"><Spinner size="sm" /></div>;
  if (error) return <Alert tone="danger">{error.message}</Alert>;
  if (!data || !data.length) return <p className="text-sm text-ink-subtle">{t('admin.buyers.noConsents')}</p>;
  return (
    <Table rows={data} empty={t('admin.buyers.noConsentsShort')}
      columns={[
        { key: 'purpose', header: t('admin.buyers.consentCol.purpose'), render: (c) => CONSENT_PURPOSES[c.purpose] || titleCase(c.purpose) },
        { key: 'source', header: t('admin.buyers.consentCol.source'), render: (c) => titleCase(c.source || '-') },
        { key: 'notice', header: t('admin.buyers.consentCol.notice'), render: (c) => <span className="font-mono text-xs">{c.noticeVersion || '-'}</span> },
        { key: 'given', header: t('admin.buyers.consentCol.given'), render: (c) => <span className="whitespace-nowrap text-xs">{dateTime(c.givenAt)}</span> },
        { key: 'state', header: t('admin.buyers.consentCol.state'), render: (c) => (c.withdrawnAt ? <Badge tone="neutral">{t('admin.buyers.withdrawn', { date: date(c.withdrawnAt) })}</Badge> : <Badge tone="success">{t('admin.buyers.active')}</Badge>) },
      ]} />
  );
}

function BuyerDetail({ id, onClose }) {
  const t = useT();
  const toast = useToast();
  const { data: b, error } = useBuyer(id);
  const status = useSetBuyerStatus();
  const anonymise = useAnonymiseBuyer();
  const [reason, setReason] = useState('');
  const [confirmAnon, setConfirmAnon] = useState(false);
  const blocked = b && b.status === 'blocked';
  const act = async (fn, msg) => { try { await fn(); toast.success(msg); } catch (e) { toast.error(e.message); } };
  return (
    <Modal open onClose={onClose} size="lg" title={b ? b.name || t('admin.buyers.buyer') : t('admin.buyers.buyer')} description={b ? `${b.email || ''}${b.phone ? ` · ${b.phone}` : ''}` : ''}>
      <div className="space-y-5">
        {error && (isMissingEndpoint(error) ? <Alert tone="warning">{t('admin.buyers.detailMissing')}</Alert> : <Alert tone="danger">{error.message}</Alert>)}
        {b && (
          <dl className="grid gap-3 text-sm sm:grid-cols-3">
            <div><dt className="text-xs text-ink-subtle">{t('admin.buyers.joined')}</dt><dd>{date(b.createdAt)}</dd></div>
            <div><dt className="text-xs text-ink-subtle">{t('admin.buyers.status')}</dt><dd><Badge tone={blocked ? 'danger' : 'success'}>{titleCase(b.status || 'active')}</Badge></dd></div>
            <div><dt className="text-xs text-ink-subtle">{t('admin.buyers.referralCode')}</dt><dd className="font-mono text-xs">{b.referralCode || '-'}{b.referredBy ? t('admin.buyers.referredBy', { by: b.referredBy }) : ''}</dd></div>
            {b.counts && Object.entries(b.counts).map(([k, v]) => <div key={k}><dt className="text-xs text-ink-subtle">{titleCase(k)}</dt><dd>{v}</dd></div>)}
          </dl>
        )}
        <div>
          <p className="mb-2 text-sm font-semibold text-ink">{t('admin.buyers.consentLedger')}</p>
          <Consents userId={id} />
        </div>
        <div className="space-y-3 border-t pt-4">
          <Textarea label={blocked ? t('admin.buyers.unblockNote') : t('admin.buyers.blockReason')} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
          <div className="flex flex-wrap gap-2">
            {blocked
              ? <Button variant="secondary" icon={CheckCircle2} disabled={reason.trim().length < 5} loading={status.isPending} onClick={() => act(() => status.mutateAsync({ id, body: { status: 'active', reason: reason.trim() } }), t('admin.buyers.unblockedToast'))}>{t('admin.buyers.unblock')}</Button>
              : <Button variant="danger" icon={Ban} disabled={reason.trim().length < 5} loading={status.isPending} onClick={() => act(() => status.mutateAsync({ id, body: { status: 'blocked', reason: reason.trim() } }), t('admin.buyers.blockedToast'))}>{t('admin.buyers.block')}</Button>}
            <Button variant="ghost" icon={UserX} onClick={() => setConfirmAnon(true)}>{t('admin.buyers.anonymise')}</Button>
          </div>
          {confirmAnon && (
            <Alert tone="danger" title={t('admin.buyers.anonTitle')}>
              {t('admin.buyers.anonBody')}
              <div className="mt-2 flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => setConfirmAnon(false)}>{t('common.cancel')}</Button>
                <Button size="sm" variant="danger" icon={ShieldOff} disabled={reason.trim().length < 5} loading={anonymise.isPending} onClick={() => act(() => anonymise.mutateAsync({ id, reason: reason.trim() }), t('admin.buyers.anonymisedToast')).then(() => setConfirmAnon(false))}>{t('admin.buyers.anonymise')}</Button>
              </div>
            </Alert>
          )}
        </div>
      </div>
    </Modal>
  );
}

function BuyersTab({ onOpen }) {
  const t = useT();
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const { data, isLoading, error } = useBuyers({ page, limit: 20, ...(q.trim() ? { q: q.trim() } : {}) });
  if (error && isMissingEndpoint(error)) {
    return <Alert tone="warning" title={t('admin.buyers.listMissingTitle')}>{t('admin.buyers.listMissingBody')}</Alert>;
  }
  return (
    <>
      <div className="mb-4 max-w-xs"><Input aria-label={t('admin.buyers.searchAria')} placeholder={t('admin.buyers.searchPlaceholder')} leading={<Search className="h-4 w-4" />} value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /></div>
      {error && <Alert tone="danger" className="mb-3">{error.message}</Alert>}
      <Table loading={isLoading} rows={(data && data.items) || []} onRowClick={(r) => onOpen(r._id)} empty={t('admin.buyers.noBuyers')}
        columns={[
          { key: 'name', header: t('admin.buyers.col.name'), render: (r) => <span className="font-medium text-ink">{r.name || '-'}</span> },
          { key: 'phone', header: t('admin.buyers.col.phone'), render: (r) => <span className="font-mono text-xs">{r.phone || '-'}</span> },
          { key: 'email', header: t('admin.buyers.col.email'), render: (r) => r.email || '-' },
          { key: 'joined', header: t('admin.buyers.col.joined'), render: (r) => <span className="text-xs">{date(r.createdAt)}</span> },
          { key: 'ref', header: t('admin.buyers.col.ref'), render: (r) => <span className="font-mono text-xs">{r.referralCode || '-'}{r.referredBy ? ` ← ${r.referredBy}` : ''}</span> },
          { key: 'leads', header: t('admin.buyers.col.leads'), render: (r) => r.leadsCount ?? '-' },
          { key: 'flag', header: t('admin.buyers.col.flag'), render: (r) => (r.seekerFlag ? <Badge tone="warning">{titleCase(r.seekerFlag.status || 'flagged')}</Badge> : '') },
          { key: 'status', header: t('admin.buyers.col.status'), render: (r) => <Badge tone={r.status === 'blocked' ? 'danger' : 'success'}>{titleCase(r.status || 'active')}</Badge> },
        ]} />
      {data && <Pagination page={data.meta.page} pages={data.meta.pages} onChange={setPage} />}
    </>
  );
}

const DECISIONS = (t) => [
  { value: 'in_progress', label: t('admin.buyers.decisions.inProgress') },
  { value: 'completed', label: t('admin.buyers.decisions.completed') },
  { value: 'rejected', label: t('admin.buyers.decisions.rejected') },
];

// PATCH /api/admin/deletion-requests/:id { status, note }. Completing it
// anonymises the account, so it asks for confirmation first.
function DecideDeletion({ request, onClose }) {
  const t = useT();
  const toast = useToast();
  const decide = useDecideDeletion();
  const [status, setStatus] = useState(request.status === 'requested' ? 'in_progress' : 'completed');
  const [note, setNote] = useState('');
  const [confirming, setConfirming] = useState(false);
  const user = request.userId && typeof request.userId === 'object' ? request.userId : null;
  const run = async () => {
    try {
      await decide.mutateAsync({ id: request._id, body: { status, note: note.trim() } });
      toast.success(status === 'completed' ? t('admin.buyers.completedToast') : t('admin.buyers.markedToast', { status: DELETION_STATUS[status].label.toLowerCase() }));
      onClose();
    } catch (e) { setConfirming(false); toast.error(e.message); }
  };
  const submit = () => (status === 'completed' ? setConfirming(true) : run());
  return (
    <>
      <Modal open={!confirming} onClose={onClose} title={t('admin.buyers.decideTitle')} description={user ? `${user.name || ''} · ${user.email || user.phone || ''} · ${titleCase(user.role)}` : undefined}
        footer={<><Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button><Button variant={status === 'completed' ? 'danger' : 'primary'} disabled={note.trim().length < 5} loading={decide.isPending} onClick={submit}>{t('admin.buyers.saveDecision')}</Button></>}>
        <div className="space-y-4">
          {request.reason && <p className="text-sm text-ink-muted">{t('admin.buyers.reasonGiven')} <span className="text-ink">{request.reason}</span></p>}
          <Select label={t('admin.buyers.decision')} value={status} onChange={(e) => setStatus(e.target.value)} options={DECISIONS(t).filter((d) => d.value !== request.status)} />
          <Textarea label={t('admin.buyers.note')} required rows={3} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} hint={t('admin.buyers.noteHint')} />
          {status === 'completed' && <Alert tone="warning">{t('admin.buyers.onlyBuyers')}</Alert>}
        </div>
      </Modal>
      <ConfirmModal open={confirming} onClose={() => setConfirming(false)} onConfirm={run} loading={decide.isPending} tone="danger" confirmLabel={t('admin.buyers.confirmLabel')} title={t('admin.buyers.confirmTitle')}>
        {t('admin.buyers.confirmBody')}
      </ConfirmModal>
    </>
  );
}

function DeletionTab({ onOpen }) {
  const t = useT();
  const [deciding, setDeciding] = useState(null);
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const { data, isLoading, error } = useDeletionRequests({ page, limit: 20, sort: 'createdAt', ...(status ? { status } : {}) });
  return (
    <>
      <div className="mb-4 max-w-xs">
        <Select aria-label={t('admin.buyers.status')} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} placeholder={t('admin.buyers.openRequests')} options={Object.entries(DELETION_STATUS).map(([value, s]) => ({ value, label: s.label }))} />
      </div>
      {error && <Alert tone="danger" className="mb-3">{error.message}</Alert>}
      <Table loading={isLoading} rows={(data && data.items) || []} onRowClick={(r) => r.userId && onOpen(r.userId._id || r.userId)} empty={t('admin.buyers.noRequests')}
        columns={[
          { key: 'user', header: t('admin.buyers.col.user'), render: (r) => (r.userId && typeof r.userId === 'object' ? <span>{r.userId.name || '-'}<span className="block text-xs text-ink-subtle">{r.userId.email || r.userId.phone} · {titleCase(r.userId.role)}</span></span> : <span className="font-mono text-xs">{String(r.userId || '-')}</span>) },
          { key: 'reason', header: t('admin.buyers.col.reason'), render: (r) => <span className="block max-w-xs truncate text-sm" title={r.reason}>{r.reason || '-'}</span> },
          { key: 'requested', header: t('admin.buyers.col.requested'), render: (r) => <span className="whitespace-nowrap text-xs">{dateTime(r.createdAt)}</span> },
          { key: 'due', header: t('admin.buyers.col.due'), render: (r) => { const due = new Date(new Date(r.createdAt).getTime() + 30 * DAY); const late = due < new Date() && ['requested', 'in_progress'].includes(r.status); return <span className={late ? 'whitespace-nowrap text-xs font-medium text-danger-700' : 'whitespace-nowrap text-xs'}>{date(due)}{late ? t('admin.buyers.overdue') : ''}</span>; } },
          { key: 'status', header: t('admin.buyers.col.status'), render: (r) => { const s = DELETION_STATUS[r.status] || { label: r.status, tone: 'neutral' }; return <span><Badge tone={s.tone}>{s.label}</Badge>{r.note && <span className="mt-0.5 block max-w-[12rem] truncate text-xs text-ink-subtle" title={r.note}>{r.note}</span>}</span>; } },
          { key: 'act', header: '', render: (r) => (['requested', 'in_progress'].includes(r.status)
            ? <Button size="sm" variant="secondary" icon={Gavel} onClick={(e) => { e.stopPropagation(); setDeciding(r); }}>{t('admin.buyers.decide')}</Button> : null) },
        ]} />
      {data && <Pagination page={data.meta.page} pages={data.meta.pages} onChange={setPage} />}
      <p className="mt-3 text-xs text-ink-subtle">{t('admin.buyers.deletionNote')}</p>
      {deciding && <DecideDeletion request={deciding} onClose={() => setDeciding(null)} />}
    </>
  );
}

function ConsentLookup() {
  const t = useT();
  const [id, setId] = useState('');
  const valid = OID.test(id.trim());
  return (
    <div className="space-y-4">
      <div className="max-w-sm"><Input label={t('admin.buyers.userId')} value={id} onChange={(e) => setId(e.target.value)} error={id && !valid ? t('admin.buyers.userIdError') : undefined} /></div>
      {valid && <Consents userId={id.trim()} />}
    </div>
  );
}

export default function BuyersPage() {
  const t = useT();
  const [tab, setTab] = useState('buyers');
  const [open, setOpen] = useState(null);
  return (
    <>
      <PageHeader title={t('panel.nav.adminBuyers')} description={t('admin.buyers.description')} />
      <Tabs className="mb-4" value={tab} onChange={setTab} tabs={[{ value: 'buyers', label: t('admin.buyers.tabs.buyers') }, { value: 'deletion', label: t('admin.buyers.tabs.deletion') }, { value: 'consents', label: t('admin.buyers.tabs.consents') }]} />
      {tab === 'buyers' && <BuyersTab onOpen={setOpen} />}
      {tab === 'deletion' && <DeletionTab onOpen={setOpen} />}
      {tab === 'consents' && <ConsentLookup />}
      {open && <BuyerDetail id={String(open)} onClose={() => setOpen(null)} />}
    </>
  );
}
