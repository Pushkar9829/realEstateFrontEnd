// RE-S-ADM-33 partners and referrals (Could, partners.manage): partner banks /
// NBFCs and rental-agreement partners; loan referrals and rental-agreement
// service requests with status, sanctioned / disbursed amounts and payout
// tracking. Each partner can carry its signed agreement (private file).
// Contacts are internal only.
import { useState } from 'react';
import { useT } from '@/shared/i18n';
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
  const t = useT();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const onFile = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > UPLOAD_RULES.document.maxMB * 1048576) { toast.error(t('admin.partners.agreement.tooLarge', { mb: UPLOAD_RULES.document.maxMB })); return; }
    setBusy(true);
    try { const up = await uploadFile(file, PARTNER_AGREEMENT_PURPOSE); onChange({ id: up.id, name: file.name, sizeBytes: up.sizeBytes }); } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };
  const saved = value && existing && String(value.id) === String(existing);
  return (
    <div className="sm:col-span-2">
      <p className="mb-1.5 text-sm font-medium text-ink">{t('admin.partners.agreement.label')}</p>
      <div className="flex flex-wrap items-center gap-2">
        {value ? (
          <span className="inline-flex items-center gap-2 rounded-md border bg-surface-muted px-3 py-1.5 text-sm text-ink">
            <FileText className="h-4 w-4 text-ink-subtle" aria-hidden />
            {saved ? t('admin.partners.agreement.onFile') : `${value.name || t('admin.partners.agreement.newFile')}${value.sizeBytes ? ` · ${formatBytes(value.sizeBytes)}` : ''}`}
          </span>
        ) : <span className="text-sm text-ink-subtle">{t('admin.partners.agreement.none')}</span>}
        {saved && partnerId && <Button size="sm" variant="ghost" onClick={() => openAgreement(partnerId, toast)}>{t('admin.partners.view')}</Button>}
        <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-line-strong bg-white px-3 text-sm font-medium text-ink hover:bg-surface-muted">
          <Upload className="h-4 w-4" />{busy ? t('admin.partners.agreement.uploading') : value ? t('admin.partners.agreement.replace') : t('admin.partners.agreement.upload')}
          <input type="file" className="sr-only" accept={UPLOAD_RULES.document.accept} onChange={onFile} disabled={busy} />
        </label>
        {value && <Button size="sm" variant="ghost" icon={X} onClick={() => onChange(null)}>{t('admin.partners.agreement.remove')}</Button>}
      </div>
      <p className="mt-1 text-xs text-ink-subtle">{t('admin.partners.agreement.hint', { rules: UPLOAD_RULES.document.label })}</p>
    </div>
  );
}

function PartnerEditor({ partner, onClose }) {
  const t = useT();
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
      toast.success(t('admin.partners.editor.saved'));
      onClose();
    } catch (e) { setErrors(e.fieldErrors); if (!Object.keys(e.fieldErrors).length) toast.error(e.message); }
  };

  return (
    <Modal open onClose={onClose} title={partner && partner._id ? t('admin.partners.editor.editTitle', { name: partner.name }) : t('admin.partners.newPartner')} size="lg"
      footer={<><Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button><Button loading={create.isPending || edit.isPending} disabled={f.name.trim().length < 2 || !f.contactEmail.trim()} onClick={save}>{t('admin.partners.editor.save')}</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input label={t('admin.partners.editor.name')} required value={f.name} onChange={set('name')} error={errors.name} />
        <Select label={t('admin.partners.type')} required value={f.type} onChange={set('type')} options={Object.entries(PARTNER_TYPES).map(([value, label]) => ({ value, label }))} />
        <Input className="sm:col-span-2" label={t('admin.partners.editor.cities')} hint={t('admin.partners.editor.citiesHint')} value={f.cities} onChange={set('cities')} error={errors.cities} />
        <Input label={t('admin.partners.editor.contactName')} value={f.contactName} onChange={set('contactName')} />
        <Input label={t('admin.partners.editor.contactEmail')} required type="email" hint={t('admin.partners.editor.contactEmailHint')} value={f.contactEmail} onChange={set('contactEmail')} error={errors.contact} />
        <Input label={t('admin.partners.editor.contactPhone')} value={f.contactPhone} onChange={set('contactPhone')} />
        <Textarea className="sm:col-span-2" label={t('admin.partners.editor.payoutTerms')} rows={2} hint={t('admin.partners.editor.payoutTermsHint')} value={f.payoutTerms} onChange={set('payoutTerms')} error={errors.payoutTerms} />
        <AgreementField partnerId={partner && partner._id} existing={existing} value={agreement} onChange={setAgreement} />
        {errors.agreementFileId && <p className="text-xs text-danger-600 sm:col-span-2">{errors.agreementFileId}</p>}
        <Checkbox className="sm:col-span-2" label={t('admin.partners.active')} description={t('admin.partners.editor.activeHint')} checked={f.active} onChange={set('active')} />
      </div>
    </Modal>
  );
}

function ReferralEditor({ r, onClose }) {
  const t = useT();
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
    try { await patch.mutateAsync({ id: r._id, body }); toast.success(t('admin.partners.ref.updated', { no: r.refNo })); onClose(); } catch (e) { setErrors(e.fieldErrors); if (!Object.keys(e.fieldErrors).length) toast.error(e.message); }
  };
  return (
    <Modal open onClose={onClose} title={`${r.refNo} · ${titleCase(r.kind)}`} description={`${r.partnerId?.name || r.partnerName || ''} · ${titleCase(r.status)}`}
      footer={<><Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button><Button loading={patch.isPending} onClick={save}>{t('common.save')}</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Select label={t('admin.partners.ref.moveTo')} value={f.status} onChange={set('status')} placeholder={next.length ? t('admin.partners.ref.keepStatus') : t('admin.partners.ref.finalStatus')} disabled={!next.length} options={next.map((s) => ({ value: s, label: titleCase(s) }))} />
        <Input label={t('admin.partners.ref.partnerRef')} value={f.partnerRef} onChange={set('partnerRef')} />
        {r.kind === 'loan' && <>
          <Input label={t('admin.partners.ref.sanctionedAmount')} type="number" min="0" value={f.sanctionedAmount} onChange={set('sanctionedAmount')} error={errors.sanctionedAmount} />
          <Input label={t('admin.partners.ref.disbursedAmount')} type="number" min="0" value={f.disbursedAmount} onChange={set('disbursedAmount')} error={errors.disbursedAmount} hint={t('admin.partners.ref.disbursedHint')} />
        </>}
        <Input label={t('admin.partners.ref.payoutDue')} type="number" min="0" value={f.payoutDue} onChange={set('payoutDue')} />
        <Input label={t('admin.partners.ref.payoutReceived')} type="number" min="0" value={f.payoutReceived} onChange={set('payoutReceived')} />
        <Textarea className="sm:col-span-2" label={t('admin.partners.ref.note')} rows={2} value={f.note} onChange={set('note')} />
      </div>
      {(r.timeline || []).length > 0 && (
        <ol className="mt-4 space-y-1 border-t pt-3 text-xs">
          {[...r.timeline].reverse().map((ev, i) => <li key={i} className="flex justify-between gap-3"><span className="text-ink-muted">{titleCase(ev.type)}{ev.note ? ` · ${ev.note}` : ''}</span><span className="text-ink-subtle">{dateTime(ev.at)}</span></li>)}
        </ol>
      )}
    </Modal>
  );
}

function Referrals({ kind }) {
  const t = useT();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [open, setOpen] = useState(null);
  const { data, isLoading, error } = usePartnerReferrals({ kind, page, limit: 20, sort: '-updatedAt', ...(status ? { status } : {}) });
  const flow = kind === 'loan' ? LOAN_FLOW : SERVICE_FLOW;
  return (
    <>
      <div className="mb-4 max-w-xs">
        <Select aria-label={t('admin.partners.status')} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} placeholder={t('admin.partners.allStatuses')} options={Object.keys(flow).map((s) => ({ value: s, label: titleCase(s) }))} />
      </div>
      {error && <Alert tone="danger" className="mb-3">{error.message}</Alert>}
      <Table loading={isLoading} rows={(data && data.items) || []} onRowClick={setOpen} empty={kind === 'loan' ? t('admin.partners.ref.emptyLoan') : t('admin.partners.ref.emptyService')}
        columns={[
          { key: 'refNo', header: t('admin.partners.ref.col.ref'), render: (r) => <span className="font-medium text-ink">{r.refNo}</span> },
          { key: 'partner', header: t('admin.partners.col.partner'), render: (r) => r.partnerId?.name || r.partnerName || '-' },
          { key: 'link', header: kind === 'loan' ? t('admin.partners.ref.col.lead') : t('admin.partners.ref.col.deal'), render: (r) => (kind === 'loan' ? r.leadId?.leadNo : r.dealId?.dealNo) || '-' },
          { key: 'amount', header: kind === 'loan' ? t('admin.partners.ref.col.loanAmount') : t('admin.partners.ref.col.fee'), render: (r) => <span className="whitespace-nowrap">{rupees(kind === 'loan' ? r.amount : r.fee)}{kind !== 'loan' && r.payer ? <span className="text-xs text-ink-subtle"> · {titleCase(r.payer)}</span> : ''}{kind === 'loan' && (r.sanctionedAmount != null || r.disbursedAmount != null) ? <span className="block text-xs text-ink-subtle">{t('admin.partners.ref.sanctionedDisbursed', { sanctioned: rupees(r.sanctionedAmount), disbursed: rupees(r.disbursedAmount) })}</span> : null}</span> },
          { key: 'city', header: t('common.city'), render: (r) => r.city || '-' },
          { key: 'status', header: t('admin.partners.status'), render: (r) => <Badge tone={['disbursed', 'completed'].includes(r.status) ? 'success' : ['rejected', 'withdrawn', 'cancelled'].includes(r.status) ? 'danger' : 'info'}>{titleCase(r.status)}</Badge> },
          { key: 'payout', header: t('admin.partners.ref.col.payout'), render: (r) => (r.payout && r.payout.status && r.payout.status !== 'none' ? <span className="whitespace-nowrap text-xs">{rupees(r.payout.received)} / {rupees(r.payout.due)} <Badge tone={r.payout.status === 'received' ? 'success' : 'warning'}>{titleCase(r.payout.status)}</Badge></span> : <span className="text-xs text-ink-subtle">-</span>) },
          { key: 'updated', header: t('admin.partners.ref.col.updated'), render: (r) => <span className="whitespace-nowrap text-xs">{dateTime(r.updatedAt)}</span> },
        ]} />
      {data && <Pagination page={data.meta.page} pages={data.meta.pages} onChange={setPage} />}
      {open && <ReferralEditor r={open} onClose={() => setOpen(null)} />}
    </>
  );
}

export default function PartnersPage() {
  const t = useT();
  const [tab, setTab] = useState('partners');
  const [type, setType] = useState('');
  const [editing, setEditing] = useState(null);
  const toast = useToast();
  const { data, isLoading, error } = usePartners(type ? { type } : {});
  return (
    <>
      <PageHeader title={t('admin.partners.title')} description={t('admin.partners.description')}
        actions={tab === 'partners' && <Button icon={Plus} onClick={() => setEditing({})}>{t('admin.partners.newPartner')}</Button>} />
      <Tabs className="mb-4" value={tab} onChange={setTab} tabs={[{ value: 'partners', label: t('admin.partners.tabs.partners') }, { value: 'loan', label: t('admin.partners.tabs.loan') }, { value: 'rental_agreement', label: t('admin.partners.tabs.service') }]} />
      {tab === 'partners' ? (
        <>
          <div className="mb-4 max-w-xs">
            <Select aria-label={t('admin.partners.type')} value={type} onChange={(e) => setType(e.target.value)} placeholder={t('admin.partners.allTypes')} options={Object.entries(PARTNER_TYPES).map(([value, label]) => ({ value, label }))} />
          </div>
          {error && <Alert tone="danger" className="mb-3">{error.message}</Alert>}
          <Table loading={isLoading} rows={data || []} empty={t('admin.partners.empty')}
            columns={[
              { key: 'name', header: t('admin.partners.col.partner'), render: (p) => <span className="font-medium text-ink">{p.name}</span> },
              { key: 'type', header: t('admin.partners.type'), render: (p) => PARTNER_TYPES[p.type] || p.type },
              { key: 'cities', header: t('admin.partners.col.cities'), render: (p) => <span className="block max-w-[14rem] truncate">{(p.cities || []).length ? p.cities.join(', ') : t('common.allCities')}</span> },
              { key: 'contact', header: t('admin.partners.col.contact'), render: (p) => <span className="text-sm">{p.contact?.name || '-'}<span className="block text-xs text-ink-subtle">{p.contact?.email}{p.contact?.phone ? ` · ${p.contact.phone}` : ''}</span></span> },
              { key: 'terms', header: t('admin.partners.col.terms'), render: (p) => <span className="block max-w-[14rem] truncate text-xs" title={p.payoutTerms}>{p.payoutTerms || '-'}</span> },
              { key: 'agreement', header: t('admin.partners.col.agreement'), render: (p) => (p.agreementFileId ? <Button size="sm" variant="ghost" icon={FileText} onClick={() => openAgreement(p._id, toast)}>{t('admin.partners.view')}</Button> : <span className="text-xs text-ink-subtle">-</span>) },
              { key: 'active', header: t('admin.partners.status'), render: (p) => <Badge tone={p.active ? 'success' : 'neutral'}>{p.active ? t('admin.partners.active') : t('admin.partners.inactive')}</Badge> },
              { key: 'edit', header: '', render: (p) => <Button size="sm" variant="ghost" icon={Pencil} onClick={() => setEditing(p)}>{t('admin.partners.edit')}</Button> },
            ]} />
        </>
      ) : <Referrals key={tab} kind={tab} />}
      {editing && <PartnerEditor partner={editing} onClose={() => setEditing(null)} />}
    </>
  );
}
