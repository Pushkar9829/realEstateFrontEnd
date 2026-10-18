// RE-G-02/08 project review: details, configurations, RERA with auto-check
// warnings and certificate (signed link), checklist and decision; live
// projects can be featured or deactivated.
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, ExternalLink, FileText, Lock, Plus, ShieldCheck, Star, Trash2 } from 'lucide-react';
import { Alert, Badge, Button, Card, CardHeader, Checkbox, PageHeader, PageSpinner, Select, Table, Textarea, useToast } from '@/shared/ui';
import { api } from '@/shared/lib/api';
import { dateTime, rupees, titleCase } from '@/shared/lib/format';
import { useT } from '@/shared/i18n';
import { useAuth } from '@/modules/auth';
import { projectStatus, reraWarning, useAdminProject, useAdminProjectAction, useClaimProject, useDecideProject } from '@/modules/projects/api';

const CHECKS = ['rera_verified', 'details_match', 'media_ok'];
const FIELDS = ['details', 'location', 'configurations', 'rera', 'media', 'commission'];

export default function ProjectReviewPage() {
  const t = useT();
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { user: me, hasPermission } = useAuth();
  const { data: p, isLoading, error } = useAdminProject(id);
  const claim = useClaimProject(id);
  const decide = useDecideProject(id);
  const adminAct = useAdminProjectAction(id);
  const [checks, setChecks] = useState({});
  const [comments, setComments] = useState([]);
  const [reason, setReason] = useState('');
  const [formError, setFormError] = useState(null);

  if (isLoading) return <PageSpinner />;
  if (error) return <Alert tone="danger">{error.message}</Alert>;

  const R = (k, vars) => t(`admin.projects.review.${k}`, vars);
  const s = projectStatus(p.status);
  const claimActive = p.review?.claimedBy && new Date(p.review.claimUntil) > new Date();
  const mine = claimActive && String(p.review.claimedBy) === String(me._id);
  const b = p.builderId || {};
  const r = p.rera || {};
  const openFile = async (fileId) => { try { const x = await api.get(`/admin/projects/${id}/files/${fileId}`); window.open(x.url, '_blank', 'noopener'); } catch (e) { toast.error(e.message); } };
  const run = async (body, msg) => {
    setFormError(null);
    try { await decide.mutateAsync(body); toast.success(msg); navigate('/admin/projects'); } catch (e) { setFormError(e.message); }
  };
  const act = async (body, msg) => { try { await adminAct.mutateAsync(body); toast.success(msg); } catch (e) { toast.error(e.message); } };

  return (
    <>
      <Link to="/admin/projects" className="mb-3 inline-flex items-center gap-1 text-sm text-brand-700 hover:underline"><ArrowLeft className="h-4 w-4" /> {t('admin.projects.title')}</Link>
      <PageHeader title={p.name} breadcrumb={p.projectNo}
        actions={<>
          <Badge tone={s.tone}>{s.label}</Badge>
          {p.status === 'pending_approval' && !claimActive && <Button icon={Lock} loading={claim.isPending} onClick={async () => { try { await claim.mutateAsync(); toast.success(R('claimedToast')); } catch (e) { toast.error(e.message); } }}>{R('claim')}</Button>}
          {['live', 'sold_out'].includes(p.status) && hasPermission('properties.manage') && <Button variant="secondary" icon={Star} onClick={() => act({ action: p.featured?.on ? 'unfeature' : 'feature' }, p.featured?.on ? R('unfeaturedToast') : R('featuredToast'))}>{p.featured?.on ? R('unfeature') : R('feature')}</Button>}
        </>} />
      {claimActive && !mine && <Alert tone="warning" className="mb-4">{R('claimedByOther', { date: dateTime(p.review.claimUntil) })}</Alert>}
      {p.reraExpiry && ['expiring', 'expired'].includes(p.reraExpiry.status) && <Alert tone={p.reraExpiry.status === 'expired' ? 'danger' : 'warning'} className="mb-4" title={p.reraExpiry.status === 'expired' ? R('reraExpired') : R('reraExpiring')}>{R('reraExpiryText', { number: p.reraExpiry.number, date: dateTime(p.reraExpiry.validTill) })}</Alert>}
      {(p.reraWarnings || []).length > 0 && <Alert tone="warning" className="mb-4" title={R('reraChecks')}><ul className="list-disc pl-4">{p.reraWarnings.map((w) => <li key={w}>{reraWarning(w)}</li>)}</ul></Alert>}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card>
            <CardHeader title={R('configurations')} />
            <Table rowKey={(c) => c._id} rows={p.configurations || []} columns={[
              { key: 'name', header: R('colName') },
              { key: 'carpet', header: R('colCarpet'), render: (c) => `${c.carpetMin}–${c.carpetMax}` },
              { key: 'price', header: R('colPrice'), render: (c) => `${rupees(c.priceMin)} – ${rupees(c.priceMax)}` },
              { key: 'units', header: R('colUnits'), render: (c) => `${c.availableUnits} / ${c.totalUnits}` },
            ]} />
          </Card>
          <Card>
            <CardHeader title={R('about')} />
            <p className="whitespace-pre-line text-sm leading-relaxed text-ink-muted">{p.description || R('noDescription')}</p>
            <p className="mt-3 text-sm text-ink-subtle">{[p.location?.addressLine, p.location?.locality, p.location?.city, p.location?.pincode].filter(Boolean).join(', ')} · {R('possession', { status: titleCase(p.possession?.status || '-') })}</p>
            {(p.media?.photos || []).length > 0 && <ul className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">{p.media.photos.map((ph) => <li key={ph.fileId} className="aspect-[4/3] overflow-hidden rounded-md bg-surface-sunken"><img src={ph.url} alt="" className="h-full w-full object-cover" loading="lazy" /></li>)}</ul>}
          </Card>
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader title="RERA" description={R('reraDesc')} />
            {r.exempt?.reason ? (
              <div className="space-y-2 text-sm">
                <Badge tone="warning">{R('exemption')}</Badge>
                <p className="text-ink-muted">{R('exemptDetail', { reason: titleCase(r.exempt.reason), area: r.exempt.plotAreaSqm, units: r.exempt.units })}</p>
                {r.exempt.docFileId && <Button size="sm" variant="secondary" icon={FileText} onClick={() => openFile(r.exempt.docFileId)}>{R('sanctionedPlan')}</Button>}
              </div>
            ) : (
              <ul className="space-y-3">
                {(r.registrations || []).map((x) => (
                  <li key={x.number} className="rounded-md border p-3 text-sm">
                    <p className="font-semibold text-ink">{x.number} <span className="font-normal text-ink-subtle">· {x.state}{x.phaseLabel ? ` · ${x.phaseLabel}` : ''}</span></p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <a href={x.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand-700 hover:underline">{R('officialPage')} <ExternalLink className="h-3.5 w-3.5" /></a>
                      {x.certificateFileId && <Button size="sm" variant="secondary" icon={FileText} onClick={() => openFile(x.certificateFileId)}>{R('certificate')}</Button>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card>
            <CardHeader title={R('builder')} />
            <p className="text-sm text-ink">{b.brand?.name || b.name}</p>
            <p className="text-xs text-ink-subtle">{b.email} · {b.phone}</p>
            <div className="mt-2"><Badge tone={b.kyc?.status === 'verified' ? 'success' : 'warning'}>KYC {titleCase(b.kyc?.status || 'not_started')}</Badge></div>
            {p.activeAgreementId && <p className="mt-3 text-sm text-ink-muted">{R('agreement', { no: p.activeAgreementId.agreementNo, percent: p.activeAgreementId.commissionPercent })}</p>}
          </Card>
          {mine && (
            <Card>
              <CardHeader title={R('decision')} />
              <div className="space-y-4">
                {CHECKS.map((k) => <Checkbox key={k} label={R(`checks.${k}`)} checked={Boolean(checks[k])} onChange={(e) => setChecks((c) => ({ ...c, [k]: e.target.checked }))} />)}
                <Button block icon={ShieldCheck} disabled={!CHECKS.every((k) => checks[k])} loading={decide.isPending} onClick={() => run({ decision: 'approve', checklist: checks }, R('approvedToast'))}>{R('approvePublish')}</Button>
                <div className="border-t pt-4">
                  <div className="mb-2 flex items-center justify-between"><p className="text-sm font-semibold text-ink">{R('requestChanges')}</p><Button size="sm" variant="ghost" icon={Plus} onClick={() => setComments((c) => [...c, { field: 'rera', comment: '' }])}>{R('add')}</Button></div>
                  {comments.map((c, i) => (
                    <div key={i} className="mb-2 grid grid-cols-[120px_1fr_auto] gap-2">
                      <Select aria-label={R('field')} value={c.field} onChange={(e) => setComments((x) => x.map((y, j) => (j === i ? { ...y, field: e.target.value } : y)))} options={FIELDS.map((f) => ({ value: f, label: R(`fields.${f}`) }))} />
                      <input className="h-10 rounded-md border border-line-strong px-3 text-sm" value={c.comment} placeholder={R('whatToFix')} onChange={(e) => setComments((x) => x.map((y, j) => (j === i ? { ...y, comment: e.target.value } : y)))} />
                      <Button variant="ghost" size="sm" icon={Trash2} aria-label={R('remove')} onClick={() => setComments((x) => x.filter((_, j) => j !== i))} />
                    </div>
                  ))}
                  <Button block variant="secondary" disabled={!comments.some((c) => c.comment.trim().length >= 2)} onClick={() => run({ decision: 'changes', comments: comments.filter((c) => c.comment.trim().length >= 2) }, R('sentBackToast'))}>{R('sendBack')}</Button>
                </div>
                <div className="border-t pt-4">
                  <Textarea label={R('rejectReason')} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
                  <Button className="mt-2" block variant="danger" disabled={!reason.trim()} onClick={() => run({ decision: 'reject', reason: reason.trim() }, R('rejectedToast'))}>{R('reject')}</Button>
                </div>
                {formError && <Alert tone="danger"><span className="inline-flex gap-1"><AlertTriangle className="mt-0.5 h-3.5 w-3.5" />{formError}</span></Alert>}
              </div>
            </Card>
          )}
          {['live', 'sold_out'].includes(p.status) && (
            <Card>
              <CardHeader title={R('deactivate')} description={R('deactivateDesc')} />
              <Textarea rows={2} label={R('reason')} value={reason} onChange={(e) => setReason(e.target.value)} />
              <Button className="mt-2" block variant="danger" disabled={reason.trim().length < 3} onClick={() => act({ action: 'deactivate', reason: reason.trim() }, R('deactivatedToast'))}>{R('deactivateProject')}</Button>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
