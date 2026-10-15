// RE-F-06 trust and safety: automatic and manual broker flags with the
// evidence, resolved by dismissing, warning, suspending or banning.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { Badge, Button, Modal, PageHeader, Pagination, Select, Table, Tabs, Textarea, useToast } from '@/shared/ui';
import { dateTime, titleCase } from '@/shared/lib/format';
import { FLAG_RULES, useBrokerFlags, useResolveFlag } from '@/modules/kyc/api';

const RESOLUTIONS = [
  { value: 'dismiss', label: 'Dismiss (not a broker)' },
  { value: 'confirm_warn', label: 'Confirm and warn the lister' },
  { value: 'confirm_suspend', label: 'Confirm and suspend' },
  { value: 'confirm_ban', label: 'Confirm and ban' },
];

function evidenceText(f) {
  const e = f.evidence || {};
  if (f.rule === 'R2') return `${e.active} active listings, limit ${e.limit}`;
  if (f.rule === 'R3') return `Photos match ${(e.matches || []).map((m) => m.listingNo).join(', ')}`;
  if (f.rule === 'R1') return `Proof owners: ${(e.owners || []).join(', ')}`;
  if (f.rule === 'R4') return `${(e.linkedAccounts || []).length} linked account(s)`;
  if (f.rule === 'R6') return `${e.hits24h} blocked attempts in 24 h`;
  if (f.rule === 'manual') return e.note;
  return JSON.stringify(e).slice(0, 120);
}

export default function TrustPage() {
  const toast = useToast();
  const [status, setStatus] = useState('open');
  const [page, setPage] = useState(1);
  const { data, isLoading } = useBrokerFlags({ page, limit: 20, sort: '-createdAt', status });
  const resolve = useResolveFlag();
  const [flag, setFlag] = useState(null);
  const [resolution, setResolution] = useState('dismiss');
  const [note, setNote] = useState('');

  const submit = async () => {
    try { await resolve.mutateAsync({ id: flag._id, body: { resolution, note: note.trim() } }); toast.success('Flag resolved'); setFlag(null); setNote(''); } catch (e) { toast.error(e.message); }
  };

  return (
    <>
      <PageHeader title="Trust and safety" description="Broker detection flags. Each automatic rule raises at most one open flag per lister." />
      <Tabs className="mb-4" value={status} onChange={(v) => { setStatus(v); setPage(1); }} tabs={[{ value: 'open', label: 'Open' }, { value: 'under_review', label: 'Under review' }, { value: 'resolved', label: 'Resolved' }].map((t) => (t.value === status && data ? { ...t, count: data.meta.total } : t))} />
      <Table loading={isLoading} rows={(data && data.items) || []} empty="No flags here. Nice and quiet."
        columns={[
          { key: 'flagNo', header: 'Flag', render: (f) => <span className="font-medium text-ink">{f.flagNo}</span> },
          { key: 'lister', header: 'Lister', render: (f) => (f.listerId ? <Link className="text-brand-700 hover:underline" to={`/admin/listers/${f.listerId._id}`}>{f.listerId.name}</Link> : '-') },
          { key: 'rule', header: 'Rule', render: (f) => <span><Badge tone="warning" icon={ShieldAlert}>{f.rule}</Badge><span className="mt-1 block text-xs text-ink-subtle">{FLAG_RULES[f.rule]}</span></span> },
          { key: 'evidence', header: 'Evidence', render: (f) => <span className="text-sm text-ink-muted">{evidenceText(f)}</span> },
          { key: 'at', header: 'Raised', render: (f) => dateTime(f.createdAt) },
          { key: 'act', header: '', render: (f) => (f.status === 'resolved' ? <Badge>{titleCase(f.resolution)}</Badge> : <Button size="sm" variant="secondary" onClick={() => setFlag(f)}>Resolve</Button>) },
        ]} />
      {data && <Pagination page={data.meta.page} pages={data.meta.pages} onChange={setPage} />}
      <Modal open={Boolean(flag)} onClose={() => setFlag(null)} title={`Resolve ${flag ? flag.flagNo : ''}`} description={flag ? FLAG_RULES[flag.rule] : ''}
        footer={<><Button variant="ghost" onClick={() => setFlag(null)}>Cancel</Button><Button variant={resolution.startsWith('confirm_') && resolution !== 'confirm_warn' ? 'danger' : 'primary'} disabled={note.trim().length < 3} loading={resolve.isPending} onClick={submit}>Resolve</Button></>}>
        <div className="space-y-4">
          <Select label="Outcome" value={resolution} onChange={(e) => setResolution(e.target.value)} options={RESOLUTIONS} />
          <Textarea label="Note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} hint="Recorded in the audit log. Warnings are emailed to the lister." />
        </div>
      </Modal>
    </>
  );
}
