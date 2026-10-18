// RE-F-04 KYC review: claim (30 min lock), details, auto-checks, documents via
// signed links (each view is audited), per-document verdicts and the decision.
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, CheckCircle2, ExternalLink, Lock, LockOpen, ShieldCheck, XCircle } from 'lucide-react';
import { Alert, Badge, Button, Card, CardHeader, PageHeader, PageSpinner, Textarea, useToast } from '@/shared/ui';
import { cn } from '@/shared/lib/cn';
import { date, dateTime, titleCase } from '@/shared/lib/format';
import { useAuth } from '@/modules/auth';
import { CHECK_LABELS, docLabel, kycDocumentUrl, kycStatus, useClaimKyc, useDecideKyc, useKycDetail, useReleaseKyc } from '@/modules/kyc/api';

function Row({ label, children }) {
  return <div className="flex flex-col gap-0.5 py-2 sm:flex-row sm:gap-4"><dt className="w-40 shrink-0 text-sm text-ink-subtle">{label}</dt><dd className="text-sm text-ink">{children || '-'}</dd></div>;
}

export default function KycReviewPage() {
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
      toast.success({ verify: 'Lister verified', resubmit: 'Sent back to the lister for changes', reject: 'KYC rejected' }[decision]);
      navigate('/admin/kyc');
    } catch (e) { setFormError(e.message); }
  };

  return (
    <>
      <Link to="/admin/kyc" className="mb-3 inline-flex items-center gap-1 text-sm text-brand-700 hover:underline"><ArrowLeft className="h-4 w-4" /> KYC queue</Link>
      <PageHeader title={user.name} description={`${titleCase(user.listerType)} · ${user.email} · ${user.phone} · joined ${date(user.createdAt)}`}
        actions={<>
          <Badge tone={s.tone}>{s.label}</Badge>
          {reviewable && !claimActive && <Button icon={Lock} loading={claim.isPending} onClick={() => act(() => claim.mutateAsync(), 'Claimed for 30 minutes')}>Claim to review</Button>}
          {mine && <Button variant="secondary" icon={LockOpen} loading={release.isPending} onClick={() => act(() => release.mutateAsync(), 'Released')}>Release</Button>}
        </>} />
      {claimActive && !mine && <Alert tone="warning" className="mb-4">Another reviewer is working on this KYC until {dateTime(kyc.claim.until)}.</Alert>}
      {mine && <Alert tone="info" className="mb-4">You hold this review until {dateTime(kyc.claim.until)}.</Alert>}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card>
            <CardHeader title="Submitted details" />
            <dl className="divide-y">
              <Row label="Legal name">{kyc.legalName}</Row>
              <Row label="PAN">{kyc.panLast4 ? `••••••${kyc.panLast4}` : null}</Row>
              <Row label="Date of birth">{kyc.dob && date(kyc.dob)}</Row>
              <Row label="Aadhaar">{kyc.aadhaarLast4 ? `XXXX XXXX ${kyc.aadhaarLast4}` : null}</Row>
              <Row label="Address">{kyc.address && [kyc.address.line1, kyc.address.line2, kyc.address.city, kyc.address.state, kyc.address.pincode].filter(Boolean).join(', ')}</Row>
              {kyc.company && kyc.company.name && <Row label="Company">{[kyc.company.name, kyc.company.type, kyc.company.cin && `CIN ${kyc.company.cin}`, kyc.company.gstin && `GSTIN ${kyc.company.gstin}`, kyc.company.rera && `RERA ${kyc.company.rera}`].filter(Boolean).join(' · ')}</Row>}
              <Row label="Declaration">{kyc.declaration && kyc.declaration.acceptedAt ? `Signed "${kyc.declaration.typedName}" on ${dateTime(kyc.declaration.acceptedAt)} from ${kyc.declaration.ip}` : null}</Row>
            </dl>
          </Card>

          <Card>
            <CardHeader title="Documents" description="Opening a document creates a 10-minute link and is recorded in the audit log." />
            <ul className="space-y-3">
              {(kyc.documents || []).map((d, i) => {
                const v = verdicts[d._id] || {};
                const status = v.status || d.status;
                return (
                  <li key={d._id || `${d.docType}-${i}`} className={cn('rounded-lg border p-4', status === 'rejected' && 'border-danger-100 bg-danger-50/40', status === 'accepted' && 'border-success-100 bg-success-50/40')}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-ink">{docLabel(d.docType)}</p>
                        <p className="text-xs text-ink-subtle">{d.mime} · uploaded {date(d.uploadedAt)}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="secondary" size="sm" icon={ExternalLink} onClick={() => open(d)}>View</Button>
                        {mine && <>
                          <Button size="sm" variant={status === 'accepted' ? 'primary' : 'secondary'} icon={CheckCircle2} onClick={() => setVerdicts((x) => ({ ...x, [d._id]: { ...v, status: 'accepted' } }))}>Accept</Button>
                          <Button size="sm" variant={status === 'rejected' ? 'danger' : 'secondary'} icon={XCircle} onClick={() => setVerdicts((x) => ({ ...x, [d._id]: { ...v, status: 'rejected' } }))}>Reject</Button>
                        </>}
                      </div>
                    </div>
                    {mine && status === 'rejected' && (
                      <input className="mt-3 h-9 w-full rounded-md border border-line-strong px-3 text-sm" placeholder="What is wrong with this document?" value={v.comment || ''}
                        onChange={(e) => setVerdicts((x) => ({ ...x, [d._id]: { ...v, status: 'rejected', comment: e.target.value } }))} />
                    )}
                    {!mine && d.comment && <p className="mt-2 text-xs text-danger-700">Comment: {d.comment}</p>}
                  </li>
                );
              })}
              {!(kyc.documents || []).length && <li className="text-sm text-ink-subtle">No documents uploaded.</li>}
            </ul>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Auto-checks" />
            {(kyc.autoChecks || []).length ? (
              <ul className="space-y-2">
                {kyc.autoChecks.map((c, i) => (
                  <li key={`${c.code}-${i}`} className={cn('flex gap-2 rounded-md p-3 text-sm', c.severity === 'high' ? 'bg-danger-50 text-danger-700' : 'bg-warning-50 text-warning-700')}>
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                    <span><strong className="block">{CHECK_LABELS[c.code] || c.code}</strong>{c.detail}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="flex items-center gap-2 text-sm text-success-700"><ShieldCheck className="h-4 w-4" /> No warnings</p>}
            <div className="mt-4 border-t pt-3 text-xs text-ink-subtle">Listings: {(listings || []).length ? listings.map((l) => `${titleCase(l._id)} ${l.n}`).join(', ') : 'none yet'}</div>
          </Card>

          {mine && (
            <Card>
              <CardHeader title="Decision" description="The lister is notified by email and in-app." />
              <div className="space-y-4">
                <Textarea label="Comment to the lister" rows={3} hint="Required when asking for changes." value={comment} onChange={(e) => setComment(e.target.value)} />
                <Textarea label="Rejection reason" rows={2} hint="Required when rejecting. Rejection suspends any live listings." value={reason} onChange={(e) => setReason(e.target.value)} />
                {formError && <Alert tone="danger">{formError}</Alert>}
                <div className="grid gap-2">
                  <Button icon={ShieldCheck} loading={decide.isPending} onClick={() => submitDecision('verify')}>Verify lister</Button>
                  <Button variant="secondary" loading={decide.isPending} onClick={() => submitDecision('resubmit')}>Ask for changes</Button>
                  <Button variant="danger" loading={decide.isPending} onClick={() => submitDecision('reject')}>Reject</Button>
                </div>
              </div>
            </Card>
          )}
          {!mine && reviewable && !claimActive && <Alert tone="info">Claim this KYC to accept or reject documents and decide.</Alert>}
          {kyc.reviewedAt && <Card><CardHeader title="Last decision" /><p className="text-sm text-ink-muted">{dateTime(kyc.reviewedAt)}{kyc.comment ? ` · "${kyc.comment}"` : ''}{kyc.rejectReason ? ` · Reason: ${kyc.rejectReason}` : ''}</p></Card>}
        </div>
      </div>
    </>
  );
}
