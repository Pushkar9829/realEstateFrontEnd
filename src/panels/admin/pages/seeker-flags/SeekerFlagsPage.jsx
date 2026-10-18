// RE-F-10 / RE-S-ADM-05 seeker flags (users.manage): buyer phones that
// enquired with too many listers or localities, or were flagged by staff.
// Detail shows the leads involved; the decision clears, throttles or blocks.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { Alert, Badge, Button, Card, CardHeader, Input, Modal, PageHeader, Pagination, Select, Spinner, Table, Tabs, Textarea, useToast } from '@/shared/ui';
import { date, dateTime, titleCase } from '@/shared/lib/format';
import { useT } from '@/shared/i18n';
import { SEEKER_ACTIONS, SEEKER_RULES, SEEKER_STATUS, useDecideSeekerFlag, useSeekerFlag, useSeekerFlags } from '@/modules/kyc/seekerApi';

const TABS = (t) => [{ value: 'open', label: t('admin.seekerFlags.tabs.open') }, { value: 'actioned', label: t('admin.seekerFlags.tabs.actioned') }, { value: 'cleared', label: t('admin.seekerFlags.tabs.cleared') }];
const DURATIONS = (t) => [
  { value: '7', label: t('admin.seekerFlags.durations.d7') },
  { value: '30', label: t('admin.seekerFlags.durations.d30') },
  { value: '90', label: t('admin.seekerFlags.durations.d90') },
  { value: 'permanent', label: t('admin.seekerFlags.durations.permanent') },
  { value: 'until', label: t('admin.seekerFlags.durations.until') },
];
const DAY = 86400000;

function FlagDetail({ id, onClose }) {
  const t = useT();
  const toast = useToast();
  const { data: f, isLoading, error } = useSeekerFlag(id);
  const decide = useDecideSeekerFlag();
  const [action, setAction] = useState('throttle');
  const [duration, setDuration] = useState('30');
  const [until, setUntil] = useState('');
  const [note, setNote] = useState('');
  const [formError, setFormError] = useState(null);

  const days = duration === 'permanent' ? undefined
    : duration === 'until' ? (until ? Math.ceil((new Date(`${until}T23:59:59+05:30`).getTime() - Date.now()) / DAY) : null)
      : Number(duration);
  const daysInvalid = action !== 'dismiss' && duration === 'until' && (days == null || days < 1 || days > 365);

  const submit = async () => {
    setFormError(null);
    try {
      await decide.mutateAsync({ id, body: { action, note: note.trim(), ...(action !== 'dismiss' && days ? { days } : {}) } });
      toast.success({ dismiss: t('admin.seekerFlags.toast.dismiss'), throttle: t('admin.seekerFlags.toast.throttle'), block: t('admin.seekerFlags.toast.block') }[action]);
      onClose();
    } catch (e) { setFormError(e.message); }
  };

  return (
    <Modal open onClose={onClose} size="lg" title={f ? t('admin.seekerFlags.detailTitle', { no: f.flagNo }) : t('admin.seekerFlags.detailTitleEmpty')} description={f ? `${f.phoneMasked} · ${SEEKER_RULES[f.rule] || f.rule}` : undefined}
      footer={f && <><Button variant="ghost" onClick={onClose}>{t('common.close')}</Button><Button variant={action === 'block' ? 'danger' : 'primary'} disabled={note.trim().length < 10 || daysInvalid} loading={decide.isPending} onClick={submit}>{t('admin.seekerFlags.saveDecision')}</Button></>}>
      {isLoading && <div className="flex justify-center py-8"><Spinner /></div>}
      {error && <Alert tone="danger">{error.message}</Alert>}
      {f && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div><p className="text-ink-subtle">{t('admin.seekerFlags.counts.listers')}</p><p className="font-semibold text-ink">{f.counts?.listers ?? '-'}</p></div>
            <div><p className="text-ink-subtle">{t('admin.seekerFlags.counts.localities')}</p><p className="font-semibold text-ink">{f.counts?.localities ?? '-'}</p></div>
            <div><p className="text-ink-subtle">{t('admin.seekerFlags.counts.cities')}</p><p className="font-semibold text-ink">{f.counts?.cities ?? '-'}</p></div>
            <div><p className="text-ink-subtle">{t('admin.seekerFlags.counts.enquiries')}</p><p className="font-semibold text-ink">{f.counts?.enquiries ?? '-'}</p></div>
          </div>
          <p className="text-xs text-ink-subtle">{t('admin.seekerFlags.window', { from: date(f.window?.from), to: date(f.window?.to), raised: dateTime(f.createdAt) })}{f.until ? ` · ${t('admin.seekerFlags.currentUntil', { date: dateTime(f.until) })}` : ''}</p>
          {f.note && <p className="rounded-md bg-surface-muted p-3 text-sm text-ink-muted">{f.note}</p>}
          <Card padded={false}>
            <div className="p-4 pb-0"><CardHeader title={t('admin.seekerFlags.leads', { n: (f.leads || []).length })} /></div>
            <ul className="divide-y">
              {(f.leads || []).map((l) => (
                <li key={l._id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm">
                  <span><Link className="font-medium text-brand-700 hover:underline" to={`/admin/leads/${l._id}`}>{l.leadNo}</Link><span className="text-ink-muted"> · {l.propertyId ? `${l.propertyId.listingNo} ${l.propertyId.location?.locality || ''}` : t('admin.seekerFlags.noProperty')}</span></span>
                  <span className="text-xs text-ink-subtle">{titleCase(l.stage)} · {date(l.createdAt)}</span>
                </li>
              ))}
            </ul>
          </Card>
          <div className="space-y-4 border-t pt-4">
            <Select label={t('admin.seekerFlags.decision')} value={action} onChange={(e) => setAction(e.target.value)} options={SEEKER_ACTIONS} />
            {action !== 'dismiss' && (
              <div className="grid gap-3 sm:grid-cols-2">
                <Select label={t('admin.seekerFlags.duration')} value={duration} onChange={(e) => setDuration(e.target.value)} options={DURATIONS(t)} />
                {duration === 'until' && <Input label={t('admin.seekerFlags.until')} type="date" value={until} min={new Date(Date.now() + DAY).toISOString().slice(0, 10)} onChange={(e) => setUntil(e.target.value)} error={daysInvalid && until ? t('admin.seekerFlags.untilError') : undefined} />}
              </div>
            )}
            <Textarea label={t('admin.seekerFlags.note')} required rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} hint={t('admin.seekerFlags.noteHint')} />
            {formError && <Alert tone="danger">{formError}</Alert>}
          </div>
        </div>
      )}
    </Modal>
  );
}

export default function SeekerFlagsPage() {
  const t = useT();
  const [status, setStatus] = useState('open');
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState(null);
  const { data, isLoading, error } = useSeekerFlags({ status, page, limit: 20 });

  return (
    <>
      <PageHeader title={t('admin.seekerFlags.title')} description={t('admin.seekerFlags.description')} />
      <Tabs className="mb-4" value={status} onChange={(v) => { setStatus(v); setPage(1); }} tabs={TABS(t).map((x) => (x.value === status && data ? { ...x, count: data.meta.total } : x))} />
      {error && <Alert tone="danger" className="mb-4">{error.message}</Alert>}
      <Table loading={isLoading} rows={(data && data.items) || []} onRowClick={(f) => setOpenId(f._id)} empty={status === 'open' ? t('admin.seekerFlags.emptyOpen') : t('admin.seekerFlags.empty')}
        columns={[
          { key: 'no', header: t('admin.seekerFlags.col.flag'), render: (f) => <span className="font-medium text-ink">{f.flagNo}</span> },
          { key: 'phone', header: t('admin.seekerFlags.col.phone'), render: (f) => <span className="font-mono text-sm">{f.phoneMasked}</span> },
          { key: 'rule', header: t('admin.seekerFlags.col.rule'), render: (f) => <span><Badge tone="warning" icon={ShieldAlert}>{titleCase(f.rule)}</Badge><span className="mt-1 block text-xs text-ink-subtle">{SEEKER_RULES[f.rule]}</span></span> },
          { key: 'counts', header: t('admin.seekerFlags.col.counts'), render: (f) => <span className="text-sm">{f.counts?.listers ?? '-'} / {f.counts?.localities ?? '-'}<span className="block text-xs text-ink-subtle">{t('admin.seekerFlags.enquiriesCount', { n: f.counts?.enquiries ?? 0 })}</span></span> },
          { key: 'at', header: t('admin.seekerFlags.col.raised'), render: (f) => dateTime(f.createdAt) },
          { key: 'status', header: t('admin.seekerFlags.col.status'), render: (f) => { const s = SEEKER_STATUS[f.status] || { label: f.status, tone: 'neutral' }; return <span><Badge tone={s.tone}>{f.status === 'actioned' ? titleCase(f.action) : s.label}</Badge>{f.until && <span className="block text-xs text-ink-subtle">{t('admin.seekerFlags.untilDate', { date: date(f.until) })}</span>}{f.status === 'open' && f.action && f.action !== 'none' && <span className="block text-xs text-ink-subtle">{t('admin.seekerFlags.auto', { action: f.action })}</span>}</span>; } },
          { key: 'act', header: '', render: () => <Button size="sm" variant="secondary">{t('admin.seekerFlags.open')}</Button> },
        ]} />
      {data && <Pagination page={data.meta.page} pages={data.meta.pages} onChange={setPage} />}
      {openId && <FlagDetail id={openId} onClose={() => setOpenId(null)} />}
    </>
  );
}
