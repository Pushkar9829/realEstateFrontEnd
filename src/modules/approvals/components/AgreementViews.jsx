// Agreement list and detail, shared by the lister panel (own agreements) and
// the admin registry. Admin-only actions appear when scope === 'admin' and the
// staff member holds agreements.manage.
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, FileSignature, FileText, RefreshCcw, ShieldAlert, ShieldCheck, XCircle } from 'lucide-react';
import { Alert, Badge, Button, Card, CardHeader, Input, Modal, PageHeader, PageSpinner, Pagination, Table, Tabs, Textarea, useToast } from '@/shared/ui';
import FileDrop from '@/shared/components/FileDrop';
import { dateTime } from '@/shared/lib/format';
import { agreementStatus, downloadAgreementsCsv, openAgreementPdf, useAgreement, useAgreements, useRequestNewVersion, useTerminateAgreement, useUploadSigned } from '../agreements';

const TABS = [{ value: '', label: 'All' }, { value: 'accepted', label: 'Accepted' }, { value: 'countersigned', label: 'Countersigned' }, { value: 'superseded', label: 'Superseded' }, { value: 'terminated', label: 'Terminated' }];

export function AgreementList({ scope, basePath }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const { data, isLoading } = useAgreements(scope, { page, limit: 20, sort: '-acceptedAt', ...(status ? { status } : {}) });
  const admin = scope === 'admin';
  return (
    <>
      <PageHeader title={admin ? 'Agreement registry' : 'Agreements'}
        description={admin ? 'Every commission agreement with its acceptance evidence. Agreements are never edited; a change creates a new version.' : 'Commission agreements you accepted for your listings and projects. Each has a fixed text, version and tamper check.'}
        actions={admin ? <Button variant="secondary" icon={Download} onClick={() => downloadAgreementsCsv().catch((e) => toast.error(e.message))}>Export CSV</Button> : null} />
      <Tabs className="mb-4" value={status} onChange={(v) => { setStatus(v); setPage(1); }} tabs={TABS} />
      <Table loading={isLoading} rows={(data && data.items) || []} onRowClick={(r) => navigate(`${basePath}/${r._id}`)} empty="No agreements yet. One is created when you accept the commission for a listing."
        columns={[
          { key: 'agreementNo', header: 'Agreement', render: (r) => <span className="font-medium text-ink">{r.agreementNo} <span className="text-xs text-ink-subtle">v{r.version}</span></span> },
          ...(admin ? [{ key: 'lister', header: 'Lister', render: (r) => (r.listerId ? <span>{r.listerId.name}<span className="block text-xs text-ink-subtle">{r.listerId.email}</span></span> : '-') }] : []),
          { key: 'for', header: 'For', render: (r) => (r.projectId ? 'Builder project' : 'Property listing') },
          { key: 'pct', header: 'Commission', render: (r) => `${r.commissionPercent}% of ${r.basis === 'annual_rent' ? 'annual rent' : 'sale price'}` },
          { key: 'acceptedAt', header: 'Accepted', render: (r) => dateTime(r.acceptedAt) },
          { key: 'status', header: 'Status', render: (r) => { const s = agreementStatus(r.status); return <Badge tone={s.tone}>{s.label}</Badge>; } },
        ]} />
      {data && <Pagination page={data.meta.page} pages={data.meta.pages} onChange={setPage} />}
    </>
  );
}

function Row({ label, children }) {
  return <div className="flex flex-col gap-0.5 py-2 sm:flex-row sm:gap-4"><dt className="w-44 shrink-0 text-sm text-ink-subtle">{label}</dt><dd className="min-w-0 break-words text-sm text-ink">{children || '-'}</dd></div>;
}

function AdminActions({ ag }) {
  const toast = useToast();
  const upload = useUploadSigned(ag._id);
  const terminate = useTerminateAgreement(ag._id);
  const ask = useRequestNewVersion(ag._id);
  const [dialog, setDialog] = useState(null);
  const [text, setText] = useState('');
  const [signedDate, setSignedDate] = useState('');
  const act = async (fn, msg) => { try { await fn(); toast.success(msg); setDialog(null); setText(''); } catch (e) { toast.error(e.message); } };
  const active = ['accepted', 'countersigned'].includes(ag.status);
  return (
    <Card>
      <CardHeader title="Registry actions" description="Needs the agreements.manage permission." />
      <div className="space-y-4">
        {ag.status === 'accepted' && (
          <div>
            <Input label="Signed on (optional)" type="date" value={signedDate} onChange={(e) => setSignedDate(e.target.value)} className="mb-2" />
            <FileDrop compact purpose="signed_agreement" kind="document" label="Upload countersigned PDF"
              onUploaded={(f) => act(() => upload.mutateAsync({ fileId: f.id, ...(signedDate ? { signedDate } : {}) }), 'Marked as countersigned')} />
          </div>
        )}
        {active && <Button block variant="secondary" icon={RefreshCcw} onClick={() => setDialog('ask')}>Ask lister to accept a new version</Button>}
        {active && <Button block variant="danger" icon={XCircle} onClick={() => setDialog('terminate')}>Terminate</Button>}
      </div>
      <Modal open={dialog === 'terminate'} onClose={() => setDialog(null)} title="Terminate agreement" size="sm" description="A live listing on this agreement becomes inactive."
        footer={<><Button variant="ghost" onClick={() => setDialog(null)}>Cancel</Button><Button variant="danger" disabled={text.trim().length < 3} loading={terminate.isPending} onClick={() => act(() => terminate.mutateAsync({ reason: text.trim() }), 'Agreement terminated')}>Terminate</Button></>}>
        <Textarea label="Reason" rows={3} value={text} onChange={(e) => setText(e.target.value)} />
      </Modal>
      <Modal open={dialog === 'ask'} onClose={() => setDialog(null)} title="Request a new version" size="sm" description="The lister is notified to review and accept the agreement again."
        footer={<><Button variant="ghost" onClick={() => setDialog(null)}>Cancel</Button><Button loading={ask.isPending} onClick={() => act(() => ask.mutateAsync({ note: text.trim() }), 'Lister notified')}>Send request</Button></>}>
        <Textarea label="Note to the lister" rows={3} value={text} onChange={(e) => setText(e.target.value)} />
      </Modal>
    </Card>
  );
}

export function AgreementDetail({ scope, id, backTo, canManage }) {
  const toast = useToast();
  const { data: ag, isLoading, error } = useAgreement(scope, id);
  if (isLoading) return <PageSpinner />;
  if (error) return <Alert tone="danger">{error.message}</Alert>;
  const s = agreementStatus(ag.status);
  return (
    <>
      <Link to={backTo} className="mb-3 inline-flex items-center gap-1 text-sm text-brand-700 hover:underline"><ArrowLeft className="h-4 w-4" /> Agreements</Link>
      <PageHeader title={`${ag.agreementNo} · version ${ag.version}`} description={`${ag.commissionPercent}% of the ${ag.basis === 'annual_rent' ? 'annual rent' : 'agreed sale price'} plus GST`}
        actions={<><Badge tone={s.tone}>{s.label}</Badge><Button variant="secondary" icon={FileText} onClick={() => openAgreementPdf(scope, ag._id).catch((e) => toast.error(e.message))}>Open PDF</Button></>} />
      {ag.hashValid
        ? <Alert tone="success" className="mb-4" title="Text integrity verified">The stored text matches its SHA-256 fingerprint, so it has not been changed since acceptance.</Alert>
        : <Alert tone="danger" className="mb-4" title="Integrity check failed">The stored text does not match its fingerprint. Report this to the platform team.</Alert>}
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card>
            <CardHeader title="Agreement text" action={<Badge icon={FileSignature}>Template v{ag.templateVersion}</Badge>} />
            <div className="max-h-[28rem] overflow-y-auto whitespace-pre-line rounded-md border bg-surface-muted p-4 text-sm leading-relaxed text-ink-muted">{ag.textSnapshot}</div>
          </Card>
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Acceptance evidence" />
            <dl className="divide-y">
              <Row label="Accepted by">{ag.acceptedName}</Row>
              <Row label="Accepted at">{dateTime(ag.acceptedAt)}</Row>
              <Row label="IP address">{ag.ip}</Row>
              <Row label="Effective from">{ag.effectiveFrom ? dateTime(ag.effectiveFrom) : 'Pending approval'}</Row>
              <Row label="Non-circumvention">{ag.nonCircumventionMonths} months</Row>
              {ag.terminatedReason && <Row label="Terminated">{ag.terminatedReason}</Row>}
              <Row label="Fingerprint"><code className="break-all text-xs">{ag.textHash}</code></Row>
            </dl>
          </Card>
          <Card>
            <CardHeader title="Versions" />
            <ol className="space-y-2">
              {(ag.versions || []).map((v) => {
                const vs = agreementStatus(v.status);
                return (
                  <li key={v._id} className="flex items-center justify-between gap-2 text-sm">
                    <span className={v._id === ag._id ? 'font-semibold text-ink' : 'text-ink-muted'}>v{v.version} · {v.commissionPercent}% · {dateTime(v.acceptedAt)}</span>
                    <Badge tone={vs.tone}>{vs.label}</Badge>
                  </li>
                );
              })}
            </ol>
          </Card>
          {scope === 'admin' && canManage && <AdminActions ag={ag} />}
          {scope === 'admin' && !canManage && <p className="flex items-center gap-2 text-xs text-ink-subtle"><ShieldAlert className="h-4 w-4" />Registry actions need the agreements.manage permission.</p>}
          {ag.status === 'countersigned' && <p className="flex items-center gap-2 text-sm text-success-700"><ShieldCheck className="h-4 w-4" />Countersigned copy on file.</p>}
        </div>
      </div>
    </>
  );
}
