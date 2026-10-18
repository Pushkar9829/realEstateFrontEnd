// RE-F-06 trust and safety: automatic and manual broker flags with the
// evidence, resolved by dismissing, warning, suspending or banning.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { Badge, Button, Modal, PageHeader, Pagination, Select, Table, Tabs, Textarea, useToast } from '@/shared/ui';
import { dateTime, titleCase } from '@/shared/lib/format';
import { useT } from '@/shared/i18n';
import { FLAG_RULES, useBrokerFlags, useResolveFlag } from '@/modules/kyc/api';

const RESOLUTIONS = (t) => [
  { value: 'dismiss', label: t('admin.trust.resolutions.dismiss') },
  { value: 'confirm_warn', label: t('admin.trust.resolutions.warn') },
  { value: 'confirm_suspend', label: t('admin.trust.resolutions.suspend') },
  { value: 'confirm_ban', label: t('admin.trust.resolutions.ban') },
];

function evidenceText(f, t) {
  const e = f.evidence || {};
  if (f.rule === 'R2') return t('admin.trust.evidence.r2', { active: e.active, limit: e.limit });
  if (f.rule === 'R3') return t('admin.trust.evidence.r3', { list: (e.matches || []).map((m) => m.listingNo).join(', ') });
  if (f.rule === 'R1') return t('admin.trust.evidence.r1', { list: (e.owners || []).join(', ') });
  if (f.rule === 'R4') return t('admin.trust.evidence.r4', { n: (e.linkedAccounts || []).length });
  if (f.rule === 'R6') return t('admin.trust.evidence.r6', { n: e.hits24h });
  if (f.rule === 'manual') return e.note;
  return JSON.stringify(e).slice(0, 120);
}

export default function TrustPage() {
  const t = useT();
  const toast = useToast();
  const [status, setStatus] = useState('open');
  const [page, setPage] = useState(1);
  const { data, isLoading } = useBrokerFlags({ page, limit: 20, sort: '-createdAt', status });
  const resolve = useResolveFlag();
  const [flag, setFlag] = useState(null);
  const [resolution, setResolution] = useState('dismiss');
  const [note, setNote] = useState('');

  const submit = async () => {
    try { await resolve.mutateAsync({ id: flag._id, body: { resolution, note: note.trim() } }); toast.success(t('admin.trust.resolvedToast')); setFlag(null); setNote(''); } catch (e) { toast.error(e.message); }
  };
  const tabs = [{ value: 'open', label: t('admin.trust.tabs.open') }, { value: 'under_review', label: t('admin.trust.tabs.underReview') }, { value: 'resolved', label: t('admin.trust.tabs.resolved') }];

  return (
    <>
      <PageHeader title={t('admin.trust.title')} description={t('admin.trust.description')} />
      <Tabs className="mb-4" value={status} onChange={(v) => { setStatus(v); setPage(1); }} tabs={tabs.map((x) => (x.value === status && data ? { ...x, count: data.meta.total } : x))} />
      <Table loading={isLoading} rows={(data && data.items) || []} empty={t('admin.trust.empty')}
        columns={[
          { key: 'flagNo', header: t('admin.trust.col.flag'), render: (f) => <span className="font-medium text-ink">{f.flagNo}</span> },
          { key: 'lister', header: t('admin.trust.col.lister'), render: (f) => (f.listerId ? <Link className="text-brand-700 hover:underline" to={`/admin/listers/${f.listerId._id}`}>{f.listerId.name}</Link> : '-') },
          { key: 'rule', header: t('admin.trust.col.rule'), render: (f) => <span><Badge tone="warning" icon={ShieldAlert}>{f.rule}</Badge><span className="mt-1 block text-xs text-ink-subtle">{FLAG_RULES[f.rule]}</span></span> },
          { key: 'evidence', header: t('admin.trust.col.evidence'), render: (f) => <span className="text-sm text-ink-muted">{evidenceText(f, t)}</span> },
          { key: 'at', header: t('admin.trust.col.raised'), render: (f) => dateTime(f.createdAt) },
          { key: 'act', header: '', render: (f) => (f.status === 'resolved' ? <Badge>{titleCase(f.resolution)}</Badge> : <Button size="sm" variant="secondary" onClick={() => setFlag(f)}>{t('admin.trust.resolve')}</Button>) },
        ]} />
      {data && <Pagination page={data.meta.page} pages={data.meta.pages} onChange={setPage} />}
      <Modal open={Boolean(flag)} onClose={() => setFlag(null)} title={t('admin.trust.resolveTitle', { no: flag ? flag.flagNo : '' })} description={flag ? FLAG_RULES[flag.rule] : ''}
        footer={<><Button variant="ghost" onClick={() => setFlag(null)}>{t('common.cancel')}</Button><Button variant={resolution.startsWith('confirm_') && resolution !== 'confirm_warn' ? 'danger' : 'primary'} disabled={note.trim().length < 3} loading={resolve.isPending} onClick={submit}>{t('admin.trust.resolve')}</Button></>}>
        <div className="space-y-4">
          <Select label={t('admin.trust.outcome')} value={resolution} onChange={(e) => setResolution(e.target.value)} options={RESOLUTIONS(t)} />
          <Textarea label={t('admin.trust.note')} rows={3} value={note} onChange={(e) => setNote(e.target.value)} hint={t('admin.trust.noteHint')} />
        </div>
      </Modal>
    </>
  );
}
