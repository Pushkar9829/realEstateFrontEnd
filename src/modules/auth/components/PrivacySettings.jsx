// RE-M-10 "Privacy and consents" (RE-S-PUB-10): consents given with their
// date and a withdraw per purpose, "download my data" (a background job; the
// page polls until the link is ready) and the account deletion request.
import { useState } from 'react';
import { Download, FileDown, ShieldOff, Trash2 } from 'lucide-react';
import { Alert, Badge, Button, Card, CardHeader, ConfirmModal, Skeleton, Spinner, Table, Textarea, useToast } from '@/shared/ui';
import { date, dateTime, titleCase } from '@/shared/lib/format';
import { useT } from '@/shared/i18n';
import { useConsents, useDataExport, useMyDeletionRequest, useRequestDeletion, useStartDataExport, useWithdrawConsent } from '../api';
import { useAuth } from '../AuthProvider';

// Purposes and sources with text under account.privacySettings.purposes / .sources.
const PURPOSES = new Set(['sales_contact', 'whatsapp_updates', 'marketing_alerts', 'partner_sharing', 'call_recording', 'analytics']);
const SOURCES = new Set(['enquiry', 'registration', 'whatsapp', 'agent', 'banner']);

const purposeLabel = (t, p) => (PURPOSES.has(p) ? t(`account.privacySettings.purposes.${p}.label`) : titleCase(p));
const purposeText = (t, p) => (PURPOSES.has(p) ? t(`account.privacySettings.purposes.${p}.text`) : undefined);
const sourceLabel = (t, s) => (SOURCES.has(s) ? t(`account.privacySettings.sources.${s}`) : titleCase(s || ''));

function Consents() {
  const t = useT();
  const toast = useToast();
  const { data, isLoading, isError, refetch } = useConsents();
  const withdraw = useWithdrawConsent();
  const [pending, setPending] = useState(null);
  const rows = (data && data.consents) || [];
  const officer = data && data.grievanceOfficer;
  const confirm = async () => {
    try { await withdraw.mutateAsync(pending); toast.success(t('account.privacySettings.withdrawn', { purpose: purposeLabel(t, pending) })); setPending(null); } catch (e) { toast.error(e.message); }
  };
  const description = data && data.noticeVersion
    ? `${t('account.privacySettings.consentsDesc')} ${t('account.privacySettings.noticeVersion', { version: data.noticeVersion })}`
    : t('account.privacySettings.consentsDesc');
  return (
    <Card>
      <CardHeader title={t('account.privacySettings.consentsTitle')} description={description} />
      {isError ? <Alert tone="danger" title={t('account.privacySettings.consentsError')} action={<Button size="sm" variant="secondary" onClick={() => refetch()}>{t('common.retry')}</Button>} />
        : isLoading ? <Skeleton className="h-24" />
          : (
            <Table rows={rows} empty={t('account.privacySettings.consentsEmpty')}
              columns={[
                { key: 'purpose', header: t('account.privacySettings.purpose'), render: (c) => <span><span className="block font-medium text-ink">{purposeLabel(t, c.purpose)}</span><span className="block text-xs text-ink-subtle">{purposeText(t, c.purpose)}</span></span> },
                { key: 'given', header: t('account.privacySettings.given'), render: (c) => <span className="whitespace-nowrap text-xs">{dateTime(c.givenAt)}<span className="block text-ink-subtle">{sourceLabel(t, c.source)}</span></span> },
                { key: 'state', header: t('account.privacySettings.status'), render: (c) => (c.withdrawnAt ? <Badge tone="neutral">{t('account.privacySettings.withdrawnOn', { date: date(c.withdrawnAt) })}</Badge> : <Badge tone="success">{t('account.privacySettings.active')}</Badge>) },
                { key: 'act', header: '', render: (c) => (c.withdrawnAt ? null : <Button size="sm" variant="ghost" icon={ShieldOff} onClick={() => setPending(c.purpose)}>{t('account.privacySettings.withdraw')}</Button>) },
              ]} />
          )}
      {officer && (officer.name || officer.email) && (
        <p className="mt-3 text-xs text-ink-subtle">{t('account.privacySettings.grievanceOfficer', { who: [officer.name, officer.email].filter(Boolean).join(' · ') })}</p>
      )}
      <ConfirmModal open={Boolean(pending)} onClose={() => setPending(null)} onConfirm={confirm} loading={withdraw.isPending} confirmLabel={t('account.privacySettings.withdrawConsent')} tone="danger"
        title={t('account.privacySettings.withdrawTitle', { purpose: pending ? purposeLabel(t, pending) : '' })}>
        {t('account.privacySettings.withdrawText')}
      </ConfirmModal>
    </Card>
  );
}

function DataExport() {
  const t = useT();
  const toast = useToast();
  const { data, isLoading } = useDataExport();
  const start = useStartDataExport();
  const status = data ? data.status : null;
  const working = ['queued', 'running'].includes(status);
  const request = async () => {
    try { await start.mutateAsync(); toast.success(t('account.privacySettings.exportStarted')); } catch (e) { toast.error(e.message); }
  };
  return (
    <Card>
      <CardHeader title={t('account.privacySettings.exportTitle')} description={t('account.privacySettings.exportDesc')} />
      {isLoading ? <Skeleton className="h-10 w-48" />
        : working ? <p className="flex items-center gap-2 text-sm text-ink-muted"><Spinner size="sm" /> {t('account.privacySettings.preparing', { date: dateTime(data.requestedAt) })}</p>
          : status === 'ready' ? (
            <div className="flex flex-wrap items-center gap-3">
              <Button icon={Download} onClick={() => window.open(data.url, '_blank', 'noopener')}>{t('account.privacySettings.exportTitle')}</Button>
              <span className="text-xs text-ink-subtle">{t('account.privacySettings.availableUntil', { date: dateTime(data.expiresAt) })}</span>
            </div>
          ) : (
            <div className="space-y-3">
              {status === 'failed' && <Alert tone="danger">{data.error ? t('account.privacySettings.exportFailedWith', { error: data.error }) : t('account.privacySettings.exportFailed')}</Alert>}
              {status === 'expired' && <p className="text-sm text-ink-muted">{t('account.privacySettings.exportExpired')}</p>}
              <Button variant="secondary" icon={FileDown} loading={start.isPending} disabled={['failed', 'expired'].includes(status)} onClick={request}>{t('account.privacySettings.prepare')}</Button>
              {['failed', 'expired'].includes(status) && <p className="text-xs text-ink-subtle">{t('account.privacySettings.exportAgain')}</p>}
            </div>
          )}
    </Card>
  );
}

const OPEN = ['requested', 'in_progress'];
const DELETION_STATUSES = new Set(['requested', 'in_progress', 'completed', 'rejected']);

function DeleteAccount() {
  const t = useT();
  const toast = useToast();
  const { data, isLoading } = useMyDeletionRequest();
  const submit = useRequestDeletion();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const pending = data && OPEN.includes(data.status);
  const confirm = async () => {
    try {
      await submit.mutateAsync(reason.trim() ? { reason: reason.trim() } : {});
      toast.success(t('account.privacySettings.deletionReceived'));
      setOpen(false); setReason('');
    } catch (e) { toast.error(e.message); }
  };
  return (
    <Card>
      <CardHeader title={t('account.privacySettings.deleteTitle')} description={t('account.privacySettings.deleteDesc')} />
      {isLoading ? <Skeleton className="h-10 w-48" /> : pending ? (
        <Alert tone="info" title={DELETION_STATUSES.has(data.status) ? t(`account.privacySettings.deletionStatus.${data.status}`) : titleCase(data.status)}>
          {t('account.privacySettings.deletionDates', { requested: date(data.createdAt), due: date(new Date(new Date(data.createdAt).getTime() + 30 * 86400000)) })}
        </Alert>
      ) : (
        <div className="space-y-3">
          {data && data.status === 'rejected' && <Alert tone="warning" title={t('account.privacySettings.lastRejected')}>{data.note || t('account.privacySettings.contactSupport')}</Alert>}
          <Button variant="danger" icon={Trash2} onClick={() => setOpen(true)}>{t('account.privacySettings.requestDeletion')}</Button>
        </div>
      )}
      <ConfirmModal open={open} onClose={() => setOpen(false)} onConfirm={confirm} loading={submit.isPending} tone="danger" confirmLabel={t('account.privacySettings.confirmDeletion')} title={t('account.privacySettings.deleteConfirmTitle')}>
        <p className="mb-3">{t('account.privacySettings.deleteConfirmText')}</p>
        <Textarea label={t('account.enquiries.reasonOptional')} rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
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
