// RE-S-ADM-29 audit logs and login history (logs.view): tabs Audit log
// (append-only, before/after diff), Login history and Contact reveals. The
// audit log and login history export to CSV with the current filters.
import { useState } from 'react';
import { Download, Eye } from 'lucide-react';
import { Alert, Badge, Button, FiltersBox, Input, Modal, PageHeader, Pagination, Select, Table, Tabs, useToast } from '@/shared/ui';
import { dateTime, titleCase } from '@/shared/lib/format';
import { useT } from '@/shared/i18n';
import { useAuditLogExport, useAuditLogs, useContactReveals, useLoginHistoryAdmin, useLoginHistoryExport } from '@/modules/reports/adminApi';

// Populated actor (name) when available; older rows or deleted users fall back to the id.
const actorName = (r, t) => (!r.actorId ? t('admin.audit.system') : typeof r.actorId === 'object' ? (r.actorId.name || r.actorId.email || r.actorId._id) : String(r.actorId).slice(-8));

const dayStart = (d) => (d ? `${d}T00:00:00+05:30` : undefined);
const dayEnd = (d) => (d ? `${d}T23:59:59+05:30` : undefined);
const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== ''));
const OID = /^[a-f0-9]{24}$/i;

// Export button: downloads the CSV with the auth header and warns when capped.
function ExportButton({ mutation, params }) {
  const toast = useToast();
  const t = useT();
  const run = async () => {
    try {
      const out = await mutation.mutateAsync(params);
      if (out && out.truncated) toast.info(t('admin.audit.truncated'));
      else toast.success(t('admin.audit.exportDone'));
    } catch (e) { toast.error(e.message); }
  };
  return <Button variant="secondary" icon={Download} loading={mutation.isPending} onClick={run}>{t('admin.audit.exportCsv')}</Button>;
}

function Json({ value }) {
  if (value === undefined || value === null) return <p className="text-xs text-ink-subtle">-</p>;
  return <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-md bg-surface-sunken p-3 text-xs text-ink">{JSON.stringify(value, null, 2)}</pre>;
}

function Diff({ before, after }) {
  const t = useT();
  const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
  if (!isObj(before) && !isObj(after)) return <div className="grid gap-3 sm:grid-cols-2"><div><p className="mb-1 text-xs font-semibold text-ink-subtle">{t('admin.audit.before')}</p><Json value={before} /></div><div><p className="mb-1 text-xs font-semibold text-ink-subtle">{t('admin.audit.after')}</p><Json value={after} /></div></div>;
  const keys = [...new Set([...Object.keys(before || {}), ...Object.keys(after || {})])];
  const show = (v) => (v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v));
  return (
    <table className="min-w-full text-xs">
      <thead><tr className="text-left text-ink-subtle"><th className="py-1 pr-3">{t('admin.audit.field')}</th><th className="py-1 pr-3">{t('admin.audit.before')}</th><th className="py-1">{t('admin.audit.after')}</th></tr></thead>
      <tbody className="divide-y">
        {keys.map((k) => {
          const b = show((before || {})[k]); const a = show((after || {})[k]);
          return <tr key={k}><td className="py-1.5 pr-3 font-medium text-ink">{k}</td><td className="break-all py-1.5 pr-3 text-danger-700">{b}</td><td className={`break-all py-1.5 ${a !== b ? 'text-success-700' : 'text-ink-muted'}`}>{a}</td></tr>;
        })}
      </tbody>
    </table>
  );
}

function AuditTab() {
  const t = useT();
  const [f, setF] = useState({ action: '', entityType: '', entityId: '', actorId: '', from: '', to: '' });
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(null);
  const set = (k) => (e) => { setF((x) => ({ ...x, [k]: e.target.value })); setPage(1); };
  const params = clean({ page, limit: 25, action: f.action.trim(), entityType: f.entityType.trim(), entityId: OID.test(f.entityId.trim()) ? f.entityId.trim() : undefined, actorId: OID.test(f.actorId.trim()) ? f.actorId.trim() : undefined, from: dayStart(f.from), to: dayEnd(f.to) });
  const { data, isLoading, error } = useAuditLogs(params);
  const exporter = useAuditLogExport();
  return (
    <>
      <div className="mb-3 flex justify-end"><ExportButton mutation={exporter} params={params} /></div>
      <div className="mb-4"><FiltersBox count={Object.values(f).filter(Boolean).length}>
      <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <Input label={t('admin.audit.actionStarts')} placeholder="deal.verify" value={f.action} onChange={set('action')} />
        <Input label={t('admin.audit.entityType')} placeholder="Deal" value={f.entityType} onChange={set('entityType')} />
        <Input label={t('admin.audit.entityId')} value={f.entityId} onChange={set('entityId')} error={f.entityId && !OID.test(f.entityId.trim()) ? t('admin.audit.idError') : undefined} />
        <Input label={t('admin.audit.actorId')} value={f.actorId} onChange={set('actorId')} error={f.actorId && !OID.test(f.actorId.trim()) ? t('admin.audit.idError') : undefined} />
        <Input label={t('admin.audit.from')} type="date" value={f.from} onChange={set('from')} />
        <Input label={t('admin.audit.to')} type="date" value={f.to} onChange={set('to')} />
      </div>
      </FiltersBox></div>
      {error && <Alert tone="danger" className="mb-3">{error.message}</Alert>}
      <Table loading={isLoading} rows={(data && data.items) || []} onRowClick={setOpen} empty={t('admin.audit.emptyAudit')}
        columns={[
          { key: 'at', header: t('admin.audit.time'), render: (r) => <span className="whitespace-nowrap text-xs">{dateTime(r.at)}</span> },
          { key: 'actor', header: t('admin.audit.actor'), render: (r) => <span className="text-xs"><span className="font-medium text-ink">{actorName(r, t)}</span><span className="block text-ink-subtle">{titleCase(r.actorRole || '')}</span></span> },
          { key: 'action', header: t('admin.audit.action'), render: (r) => <span className="font-mono text-xs text-ink">{r.action}</span> },
          { key: 'entity', header: t('admin.audit.entity'), render: (r) => <span className="text-xs">{r.entityType || '-'}{r.entityId && <span className="block font-mono text-ink-subtle">{r.entityId}</span>}</span> },
          { key: 'reason', header: t('admin.audit.reason'), render: (r) => <span className="block max-w-[16rem] truncate text-xs" title={r.reason}>{r.reason || '-'}</span> },
          { key: 'ip', header: t('admin.audit.ip'), render: (r) => <span className="font-mono text-xs">{r.ip || '-'}</span> },
          { key: 'view', header: '', render: (r) => <Button size="sm" variant="ghost" icon={Eye} aria-label={t('admin.audit.viewChange')} onClick={(e) => { e.stopPropagation(); setOpen(r); }} /> },
        ]} />
      {data && <Pagination page={data.meta.page} pages={data.meta.pages} onChange={setPage} />}
      <Modal open={Boolean(open)} onClose={() => setOpen(null)} size="lg" title={open ? open.action : ''} description={open ? `${dateTime(open.at)} · ${open.entityType || ''} ${open.entityId || ''}` : ''}>
        {open && (
          <div className="space-y-4">
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div><dt className="text-xs text-ink-subtle">{t('admin.audit.actor')}</dt><dd className="text-xs">{actorName(open, t)} ({open.actorRole || '-'}){open.actorId && typeof open.actorId === 'object' ? <span className="block font-mono text-ink-subtle">{open.actorId._id}</span> : null}</dd></div>
              <div><dt className="text-xs text-ink-subtle">{t('admin.audit.ipUa')}</dt><dd className="break-all text-xs">{open.ip || '-'} · {open.ua || '-'}</dd></div>
              {open.reason && <div className="sm:col-span-2"><dt className="text-xs text-ink-subtle">{t('admin.audit.reason')}</dt><dd>{open.reason}</dd></div>}
            </dl>
            <Diff before={open.before} after={open.after} />
          </div>
        )}
      </Modal>
    </>
  );
}

function LoginsTab() {
  const t = useT();
  const [userId, setUserId] = useState('');
  const [success, setSuccess] = useState('');
  const [page, setPage] = useState(1);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const params = clean({ page, limit: 25, userId: OID.test(userId.trim()) ? userId.trim() : undefined, success, from: dayStart(from), to: dayEnd(to) });
  const { data, isLoading, error } = useLoginHistoryAdmin(params);
  const exporter = useLoginHistoryExport();
  return (
    <>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="grid flex-1 gap-3 sm:grid-cols-[16rem_12rem_10rem_10rem]">
          <Input label={t('admin.audit.userId')} value={userId} onChange={(e) => { setUserId(e.target.value); setPage(1); }} error={userId && !OID.test(userId.trim()) ? t('admin.audit.idError') : undefined} />
          <Select label={t('admin.audit.result')} value={success} onChange={(e) => { setSuccess(e.target.value); setPage(1); }} placeholder={t('admin.audit.all')} options={[{ value: 'true', label: t('admin.audit.success') }, { value: 'false', label: t('admin.audit.failed') }]} />
          <Input label={t('admin.audit.from')} type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
          <Input label={t('admin.audit.to')} type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
        </div>
        <ExportButton mutation={exporter} params={params} />
      </div>
      {error && <Alert tone="danger" className="mb-3">{error.message}</Alert>}
      <Table loading={isLoading} rows={(data && data.items) || []} empty={t('admin.audit.emptyLogins')}
        columns={[
          { key: 'at', header: t('admin.audit.time'), render: (r) => <span className="whitespace-nowrap text-xs">{dateTime(r.at)}</span> },
          { key: 'user', header: t('admin.audit.user'), render: (r) => (r.userId && typeof r.userId === 'object' ? <span className="text-sm">{r.userId.name}<span className="block text-xs text-ink-subtle">{r.userId.email} · {titleCase(r.userId.role)}</span></span> : <span className="font-mono text-xs">{String(r.userId || '-')}</span>) },
          { key: 'success', header: t('admin.audit.result'), render: (r) => <Badge tone={r.success ? 'success' : 'danger'}>{r.success ? t('admin.audit.success') : t('admin.audit.failed')}</Badge> },
          { key: 'method', header: t('admin.audit.method'), render: (r) => titleCase(r.method || '-') },
          { key: 'reason', header: t('admin.audit.reason'), render: (r) => r.reason ? titleCase(r.reason) : '-' },
          { key: 'ip', header: t('admin.audit.ip'), render: (r) => <span className="font-mono text-xs">{r.ip || '-'}</span> },
          { key: 'ua', header: t('admin.audit.ua'), render: (r) => <span className="block max-w-[18rem] truncate text-xs" title={r.ua}>{r.ua || '-'}</span> },
        ]} />
      {data && <Pagination page={data.meta.page} pages={data.meta.pages} onChange={setPage} />}
    </>
  );
}

function RevealsTab() {
  const t = useT();
  const [f, setF] = useState({ actorId: '', subjectType: '', from: '', to: '' });
  const [page, setPage] = useState(1);
  const set = (k) => (e) => { setF((x) => ({ ...x, [k]: e.target.value })); setPage(1); };
  const { data, isLoading, error } = useContactReveals(clean({ page, limit: 25, actorId: OID.test(f.actorId.trim()) ? f.actorId.trim() : undefined, subjectType: f.subjectType, from: dayStart(f.from), to: dayEnd(f.to) }));
  return (
    <>
      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        <Input label={t('admin.audit.staffUserId')} value={f.actorId} onChange={set('actorId')} error={f.actorId && !OID.test(f.actorId.trim()) ? t('admin.audit.idError') : undefined} />
        <Select label={t('admin.audit.whoseContact')} value={f.subjectType} onChange={set('subjectType')} placeholder={t('admin.audit.buyerAndLister')} options={[{ value: 'buyer', label: t('admin.audit.buyer') }, { value: 'lister', label: t('admin.audit.lister') }]} />
        <Input label={t('admin.audit.from')} type="date" value={f.from} onChange={set('from')} />
        <Input label={t('admin.audit.to')} type="date" value={f.to} onChange={set('to')} />
      </div>
      {error && <Alert tone="danger" className="mb-3">{error.message}</Alert>}
      <Table loading={isLoading} rows={(data && data.items) || []} empty={t('admin.audit.emptyReveals')}
        columns={[
          { key: 'at', header: t('admin.audit.time'), render: (r) => <span className="whitespace-nowrap text-xs">{dateTime(r.createdAt)}</span> },
          { key: 'actor', header: t('admin.audit.revealedBy'), render: (r) => (r.actorId && typeof r.actorId === 'object' ? <span className="text-sm">{r.actorId.name}<span className="block text-xs text-ink-subtle">{titleCase(r.actorId.role)}</span></span> : '-') },
          { key: 'subject', header: t('admin.audit.contactOf'), render: (r) => <span className="text-xs"><Badge tone={r.subjectType === 'buyer' ? 'info' : 'accent'}>{titleCase(r.subjectType)}</Badge> <span className="font-mono text-ink-subtle">{String(r.subjectId || '').slice(-8)}</span></span> },
          { key: 'field', header: t('admin.audit.field'), render: (r) => titleCase(r.field) },
          { key: 'context', header: t('admin.audit.leadProperty'), render: (r) => <span className="font-mono text-xs text-ink-subtle">{r.leadId ? t('admin.audit.leadRef', { id: String(r.leadId).slice(-8) }) : ''}{r.propertyId ? ` ${t('admin.audit.propRef', { id: String(r.propertyId).slice(-8) })}` : ''}{!r.leadId && !r.propertyId ? '-' : ''}</span> },
          { key: 'ip', header: t('admin.audit.ip'), render: (r) => <span className="font-mono text-xs">{r.ip || '-'}</span> },
        ]} />
      {data && <Pagination page={data.meta.page} pages={data.meta.pages} onChange={setPage} />}
    </>
  );
}

export default function AuditLogsPage() {
  const t = useT();
  const [tab, setTab] = useState('audit');
  return (
    <>
      <PageHeader title={t('admin.audit.title')} description={t('admin.audit.desc')} />
      <Tabs className="mb-4" value={tab} onChange={setTab} tabs={[{ value: 'audit', label: t('admin.audit.tabAudit') }, { value: 'logins', label: t('admin.audit.tabLogins') }, { value: 'reveals', label: t('admin.audit.tabReveals') }]} />
      {tab === 'audit' && <AuditTab />}
      {tab === 'logins' && <LoginsTab />}
      {tab === 'reveals' && <RevealsTab />}
    </>
  );
}
