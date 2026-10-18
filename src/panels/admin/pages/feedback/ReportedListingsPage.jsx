// RE-E-13 / RE-S-ADM-05 reported listings (properties.manage): reports from
// buyers and guests with age against the review SLA, decided by dismissing,
// asking the lister to fix, pausing or taking the listing down, and
// optionally raising a broker flag on the lister (RE-F-06).
import { useState } from 'react';
import { Flag } from 'lucide-react';
import { Alert, Badge, Button, Checkbox, Modal, PageHeader, Pagination, Select, Table, Tabs, Textarea, useToast } from '@/shared/ui';
import { dateTime, timeAgo } from '@/shared/lib/format';
import { listingStatus } from '@/modules/listings/api';
import { FLAGGABLE_ACTIONS, REPORT_ACTIONS, REPORT_REASONS, REPORT_STATUS, useActionReport, useListingReports } from '@/modules/search/adminApi';
import { useT } from '@/shared/i18n';

const SLA = { green: ['success', 'onTime'], amber: ['warning', 'dueSoon'], red: ['danger', 'overdue'] };
const OPEN_TAB = 'open,under_review';
const TABS = (t) => [
  { value: OPEN_TAB, label: t('admin.feedback.tabs.open') },
  { value: 'actioned', label: t('admin.feedback.tabs.actioned') },
  { value: 'dismissed', label: t('admin.feedback.tabs.dismissed') },
];

export default function ReportedListingsPage() {
  const t = useT();
  const toast = useToast();
  const [status, setStatus] = useState(OPEN_TAB);
  const [page, setPage] = useState(1);
  const { data, isLoading, error } = useListingReports({ status, page, limit: 20 });
  const act = useActionReport();
  const [report, setReport] = useState(null);
  const [action, setAction] = useState('ask_fix');
  const [note, setNote] = useState('');
  const [flag, setFlag] = useState(false);
  const [formError, setFormError] = useState(null);
  const rows = (data && data.items) || [];
  const isOpen = status === OPEN_TAB;
  const perListing = rows.reduce((m, r) => { const k = String(r.propertyId?._id || r.propertyId); m[k] = (m[k] || 0) + 1; return m; }, {});
  const minNote = action === 'dismiss' ? 3 : 10;

  const openModal = (r) => { setReport(r); setAction('ask_fix'); setNote(''); setFlag(r.reason === 'broker'); setFormError(null); };
  const withFlag = action === 'raise_broker_flag' || (flag && FLAGGABLE_ACTIONS.includes(action));
  const submit = async () => {
    setFormError(null);
    try {
      const body = { action, note: note.trim() };
      if (withFlag && action !== 'raise_broker_flag') body.flag = true;
      const res = await act.mutateAsync({ id: report._id, body });
      const flagText = res && res.brokerFlag ? t('admin.feedback.flagOpen', { no: res.brokerFlag.flagNo }) : '';
      toast.success(action === 'dismiss' ? t('admin.feedback.dismissedToast') : action === 'raise_broker_flag' ? `${t('admin.feedback.flagRaisedToast')}${flagText}` : `${t('admin.feedback.actionedToast')}${flagText}`);
      setReport(null);
    } catch (e) { setFormError(e.message); }
  };

  return (
    <>
      <PageHeader title={t('panel.nav.adminFeedback')} description={t('admin.feedback.description')} />
      <Tabs className="mb-4" value={status} onChange={(v) => { setStatus(v); setPage(1); }} tabs={TABS(t).map((x) => (x.value === status && data ? { ...x, count: data.meta.total } : x))} />
      {error && <Alert tone="danger" className="mb-4">{error.message}</Alert>}
      <Table loading={isLoading} rows={rows} empty={isOpen ? t('admin.feedback.emptyOpen') : t('admin.feedback.emptyOther')}
        columns={[
          { key: 'no', header: t('admin.feedback.col.no'), render: (r) => <span className="font-medium text-ink">{r.reportNo}</span> },
          { key: 'listing', header: t('admin.feedback.col.listing'), render: (r) => { const p = r.propertyId; if (!p) return '-'; const s = listingStatus(p.status); return (
            <span className="block max-w-xs">
              <span className="block truncate text-sm">{p.status === 'live' && p.slug ? <a className="text-brand-700 hover:underline" href={`/property/${p.slug}`} target="_blank" rel="noreferrer">{p.title}</a> : p.title}</span>
              <span className="text-xs text-ink-subtle">{p.listingNo} · {p.location?.city} · </span><Badge tone={s.tone}>{s.label}</Badge>
              {perListing[String(p._id)] > 1 && <Badge className="ml-1" tone="warning" icon={Flag}>{t('admin.feedback.reportCount', { count: perListing[String(p._id)] })}</Badge>}
            </span>
          ); } },
          { key: 'reason', header: t('admin.feedback.col.reason'), render: (r) => <span><span className="text-sm">{REPORT_REASONS[r.reason] || r.reason}</span>{r.details && <span className="block max-w-sm text-xs text-ink-subtle">{r.details}</span>}</span> },
          { key: 'at', header: t('admin.feedback.col.at'), render: (r) => <span className="whitespace-nowrap text-sm" title={dateTime(r.createdAt)}>{timeAgo(r.createdAt)}</span> },
          isOpen
            ? { key: 'sla', header: t('admin.feedback.col.sla'), render: (r) => { const [tone, label] = SLA[(r.sla && r.sla.level) || 'green']; return <span title={r.sla ? t('admin.feedback.slaAge', { age: r.sla.ageHours, hours: r.sla.hours }) : undefined}><Badge tone={tone}>{t(`admin.feedback.sla.${label}`)}</Badge></span>; } }
            : { key: 'outcome', header: t('admin.feedback.col.outcome'), render: (r) => { const s = REPORT_STATUS[r.status] || {}; return <span><Badge tone={s.tone}>{(REPORT_ACTIONS.find((a) => a.value === r.action) || {}).label || s.label}</Badge>{r.note && <span className="block max-w-xs text-xs text-ink-subtle">{r.note}</span>}</span>; } },
          { key: 'act', header: '', render: (r) => (['open', 'under_review'].includes(r.status) ? <Button size="sm" variant="secondary" onClick={() => openModal(r)}>{t('admin.feedback.decide')}</Button> : null) },
        ]} />
      {data && <Pagination page={data.meta.page} pages={data.meta.pages} onChange={setPage} />}

      <Modal open={Boolean(report)} onClose={() => setReport(null)} title={report ? t('admin.feedback.decideTitle', { no: report.reportNo }) : ''} description={report ? `${REPORT_REASONS[report.reason] || report.reason} · ${report.propertyId?.listingNo || ''}` : ''}
        footer={<><Button variant="ghost" onClick={() => setReport(null)}>{t('common.cancel')}</Button><Button variant={['pause', 'take_down'].includes(action) ? 'danger' : 'primary'} disabled={note.trim().length < minNote} loading={act.isPending} onClick={submit}>{t('common.confirm')}</Button></>}>
        <div className="space-y-4">
          {report?.details && <p className="rounded-md bg-surface-muted p-3 text-sm text-ink-muted">{report.details}</p>}
          <Select label={t('admin.feedback.action')} value={action} onChange={(e) => setAction(e.target.value)} options={REPORT_ACTIONS} />
          {action === 'pause' && <Alert tone="warning">{t('admin.feedback.pauseNote')}</Alert>}
          {action === 'take_down' && <Alert tone="danger">{t('admin.feedback.takeDownNote')}</Alert>}
          {action === 'raise_broker_flag' && <Alert tone="warning">{t('admin.feedback.flagNote')}</Alert>}
          {FLAGGABLE_ACTIONS.includes(action) && <Checkbox label={t('admin.feedback.alsoFlag')} description={t('admin.feedback.alsoFlagHint')} checked={flag} onChange={(e) => setFlag(e.target.checked)} />}
          <Textarea label={['dismiss', 'raise_broker_flag'].includes(action) ? t('admin.feedback.internalNote') : t('admin.feedback.listerNote')} required rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} hint={t('admin.feedback.noteHint', { min: minNote })} />
          {formError && <Alert tone="danger">{formError}</Alert>}
        </div>
      </Modal>
    </>
  );
}
