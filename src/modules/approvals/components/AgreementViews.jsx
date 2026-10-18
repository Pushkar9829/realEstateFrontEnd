// Agreement list and detail, shared by the lister panel (own agreements) and
// the admin registry. Admin-only actions appear when scope === 'admin' and the
// staff member holds agreements.manage.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Download, FileSignature, FileText, RefreshCcw, ShieldAlert, ShieldCheck, XCircle } from 'lucide-react';
import { Alert, Badge, Button, Card, CardHeader, Input, Modal, PageHeader, PageSpinner, Pagination, Table, Tabs, Textarea, useToast } from '@/shared/ui';
import FileDrop from '@/shared/components/FileDrop';
import { dateTime } from '@/shared/lib/format';
import { agreementStatus, downloadAgreementsCsv, openAgreementPdf, useAgreement, useAgreements, useRequestNewVersion, useTerminateAgreement, useUploadSigned } from '../agreements';
import { useT } from '@/shared/i18n';

// Tab labels come from lister.agreements.status.<value> ('' = All).
const TABS = ['', 'accepted', 'countersigned', 'superseded', 'terminated'];

export function AgreementList({ scope, basePath }) {
  const t = useT();
  const toast = useToast();
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const { data, isLoading } = useAgreements(scope, { page, limit: 20, sort: '-acceptedAt', ...(status ? { status } : {}) });
  const admin = scope === 'admin';
  return (
    <>
      <PageHeader title={admin ? t('lister.agreements.registry') : t('lister.agreements.title')}
        description={admin ? t('lister.agreements.registryDesc') : t('lister.agreements.desc')}
        actions={admin ? <Button variant="secondary" icon={Download} onClick={() => downloadAgreementsCsv().catch((e) => toast.error(e.message))}>{t('lister.agreements.exportCsv')}</Button> : null} />
      <Tabs className="mb-4" value={status} onChange={(v) => { setStatus(v); setPage(1); }} tabs={TABS.map((value) => ({ value, label: value ? t(`lister.agreements.status.${value}`) : t('lister.listings.tabs.all') }))} />
      <Table loading={isLoading} rows={(data && data.items) || []} rowHref={(r) => `${basePath}/${r._id}`} empty={t('lister.agreements.empty')}
        columns={[
          { key: 'agreementNo', header: t('lister.agreements.col.agreement'), render: (r) => <span className="font-medium text-ink">{r.agreementNo} <span className="text-xs text-ink-subtle">v{r.version}</span></span> },
          ...(admin ? [{ key: 'lister', header: t('lister.agreements.col.lister'), render: (r) => (r.listerId ? <span>{r.listerId.name}<span className="block text-xs text-ink-subtle">{r.listerId.email}</span></span> : '-') }] : []),
          { key: 'for', header: t('lister.agreements.col.for'), render: (r) => (r.projectId ? t('lister.agreements.builderProject') : t('lister.agreements.propertyListing')) },
          { key: 'pct', header: t('lister.wizard.steps.commission'), render: (r) => t('lister.agreements.pctOf', { pct: r.commissionPercent, basis: r.basis === 'annual_rent' ? t('lister.agreements.annualRent') : t('lister.agreements.salePrice') }) },
          { key: 'acceptedAt', header: t('lister.agreements.status.accepted'), render: (r) => dateTime(r.acceptedAt) },
          { key: 'status', header: t('lister.leads.col.status'), render: (r) => { const s = agreementStatus(r.status); return <Badge tone={s.tone}>{s.label}</Badge>; } },
        ]} />
      {data && <Pagination page={data.meta.page} pages={data.meta.pages} onChange={setPage} />}
    </>
  );
}

function Row({ label, children }) {
  return <div className="flex flex-col gap-0.5 py-2 sm:flex-row sm:gap-4"><dt className="w-44 shrink-0 text-sm text-ink-subtle">{label}</dt><dd className="min-w-0 break-words text-sm text-ink">{children || '-'}</dd></div>;
}

function AdminActions({ ag }) {
  const t = useT();
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
      <CardHeader title={t('lister.agreements.admin.actions')} description={t('lister.agreements.admin.perm')} />
      <div className="space-y-4">
        {ag.status === 'accepted' && (
          <div>
            <Input label={t('lister.agreements.admin.signedOn')} type="date" value={signedDate} onChange={(e) => setSignedDate(e.target.value)} className="mb-2" />
            <FileDrop compact purpose="signed_agreement" kind="document" label={t('lister.agreements.admin.upload')}
              onUploaded={(f) => act(() => upload.mutateAsync({ fileId: f.id, ...(signedDate ? { signedDate } : {}) }), t('lister.agreements.admin.marked'))} />
          </div>
        )}
        {active && <Button block variant="secondary" icon={RefreshCcw} onClick={() => setDialog('ask')}>{t('lister.agreements.admin.ask')}</Button>}
        {active && <Button block variant="danger" icon={XCircle} onClick={() => setDialog('terminate')}>{t('lister.agreements.admin.terminate')}</Button>}
      </div>
      <Modal open={dialog === 'terminate'} onClose={() => setDialog(null)} title={t('lister.agreements.admin.terminateTitle')} size="sm" description={t('lister.agreements.admin.terminateDesc')}
        footer={<><Button variant="ghost" onClick={() => setDialog(null)}>{t('common.cancel')}</Button><Button variant="danger" disabled={text.trim().length < 3} loading={terminate.isPending} onClick={() => act(() => terminate.mutateAsync({ reason: text.trim() }), t('lister.agreements.admin.terminated'))}>{t('lister.agreements.admin.terminate')}</Button></>}>
        <Textarea label={t('lister.listings.reason')} rows={3} value={text} onChange={(e) => setText(e.target.value)} />
      </Modal>
      <Modal open={dialog === 'ask'} onClose={() => setDialog(null)} title={t('lister.agreements.admin.askTitle')} size="sm" description={t('lister.agreements.admin.askDesc')}
        footer={<><Button variant="ghost" onClick={() => setDialog(null)}>{t('common.cancel')}</Button><Button loading={ask.isPending} onClick={() => act(() => ask.mutateAsync({ note: text.trim() }), t('lister.agreements.admin.notified'))}>{t('lister.verify.send')}</Button></>}>
        <Textarea label={t('lister.agreements.admin.note')} rows={3} value={text} onChange={(e) => setText(e.target.value)} />
      </Modal>
    </Card>
  );
}

export function AgreementDetail({ scope, id, backTo, canManage }) {
  const t = useT();
  const toast = useToast();
  const { data: ag, isLoading, error } = useAgreement(scope, id);
  if (isLoading) return <PageSpinner />;
  if (error) return <Alert tone="danger">{error.message}</Alert>;
  const s = agreementStatus(ag.status);
  return (
    <>
      <Link to={backTo} className="mb-3 inline-flex items-center gap-1 text-sm text-brand-700 hover:underline"><ArrowLeft className="h-4 w-4" /> {t('lister.agreements.title')}</Link>
      <PageHeader title={t('lister.agreements.versionTitle', { no: ag.agreementNo, v: ag.version })} description={t('lister.agreements.pctPlusGst', { pct: ag.commissionPercent, basis: ag.basis === 'annual_rent' ? t('lister.agreements.annualRent') : t('lister.wizard.comm.basisSale') })}
        actions={<><Badge tone={s.tone}>{s.label}</Badge><Button variant="secondary" icon={FileText} onClick={() => openAgreementPdf(scope, ag._id).catch((e) => toast.error(e.message))}>{t('lister.invoices.openPdf')}</Button></>} />
      {ag.hashValid
        ? <Alert tone="success" className="mb-4" title={t('lister.agreements.intOk')}>{t('lister.agreements.intOkText')}</Alert>
        : <Alert tone="danger" className="mb-4" title={t('lister.agreements.intBad')}>{t('lister.agreements.intBadText')}</Alert>}
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card>
            <CardHeader title={t('lister.agreements.text')} action={<Badge icon={FileSignature}>{t('lister.agreements.template', { v: ag.templateVersion })}</Badge>} />
            <div className="max-h-[28rem] overflow-y-auto whitespace-pre-line rounded-md border bg-surface-muted p-4 text-sm leading-relaxed text-ink-muted">{ag.textSnapshot}</div>
          </Card>
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader title={t('lister.agreements.evidence')} />
            <dl className="divide-y">
              <Row label={t('lister.agreements.acceptedBy')}>{ag.acceptedName}</Row>
              <Row label={t('lister.agreements.acceptedAt')}>{dateTime(ag.acceptedAt)}</Row>
              <Row label={t('lister.agreements.ip')}>{ag.ip}</Row>
              <Row label={t('lister.agreements.effective')}>{ag.effectiveFrom ? dateTime(ag.effectiveFrom) : t('lister.status.pending_approval')}</Row>
              <Row label={t('lister.agreements.nonCircumvention')}>{t('lister.agreements.months', { n: ag.nonCircumventionMonths })}</Row>
              {ag.terminatedReason && <Row label={t('lister.agreements.status.terminated')}>{ag.terminatedReason}</Row>}
              <Row label={t('lister.agreements.fingerprint')}><code className="break-all text-xs">{ag.textHash}</code></Row>
            </dl>
          </Card>
          <Card>
            <CardHeader title={t('lister.agreements.versions')} />
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
          {scope === 'admin' && !canManage && <p className="flex items-center gap-2 text-xs text-ink-subtle"><ShieldAlert className="h-4 w-4" />{t('lister.agreements.admin.needPerm')}</p>}
          {ag.status === 'countersigned' && <p className="flex items-center gap-2 text-sm text-success-700"><ShieldCheck className="h-4 w-4" />{t('lister.agreements.onFile')}</p>}
        </div>
      </div>
    </>
  );
}
