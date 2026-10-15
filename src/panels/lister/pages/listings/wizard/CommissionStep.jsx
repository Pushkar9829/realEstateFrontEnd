// Step 7: mandatory commission % within admin limits and click-wrap acceptance
// of the agreement (typed name, time and IP recorded). RE-A-09/10.
import { useMemo, useState } from 'react';
import { CheckCircle2, FileSignature } from 'lucide-react';
import { Alert, Badge, Button, Card, CardHeader, Checkbox, Input, PageSpinner, useToast } from '@/shared/ui';
import { dateTime, rupees } from '@/shared/lib/format';
import { useAuth } from '@/modules/auth';
import { priceOf, useAcceptCommission, useAgreementTemplate } from '@/modules/listings/api';

function render(body, vars) {
  return String(body || '').replace(/\{\{(\w+)\}\}/g, (_, k) => (vars[k] !== undefined && vars[k] !== '' ? vars[k] : `[${k}]`));
}

export default function CommissionStep({ listing, next, back }) {
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
      toast.success(r.pendingRevision ? 'New commission saved for review' : `Agreement ${r.agreementNo} accepted`);
      next();
    } catch (e) { setError(e.fieldErrors?.percent || e.message); }
  };

  return (
    <div className="space-y-6">
      {listing.commission?.acceptedAt && (
        <Alert tone="success" title={`Agreement accepted at ${listing.commission.percent}%`}>Accepted by {listing.commission.acceptedName} on {dateTime(listing.commission.acceptedAt)}. Accepting again creates a new agreement version.</Alert>
      )}
      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <Card>
          <CardHeader title="Commission" description={`Payable only when a deal closes with a buyer introduced by us. Allowed: ${limits.min}% to ${limits.max}% of the ${listing.purpose === 'rent' ? 'annual rent (12 x monthly rent)' : 'agreed sale price'}.`} />
          <Input label="Commission %" required type="number" step="0.01" min={limits.min} max={limits.max} value={percent} onChange={(e) => setPercent(e.target.value)}
            error={percent && !validPct ? `Enter ${limits.min} to ${limits.max}, up to 2 decimals` : undefined} />
          {example != null && (
            <div className="mt-4 rounded-md bg-brand-50 p-4 text-sm text-brand-700">
              Example: on {rupees(basePaise)} the commission would be <strong>{rupees(example)}</strong> plus 18% GST.
            </div>
          )}
          <div className="mt-5 space-y-4">
            <Input label="Type your full name to sign" required value={name} onChange={(e) => setName(e.target.value)} />
            <Checkbox label="I have read and accept the commission agreement" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
          </div>
          {error && <Alert tone="danger" className="mt-4">{error}</Alert>}
        </Card>
        <Card>
          <CardHeader title="Agreement" description={`Version ${tpl.data.version}. A copy is saved in your Agreements and emailed to you.`} action={<Badge icon={FileSignature}>Click-wrap</Badge>} />
          <div className="max-h-80 overflow-y-auto whitespace-pre-line rounded-md border bg-surface-muted p-4 text-sm leading-relaxed text-ink-muted">{text}</div>
        </Card>
      </div>
      <div className="flex items-center justify-between border-t pt-5">
        <Button variant="ghost" onClick={back}>Back</Button>
        <Button icon={CheckCircle2} disabled={!validPct || !agree || name.trim().length < 2} loading={accept.isPending} onClick={save}>Accept and continue</Button>
      </div>
    </div>
  );
}
