// RE-M-10 "Privacy and consents" (RE-S-PUB-10): consents given with their
// date and a withdraw per purpose, "download my data" (a background job; the
// page polls until the link is ready) and the account deletion request.
import { useState } from 'react';
import { Download, FileDown, ShieldOff, Trash2 } from 'lucide-react';
import { Alert, Badge, Button, Card, CardHeader, ConfirmModal, Skeleton, Spinner, Table, Textarea, useToast } from '@/shared/ui';
import { date, dateTime, titleCase } from '@/shared/lib/format';
import { useConsents, useDataExport, useMyDeletionRequest, useRequestDeletion, useStartDataExport, useWithdrawConsent } from '../api';
import { useAuth } from '../AuthProvider';

const PURPOSES = {
  sales_contact: ['Sales contact', 'Our sales team may call or message you about your enquiries.'],
  whatsapp_updates: ['WhatsApp updates', 'Visit reminders and property updates on WhatsApp.'],
  marketing_alerts: ['Marketing alerts', 'Property alerts, offers and news.'],
  partner_sharing: ['Partner sharing', 'Sharing your details with a partner bank or service you asked for.'],
  call_recording: ['Call recording', 'Calls with our team may be recorded for quality.'],
  analytics: ['Analytics', 'Anonymous usage analytics to improve the site.'],
};
const SOURCES = { enquiry: 'Enquiry form', registration: 'Sign-up', whatsapp: 'WhatsApp', agent: 'Recorded by our team', banner: 'Cookie banner' };

function Consents() {
  const toast = useToast();
  const { data, isLoading, isError, refetch } = useConsents();
  const withdraw = useWithdrawConsent();
  const [pending, setPending] = useState(null);
  const rows = (data && data.consents) || [];
  const officer = data && data.grievanceOfficer;
  const confirm = async () => {
    try { await withdraw.mutateAsync(pending); toast.success(`${PURPOSES[pending] ? PURPOSES[pending][0] : titleCase(pending)}: consent withdrawn`); setPending(null); } catch (e) { toast.error(e.message); }
  };
  return (
    <Card>
      <CardHeader title="Consents" description={`What you agreed to and when (Digital Personal Data Protection Act 2023).${data && data.noticeVersion ? ` Privacy notice version ${data.noticeVersion}.` : ''}`} />
      {isError ? <Alert tone="danger" title="Could not load your consents" action={<Button size="sm" variant="secondary" onClick={() => refetch()}>Retry</Button>} />
        : isLoading ? <Skeleton className="h-24" />
          : (
            <Table rows={rows} empty="You have not given any optional consents."
              columns={[
                { key: 'purpose', header: 'Purpose', render: (c) => <span><span className="block font-medium text-ink">{(PURPOSES[c.purpose] || [titleCase(c.purpose)])[0]}</span><span className="block text-xs text-ink-subtle">{(PURPOSES[c.purpose] || [])[1]}</span></span> },
                { key: 'given', header: 'Given', render: (c) => <span className="whitespace-nowrap text-xs">{dateTime(c.givenAt)}<span className="block text-ink-subtle">{SOURCES[c.source] || titleCase(c.source || '')}</span></span> },
                { key: 'state', header: 'Status', render: (c) => (c.withdrawnAt ? <Badge tone="neutral">Withdrawn {date(c.withdrawnAt)}</Badge> : <Badge tone="success">Active</Badge>) },
                { key: 'act', header: '', render: (c) => (c.withdrawnAt ? null : <Button size="sm" variant="ghost" icon={ShieldOff} onClick={() => setPending(c.purpose)}>Withdraw</Button>) },
              ]} />
          )}
      {officer && (officer.name || officer.email) && (
        <p className="mt-3 text-xs text-ink-subtle">Grievance officer: {[officer.name, officer.email].filter(Boolean).join(' · ')}</p>
      )}
      <ConfirmModal open={Boolean(pending)} onClose={() => setPending(null)} onConfirm={confirm} loading={withdraw.isPending} confirmLabel="Withdraw consent" tone="danger"
        title={`Withdraw "${pending ? (PURPOSES[pending] || [titleCase(pending)])[0] : ''}"?`}>
        We stop using your data for this purpose from now on. Messages already scheduled may still arrive for a short while. You can give consent again later, for example on your next enquiry.
      </ConfirmModal>
    </Card>
  );
}

function DataExport() {
  const toast = useToast();
  const { data, isLoading } = useDataExport();
  const start = useStartDataExport();
  const status = data ? data.status : null;
  const working = ['queued', 'running'].includes(status);
  const request = async () => {
    try { await start.mutateAsync(); toast.success('We are preparing your data. We will also email you when it is ready.'); } catch (e) { toast.error(e.message); }
  };
  return (
    <Card>
      <CardHeader title="Download my data" description="A copy of your profile, consents, enquiries, shortlists, saved searches and sign-in history as a JSON file. One request per day; the link is valid for 24 hours." />
      {isLoading ? <Skeleton className="h-10 w-48" />
        : working ? <p className="flex items-center gap-2 text-sm text-ink-muted"><Spinner size="sm" /> Preparing your file (requested {dateTime(data.requestedAt)}). This page updates by itself.</p>
          : status === 'ready' ? (
            <div className="flex flex-wrap items-center gap-3">
              <Button icon={Download} onClick={() => window.open(data.url, '_blank', 'noopener')}>Download my data</Button>
              <span className="text-xs text-ink-subtle">Available until {dateTime(data.expiresAt)}</span>
            </div>
          ) : (
            <div className="space-y-3">
              {status === 'failed' && <Alert tone="danger">The last export failed{data.error ? `: ${data.error}` : ''}. Please try again tomorrow or contact support.</Alert>}
              {status === 'expired' && <p className="text-sm text-ink-muted">Your last download link has expired.</p>}
              <Button variant="secondary" icon={FileDown} loading={start.isPending} disabled={['failed', 'expired'].includes(status)} onClick={request}>Prepare my data</Button>
              {['failed', 'expired'].includes(status) && <p className="text-xs text-ink-subtle">You can request a new file 24 hours after the last request.</p>}
            </div>
          )}
    </Card>
  );
}

const OPEN = ['requested', 'in_progress'];
const DELETION_TEXT = { requested: 'Received', in_progress: 'In progress', completed: 'Completed', rejected: 'Rejected' };

function DeleteAccount() {
  const toast = useToast();
  const { data, isLoading } = useMyDeletionRequest();
  const submit = useRequestDeletion();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const pending = data && OPEN.includes(data.status);
  const confirm = async () => {
    try {
      await submit.mutateAsync(reason.trim() ? { reason: reason.trim() } : {});
      toast.success('Deletion request received. We will process it within 30 days.');
      setOpen(false); setReason('');
    } catch (e) { toast.error(e.message); }
  };
  return (
    <Card>
      <CardHeader title="Delete my account" description="We remove your personal details within 30 days. Records we must keep by law (deals, invoices) are retained without your contact details." />
      {isLoading ? <Skeleton className="h-10 w-48" /> : pending ? (
        <Alert tone="info" title={`Deletion request ${DELETION_TEXT[data.status].toLowerCase()}`}>
          Requested on {date(data.createdAt)}. Due by {date(new Date(new Date(data.createdAt).getTime() + 30 * 86400000))}. Contact support to cancel it.
        </Alert>
      ) : (
        <div className="space-y-3">
          {data && data.status === 'rejected' && <Alert tone="warning" title="Your last request was not completed">{data.note || 'Contact support for details.'}</Alert>}
          <Button variant="danger" icon={Trash2} onClick={() => setOpen(true)}>Request account deletion</Button>
        </div>
      )}
      <ConfirmModal open={open} onClose={() => setOpen(false)} onConfirm={confirm} loading={submit.isPending} tone="danger" confirmLabel="Request deletion" title="Delete your account?">
        <p className="mb-3">Our team reviews the request and anonymises your account within 30 days. An open deal must finish first. You will get an email when it is done.</p>
        <Textarea label="Reason (optional)" rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
      </ConfirmModal>
    </Card>
  );
}

export default function PrivacySettings() {
  const { user } = useAuth();
  const canDelete = ['buyer', 'lister'].includes(user.role);
  return (
    <div className="space-y-6">
      <Consents />
      <DataExport />
      {canDelete && <DeleteAccount />}
    </div>
  );
}
