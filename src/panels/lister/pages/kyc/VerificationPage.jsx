// RE-F-01/02 lister verification: details (PAN, address, company for builders),
// type-specific documents and the four-statement no-broker declaration.
// API: GET/PUT /lister/kyc, POST/DELETE /lister/kyc/documents, POST /lister/kyc/submit
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { BadgeCheck, CheckCircle2, Clock, FileText, Lock, ShieldX, Trash2, TriangleAlert } from 'lucide-react';
import { Alert, Badge, Button, Card, CardHeader, Checkbox, Input, PageHeader, PageSpinner, Stepper, useToast } from '@/shared/ui';
import FileDrop from '@/shared/components/FileDrop';
import { cn } from '@/shared/lib/cn';
import { date, dateTime } from '@/shared/lib/format';
import { useAuth } from '@/modules/auth';
import { docLabel, kycStatus, useAddKycDocument, useOwnBrand, useOwnKyc, useRemoveKycDocument, useRequestBrand, useSaveKyc, useSubmitKyc } from '@/modules/kyc/api';

const EDITABLE = ['not_started', 'resubmission_required', 'verified'];
const PAN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

const detailsSchema = (builder) => z.object({
  legalName: z.string().trim().min(2, 'Enter your name as on PAN').max(120),
  pan: z.string().trim().toUpperCase().regex(PAN, 'PAN must look like ABCDE1234F'),
  dob: z.string().optional(),
  aadhaarLast4: z.string().trim().regex(/^(\d{4})?$/, 'Last 4 digits only').optional(),
  line1: z.string().trim().min(3, 'Enter the address').max(200),
  line2: z.string().trim().max(200).optional(),
  city: z.string().trim().min(2, 'Enter the city').max(60),
  state: z.string().trim().min(2, 'Enter the state').max(60),
  pincode: z.string().trim().regex(/^[1-9][0-9]{5}$/, '6-digit pincode'),
  companyName: builder ? z.string().trim().min(2, 'Company name is required').max(120) : z.string().optional(),
  companyType: z.string().optional(),
  cin: z.string().trim().max(30).optional(),
  gstin: z.string().trim().toUpperCase().regex(/^([0-9A-Z]{15})?$/, '15-character GSTIN').optional(),
  rera: z.string().trim().max(40).optional(),
});

function StatusPanel({ kyc }) {
  const s = kycStatus(kyc.status);
  const map = {
    not_started: [FileText, 'Start your verification', 'Fill in your details, upload the documents and sign the declaration. Our team reviews it within 48 hours.'],
    submitted: [Clock, 'Submitted for review', `Submitted on ${dateTime(kyc.submittedAt)}. We will notify you by email once it is reviewed (usually within 48 hours).`],
    under_review: [Clock, 'Under review', 'A reviewer is checking your documents now. Editing is locked until the review is complete.'],
    resubmission_required: [TriangleAlert, 'Changes needed', kyc.comment || 'Please correct the items marked below and submit again.'],
    verified: [BadgeCheck, 'You are verified', `Verified on ${date(kyc.reviewedAt)}. Changing your details sends them back for a quick review; your live listings stay live.`],
    rejected: [ShieldX, 'Verification rejected', kyc.rejectReason || 'Your verification was rejected. Contact support for help.'],
  };
  const [Icon, title, text] = map[kyc.status] || map.not_started;
  const tone = { success: 'border-success-100 bg-success-50 text-success-700', warning: 'border-warning-100 bg-warning-50 text-warning-700', danger: 'border-danger-100 bg-danger-50 text-danger-700', info: 'border-info-100 bg-info-50 text-info-700', neutral: 'border-line bg-white text-ink' }[s.tone];
  return (
    <div className={cn('mb-6 flex items-start gap-4 rounded-lg border p-5', tone)}>
      <Icon className="mt-0.5 h-6 w-6 shrink-0" aria-hidden />
      <div className="flex-1">
        <div className="flex flex-wrap items-center gap-2"><h2 className="text-base font-semibold">{title}</h2><Badge tone={s.tone}>{s.label}</Badge></div>
        <p className="mt-1 text-sm opacity-90">{text}</p>
        {kyc.resubmissionCount > 0 && <p className="mt-1 text-xs opacity-75">Resubmissions used: {kyc.resubmissionCount} of 3</p>}
      </div>
    </div>
  );
}

function Details({ kyc, builder, locked, onSaved }) {
  const save = useSaveKyc();
  const toast = useToast();
  const [error, setError] = useState(null);
  const form = useForm({
    resolver: zodResolver(detailsSchema(builder)),
    mode: 'onTouched',
    defaultValues: {
      legalName: kyc.legalName || '', pan: '', dob: kyc.dob ? String(kyc.dob).slice(0, 10) : '', aadhaarLast4: kyc.aadhaarLast4 || '',
      line1: kyc.address?.line1 || '', line2: kyc.address?.line2 || '', city: kyc.address?.city || '', state: kyc.address?.state || '', pincode: kyc.address?.pincode || '',
      companyName: kyc.company?.name || '', companyType: kyc.company?.type || '', cin: kyc.company?.cin || '', gstin: kyc.company?.gstin || '', rera: kyc.company?.rera || '',
    },
  });
  const err = (n) => form.formState.errors[n]?.message;
  const onSubmit = form.handleSubmit(async (v) => {
    setError(null);
    const body = {
      legalName: v.legalName, pan: v.pan, ...(v.dob ? { dob: v.dob } : {}), ...(v.aadhaarLast4 ? { aadhaarLast4: v.aadhaarLast4 } : {}),
      address: { line1: v.line1, ...(v.line2 ? { line2: v.line2 } : {}), city: v.city, state: v.state, pincode: v.pincode },
      ...(builder ? { company: { name: v.companyName, ...(v.companyType ? { type: v.companyType } : {}), ...(v.cin ? { cin: v.cin } : {}), ...(v.gstin ? { gstin: v.gstin } : {}), ...(v.rera ? { rera: v.rera } : {}) } } : {}),
    };
    try {
      await save.mutateAsync(body);
      form.setValue('pan', '');
      toast.success(kyc.status === 'verified' ? 'Details saved and sent for a quick re-review' : 'Details saved');
      onSaved && onSaved();
    } catch (e) {
      const fe = e.fieldErrors || {};
      if (Object.keys(fe).length) Object.entries(fe).forEach(([k, m]) => form.setError(k === 'address' ? 'line1' : k === 'company' ? 'companyName' : k, { message: m }));
      else setError(e.message);
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {error && <Alert tone="danger">{error}</Alert>}
      <fieldset disabled={locked} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Full name as on PAN" required error={err('legalName')} {...form.register('legalName')} />
          <Input label="PAN" required placeholder="ABCDE1234F" inputClassName="uppercase"
            hint={kyc.panLast4 ? `On file: ••••••${kyc.panLast4}. Re-enter the full PAN to save changes.` : 'Stored encrypted. Only the last 4 characters are ever shown.'}
            error={err('pan')} {...form.register('pan')} />
          <Input label="Date of birth" type="date" error={err('dob')} {...form.register('dob')} />
          <Input label="Aadhaar (last 4 digits only)" inputMode="numeric" maxLength={4} hint="Never enter the full Aadhaar number." error={err('aadhaarLast4')} {...form.register('aadhaarLast4')} />
        </div>
        <div>
          <p className="mb-3 text-sm font-semibold text-ink">Address</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Address line 1" required className="sm:col-span-2" error={err('line1')} {...form.register('line1')} />
            <Input label="Address line 2" className="sm:col-span-2" {...form.register('line2')} />
            <Input label="City" required error={err('city')} {...form.register('city')} />
            <Input label="State" required error={err('state')} {...form.register('state')} />
            <Input label="Pincode" required inputMode="numeric" maxLength={6} error={err('pincode')} {...form.register('pincode')} />
          </div>
        </div>
        {builder && (
          <div>
            <p className="mb-3 text-sm font-semibold text-ink">Company</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Company name" required error={err('companyName')} {...form.register('companyName')} />
              <Input label="Company type" placeholder="Private limited, LLP, partnership…" {...form.register('companyType')} />
              <Input label="CIN / registration number" {...form.register('cin')} />
              <Input label="GSTIN" inputClassName="uppercase" error={err('gstin')} {...form.register('gstin')} />
              <Input label="Promoter RERA number" {...form.register('rera')} />
            </div>
          </div>
        )}
      </fieldset>
      {!locked && <div className="flex justify-end"><Button type="submit" loading={save.isPending}>Save details</Button></div>}
    </form>
  );
}

function Documents({ kyc, types, locked }) {
  const add = useAddKycDocument();
  const remove = useRemoveKycDocument();
  const toast = useToast();
  const docs = kyc.documents || [];
  const byType = Object.fromEntries(docs.map((d) => [d.docType, d]));
  const tone = { accepted: 'success', rejected: 'danger', pending: 'neutral' };

  return (
    <ul className="space-y-3">
      {types.all.map((code) => {
        const doc = byType[code];
        const required = types.required.includes(code);
        return (
          <li key={code} className={cn('rounded-lg border p-4', doc && doc.status === 'rejected' ? 'border-danger-100 bg-danger-50/40' : 'bg-white')}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-ink">{docLabel(code)} {required ? <span className="text-danger-600">*</span> : <span className="text-xs font-normal text-ink-subtle">(optional)</span>}</p>
                {doc && <p className="mt-0.5 text-xs text-ink-subtle">Uploaded {date(doc.uploadedAt)}</p>}
                {doc && doc.comment && <p className="mt-1 text-xs text-danger-700">Reviewer: {doc.comment}</p>}
              </div>
              {doc && (
                <div className="flex items-center gap-2">
                  <Badge tone={tone[doc.status]} icon={doc.status === 'accepted' ? CheckCircle2 : undefined}>{doc.status === 'pending' ? 'Uploaded' : doc.status === 'accepted' ? 'Accepted' : 'Rejected'}</Badge>
                  {!locked && (
                    <Button variant="ghost" size="sm" icon={Trash2} aria-label={`Remove ${docLabel(code)}`}
                      onClick={async () => { try { await remove.mutateAsync(doc._id); } catch (e) { toast.error(e.message); } }} />
                  )}
                </div>
              )}
            </div>
            {!locked && (
              <div className="mt-3">
                <FileDrop compact purpose="kyc_doc" kind="document" label={doc ? 'Replace file' : 'Upload file'}
                  onUploaded={async (f) => { try { await add.mutateAsync({ docType: code, fileId: f.id }); toast.success(`${docLabel(code)} uploaded`); } catch (e) { toast.error(e.message); } }} />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function Declaration({ statements, kyc, ready, locked, defaultName }) {
  const submit = useSubmitKyc();
  const toast = useToast();
  const [ticks, setTicks] = useState(statements.map(() => false));
  const [name, setName] = useState(defaultName || '');
  const [error, setError] = useState(null);
  const all = ticks.every(Boolean) && name.trim().length >= 2;

  if (kyc.declaration && kyc.declaration.acceptedAt && locked) {
    return <p className="text-sm text-ink-muted">Signed by <strong>{kyc.declaration.typedName}</strong> on {dateTime(kyc.declaration.acceptedAt)}.</p>;
  }
  const onSubmit = async () => {
    setError(null);
    try {
      await submit.mutateAsync({ statements: ticks, typedName: name.trim() });
      toast.success('Verification submitted. We will review it within 48 hours.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      setError(e.details && Array.isArray(e.details) ? `${e.message}: ${e.details.map((d) => (String(d.path).startsWith('document:') ? docLabel(String(d.path).slice(9)) : d.path)).join(', ')}` : e.message);
    }
  };
  return (
    <div className="space-y-4">
      <ul className="space-y-3">
        {statements.map((s, i) => (
          <li key={s}><Checkbox label={s} checked={ticks[i]} disabled={locked} onChange={(e) => setTicks((t) => t.map((v, j) => (j === i ? e.target.checked : v)))} /></li>
        ))}
      </ul>
      <Input label="Type your full name to sign" value={name} onChange={(e) => setName(e.target.value)} disabled={locked} hint="Your typed name, the time and your IP address are recorded as your signature." />
      {error && <Alert tone="danger">{error}</Alert>}
      {!ready && !locked && <Alert tone="warning">Save your details and upload all required documents before submitting.</Alert>}
      {!locked && <div className="flex justify-end"><Button size="lg" disabled={!all || !ready} loading={submit.isPending} onClick={onSubmit}>Submit for verification</Button></div>}
    </div>
  );
}

// RE-B-02 / RE-S-LIS-16 builder brand: shown publicly as "Verified Builder · <brand>" once our team approves it.
function BrandCard() {
  const toast = useToast();
  const { data: brand, isLoading } = useOwnBrand();
  const request = useRequestBrand();
  const [name, setName] = useState(null);
  const [logo, setLogo] = useState(null);
  const [error, setError] = useState(null);
  if (isLoading || !brand) return null;
  const value = name ?? (brand.pending ? brand.pending.name : brand.name) ?? '';
  const save = async () => {
    setError(null);
    try {
      await request.mutateAsync({ name: value.trim(), ...(logo ? { logoFileId: logo.id } : {}) });
      setName(null); setLogo(null);
      toast.success('Brand sent for approval');
    } catch (e) { setError((e.fieldErrors && Object.values(e.fieldErrors)[0]) || e.message); }
  };
  return (
    <Card>
      <CardHeader title="Builder brand" description={`Buyers see "${brand.publicLabel}" on your listings and projects. Brand changes are approved by our team; your name, phone and email are never shown.`}
        action={brand.pending ? <Badge tone="warning" icon={Clock}>Awaiting approval</Badge> : brand.approved ? <Badge tone="success" icon={BadgeCheck}>Approved</Badge> : null} />
      <div className="space-y-4">
        {brand.pending && <Alert tone="info">"{brand.pending.name}" was sent on {date(brand.pending.requestedAt)}. {brand.name && brand.approved ? `"${brand.name}" stays on your listings until it is approved.` : ''}</Alert>}
        {brand.rejectReason && !brand.pending && <Alert tone="warning">Your last brand change was not approved: {brand.rejectReason}</Alert>}
        <div className="flex flex-wrap items-end gap-4">
          {(logo || brand.logoUrl) && <img src={logo ? logo.url : brand.logoUrl} alt="Brand logo" className="h-16 w-16 rounded border bg-white object-contain" />}
          <div className="min-w-[16rem] flex-1"><Input label="Brand name" maxLength={60} value={value} onChange={(e) => setName(e.target.value)} hint="2-60 characters. No phone numbers or email addresses." error={error} /></div>
        </div>
        <FileDrop compact purpose="avatar" kind="image" label={logo ? 'Logo uploaded, replace' : 'Upload a logo (optional)'} onUploaded={(f) => setLogo(f)} />
        <div className="flex justify-end">
          <Button loading={request.isPending} disabled={value.trim().length < 2 || (!logo && value.trim() === ((brand.pending && brand.pending.name) || brand.name || ''))} onClick={save}>Send for approval</Button>
        </div>
      </div>
    </Card>
  );
}

export default function VerificationPage() {
  const { user, refreshUser } = useAuth();
  const { data, isLoading, error } = useOwnKyc();
  const builder = user.listerType === 'builder';

  // Keep the session user (banner, dashboard) in sync with the KYC status.
  const status = data && data.kyc && data.kyc.status;
  useEffect(() => { if (status && user.kyc && user.kyc.status !== status) refreshUser(); }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  const kyc = (data && data.kyc) || { status: 'not_started' };
  const types = (data && data.documentTypes) || { all: [], required: [] };
  const locked = !EDITABLE.includes(kyc.status);
  const detailsDone = Boolean(kyc.legalName && kyc.panLast4 && kyc.address && kyc.address.line1);
  const docsDone = types.required.every((r) => (kyc.documents || []).some((d) => d.docType === r));
  const canSubmit = ['not_started', 'resubmission_required'].includes(kyc.status);
  const step = useMemo(() => (!detailsDone ? 0 : !docsDone ? 1 : 2), [detailsDone, docsDone]);

  if (isLoading) return <PageSpinner />;
  if (error) return <Alert tone="danger">{error.message}</Alert>;

  return (
    <>
      <PageHeader title="Verification (KYC)" description="Required before any listing or project can go live. Your documents are private and only seen by our verification team." />
      <StatusPanel kyc={kyc} />
      {canSubmit && <div className="mb-6"><Stepper steps={[{ label: 'Your details' }, { label: 'Documents' }, { label: 'Declaration and submit' }]} current={step} /></div>}

      <div className="space-y-6">
        <Card>
          <CardHeader title="1. Your details" description={builder ? 'Your details as the authorised signatory, and the company details.' : 'As shown on your PAN card.'}
            action={locked ? <Badge icon={Lock}>Locked during review</Badge> : detailsDone ? <Badge tone="success" icon={CheckCircle2}>Saved</Badge> : null} />
          <Details kyc={kyc} builder={builder} locked={locked || kyc.status === 'rejected'} />
        </Card>
        <Card>
          <CardHeader title="2. Documents" description="Clear scans or photos. PDF, JPG or PNG up to 10 MB. Mask all but the last 4 digits of Aadhaar."
            action={docsDone ? <Badge tone="success" icon={CheckCircle2}>All required uploaded</Badge> : null} />
          <Documents kyc={kyc} types={types} locked={locked || kyc.status === 'rejected'} />
        </Card>
        {(canSubmit || (kyc.declaration && kyc.declaration.acceptedAt)) && (
          <Card>
            <CardHeader title="3. No-broker declaration" description="All four statements are required. False declarations lead to a permanent ban." />
            <Declaration statements={(data && data.declarationStatements) || []} kyc={kyc} ready={detailsDone && docsDone} locked={!canSubmit} defaultName={kyc.legalName || user.name} />
          </Card>
        )}
        {builder && <BrandCard />}
      </div>
    </>
  );
}
