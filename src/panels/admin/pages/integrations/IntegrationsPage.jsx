// RE-S-ADM-30 jobs and MLM outbox (integrations.manage): outbox events with
// counts per status, payload and attempt log, retry and mark dead; background
// jobs with retry of failed ones; status cards per channel (provider from the
// server config, settings switch, last success and failure).
import { useState } from 'react';
import { RotateCw, Search, Skull } from 'lucide-react';
import { Alert, Badge, Button, Card, Input, Modal, PageHeader, Pagination, Select, Spinner, Table, Tabs, Textarea, useToast } from '@/shared/ui';
import { cn } from '@/shared/lib/cn';
import { useT } from '@/shared/i18n';
import { dateTime, timeAgo } from '@/shared/lib/format';
import { INTEGRATION_HEALTH, JOB_STATUS, OUTBOX_STATUS, OUTBOX_TYPES, useIntegrationsStatus, useJobs, useMarkDead, useOutbox, useOutboxEvent, useRetryJob, useRetryOutbox } from '@/modules/mlm/api';

const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== ''));
const tone = (map, s) => (map[s] || { tone: 'neutral', label: s });

function EventDrawer({ id, onClose }) {
  const toast = useToast();
  const t = useT();
  const { data: e, isLoading, error } = useOutboxEvent(id);
  const retry = useRetryOutbox();
  const dead = useMarkDead();
  const [reason, setReason] = useState('');
  const [confirmDead, setConfirmDead] = useState(false);
  const act = async (fn, msg) => { try { await fn(); toast.success(msg); } catch (err) { toast.error(err.message); } };
  return (
    <Modal open onClose={onClose} size="lg" title={e ? `${e.type} · ${e.eventId}` : t('admin.integrations.outboxEvent')} description={t('admin.integrations.eventDesc')}
      footer={e && e.status !== 'sent' ? <>
        <Button variant="danger" icon={Skull} onClick={() => setConfirmDead(true)} disabled={e.status === 'dead'}>{t('admin.integrations.markDead')}</Button>
        <Button icon={RotateCw} loading={retry.isPending} onClick={() => act(() => retry.mutateAsync(e._id), t('admin.integrations.queuedRetry'))}>{t('admin.integrations.retryNow')}</Button>
      </> : null}>
      {isLoading && <div className="flex justify-center py-8"><Spinner /></div>}
      {error && <Alert tone="danger">{error.message}</Alert>}
      {e && (
        <div className="space-y-4">
          <dl className="grid gap-2 text-sm sm:grid-cols-3">
            <div><dt className="text-xs text-ink-subtle">{t('admin.integrations.status')}</dt><dd><Badge tone={tone(OUTBOX_STATUS, e.status).tone}>{tone(OUTBOX_STATUS, e.status).label}</Badge></dd></div>
            <div><dt className="text-xs text-ink-subtle">{t('admin.integrations.attempts')}</dt><dd>{e.attempts}</dd></div>
            <div><dt className="text-xs text-ink-subtle">{t('admin.integrations.lastResponse')}</dt><dd>{e.responseCode || '-'}</dd></div>
            <div><dt className="text-xs text-ink-subtle">{t('admin.integrations.created')}</dt><dd className="text-xs">{dateTime(e.createdAt)}</dd></div>
            <div><dt className="text-xs text-ink-subtle">{t('admin.integrations.nextAttempt')}</dt><dd className="text-xs">{e.status === 'pending' ? dateTime(e.nextAttemptAt) : '-'}</dd></div>
            <div><dt className="text-xs text-ink-subtle">{t('admin.integrations.sent')}</dt><dd className="text-xs">{dateTime(e.sentAt)}</dd></div>
            <div className="sm:col-span-3"><dt className="text-xs text-ink-subtle">{t('admin.integrations.aggregate')}</dt><dd className="font-mono text-xs">{e.aggregateId || '-'}</dd></div>
            {e.lastError && <div className="sm:col-span-3"><dt className="text-xs text-ink-subtle">{t('admin.integrations.lastError')}</dt><dd className="text-xs text-danger-700">{e.lastError}</dd></div>}
          </dl>
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-subtle">{t('admin.integrations.payload')}</p>
            <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-all rounded-md bg-surface-sunken p-3 text-xs text-ink">{JSON.stringify(e.payload, null, 2)}</pre>
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-subtle">{t('admin.integrations.attemptLog')}</p>
            {(e.attemptLog || []).length ? (
              <table className="min-w-full text-xs">
                <thead><tr className="text-left text-ink-subtle"><th className="py-1 pr-3">{t('admin.integrations.time')}</th><th className="py-1 pr-3">{t('admin.integrations.response')}</th><th className="py-1">{t('admin.integrations.error')}</th></tr></thead>
                <tbody className="divide-y">{[...e.attemptLog].reverse().map((a, i) => <tr key={i}><td className="whitespace-nowrap py-1.5 pr-3">{dateTime(a.at)}</td><td className="py-1.5 pr-3">{a.responseCode || '-'}</td><td className="break-all py-1.5 text-danger-700">{a.error || ''}</td></tr>)}</tbody>
              </table>
            ) : <p className="text-xs text-ink-subtle">{t('admin.integrations.noAttempts')}</p>}
          </div>
          {confirmDead && (
            <div className="rounded-md border border-danger-100 bg-danger-50 p-3">
              <Textarea label={t('admin.integrations.stopReason')} rows={2} value={reason} onChange={(ev) => setReason(ev.target.value)} />
              <div className="mt-2 flex justify-end gap-2">
                <Button size="sm" variant="secondary" onClick={() => setConfirmDead(false)}>{t('common.cancel')}</Button>
                <Button size="sm" variant="danger" disabled={reason.trim().length < 3} loading={dead.isPending} onClick={() => act(() => dead.mutateAsync({ id: e._id, reason: reason.trim() }), t('admin.integrations.markedDead')).then(() => setConfirmDead(false))}>{t('admin.integrations.stopRetries')}</Button>
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function OutboxTab() {
  const t = useT();
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(null);
  const { data, isLoading, error } = useOutbox(clean({ page, limit: 25, sort: '-createdAt', status, type, q: q.trim() }));
  const counts = (data && data.meta.counts) || {};
  return (
    <>
      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        {Object.entries(OUTBOX_STATUS).map(([k, s]) => (
          <button key={k} type="button" onClick={() => { setStatus(status === k ? '' : k); setPage(1); }}
            className={cn('rounded-lg border bg-white p-4 text-left shadow-sm transition hover:border-brand-300', status === k && 'border-brand-600 ring-2 ring-brand-500/20')}>
            <span className="block text-xs text-ink-subtle">{s.label}</span>
            <span className={cn('mt-1 block text-2xl font-semibold', k === 'dead' && counts[k] ? 'text-danger-700' : 'text-ink')}>{counts[k] || 0}</span>
          </button>
        ))}
      </div>
      <div className="mb-4 grid gap-3 sm:grid-cols-[14rem_14rem_1fr]">
        <Select aria-label={t('admin.integrations.eventType')} value={type} onChange={(e) => { setType(e.target.value); setPage(1); }} placeholder={t('admin.integrations.allEventTypes')} options={OUTBOX_TYPES.map((x) => ({ value: x, label: x }))} />
        <Select aria-label={t('admin.integrations.status')} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} placeholder={t('admin.integrations.allStatuses')} options={Object.entries(OUTBOX_STATUS).map(([value, s]) => ({ value, label: s.label }))} />
        <Input aria-label={t('admin.integrations.eventSearch')} placeholder={t('admin.integrations.eventSearchPh')} leading={<Search className="h-4 w-4" />} value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
      </div>
      {error && <Alert tone="danger" className="mb-3">{error.message}</Alert>}
      <Table loading={isLoading} rows={(data && data.items) || []} onRowClick={(r) => setOpen(r._id)} empty={t('admin.integrations.emptyOutbox')}
        columns={[
          { key: 'eventId', header: t('admin.integrations.event'), render: (r) => <span><span className="block font-mono text-xs text-ink">{r.eventId}</span><span className="text-xs text-ink-subtle">{r.type}{r.payload?.data?.dealNo ? ` · ${r.payload.data.dealNo}` : ''}</span></span> },
          { key: 'status', header: t('admin.integrations.status'), render: (r) => <Badge tone={tone(OUTBOX_STATUS, r.status).tone}>{tone(OUTBOX_STATUS, r.status).label}</Badge> },
          { key: 'attempts', header: t('admin.integrations.attempts'), render: (r) => r.attempts },
          { key: 'code', header: t('admin.integrations.lastCode'), render: (r) => r.responseCode || '-' },
          { key: 'next', header: t('admin.integrations.nextRetry'), render: (r) => <span className="whitespace-nowrap text-xs">{r.status === 'pending' ? dateTime(r.nextAttemptAt) : '-'}</span> },
          { key: 'error', header: t('admin.integrations.lastError'), render: (r) => <span className="block max-w-[16rem] truncate text-xs text-danger-700" title={r.lastError}>{r.lastError || ''}</span> },
          { key: 'created', header: t('admin.integrations.created'), render: (r) => <span className="whitespace-nowrap text-xs" title={dateTime(r.createdAt)}>{timeAgo(r.createdAt)}</span> },
        ]} />
      {data && <Pagination page={data.meta.page} pages={data.meta.pages} onChange={setPage} />}
      {open && <EventDrawer id={open} onClose={() => setOpen(null)} />}
    </>
  );
}

function JobsTab() {
  const toast = useToast();
  const t = useT();
  const [status, setStatus] = useState('failed');
  const [type, setType] = useState('');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(null);
  const { data, isLoading, error } = useJobs(clean({ page, limit: 25, sort: '-createdAt', status, type: type.trim() }));
  const retry = useRetryJob();
  const doRetry = async (e, j) => { e.stopPropagation(); try { await retry.mutateAsync(j._id); toast.success(t('admin.integrations.jobQueued', { type: j.type })); } catch (err) { toast.error(err.message); } };
  return (
    <>
      <div className="mb-4 grid gap-3 sm:grid-cols-[14rem_16rem]">
        <Select aria-label={t('admin.integrations.status')} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} placeholder={t('admin.integrations.allStatuses')} options={Object.entries(JOB_STATUS).map(([value, s]) => ({ value, label: s.label }))} />
        <Input aria-label={t('admin.integrations.jobType')} placeholder={t('admin.integrations.jobTypePh')} value={type} onChange={(e) => { setType(e.target.value); setPage(1); }} />
      </div>
      {error && <Alert tone="danger" className="mb-3">{error.message}</Alert>}
      <Table loading={isLoading} rows={(data && data.items) || []} onRowClick={setOpen} empty={t('admin.integrations.emptyJobs')}
        columns={[
          { key: 'type', header: t('admin.integrations.type'), render: (r) => <span className="font-mono text-xs text-ink">{r.type}</span> },
          { key: 'status', header: t('admin.integrations.status'), render: (r) => <Badge tone={tone(JOB_STATUS, r.status).tone}>{tone(JOB_STATUS, r.status).label}</Badge> },
          { key: 'attempts', header: t('admin.integrations.attempts'), render: (r) => `${r.attempts} / ${r.maxAttempts}` },
          { key: 'runAt', header: t('admin.integrations.runAt'), render: (r) => <span className="whitespace-nowrap text-xs">{dateTime(r.runAt)}</span> },
          { key: 'error', header: t('admin.integrations.lastError'), render: (r) => <span className="block max-w-[20rem] truncate text-xs text-danger-700" title={r.lastError}>{r.lastError || ''}</span> },
          { key: 'finished', header: t('admin.integrations.finished'), render: (r) => <span className="whitespace-nowrap text-xs">{dateTime(r.finishedAt)}</span> },
          { key: 'retry', header: '', render: (r) => (['failed', 'dead'].includes(r.status) ? <Button size="sm" variant="secondary" icon={RotateCw} loading={retry.isPending && retry.variables === r._id} onClick={(e) => doRetry(e, r)}>{t('common.retry')}</Button> : null) },
        ]} />
      {data && <Pagination page={data.meta.page} pages={data.meta.pages} onChange={setPage} />}
      <Modal open={Boolean(open)} onClose={() => setOpen(null)} title={open ? open.type : ''} description={open ? `${t('admin.integrations.createdAt', { date: dateTime(open.createdAt) })}${open.uniqueKey ? ` · ${t('admin.integrations.keyRef', { key: open.uniqueKey })}` : ''}` : ''}>
        {open && <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-all rounded-md bg-surface-sunken p-3 text-xs text-danger-700">{open.lastError || t('admin.integrations.noError')}</pre>}
      </Modal>
    </>
  );
}

function When({ label, at, tracked }) {
  const t = useT();
  return (
    <div>
      <dt className="text-xs text-ink-subtle">{label}</dt>
      <dd className="text-xs text-ink" title={at ? dateTime(at) : undefined}>{!tracked ? t('admin.integrations.notRecorded') : at ? timeAgo(at) : t('admin.integrations.never')}</dd>
    </div>
  );
}

function StatusCards() {
  const t = useT();
  const { data, isLoading, error } = useIntegrationsStatus();
  if (isLoading) return <div className="mb-6 flex justify-center py-6"><Spinner /></div>;
  if (error) return <Alert tone="danger" className="mb-6">{error.message}</Alert>;
  return (
    <section aria-label={t('admin.integrations.statusAria')} className="mb-6">
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {data.channels.map((c) => {
          const h = tone(INTEGRATION_HEALTH, c.status);
          return (
            <li key={c.key}>
              <Card className="h-full" padded={false}>
                <div className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-ink">{c.label}</h3>
                      <p className="truncate text-xs text-ink-subtle" title={c.detail}><span className="font-mono">{c.provider}</span>{c.detail ? ` · ${c.detail}` : ''}</p>
                    </div>
                    <Badge tone={h.tone}>{h.label}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <Badge tone={c.enabled ? 'success' : 'neutral'}>{c.enabled ? t('admin.integrations.enabled') : t('admin.integrations.disabled')}{c.settingKey ? ` (${c.settingKey})` : ''}</Badge>
                    {!c.configured && <Badge tone="warning">{t('admin.integrations.keysMissing')}</Badge>}
                    {c.queued ? <Badge tone="info">{t('admin.integrations.nQueued', { n: c.queued })}</Badge> : null}
                    {c.dead ? <Badge tone="danger">{t('admin.integrations.nDead', { n: c.dead })}</Badge> : null}
                  </div>
                  <dl className="grid grid-cols-2 gap-2">
                    <When label={t('admin.integrations.lastSuccess')} at={c.lastSuccessAt} tracked={c.tracked?.success} />
                    <When label={t('admin.integrations.lastFailure')} at={c.lastFailureAt} tracked={c.tracked?.failure} />
                  </dl>
                  {c.lastError && <p className={cn('line-clamp-2 break-all text-xs', c.status === 'error' ? 'text-danger-700' : 'text-ink-subtle')} title={c.lastError}>{c.lastError}</p>}
                  {c.note && <p className="text-xs text-ink-subtle">{c.note}</p>}
                </div>
              </Card>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-xs text-ink-subtle">{t('admin.integrations.checked', { ago: timeAgo(data.checkedAt) })}</p>
    </section>
  );
}

export default function IntegrationsPage() {
  const t = useT();
  const [tab, setTab] = useState('outbox');
  return (
    <>
      <PageHeader title={t('admin.integrations.title')} description={t('admin.integrations.desc')} />
      <StatusCards />
      <Tabs className="mb-4" value={tab} onChange={setTab} tabs={[{ value: 'outbox', label: t('admin.integrations.tabOutbox') }, { value: 'jobs', label: t('admin.integrations.tabJobs') }]} />
      {tab === 'outbox' ? <OutboxTab /> : <JobsTab />}
    </>
  );
}
