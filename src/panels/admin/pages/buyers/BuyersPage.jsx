// RE-S-ADM-22 buyers and privacy (users.manage): buyer accounts with a detail
// view (consent ledger, block / unblock, anonymise), the deletion request
// queue with the 30-day due date and decisions (in progress / completed =
// anonymise / rejected, with a note), and a consent lookup by user ID.
import { useState } from 'react';
import { Ban, CheckCircle2, Gavel, Search, ShieldOff, UserX } from 'lucide-react';
import { Alert, Badge, Button, ConfirmModal, Input, Modal, PageHeader, Pagination, Select, Spinner, Table, Tabs, Textarea, useToast } from '@/shared/ui';
import { date, dateTime, titleCase } from '@/shared/lib/format';
import { CONSENT_PURPOSES, DELETION_STATUS, isMissingEndpoint, useAnonymiseBuyer, useBuyer, useBuyers, useDecideDeletion, useDeletionRequests, useSetBuyerStatus, useUserConsents } from '@/modules/auth/adminApi';

const OID = /^[a-f0-9]{24}$/i;
const DAY = 86400000;

function Consents({ userId }) {
  const { data, isLoading, error } = useUserConsents(userId);
  if (isLoading) return <div className="py-4"><Spinner size="sm" /></div>;
  if (error) return <Alert tone="danger">{error.message}</Alert>;
  if (!data || !data.length) return <p className="text-sm text-ink-subtle">No consent records.</p>;
  return (
    <Table rows={data} empty="No consent records"
      columns={[
        { key: 'purpose', header: 'Purpose', render: (c) => CONSENT_PURPOSES[c.purpose] || titleCase(c.purpose) },
        { key: 'source', header: 'Source', render: (c) => titleCase(c.source || '-') },
        { key: 'notice', header: 'Notice', render: (c) => <span className="font-mono text-xs">{c.noticeVersion || '-'}</span> },
        { key: 'given', header: 'Given', render: (c) => <span className="whitespace-nowrap text-xs">{dateTime(c.givenAt)}</span> },
        { key: 'state', header: 'State', render: (c) => (c.withdrawnAt ? <Badge tone="neutral">Withdrawn {date(c.withdrawnAt)}</Badge> : <Badge tone="success">Active</Badge>) },
      ]} />
  );
}

function BuyerDetail({ id, onClose }) {
  const toast = useToast();
  const { data: b, error } = useBuyer(id);
  const status = useSetBuyerStatus();
  const anonymise = useAnonymiseBuyer();
  const [reason, setReason] = useState('');
  const [confirmAnon, setConfirmAnon] = useState(false);
  const blocked = b && b.status === 'blocked';
  const act = async (fn, msg) => { try { await fn(); toast.success(msg); } catch (e) { toast.error(e.message); } };
  return (
    <Modal open onClose={onClose} size="lg" title={b ? b.name || 'Buyer' : 'Buyer'} description={b ? `${b.email || ''}${b.phone ? ` · ${b.phone}` : ''}` : ''}>
      <div className="space-y-5">
        {error && (isMissingEndpoint(error) ? <Alert tone="warning">The buyer detail endpoint (GET /api/admin/users/:id) is not in the backend yet; the consent ledger below still loads.</Alert> : <Alert tone="danger">{error.message}</Alert>)}
        {b && (
          <dl className="grid gap-3 text-sm sm:grid-cols-3">
            <div><dt className="text-xs text-ink-subtle">Joined</dt><dd>{date(b.createdAt)}</dd></div>
            <div><dt className="text-xs text-ink-subtle">Status</dt><dd><Badge tone={blocked ? 'danger' : 'success'}>{titleCase(b.status || 'active')}</Badge></dd></div>
            <div><dt className="text-xs text-ink-subtle">Referral code</dt><dd className="font-mono text-xs">{b.referralCode || '-'}{b.referredBy ? ` · by ${b.referredBy}` : ''}</dd></div>
            {b.counts && Object.entries(b.counts).map(([k, v]) => <div key={k}><dt className="text-xs text-ink-subtle">{titleCase(k)}</dt><dd>{v}</dd></div>)}
          </dl>
        )}
        <div>
          <p className="mb-2 text-sm font-semibold text-ink">Consent ledger</p>
          <Consents userId={id} />
        </div>
        <div className="space-y-3 border-t pt-4">
          <Textarea label={blocked ? 'Note for unblocking' : 'Reason for blocking'} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
          <div className="flex flex-wrap gap-2">
            {blocked
              ? <Button variant="secondary" icon={CheckCircle2} disabled={reason.trim().length < 5} loading={status.isPending} onClick={() => act(() => status.mutateAsync({ id, body: { status: 'active', reason: reason.trim() } }), 'Buyer unblocked')}>Unblock</Button>
              : <Button variant="danger" icon={Ban} disabled={reason.trim().length < 5} loading={status.isPending} onClick={() => act(() => status.mutateAsync({ id, body: { status: 'blocked', reason: reason.trim() } }), 'Buyer blocked')}>Block</Button>}
            <Button variant="ghost" icon={UserX} onClick={() => setConfirmAnon(true)}>Anonymise</Button>
          </div>
          {confirmAnon && (
            <Alert tone="danger" title="Anonymise this buyer?">
              Name, phone and email are replaced with placeholders on the account and on closed leads. Open deals block anonymisation. This cannot be undone. The reason above (at least 5 characters) is recorded in the audit log.
              <div className="mt-2 flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => setConfirmAnon(false)}>Cancel</Button>
                <Button size="sm" variant="danger" icon={ShieldOff} disabled={reason.trim().length < 5} loading={anonymise.isPending} onClick={() => act(() => anonymise.mutateAsync({ id, reason: reason.trim() }), 'Buyer anonymised').then(() => setConfirmAnon(false))}>Anonymise</Button>
              </div>
            </Alert>
          )}
        </div>
      </div>
    </Modal>
  );
}

function BuyersTab({ onOpen }) {
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const { data, isLoading, error } = useBuyers({ page, limit: 20, ...(q.trim() ? { q: q.trim() } : {}) });
  if (error && isMissingEndpoint(error)) {
    return <Alert tone="warning" title="Buyer list not available">The backend does not expose GET /api/admin/users yet. Use the deletion requests tab, or look up a buyer's consents by user ID.</Alert>;
  }
  return (
    <>
      <div className="mb-4 max-w-xs"><Input aria-label="Search buyers" placeholder="Name, email or phone" leading={<Search className="h-4 w-4" />} value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /></div>
      {error && <Alert tone="danger" className="mb-3">{error.message}</Alert>}
      <Table loading={isLoading} rows={(data && data.items) || []} onRowClick={(r) => onOpen(r._id)} empty="No buyers found"
        columns={[
          { key: 'name', header: 'Name', render: (r) => <span className="font-medium text-ink">{r.name || '-'}</span> },
          { key: 'phone', header: 'Phone', render: (r) => <span className="font-mono text-xs">{r.phone || '-'}</span> },
          { key: 'email', header: 'Email', render: (r) => r.email || '-' },
          { key: 'joined', header: 'Joined', render: (r) => <span className="text-xs">{date(r.createdAt)}</span> },
          { key: 'ref', header: 'Referral', render: (r) => <span className="font-mono text-xs">{r.referralCode || '-'}{r.referredBy ? ` ← ${r.referredBy}` : ''}</span> },
          { key: 'leads', header: 'Leads', render: (r) => r.leadsCount ?? '-' },
          { key: 'flag', header: 'Seeker flag', render: (r) => (r.seekerFlag ? <Badge tone="warning">{titleCase(r.seekerFlag.status || 'flagged')}</Badge> : '') },
          { key: 'status', header: 'Status', render: (r) => <Badge tone={r.status === 'blocked' ? 'danger' : 'success'}>{titleCase(r.status || 'active')}</Badge> },
        ]} />
      {data && <Pagination page={data.meta.page} pages={data.meta.pages} onChange={setPage} />}
    </>
  );
}

const DECISIONS = [
  { value: 'in_progress', label: 'In progress (we are working on it)' },
  { value: 'completed', label: 'Completed: anonymise the account now' },
  { value: 'rejected', label: 'Rejected (explain why in the note)' },
];

// PATCH /api/admin/deletion-requests/:id { status, note }. Completing it
// anonymises the account, so it asks for confirmation first.
function DecideDeletion({ request, onClose }) {
  const toast = useToast();
  const decide = useDecideDeletion();
  const [status, setStatus] = useState(request.status === 'requested' ? 'in_progress' : 'completed');
  const [note, setNote] = useState('');
  const [confirming, setConfirming] = useState(false);
  const user = request.userId && typeof request.userId === 'object' ? request.userId : null;
  const run = async () => {
    try {
      await decide.mutateAsync({ id: request._id, body: { status, note: note.trim() } });
      toast.success(status === 'completed' ? 'Account anonymised and request completed' : `Request marked ${DELETION_STATUS[status].label.toLowerCase()}`);
      onClose();
    } catch (e) { setConfirming(false); toast.error(e.message); }
  };
  const submit = () => (status === 'completed' ? setConfirming(true) : run());
  return (
    <>
      <Modal open={!confirming} onClose={onClose} title="Decide deletion request" description={user ? `${user.name || ''} · ${user.email || user.phone || ''} · ${titleCase(user.role)}` : undefined}
        footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant={status === 'completed' ? 'danger' : 'primary'} disabled={note.trim().length < 5} loading={decide.isPending} onClick={submit}>Save decision</Button></>}>
        <div className="space-y-4">
          {request.reason && <p className="text-sm text-ink-muted">Reason given: <span className="text-ink">{request.reason}</span></p>}
          <Select label="Decision" value={status} onChange={(e) => setStatus(e.target.value)} options={DECISIONS.filter((d) => d.value !== request.status)} />
          <Textarea label="Note" required rows={3} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} hint="At least 5 characters. Kept with the request and in the audit log." />
          {status === 'completed' && <Alert tone="warning">Only buyer accounts can be anonymised here, and an open deal blocks it.</Alert>}
        </div>
      </Modal>
      <ConfirmModal open={confirming} onClose={() => setConfirming(false)} onConfirm={run} loading={decide.isPending} tone="danger" confirmLabel="Anonymise and complete" title="Anonymise this account?">
        Name, phone and email are replaced with placeholders on the account and on its leads, and every session is signed out. Deals and invoices keep their amounts and dates. This cannot be undone.
      </ConfirmModal>
    </>
  );
}

function DeletionTab({ onOpen }) {
  const [deciding, setDeciding] = useState(null);
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const { data, isLoading, error } = useDeletionRequests({ page, limit: 20, sort: 'createdAt', ...(status ? { status } : {}) });
  return (
    <>
      <div className="mb-4 max-w-xs">
        <Select aria-label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} placeholder="Open (requested, in progress)" options={Object.entries(DELETION_STATUS).map(([value, s]) => ({ value, label: s.label }))} />
      </div>
      {error && <Alert tone="danger" className="mb-3">{error.message}</Alert>}
      <Table loading={isLoading} rows={(data && data.items) || []} onRowClick={(r) => r.userId && onOpen(r.userId._id || r.userId)} empty="No deletion requests"
        columns={[
          { key: 'user', header: 'User', render: (r) => (r.userId && typeof r.userId === 'object' ? <span>{r.userId.name || '-'}<span className="block text-xs text-ink-subtle">{r.userId.email || r.userId.phone} · {titleCase(r.userId.role)}</span></span> : <span className="font-mono text-xs">{String(r.userId || '-')}</span>) },
          { key: 'reason', header: 'Reason', render: (r) => <span className="block max-w-xs truncate text-sm" title={r.reason}>{r.reason || '-'}</span> },
          { key: 'requested', header: 'Requested', render: (r) => <span className="whitespace-nowrap text-xs">{dateTime(r.createdAt)}</span> },
          { key: 'due', header: 'Due (30 days)', render: (r) => { const due = new Date(new Date(r.createdAt).getTime() + 30 * DAY); const late = due < new Date() && ['requested', 'in_progress'].includes(r.status); return <span className={late ? 'whitespace-nowrap text-xs font-medium text-danger-700' : 'whitespace-nowrap text-xs'}>{date(due)}{late ? ' · overdue' : ''}</span>; } },
          { key: 'status', header: 'Status', render: (r) => { const s = DELETION_STATUS[r.status] || { label: r.status, tone: 'neutral' }; return <span><Badge tone={s.tone}>{s.label}</Badge>{r.note && <span className="mt-0.5 block max-w-[12rem] truncate text-xs text-ink-subtle" title={r.note}>{r.note}</span>}</span>; } },
          { key: 'act', header: '', render: (r) => (['requested', 'in_progress'].includes(r.status)
            ? <Button size="sm" variant="secondary" icon={Gavel} onClick={(e) => { e.stopPropagation(); setDeciding(r); }}>Decide</Button> : null) },
        ]} />
      {data && <Pagination page={data.meta.page} pages={data.meta.pages} onChange={setPage} />}
      <p className="mt-3 text-xs text-ink-subtle">Open a request to see the user's consents; use Decide to record progress, complete (anonymise) or reject it.</p>
      {deciding && <DecideDeletion request={deciding} onClose={() => setDeciding(null)} />}
    </>
  );
}

function ConsentLookup() {
  const [id, setId] = useState('');
  const valid = OID.test(id.trim());
  return (
    <div className="space-y-4">
      <div className="max-w-sm"><Input label="User ID" value={id} onChange={(e) => setId(e.target.value)} error={id && !valid ? '24-character user ID' : undefined} /></div>
      {valid && <Consents userId={id.trim()} />}
    </div>
  );
}

export default function BuyersPage() {
  const [tab, setTab] = useState('buyers');
  const [open, setOpen] = useState(null);
  return (
    <>
      <PageHeader title="Buyers and privacy" description="Buyer accounts, data-deletion requests (due within 30 days) and the consent ledger (DPDP Act)." />
      <Tabs className="mb-4" value={tab} onChange={setTab} tabs={[{ value: 'buyers', label: 'Buyer accounts' }, { value: 'deletion', label: 'Deletion requests' }, { value: 'consents', label: 'Consent lookup' }]} />
      {tab === 'buyers' && <BuyersTab onOpen={setOpen} />}
      {tab === 'deletion' && <DeletionTab onOpen={setOpen} />}
      {tab === 'consents' && <ConsentLookup />}
      {open && <BuyerDetail id={String(open)} onClose={() => setOpen(null)} />}
    </>
  );
}
