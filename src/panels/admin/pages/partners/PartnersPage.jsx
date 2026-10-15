// RE-S-ADM-33 partners and referrals (Could, partners.manage): partner banks /
// NBFCs and rental-agreement partners; loan referrals and rental-agreement
// service requests with status, sanctioned / disbursed amounts and payout
// tracking. Each partner can carry its signed agreement (private file).
// Contacts are internal only.
import { useState } from 'react';
import { FileText, Pencil, Plus, Upload, X } from 'lucide-react';
import { Alert, Badge, Button, Checkbox, Input, Modal, PageHeader, Pagination, Select, Table, Tabs, Textarea, useToast } from '@/shared/ui';
import { dateTime, rupees, titleCase } from '@/shared/lib/format';
import { UPLOAD_RULES, formatBytes, uploadFile } from '@/shared/lib/upload';
import { LOAN_FLOW, PARTNER_AGREEMENT_PURPOSE, PARTNER_TYPES, SERVICE_FLOW, partnerAgreementUrl, useCreatePartner, useEditPartner, usePartnerReferrals, usePartners, usePatchReferral } from '@/modules/deals/adminApi';

const EMPTY = { name: '', type: 'bank', cities: '', contactName: '', contactEmail: '', contactPhone: '', payoutTerms: '', active: true };
const inr = (paise) => (paise == null ? '' : String(paise / 100));

// Opens the agreement through a short-lived signed link (the file is private).
async function openAgreement(partnerId, toast) {
  try { const { url } = await partnerAgreementUrl(partnerId); window.open(url, '_blank', 'noopener'); } catch (e) { toast.error(e.message); }
}

// value: { id, name?, sizeBytes? } | null; existing is the saved file id.
function AgreementField({ partnerId, existing, value, onChange }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const onFile = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > UPLOAD_RULES.document.maxMB * 1048576) { toast.error(`Agreements must be ${UPLOAD_RULES.document.maxMB} MB or smaller`); return; }
    setBusy(true);
    try { const up = await uploadFile(file, PARTNER_AGREEMENT_PURPOSE); onChange({ id: up.id, name: file.name, sizeBytes: up.sizeBytes }); } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };
  const saved = value && existing && String(value.id) === String(existing);
  return (
    <div className="sm:col-span-2">
      <p className="mb-1.5 text-sm font-medium text-ink">Signed partner agreement</p>
      <div className="flex flex-wrap items-center gap-2">
        {value ? (
          <span className="inline-flex items-center gap-2 rounded-md border bg-surface-muted px-3 py-1.5 text-sm text-ink">
            <FileText className="h-4 w-4 text-ink-subtle" aria-hidden />
            {saved ? 'Agreement on file' : `${value.name || 'New file'}${value.sizeBytes ? ` · ${formatBytes(value.sizeBytes)}` : ''}`}
          </span>
        ) : <span className="text-sm text-ink-subtle">No agreement uploaded</span>}
        {saved && partnerId && <Button size="sm" variant="ghost" onClick={() => openAgreement(partnerId, toast)}>View</Button>}
        <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-line-strong bg-white px-3 text-sm font-medium text-ink hover:bg-surface-muted">
          <Upload className="h-4 w-4" />{busy ? 'Uploading...' : value ? 'Replace' : 'Upload'}
          <input type="file" className="sr-only" accept={UPLOAD_RULES.document.accept} onChange={onFile} disabled={busy} />
        </label>
        {value && <Button size="sm" variant="ghost" icon={X} onClick={() => onChange(null)}>Remove</Button>}
      </div>
      <p className="mt-1 text-xs text-ink-subtle">{UPLOAD_RULES.document.label}. Stored privately; opened through a 10-minute link.</p>
    </div>
  );
}

function PartnerEditor({ partner, onClose }) {
  const toast = useToast();
  const create = useCreatePartner();
  const edit = useEditPartner();
  const [f, setF] = useState(() => (partner && partner._id ? {
    name: partner.name, type: partner.type, cities: (partner.cities || []).join(', '), contactName: partner.contact?.name || '', contactEmail: partner.contact?.email || '',
    contactPhone: partner.contact?.phone || '', payoutTerms: partner.payoutTerms || '', active: partner.active !== false,
  } : EMPTY));
  const existing = partner && partner.agreementFileId ? String(partner.agreementFileId) : null;
  const [agreement, setAgreement] = useState(existing ? { id: existing } : null);
  const [errors, setErrors] = useState({});
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const save = async () => {
    setErrors({});
    const body = {
      name: f.name.trim(), type: f.type, cities: f.cities.split(',').map((c) => c.trim()).filter(Boolean),
      contact: { email: f.contactEmail.trim(), ...(f.contactName.trim() ? { name: f.contactName.trim() } : {}), ...(f.contactPhone.trim() ? { phone: f.contactPhone.trim() } : {}) },
      ...(f.payoutTerms.trim() ? { payoutTerms: f.payoutTerms.trim() } : {}), active: f.active,
    };
    if (agreement && String(agreement.id) !== existing) body.agreementFileId = agreement.id;
    else if (!agreement && existing) body.agreementFileId = null;
    try {
      if (partner && partner._id) await edit.mutateAsync({ id: partner._id, body });
      else await create.mutateAsync(body);
      toast.success('Partner saved');
      onClose();
    } catch (e) { setErrors(e.fieldErrors); if (!Object.keys(e.fieldErrors).length) toast.error(e.message); }
  };

  return (
    <Modal open onClose={onClose} title={partner && partner._id ? `Edit ${partner.name}` : 'New partner'} size="lg"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={create.isPending || edit.isPending} disabled={f.name.trim().length < 2 || !f.contactEmail.trim()} onClick={save}>Save partner</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input label="Name" required value={f.name} onChange={set('name')} error={errors.name} />
        <Select label="Type" required value={f.type} onChange={set('type')} options={Object.entries(PARTNER_TYPES).map(([value, label]) => ({ value, label }))} />
        <Input className="sm:col-span-2" label="Cities served" hint="Comma separated; empty means all cities." value={f.cities} onChange={set('cities')} error={errors.cities} />
        <Input label="Contact name" value={f.contactName} onChange={set('contactName')} />
        <Input label="Contact email" required type="email" hint="Referrals are emailed here." value={f.contactEmail} onChange={set('contactEmail')} error={errors.contact} />
        <Input label="Contact phone" value={f.contactPhone} onChange={set('contactPhone')} />
        <Textarea className="sm:col-span-2" label="Referral payout terms" rows={2} hint="e.g. 0.25% of disbursed loan, or INR 1,500 per request." value={f.payoutTerms} onChange={set('payoutTerms')} error={errors.payoutTerms} />
        <AgreementField partnerId={partner && partner._id} existing={existing} value={agreement} onChange={setAgreement} />
        {errors.agreementFileId && <p className="text-xs text-danger-600 sm:col-span-2">{errors.agreementFileId}</p>}
        <Checkbox className="sm:col-span-2" label="Active" description="Inactive partners cannot receive new referrals." checked={f.active} onChange={set('active')} />
      </div>
    </Modal>
  );
}

function ReferralEditor({ r, onClose }) {
  const toast = useToast();
  const patch = usePatchReferral();
  const flow = r.kind === 'loan' ? LOAN_FLOW : SERVICE_FLOW;
  const next = flow[r.status] || [];
  const [f, setF] = useState({ status: '', partnerRef: r.partnerRef || '', note: '', payoutDue: r.payout?.due ? String(r.payout.due / 100) : '', payoutReceived: r.payout?.received ? String(r.payout.received / 100) : '', sanctionedAmount: inr(r.sanctionedAmount), disbursedAmount: inr(r.disbursedAmount) });
  const [errors, setErrors] = useState({});
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const save = async () => {
    const body = {
      ...(f.status ? { status: f.status } : {}), ...(f.note.trim() ? { note: f.note.trim() } : {}),
      ...(f.partnerRef !== (r.partnerRef || '') ? { partnerRef: f.partnerRef.trim() } : {}),
      ...(f.payoutDue !== '' ? { payoutDue: Number(f.payoutDue) } : {}), ...(f.payoutReceived !== '' ? { payoutReceived: Number(f.payoutReceived) } : {}),
    };
    // Loan amounts: send only what changed; an emptied field clears it (null).
    if (r.kind === 'loan') {
      ['sanctionedAmount', 'disbursedAmount'].forEach((k) => { if (f[k] !== inr(r[k])) body[k] = f[k] === '' ? null : Number(f[k]); });
    }
    setErrors({});
    try { await patch.mutateAsync({ id: r._id, body }); toast.success(`${r.refNo} updated`); onClose(); } catch (e) { setErrors(e.fieldErrors); if (!Object.keys(e.fieldErrors).length) toast.error(e.message); }
  };
  return (
    <Modal open onClose={onClose} title={`${r.refNo} · ${titleCase(r.kind)}`} description={`${r.partnerId?.name || r.partnerName || ''} · ${titleCase(r.status)}`}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={patch.isPending} onClick={save}>Save</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Select label="Move to status" value={f.status} onChange={set('status')} placeholder={next.length ? 'Keep current status' : 'Final status'} disabled={!next.length} options={next.map((s) => ({ value: s, label: titleCase(s) }))} />
        <Input label="Partner reference" value={f.partnerRef} onChange={set('partnerRef')} />
        {r.kind === 'loan' && <>
          <Input label="Sanctioned amount (INR)" type="number" min="0" value={f.sanctionedAmount} onChange={set('sanctionedAmount')} error={errors.sanctionedAmount} />
          <Input label="Disbursed amount (INR)" type="number" min="0" value={f.disbursedAmount} onChange={set('disbursedAmount')} error={errors.disbursedAmount} hint="At most the sanctioned amount." />
        </>}
        <Input label="Payout due (INR)" type="number" min="0" value={f.payoutDue} onChange={set('payoutDue')} />
        <Input label="Payout received (INR)" type="number" min="0" value={f.payoutReceived} onChange={set('payoutReceived')} />
        <Textarea className="sm:col-span-2" label="Note" rows={2} value={f.note} onChange={set('note')} />
      </div>
      {(r.timeline || []).length > 0 && (
        <ol className="mt-4 space-y-1 border-t pt-3 text-xs">
          {[...r.timeline].reverse().map((t, i) => <li key={i} className="flex justify-between gap-3"><span className="text-ink-muted">{titleCase(t.type)}{t.note ? ` · ${t.note}` : ''}</span><span className="text-ink-subtle">{dateTime(t.at)}</span></li>)}
        </ol>
      )}
    </Modal>
  );
}

function Referrals({ kind }) {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [open, setOpen] = useState(null);
  const { data, isLoading, error } = usePartnerReferrals({ kind, page, limit: 20, sort: '-updatedAt', ...(status ? { status } : {}) });
  const flow = kind === 'loan' ? LOAN_FLOW : SERVICE_FLOW;
  return (
    <>
      <div className="mb-4 max-w-xs">
        <Select aria-label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} placeholder="All statuses" options={Object.keys(flow).map((s) => ({ value: s, label: titleCase(s) }))} />
      </div>
      {error && <Alert tone="danger" className="mb-3">{error.message}</Alert>}
      <Table loading={isLoading} rows={(data && data.items) || []} onRowClick={setOpen} empty={kind === 'loan' ? 'No loan referrals' : 'No service requests'}
        columns={[
          { key: 'refNo', header: 'Ref', render: (r) => <span className="font-medium text-ink">{r.refNo}</span> },
          { key: 'partner', header: 'Partner', render: (r) => r.partnerId?.name || r.partnerName || '-' },
          { key: 'link', header: kind === 'loan' ? 'Lead' : 'Deal', render: (r) => (kind === 'loan' ? r.leadId?.leadNo : r.dealId?.dealNo) || '-' },
          { key: 'amount', header: kind === 'loan' ? 'Loan amount' : 'Fee', render: (r) => <span className="whitespace-nowrap">{rupees(kind === 'loan' ? r.amount : r.fee)}{kind !== 'loan' && r.payer ? <span className="text-xs text-ink-subtle"> · {titleCase(r.payer)}</span> : ''}{kind === 'loan' && (r.sanctionedAmount != null || r.disbursedAmount != null) ? <span className="block text-xs text-ink-subtle">Sanctioned {rupees(r.sanctionedAmount)} · disbursed {rupees(r.disbursedAmount)}</span> : null}</span> },
          { key: 'city', header: 'City', render: (r) => r.city || '-' },
          { key: 'status', header: 'Status', render: (r) => <Badge tone={['disbursed', 'completed'].includes(r.status) ? 'success' : ['rejected', 'withdrawn', 'cancelled'].includes(r.status) ? 'danger' : 'info'}>{titleCase(r.status)}</Badge> },
          { key: 'payout', header: 'Payout', render: (r) => (r.payout && r.payout.status && r.payout.status !== 'none' ? <span className="whitespace-nowrap text-xs">{rupees(r.payout.received)} / {rupees(r.payout.due)} <Badge tone={r.payout.status === 'received' ? 'success' : 'warning'}>{titleCase(r.payout.status)}</Badge></span> : <span className="text-xs text-ink-subtle">-</span>) },
          { key: 'updated', header: 'Last update', render: (r) => <span className="whitespace-nowrap text-xs">{dateTime(r.updatedAt)}</span> },
        ]} />
      {data && <Pagination page={data.meta.page} pages={data.meta.pages} onChange={setPage} />}
      {open && <ReferralEditor r={open} onClose={() => setOpen(null)} />}
    </>
  );
}

export default function PartnersPage() {
  const [tab, setTab] = useState('partners');
  const [type, setType] = useState('');
  const [editing, setEditing] = useState(null);
  const toast = useToast();
  const { data, isLoading, error } = usePartners(type ? { type } : {});
  return (
    <>
      <PageHeader title="Partners and referrals" description="Banks, NBFCs and rental-agreement partners. Partner contacts are internal and never shown to buyers or listers."
        actions={tab === 'partners' && <Button icon={Plus} onClick={() => setEditing({})}>New partner</Button>} />
      <Tabs className="mb-4" value={tab} onChange={setTab} tabs={[{ value: 'partners', label: 'Partners' }, { value: 'loan', label: 'Loan referrals' }, { value: 'rental_agreement', label: 'Service requests' }]} />
      {tab === 'partners' ? (
        <>
          <div className="mb-4 max-w-xs">
            <Select aria-label="Type" value={type} onChange={(e) => setType(e.target.value)} placeholder="All types" options={Object.entries(PARTNER_TYPES).map(([value, label]) => ({ value, label }))} />
          </div>
          {error && <Alert tone="danger" className="mb-3">{error.message}</Alert>}
          <Table loading={isLoading} rows={data || []} empty="No partners yet"
            columns={[
              { key: 'name', header: 'Partner', render: (p) => <span className="font-medium text-ink">{p.name}</span> },
              { key: 'type', header: 'Type', render: (p) => PARTNER_TYPES[p.type] || p.type },
              { key: 'cities', header: 'Cities', render: (p) => <span className="block max-w-[14rem] truncate">{(p.cities || []).length ? p.cities.join(', ') : 'All cities'}</span> },
              { key: 'contact', header: 'Contact', render: (p) => <span className="text-sm">{p.contact?.name || '-'}<span className="block text-xs text-ink-subtle">{p.contact?.email}{p.contact?.phone ? ` · ${p.contact.phone}` : ''}</span></span> },
              { key: 'terms', header: 'Payout terms', render: (p) => <span className="block max-w-[14rem] truncate text-xs" title={p.payoutTerms}>{p.payoutTerms || '-'}</span> },
              { key: 'agreement', header: 'Agreement', render: (p) => (p.agreementFileId ? <Button size="sm" variant="ghost" icon={FileText} onClick={() => openAgreement(p._id, toast)}>View</Button> : <span className="text-xs text-ink-subtle">-</span>) },
              { key: 'active', header: 'Status', render: (p) => <Badge tone={p.active ? 'success' : 'neutral'}>{p.active ? 'Active' : 'Inactive'}</Badge> },
              { key: 'edit', header: '', render: (p) => <Button size="sm" variant="ghost" icon={Pencil} onClick={() => setEditing(p)}>Edit</Button> },
            ]} />
        </>
      ) : <Referrals key={tab} kind={tab} />}
      {editing && <PartnerEditor partner={editing} onClose={() => setEditing(null)} />}
    </>
  );
}
