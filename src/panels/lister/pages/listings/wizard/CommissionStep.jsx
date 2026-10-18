// Step 7: mandatory commission % within admin limits and click-wrap acceptance
// of the agreement (typed name, time and IP recorded). RE-A-09/10.
import { useMemo, useState } from 'react';
import { CheckCircle2, FileSignature } from 'lucide-react';
import { Alert, Badge, Button, Card, CardHeader, Checkbox, Input, PageSpinner, useToast } from '@/shared/ui';
import { dateTime, rupees } from '@/shared/lib/format';
import { useAuth } from '@/modules/auth';
import { priceOf, useAcceptCommission, useAgreementTemplate } from '@/modules/listings/api';
import { useT } from '@/shared/i18n';

function render(body, vars) {
  return String(body || '').replace(/\{\{(\w+)\}\}/g, (_, k) => (vars[k] !== undefined && vars[k] !== '' ? vars[k] : `[${k}]`));
}

export default function CommissionStep({ listing, next, back }) {
  const t = useT();
  const { user } = useAuth();
  const toast = useToast();
  const tpl = useAgreementTemplate(listing.purpose);
  const accept = useAcceptCommission(listing._id);
  const [percent, setPercent] = useState(listing.commission?.percent ? String(listing.commission.percent) : '');
  const [name, setName] = useState(listing.commission?.acceptedName || user.kyc?.legalName || user.name);
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState(null);

  const limits = tpl.data && tpl.data.limits;
  const pct = Number(percent);
  const validPct = limits && pct >= limits.min && pct <= limits.max && Math.round(pct * 100) === pct * 100;
  const base = priceOf(listing);
  const basePaise = listing.purpose === 'rent' ? (base || 0) * 12 : base || 0;
  const example = validPct && basePaise ? Math.round((basePaise * pct) / 100) : null;
  const text = useMemo(() => render(tpl.data && tpl.data.body, {
    listerName: user.kyc?.legalName || user.name, companyName: 'the platform', propertyRef: `${listing.listingNo} - ${listing.title || ''}`,
    commissionPercent: validPct ? pct.toFixed(2) : '', nonCircumventionMonths: tpl.data && tpl.data.nonCircumventionMonths, acceptedName: name, acceptedAt: 'on acceptance',
  }), [tpl.data, user, listing, validPct, pct, name]);

  if (tpl.isLoading) return <PageSpinner />;
  if (tpl.error) return <Alert tone="danger">{tpl.error.message}</Alert>;

  const save = async () => {
    setError(null);
    try {
      const r = await accept.mutateAsync({ percent: pct, accept: true, typedName: name.trim() });
      toast.success(r.pendingRevision ? t('lister.wizard.comm.savedReview') : t('lister.wizard.comm.accepted', { no: r.agreementNo }));
      next();
    } catch (e) { setError(e.fieldErrors?.percent || e.message); }
  };

  return (
    <div className="space-y-6">
      {listing.commission?.acceptedAt && (
        <Alert tone="success" title={t('lister.wizard.comm.acceptedAt', { pct: listing.commission.percent })}>{t('lister.wizard.comm.acceptedBy', { name: listing.commission.acceptedName, date: dateTime(listing.commission.acceptedAt) })}</Alert>
      )}
      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <Card>
          <CardHeader title={t('lister.wizard.steps.commission')} description={t('lister.wizard.comm.desc', { min: limits.min, max: limits.max, basis: listing.purpose === 'rent' ? t('lister.wizard.comm.basisRent') : t('lister.wizard.comm.basisSale') })} />
          <Input label={t('lister.wizard.comm.percent')} required type="number" step="0.01" min={limits.min} max={limits.max} value={percent} onChange={(e) => setPercent(e.target.value)}
            error={percent && !validPct ? t('lister.wizard.comm.range', { min: limits.min, max: limits.max }) : undefined} />
          {example != null && (
            <div className="mt-4 rounded-md bg-brand-50 p-4 text-sm text-brand-700">
              {t('lister.wizard.comm.example1', { base: rupees(basePaise) })} <strong>{rupees(example)}</strong> {t('lister.wizard.comm.example2')}
            </div>
          )}
          <div className="mt-5 space-y-4">
            <Input label={t('lister.kyc.decl.typeName')} required value={name} onChange={(e) => setName(e.target.value)} />
            <Checkbox label={t('lister.wizard.comm.agree')} checked={agree} onChange={(e) => setAgree(e.target.checked)} />
          </div>
          {error && <Alert tone="danger" className="mt-4">{error}</Alert>}
        </Card>
        <Card>
          <CardHeader title={t('lister.listingStatus.agreement')} description={t('lister.wizard.comm.version', { v: tpl.data.version })} action={<Badge icon={FileSignature}>{t('lister.wizard.comm.clickWrap')}</Badge>} />
          <div className="max-h-80 overflow-y-auto whitespace-pre-line rounded-md border bg-surface-muted p-4 text-sm leading-relaxed text-ink-muted">{text}</div>
        </Card>
      </div>
      <div className="flex items-center justify-between border-t pt-5">
        <Button variant="ghost" onClick={back}>{t('common.back')}</Button>
        <Button icon={CheckCircle2} disabled={!validPct || !agree || name.trim().length < 2} loading={accept.isPending} onClick={save}>{t('lister.wizard.comm.acceptContinue')}</Button>
      </div>
    </div>
  );
}
