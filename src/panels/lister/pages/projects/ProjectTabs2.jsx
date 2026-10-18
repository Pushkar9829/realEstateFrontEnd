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
import { useT } from '@/shared/i18n';

export function MediaTab({ project }) {
  const t = useT();
  const add = useAddProjectMedia(project._id);
  const toast = useToast();
  const photos = project.media?.photos || [];
  return (
    <div className="space-y-6">
      <Card padded={false} className="border-0 shadow-none">
        <CardHeader title={t('lister.projects.media.photos', { n: photos.length })} description={t('lister.projects.media.desc')} />
        {photos.length > 0 && (
          <ul className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {photos.map((p) => <li key={p.fileId} className="aspect-[4/3] overflow-hidden rounded-lg border bg-surface-sunken"><img src={p.url} alt={p.caption || ''} className="h-full w-full object-cover" loading="lazy" /></li>)}
          </ul>
        )}
        <FileDrop multiple purpose="project_media" kind="image" disabled={photos.length >= 30} label={t('lister.projects.media.drop')} onUploaded={async (f) => { await add.mutateAsync({ kind: 'photo', fileId: f.id }); }} />
      </Card>
      <div>
        <p className="mb-2 text-sm font-medium text-ink">{t('lister.wizard.media.brochure')} {project.media?.brochure?.url && <a className="ml-2 inline-flex items-center gap-1 text-brand-700 hover:underline" href={project.media.brochure.url} target="_blank" rel="noreferrer"><FileText className="h-4 w-4" />{t('lister.projects.media.current')}</a>}</p>
        <FileDrop compact purpose="brochure" kind="document" label={project.media?.brochure ? t('lister.wizard.media.replaceBrochure') : t('lister.projects.media.uploadBrochure')}
          onUploaded={async (f) => { try { await add.mutateAsync({ kind: 'brochure', fileId: f.id }); toast.success(t('lister.wizard.media.brochureAdded')); } catch (e) { toast.error(e.message); } }} />
      </div>
    </div>
  );
}

export function CommissionTab({ project, next }) {
  const t = useT();
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
    try { const r = await accept.mutateAsync({ percent: n, accept: true, typedName: name.trim() }); toast.success(t('lister.wizard.comm.accepted', { no: r.agreementNo })); next(); } catch (e) { toast.error(e.message); }
  };
  return (
    <div className="space-y-5">
      {project.commission?.acceptedAt && <Alert tone="success">{t('lister.projects.comm.accepted', { pct: project.commission.percent, date: dateTime(project.commission.acceptedAt) })}</Alert>}
      <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
        <div className="space-y-4">
          <Input label={t('lister.projects.comm.percent')} required type="number" step="0.01" value={pct} onChange={(e) => setPct(e.target.value)} error={pct && !valid ? t('lister.wizard.comm.range', { min, max }) : undefined} />
          {valid && project.configurations?.[0]?.priceMin > 0 && <p className="rounded-md bg-brand-50 p-3 text-sm text-brand-700">{t('lister.projects.comm.example', { price: rupees(project.configurations[0].priceMin), amount: rupees(Math.round((project.configurations[0].priceMin * n) / 100)) })}</p>}
          <Input label={t('lister.kyc.decl.typeName')} value={name} onChange={(e) => setName(e.target.value)} />
          <Checkbox label={t('lister.projects.comm.agree')} checked={agree} onChange={(e) => setAgree(e.target.checked)} />
          <Button icon={CheckCircle2} disabled={!valid || !agree || name.trim().length < 2} loading={accept.isPending} onClick={save}>{t('lister.projects.comm.accept')}</Button>
        </div>
        <div className="max-h-80 overflow-y-auto whitespace-pre-line rounded-md border bg-surface-muted p-4 text-sm leading-relaxed text-ink-muted">{text}</div>
      </div>
    </div>
  );
}

function Inventory({ project }) {
  const t = useT();
  const update = useUpdateInventory(project._id);
  const toast = useToast();
  const [vals, setVals] = useState(Object.fromEntries((project.configurations || []).map((c) => [c._id, String(c.availableUnits)])));
  const changed = (project.configurations || []).filter((c) => String(c.availableUnits) !== vals[c._id]);
  const save = async () => {
    try {
      const r = await update.mutateAsync({ items: changed.map((c) => ({ configId: c._id, availableUnits: Number(vals[c._id]) })) });
      toast.success(r.status === 'sold_out' ? t('lister.projects.inv.savedSoldOut') : t('lister.projects.inv.saved'));
    } catch (e) { toast.error(e.message); }
  };
  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-muted">{t('lister.projects.inv.hint')}</p>
      <ul className="divide-y rounded-lg border">
        {(project.configurations || []).map((c) => (
          <li key={c._id} className="flex flex-wrap items-center gap-4 px-4 py-3">
            <span className="min-w-0 flex-1"><span className="block font-medium text-ink">{c.name}</span><span className="text-xs text-ink-subtle">{c.carpetMin}–{c.carpetMax} {t('lister.wizard.units.sqft')} · {rupees(c.priceMin)}–{rupees(c.priceMax)}</span></span>
            <span className="text-sm text-ink-subtle">{t('lister.projects.inv.ofTotal', { n: c.totalUnits })}</span>
            <input className="h-9 w-24 rounded-md border border-line-strong px-2 text-sm" type="number" min={0} max={c.totalUnits} value={vals[c._id] ?? ''} onChange={(e) => setVals((v) => ({ ...v, [c._id]: e.target.value }))} aria-label={t('lister.projects.inv.availableFor', { name: c.name })} />
            <Badge tone={Number(vals[c._id]) === 0 ? 'neutral' : Number(vals[c._id]) <= 5 ? 'warning' : 'success'}>{Number(vals[c._id]) === 0 ? t('lister.projects.status.sold_out') : Number(vals[c._id]) <= 5 ? t('lister.projects.inv.fewLeft') : t('lister.projects.inv.available')}</Badge>
          </li>
        ))}
      </ul>
      <div className="flex justify-end"><Button disabled={!changed.length} loading={update.isPending} onClick={save}>{t('lister.availability.save')}</Button></div>
    </div>
  );
}

function CsvImport({ project }) {
  const t = useT();
  const toast = useToast();
  const preview = usePreviewUnits(project._id);
  const confirm = useConfirmUnits(project._id);
  const [result, setResult] = useState(null);
  const run = async (body) => { try { setResult(await preview.mutateAsync(body)); } catch (e) { toast.error(e.message); } };
  const onConfirm = async () => {
    try { const r = await confirm.mutateAsync(result.importId); toast.success(t('lister.projects.csv.saved', { n: result.create + result.update, configs: r.configurations.length })); setResult(null); } catch (e) { toast.error(e.message); }
  };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-muted">{t('lister.projects.csv.hint')}</p>
        <Button variant="secondary" size="sm" icon={Download} onClick={() => downloadUnitsTemplate(project._id).catch((e) => toast.error(e.message))}>{t('lister.projects.csv.template')}</Button>
      </div>
      <FileDrop purpose="unit_csv" kind="csv" label={preview.isPending ? t('lister.projects.csv.checking') : t('lister.projects.csv.drop')} onUploaded={(f) => run({ fileId: f.id })} />
      {result && (
        <Card>
          <CardHeader title={t('lister.projects.csv.preview')} description={t('lister.projects.csv.rows', { n: result.rows })} action={<Badge tone={result.errors.length ? 'warning' : 'success'}>{t('lister.projects.csv.errors', { n: result.errors.length })}</Badge>} />
          <div className="mb-4 flex flex-wrap gap-3 text-sm"><Badge tone="success">{t('lister.projects.csv.newUnits', { n: result.create })}</Badge><Badge tone="info">{t('lister.projects.csv.updates', { n: result.update })}</Badge></div>
          {result.errors.length > 0 && (
            <div className="mb-4 max-h-56 overflow-y-auto rounded-md border">
              <table className="min-w-full text-sm"><thead className="bg-surface-muted text-left text-xs uppercase text-ink-subtle"><tr><th className="px-3 py-2">{t('lister.projects.csv.line')}</th><th className="px-3 py-2">{t('lister.projects.csv.problem')}</th></tr></thead>
                <tbody className="divide-y">{result.errors.map((e) => <tr key={`${e.line}-${e.reason}`}><td className="px-3 py-1.5">{e.line}</td><td className="px-3 py-1.5 text-danger-700">{e.reason}</td></tr>)}</tbody></table>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setResult(null)}>{t('lister.projects.csv.discard')}</Button>
            <Button icon={Upload} disabled={!(result.create + result.update)} loading={confirm.isPending} onClick={onConfirm}>{t('lister.projects.csv.saveRows', { n: result.create + result.update })}</Button>
          </div>
        </Card>
      )}
    </div>
  );
}

const UNIT_STATUS = ['available', 'blocked', 'booked', 'sold'];

function UnitList({ project }) {
  const t = useT();
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const { data, isLoading } = useUnits(project._id, { page, limit: 50, ...(status ? { status } : {}) });
  const names = useMemo(() => Object.fromEntries((project.configurations || []).map((c) => [c._id, c.name])), [project.configurations]);
  return (
    <div className="space-y-3">
      <Tabs value={status} onChange={(v) => { setStatus(v); setPage(1); }} tabs={['', ...UNIT_STATUS].map((s) => ({ value: s, label: s ? t(`lister.projects.unitStatus.${s}`) : t('lister.listings.tabs.all') }))} />
      <Table loading={isLoading} rows={(data && data.items) || []} empty={t('lister.projects.units.empty')}
        columns={[
          { key: 'tower', header: t('lister.projects.units.tower') }, { key: 'floor', header: t('lister.wizard.details.floor') }, { key: 'unitNo', header: t('lister.projects.units.unit') },
          { key: 'config', header: t('lister.wizard.basic.config'), render: (r) => names[r.configId] || '-' },
          { key: 'carpetSqft', header: t('lister.projects.units.carpet') },
          { key: 'price', header: t('lister.wizard.steps.price'), render: (r) => (r.price ? rupees(r.price) : '-') },
          { key: 'status', header: t('lister.leads.col.status'), render: (r) => <Badge tone={{ available: 'success', blocked: 'warning', booked: 'info', sold: 'neutral' }[r.status]}>{UNIT_STATUS.includes(r.status) ? t(`lister.projects.unitStatus.${r.status}`) : titleCase(r.status)}</Badge> },
        ]} />
      {data && <Pagination page={data.meta.page} pages={data.meta.pages} onChange={setPage} />}
    </div>
  );
}

export function UnitsTab({ project }) {
  const t = useT();
  const [view, setView] = useState('inventory');
  if (!(project.configurations || []).length) return <Alert tone="info">{t('lister.projects.units.addFirst')}</Alert>;
  return (
    <div className="space-y-5">
      <Tabs value={view} onChange={setView} tabs={[{ value: 'inventory', label: t('lister.projects.units.availability') }, { value: 'import', label: t('lister.projects.units.import') }, { value: 'units', label: t('lister.projects.units.list') }]} />
      {view === 'inventory' && <Inventory key={project.updatedAt} project={project} />}
      {view === 'import' && <CsvImport project={project} />}
      {view === 'units' && <UnitList project={project} />}
    </div>
  );
}
