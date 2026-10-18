// RE-F-04 KYC review: claim (30 min lock), details, auto-checks, documents via
// signed links (each view is audited), per-document verdicts and the decision.
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, CheckCircle2, ExternalLink, Lock, LockOpen, ShieldCheck, XCircle } from 'lucide-react';
import { Alert, Badge, Button, Card, CardHeader, PageHeader, PageSpinner, Textarea, useToast } from '@/shared/ui';
import { cn } from '@/shared/lib/cn';
import { date, dateTime, titleCase } from '@/shared/lib/format';
import { useT } from '@/shared/i18n';
import { useAuth } from '@/modules/auth';
import { CHECK_LABELS, docLabel, kycDocumentUrl, kycStatus, useClaimKyc, useDecideKyc, useKycDetail, useReleaseKyc } from '@/modules/kyc/api';

function Row({ label, children }) {
  return <div className="flex flex-col gap-0.5 py-2 sm:flex-row sm:gap-4"><dt className="w-40 shrink-0 text-sm text-ink-subtle">{label}</dt><dd className="text-sm text-ink">{children || '-'}</dd></div>;
}

export default function KycReviewPage() {
  const t = useT();
  const { userId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { user: me } = useAuth();
  const { data, isLoading, error } = useKycDetail(userId);
  const claim = useClaimKyc(userId);
  const release = useReleaseKyc(userId);
  const decide = useDecideKyc(userId);
  const [verdicts, setVerdicts] = useState({});
  const [comment, setComment] = useState('');
  const [reason, setReason] = useState('');
  const [formError, setFormError] = useState(null);

  if (isLoading) return <PageSpinner />;
  if (error) return <Alert tone="danger">{error.message}</Alert>;

  const { user, kyc, listings } = data;
  const s = kycStatus(kyc.status);
  const claimActive = kyc.claim && new Date(kyc.claim.until) > new Date();
  const mine = claimActive && String(kyc.claim.by) === String(me._id);
  const reviewable = ['submitted', 'under_review'].includes(kyc.status);

  const open = async (doc) => {
    try { const r = await kycDocumentUrl(userId, doc._id); window.open(r.url, '_blank', 'noopener'); } catch (e) { toast.error(e.message); }
  };
  const act = async (fn, msg) => { try { await fn(); if (msg) toast.success(msg); } catch (e) { toast.error(e.message); } };
  const submitDecision = async (decision) => {
    setFormError(null);
    const documents = Object.entries(verdicts).map(([docId, v]) => ({ docId, status: v.status, ...(v.comment ? { comment: v.comment } : {}) }));
    try {
      await decide.mutateAsync({ decision, ...(comment ? { comment } : {}), ...(reason ? { reason } : {}), ...(documents.length ? { documents } : {}) });
      toast.success({ verify: t('admin.kyc.review.toastVerified'), resubmit: t('admin.kyc.review.toastResubmit'), reject: t('admin.kyc.review.toastRejected') }[decision]);
      navigate('/admin/kyc');
    } catch (e) { setFormError(e.message); }
  };

  return (
    <>
      <Link to="/admin/kyc" className="mb-3 inline-flex items-center gap-1 text-sm text-brand-700 hover:underline"><ArrowLeft className="h-4 w-4" /> {t('admin.kyc.title')}</Link>
      <PageHeader title={user.name} description={t('admin.kyc.review.meta', { type: titleCase(user.listerType), email: user.email, phone: user.phone, date: date(user.createdAt) })}
        actions={<>
          <Badge tone={s.tone}>{s.label}</Badge>
          {reviewable && !claimActive && <Button icon={Lock} loading={claim.isPending} onClick={() => act(() => claim.mutateAsync(), t('admin.kyc.review.claimedToast'))}>{t('admin.kyc.review.claim')}</Button>}
          {mine && <Button variant="secondary" icon={LockOpen} loading={release.isPending} onClick={() => act(() => release.mutateAsync(), t('admin.kyc.review.releasedToast'))}>{t('admin.kyc.review.release')}</Button>}
        </>} />
      {claimActive && !mine && <Alert tone="warning" className="mb-4">{t('admin.kyc.review.claimedByOther', { date: dateTime(kyc.claim.until) })}</Alert>}
      {mine && <Alert tone="info" className="mb-4">{t('admin.kyc.review.claimedByMe', { date: dateTime(kyc.claim.until) })}</Alert>}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card>
            <CardHeader title={t('admin.kyc.review.details')} />
            <dl className="divide-y">
              <Row label={t('admin.kyc.review.legalName')}>{kyc.legalName}</Row>
              <Row label="PAN">{kyc.panLast4 ? `••••••${kyc.panLast4}` : null}</Row>
              <Row label={t('admin.kyc.review.dob')}>{kyc.dob && date(kyc.dob)}</Row>
              <Row label={t('admin.kyc.review.aadhaar')}>{kyc.aadhaarLast4 ? `XXXX XXXX ${kyc.aadhaarLast4}` : null}</Row>
              <Row label={t('admin.kyc.review.address')}>{kyc.address && [kyc.address.line1, kyc.address.line2, kyc.address.city, kyc.address.state, kyc.address.pincode].filter(Boolean).join(', ')}</Row>
              {kyc.company && kyc.company.name && <Row label={t('admin.kyc.review.company')}>{[kyc.company.name, kyc.company.type, kyc.company.cin && `CIN ${kyc.company.cin}`, kyc.company.gstin && `GSTIN ${kyc.company.gstin}`, kyc.company.rera && `RERA ${kyc.company.rera}`].filter(Boolean).join(' · ')}</Row>}
              <Row label={t('admin.kyc.review.declaration')}>{kyc.declaration && kyc.declaration.acceptedAt ? t('admin.kyc.review.signed', { name: kyc.declaration.typedName, date: dateTime(kyc.declaration.acceptedAt), ip: kyc.declaration.ip }) : null}</Row>
            </dl>
          </Card>

          <Card>
            <CardHeader title={t('admin.kyc.review.documents')} description={t('admin.kyc.review.documentsDesc')} />
            <ul className="space-y-3">
              {(kyc.documents || []).map((d, i) => {
                const v = verdicts[d._id] || {};
                const status = v.status || d.status;
                return (
                  <li key={d._id || `${d.docType}-${i}`} className={cn('rounded-lg border p-4', status === 'rejected' && 'border-danger-100 bg-danger-50/40', status === 'accepted' && 'border-success-100 bg-success-50/40')}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-ink">{docLabel(d.docType)}</p>
                        <p className="text-xs text-ink-subtle">{t('admin.kyc.review.uploaded', { mime: d.mime, date: date(d.uploadedAt) })}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="secondary" size="sm" icon={ExternalLink} onClick={() => open(d)}>{t('admin.kyc.review.view')}</Button>
                        {mine && <>
                          <Button size="sm" variant={status === 'accepted' ? 'primary' : 'secondary'} icon={CheckCircle2} onClick={() => setVerdicts((x) => ({ ...x, [d._id]: { ...v, status: 'accepted' } }))}>{t('admin.kyc.review.accept')}</Button>
                          <Button size="sm" variant={status === 'rejected' ? 'danger' : 'secondary'} icon={XCircle} onClick={() => setVerdicts((x) => ({ ...x, [d._id]: { ...v, status: 'rejected' } }))}>{t('admin.kyc.review.reject')}</Button>
                        </>}
                      </div>
                    </div>
                    {mine && status === 'rejected' && (
                      <input className="mt-3 h-9 w-full rounded-md border border-line-strong px-3 text-sm" placeholder={t('admin.kyc.review.docWrong')} value={v.comment || ''}
                        onChange={(e) => setVerdicts((x) => ({ ...x, [d._id]: { ...v, status: 'rejected', comment: e.target.value } }))} />
                    )}
                    {!mine && d.comment && <p className="mt-2 text-xs text-danger-700">{t('admin.kyc.review.docComment', { comment: d.comment })}</p>}
                  </li>
                );
              })}
              {!(kyc.documents || []).length && <li className="text-sm text-ink-subtle">{t('admin.kyc.review.noDocuments')}</li>}
            </ul>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title={t('admin.kyc.col.checks')} />
            {(kyc.autoChecks || []).length ? (
              <ul className="space-y-2">
                {kyc.autoChecks.map((c, i) => (
                  <li key={`${c.code}-${i}`} className={cn('flex gap-2 rounded-md p-3 text-sm', c.severity === 'high' ? 'bg-danger-50 text-danger-700' : 'bg-warning-50 text-warning-700')}>
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                    <span><strong className="block">{CHECK_LABELS[c.code] || c.code}</strong>{c.detail}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="flex items-center gap-2 text-sm text-success-700"><ShieldCheck className="h-4 w-4" /> {t('admin.kyc.review.noWarnings')}</p>}
            <div className="mt-4 border-t pt-3 text-xs text-ink-subtle">{t('admin.kyc.review.listings', { list: (listings || []).length ? listings.map((l) => `${titleCase(l._id)} ${l.n}`).join(', ') : t('admin.kyc.review.noneYet') })}</div>
          </Card>

          {mine && (
            <Card>
              <CardHeader title={t('admin.kyc.review.decision')} description={t('admin.kyc.review.decisionDesc')} />
              <div className="space-y-4">
                <Textarea label={t('admin.kyc.review.commentLabel')} rows={3} hint={t('admin.kyc.review.commentHint')} value={comment} onChange={(e) => setComment(e.target.value)} />
                <Textarea label={t('admin.kyc.review.reasonLabel')} rows={2} hint={t('admin.kyc.review.reasonHint')} value={reason} onChange={(e) => setReason(e.target.value)} />
                {formError && <Alert tone="danger">{formError}</Alert>}
                <div className="grid gap-2">
                  <Button icon={ShieldCheck} loading={decide.isPending} onClick={() => submitDecision('verify')}>{t('admin.kyc.review.verify')}</Button>
                  <Button variant="secondary" loading={decide.isPending} onClick={() => submitDecision('resubmit')}>{t('admin.kyc.review.askChanges')}</Button>
                  <Button variant="danger" loading={decide.isPending} onClick={() => submitDecision('reject')}>{t('admin.kyc.review.reject')}</Button>
                </div>
              </div>
            </Card>
          )}
          {!mine && reviewable && !claimActive && <Alert tone="info">{t('admin.kyc.review.claimHint')}</Alert>}
          {kyc.reviewedAt && <Card><CardHeader title={t('admin.kyc.review.lastDecision')} /><p className="text-sm text-ink-muted">{dateTime(kyc.reviewedAt)}{kyc.comment ? ` · "${kyc.comment}"` : ''}{kyc.rejectReason ? ` · ${t('admin.kyc.review.lastReason', { reason: kyc.rejectReason })}` : ''}</p></Card>}
        </div>
      </div>
    </>
  );
}
