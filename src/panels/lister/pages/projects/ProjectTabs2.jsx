// Project editor tabs: photos and brochure, project commission agreement,
// and units (inventory per configuration + CSV bulk import with preview).
// RE-G-01/04/05/09.
import { useMemo, useState } from 'react';
import { CheckCircle2, Download, FileText, Upload } from 'lucide-react';
import { Alert, Badge, Button, Card, CardHeader, Checkbox, Input, PageSpinner, Pagination, Table, Tabs, useToast } from '@/shared/ui';
import FileDrop from '@/shared/components/FileDrop';
import { dateTime, rupees, titleCase } from '@/shared/lib/format';
import { useAuth } from '@/modules/auth';
import { useAgreementTemplate } from '@/modules/listings/api';
import { downloadUnitsTemplate, useAddProjectMedia, useConfirmUnits, usePreviewUnits, useProjectCommission, useUnits, useUpdateInventory } from '@/modules/projects/api';

export function MediaTab({ project }) {
  const add = useAddProjectMedia(project._id);
  const toast = useToast();
  const photos = project.media?.photos || [];
  return (
    <div className="space-y-6">
      <Card padded={false} className="border-0 shadow-none">
        <CardHeader title={`Photos (${photos.length} / 30)`} description="Site, elevation, amenities and sample flat. At least 1024 x 768." />
        {photos.length > 0 && (
          <ul className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {photos.map((p) => <li key={p.fileId} className="aspect-[4/3] overflow-hidden rounded-lg border bg-surface-sunken"><img src={p.url} alt={p.caption || ''} className="h-full w-full object-cover" loading="lazy" /></li>)}
          </ul>
        )}
        <FileDrop multiple purpose="project_media" kind="image" disabled={photos.length >= 30} label="Drop project photos here" onUploaded={async (f) => { await add.mutateAsync({ kind: 'photo', fileId: f.id }); }} />
      </Card>
      <div>
        <p className="mb-2 text-sm font-medium text-ink">Brochure {project.media?.brochure?.url && <a className="ml-2 inline-flex items-center gap-1 text-brand-700 hover:underline" href={project.media.brochure.url} target="_blank" rel="noreferrer"><FileText className="h-4 w-4" />current</a>}</p>
        <FileDrop compact purpose="brochure" kind="document" label={project.media?.brochure ? 'Replace brochure' : 'Upload brochure (PDF)'}
          onUploaded={async (f) => { try { await add.mutateAsync({ kind: 'brochure', fileId: f.id }); toast.success('Brochure added'); } catch (e) { toast.error(e.message); } }} />
      </div>
    </div>
  );
}

export function CommissionTab({ project, next }) {
  const { user } = useAuth();
  const toast = useToast();
  const tpl = useAgreementTemplate('project');
  const accept = useProjectCommission(project._id);
  const [pct, setPct] = useState(project.commission?.percent ? String(project.commission.percent) : '');
  const [name, setName] = useState(user.kyc?.legalName || user.name);
  const [agree, setAgree] = useState(false);
  if (tpl.isLoading) return <PageSpinner />;
  if (tpl.error) return <Alert tone="danger">{tpl.error.message}</Alert>;
  const { min, max } = tpl.data.limits;
  const n = Number(pct);
  const valid = n >= min && n <= max && Math.round(n * 100) === n * 100;
  const text = String(tpl.data.body).replace(/\{\{(\w+)\}\}/g, (_, k) => ({ listerName: user.kyc?.legalName || user.name, propertyRef: `${project.projectNo} - ${project.name}`, commissionPercent: valid ? n.toFixed(2) : '[%]', nonCircumventionMonths: tpl.data.nonCircumventionMonths, acceptedName: name, companyName: 'the platform', acceptedAt: 'on acceptance' }[k] ?? `[${k}]`));
  const save = async () => {
    try { const r = await accept.mutateAsync({ percent: n, accept: true, typedName: name.trim() }); toast.success(`Agreement ${r.agreementNo} accepted`); next(); } catch (e) { toast.error(e.message); }
  };
  return (
    <div className="space-y-5">
      {project.commission?.acceptedAt && <Alert tone="success">Accepted at {project.commission.percent}% on {dateTime(project.commission.acceptedAt)}. One agreement covers every configuration.</Alert>}
      <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
        <div className="space-y-4">
          <Input label="Commission % of unit sale price" required type="number" step="0.01" value={pct} onChange={(e) => setPct(e.target.value)} error={pct && !valid ? `Enter ${min} to ${max}, up to 2 decimals` : undefined} />
          {valid && project.configurations?.[0]?.priceMin > 0 && <p className="rounded-md bg-brand-50 p-3 text-sm text-brand-700">Example: on a {rupees(project.configurations[0].priceMin)} unit the commission is {rupees(Math.round((project.configurations[0].priceMin * n) / 100))} plus GST.</p>}
          <Input label="Type your full name to sign" value={name} onChange={(e) => setName(e.target.value)} />
          <Checkbox label="I accept the project commission agreement" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
          <Button icon={CheckCircle2} disabled={!valid || !agree || name.trim().length < 2} loading={accept.isPending} onClick={save}>Accept agreement</Button>
        </div>
        <div className="max-h-80 overflow-y-auto whitespace-pre-line rounded-md border bg-surface-muted p-4 text-sm leading-relaxed text-ink-muted">{text}</div>
      </div>
    </div>
  );
}

function Inventory({ project }) {
  const update = useUpdateInventory(project._id);
  const toast = useToast();
  const [vals, setVals] = useState(Object.fromEntries((project.configurations || []).map((c) => [c._id, String(c.availableUnits)])));
  const changed = (project.configurations || []).filter((c) => String(c.availableUnits) !== vals[c._id]);
  const save = async () => {
    try {
      const r = await update.mutateAsync({ items: changed.map((c) => ({ configId: c._id, availableUnits: Number(vals[c._id]) })) });
      toast.success(r.status === 'sold_out' ? 'Inventory saved. All configurations are sold out.' : 'Inventory saved');
    } catch (e) { toast.error(e.message); }
  };
  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-muted">Every change is logged. Verified deals reduce availability automatically. When all are 0, the project shows as sold out.</p>
      <ul className="divide-y rounded-lg border">
        {(project.configurations || []).map((c) => (
          <li key={c._id} className="flex flex-wrap items-center gap-4 px-4 py-3">
            <span className="min-w-0 flex-1"><span className="block font-medium text-ink">{c.name}</span><span className="text-xs text-ink-subtle">{c.carpetMin}–{c.carpetMax} sq ft · {rupees(c.priceMin)}–{rupees(c.priceMax)}</span></span>
            <span className="text-sm text-ink-subtle">of {c.totalUnits} total</span>
            <input className="h-9 w-24 rounded-md border border-line-strong px-2 text-sm" type="number" min={0} max={c.totalUnits} value={vals[c._id] ?? ''} onChange={(e) => setVals((v) => ({ ...v, [c._id]: e.target.value }))} aria-label={`Available units for ${c.name}`} />
            <Badge tone={Number(vals[c._id]) === 0 ? 'neutral' : Number(vals[c._id]) <= 5 ? 'warning' : 'success'}>{Number(vals[c._id]) === 0 ? 'Sold out' : Number(vals[c._id]) <= 5 ? 'Few left' : 'Available'}</Badge>
          </li>
        ))}
      </ul>
      <div className="flex justify-end"><Button disabled={!changed.length} loading={update.isPending} onClick={save}>Save availability</Button></div>
    </div>
  );
}

function CsvImport({ project }) {
  const toast = useToast();
  const preview = usePreviewUnits(project._id);
  const confirm = useConfirmUnits(project._id);
  const [result, setResult] = useState(null);
  const run = async (body) => { try { setResult(await preview.mutateAsync(body)); } catch (e) { toast.error(e.message); } };
  const onConfirm = async () => {
    try { const r = await confirm.mutateAsync(result.importId); toast.success(`Saved ${result.create + result.update} units. Totals updated for ${r.configurations.length} configurations.`); setResult(null); } catch (e) { toast.error(e.message); }
  };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-muted">Columns: tower, floor, unit no, configuration (exact name), carpet sq ft, price ₹, status (available, blocked, booked, sold). Up to 2,000 rows. Nothing is saved until you confirm the preview.</p>
        <Button variant="secondary" size="sm" icon={Download} onClick={() => downloadUnitsTemplate(project._id).catch((e) => toast.error(e.message))}>Template</Button>
      </div>
      <FileDrop purpose="unit_csv" kind="csv" label={preview.isPending ? 'Checking rows…' : 'Drop the units CSV here'} onUploaded={(f) => run({ fileId: f.id })} />
      {result && (
        <Card>
          <CardHeader title="Preview" description={`${result.rows} rows read`} action={<Badge tone={result.errors.length ? 'warning' : 'success'}>{result.errors.length} errors</Badge>} />
          <div className="mb-4 flex flex-wrap gap-3 text-sm"><Badge tone="success">{result.create} new units</Badge><Badge tone="info">{result.update} updates</Badge></div>
          {result.errors.length > 0 && (
            <div className="mb-4 max-h-56 overflow-y-auto rounded-md border">
              <table className="min-w-full text-sm"><thead className="bg-surface-muted text-left text-xs uppercase text-ink-subtle"><tr><th className="px-3 py-2">Line</th><th className="px-3 py-2">Problem</th></tr></thead>
                <tbody className="divide-y">{result.errors.map((e) => <tr key={`${e.line}-${e.reason}`}><td className="px-3 py-1.5">{e.line}</td><td className="px-3 py-1.5 text-danger-700">{e.reason}</td></tr>)}</tbody></table>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setResult(null)}>Discard</Button>
            <Button icon={Upload} disabled={!(result.create + result.update)} loading={confirm.isPending} onClick={onConfirm}>Save {result.create + result.update} valid rows</Button>
          </div>
        </Card>
      )}
    </div>
  );
}

function UnitList({ project }) {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const { data, isLoading } = useUnits(project._id, { page, limit: 50, ...(status ? { status } : {}) });
  const names = useMemo(() => Object.fromEntries((project.configurations || []).map((c) => [c._id, c.name])), [project.configurations]);
  return (
    <div className="space-y-3">
      <Tabs value={status} onChange={(v) => { setStatus(v); setPage(1); }} tabs={['', 'available', 'blocked', 'booked', 'sold'].map((s) => ({ value: s, label: s ? titleCase(s) : 'All' }))} />
      <Table loading={isLoading} rows={(data && data.items) || []} empty="No units yet. Import a CSV to add them."
        columns={[
          { key: 'tower', header: 'Tower' }, { key: 'floor', header: 'Floor' }, { key: 'unitNo', header: 'Unit' },
          { key: 'config', header: 'Configuration', render: (r) => names[r.configId] || '-' },
          { key: 'carpetSqft', header: 'Carpet sq ft' },
          { key: 'price', header: 'Price', render: (r) => (r.price ? rupees(r.price) : '-') },
          { key: 'status', header: 'Status', render: (r) => <Badge tone={{ available: 'success', blocked: 'warning', booked: 'info', sold: 'neutral' }[r.status]}>{titleCase(r.status)}</Badge> },
        ]} />
      {data && <Pagination page={data.meta.page} pages={data.meta.pages} onChange={setPage} />}
    </div>
  );
}

export function UnitsTab({ project }) {
  const [view, setView] = useState('inventory');
  if (!(project.configurations || []).length) return <Alert tone="info">Add configurations first.</Alert>;
  return (
    <div className="space-y-5">
      <Tabs value={view} onChange={setView} tabs={[{ value: 'inventory', label: 'Availability' }, { value: 'import', label: 'Bulk import (CSV)' }, { value: 'units', label: 'Unit list' }]} />
      {view === 'inventory' && <Inventory key={project.updatedAt} project={project} />}
      {view === 'import' && <CsvImport project={project} />}
      {view === 'units' && <UnitList project={project} />}
    </div>
  );
}
