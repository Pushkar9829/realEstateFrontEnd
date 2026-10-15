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

const SLA = { green: ['success', 'On time'], amber: ['warning', 'Due soon'], red: ['danger', 'Overdue'] };
const TABS = [
  { value: 'open,under_review', label: 'Open' },
  { value: 'actioned', label: 'Actioned' },
  { value: 'dismissed', label: 'Dismissed' },
];

export default function ReportedListingsPage() {
  const toast = useToast();
  const [status, setStatus] = useState(TABS[0].value);
  const [page, setPage] = useState(1);
  const { data, isLoading, error } = useListingReports({ status, page, limit: 20 });
  const act = useActionReport();
  const [report, setReport] = useState(null);
  const [action, setAction] = useState('ask_fix');
  const [note, setNote] = useState('');
  const [flag, setFlag] = useState(false);
  const [formError, setFormError] = useState(null);
  const rows = (data && data.items) || [];
  const isOpen = status === TABS[0].value;
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
      const flagText = res && res.brokerFlag ? ` Broker flag ${res.brokerFlag.flagNo} is open.` : '';
      toast.success(action === 'dismiss' ? 'Report dismissed' : action === 'raise_broker_flag' ? `Broker flag raised.${flagText}` : `Report actioned; the lister is notified.${flagText}`);
      setReport(null);
    } catch (e) { setFormError(e.message); }
  };

  return (
    <>
      <PageHeader title="Reported listings" description="Reports from buyers and guests, oldest first. Acting on one closes the other open reports on the same listing." />
      <Tabs className="mb-4" value={status} onChange={(v) => { setStatus(v); setPage(1); }} tabs={TABS.map((t) => (t.value === status && data ? { ...t, count: data.meta.total } : t))} />
      {error && <Alert tone="danger" className="mb-4">{error.message}</Alert>}
      <Table loading={isLoading} rows={rows} empty={isOpen ? 'No open reports.' : 'Nothing here.'}
        columns={[
          { key: 'no', header: 'Report', render: (r) => <span className="font-medium text-ink">{r.reportNo}</span> },
          { key: 'listing', header: 'Listing', render: (r) => { const p = r.propertyId; if (!p) return '-'; const s = listingStatus(p.status); return (
            <span className="block max-w-xs">
              <span className="block truncate text-sm">{p.status === 'live' && p.slug ? <a className="text-brand-700 hover:underline" href={`/property/${p.slug}`} target="_blank" rel="noreferrer">{p.title}</a> : p.title}</span>
              <span className="text-xs text-ink-subtle">{p.listingNo} · {p.location?.city} · </span><Badge tone={s.tone}>{s.label}</Badge>
              {perListing[String(p._id)] > 1 && <Badge className="ml-1" tone="warning" icon={Flag}>{perListing[String(p._id)]} reports</Badge>}
            </span>
          ); } },
          { key: 'reason', header: 'Reason', render: (r) => <span><span className="text-sm">{REPORT_REASONS[r.reason] || r.reason}</span>{r.details && <span className="block max-w-sm text-xs text-ink-subtle">{r.details}</span>}</span> },
          { key: 'at', header: 'Received', render: (r) => <span className="whitespace-nowrap text-sm" title={dateTime(r.createdAt)}>{timeAgo(r.createdAt)}</span> },
          isOpen
            ? { key: 'sla', header: 'SLA', render: (r) => { const [tone, label] = SLA[(r.sla && r.sla.level) || 'green']; return <span title={r.sla ? `${r.sla.ageHours} h of ${r.sla.hours} h` : undefined}><Badge tone={tone}>{label}</Badge></span>; } }
            : { key: 'outcome', header: 'Outcome', render: (r) => { const s = REPORT_STATUS[r.status] || {}; return <span><Badge tone={s.tone}>{(REPORT_ACTIONS.find((a) => a.value === r.action) || {}).label || s.label}</Badge>{r.note && <span className="block max-w-xs text-xs text-ink-subtle">{r.note}</span>}</span>; } },
          { key: 'act', header: '', render: (r) => (['open', 'under_review'].includes(r.status) ? <Button size="sm" variant="secondary" onClick={() => openModal(r)}>Decide</Button> : null) },
        ]} />
      {data && <Pagination page={data.meta.page} pages={data.meta.pages} onChange={setPage} />}

      <Modal open={Boolean(report)} onClose={() => setReport(null)} title={report ? `Decide ${report.reportNo}` : ''} description={report ? `${REPORT_REASONS[report.reason] || report.reason} · ${report.propertyId?.listingNo || ''}` : ''}
        footer={<><Button variant="ghost" onClick={() => setReport(null)}>Cancel</Button><Button variant={['pause', 'take_down'].includes(action) ? 'danger' : 'primary'} disabled={note.trim().length < minNote} loading={act.isPending} onClick={submit}>Confirm</Button></>}>
        <div className="space-y-4">
          {report?.details && <p className="rounded-md bg-surface-muted p-3 text-sm text-ink-muted">{report.details}</p>}
          <Select label="Action" value={action} onChange={(e) => setAction(e.target.value)} options={REPORT_ACTIONS} />
          {action === 'pause' && <Alert tone="warning">The listing is paused for admin review; only an admin can resume it.</Alert>}
          {action === 'take_down' && <Alert tone="danger">The listing is deactivated with this note as the reason.</Alert>}
          {action === 'raise_broker_flag' && <Alert tone="warning">A broker flag is opened on the lister with this report as evidence. The lister is not notified; resolve the flag on the broker flags page.</Alert>}
          {FLAGGABLE_ACTIONS.includes(action) && <Checkbox label="Also raise a broker flag on the lister" description="Opens (or adds this report to) the lister's broker flag for review." checked={flag} onChange={(e) => setFlag(e.target.checked)} />}
          <Textarea label={['dismiss', 'raise_broker_flag'].includes(action) ? 'Internal note' : 'Note to the lister'} required rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} hint={`${minNote}-500 characters. Recorded in the audit log.`} />
          {formError && <Alert tone="danger">{formError}</Alert>}
        </div>
      </Modal>
    </>
  );
}
