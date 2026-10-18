// RE-L-01..04 masters (masters.manage): cities, localities (with lister
// requests), property types, amenities, landmark types, KYC document types and
// reasons. Codes are fixed once created; items are deactivated, never deleted.
// RE-S-ADM-23/24: locality CSV import (preview, then confirm), locality merge
// and reorder (up / down) of the catalogue lists.
import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Check, GitMerge, Plus, Upload, X } from 'lucide-react';
import { Alert, Badge, Button, ConfirmModal, Input, Modal, PageHeader, Pagination, Select, Table, Tabs, Textarea, useToast } from '@/shared/ui';
import { api } from '@/shared/lib/api';
import { MASTER_TYPES, useCreateMaster, useDecideLocalityRequest, useEditMaster, useMasterList } from '@/modules/cms/api';
import { useCities } from '@/modules/listings/api';
import { useT } from '@/shared/i18n';

const MASTER_PATHS = ['cities', 'localities', 'property-types', 'amenities', 'landmark-types', 'doc-types', 'reasons'];
const CATEGORIES = ['residential', 'commercial', 'land'];
// Tab label for a master type (translated), falling back to the module label.
const typeLabel = (t, m) => (MASTER_PATHS.includes(m.path) ? t(`admin.masters.types.${m.path}`) : m.label);
const categoryLabel = (t, c) => (CATEGORIES.includes(c) ? t(`admin.masters.categories.${c}`) : c);

function AddDialog({ path, onClose }) {
  const t = useT();
  const toast = useToast();
  const create = useCreateMaster();
  const cities = useCities();
  const [v, setV] = useState({ name: '', parentId: '', lat: '', lng: '', state: '', category: 'residential' });
  const [errors, setErrors] = useState({});
  const set = (k) => (e) => setV((x) => ({ ...x, [k]: e.target.value }));
  const submit = async () => {
    setErrors({});
    const body = { name: v.name.trim() };
    if (path === 'localities') Object.assign(body, { parentId: v.parentId, lat: Number(v.lat), lng: Number(v.lng) });
    if (path === 'cities') Object.assign(body, { state: v.state, ...(v.lat ? { lat: Number(v.lat), lng: Number(v.lng) } : {}) });
    if (path === 'property-types') body.category = v.category;
    try { await create.mutateAsync({ path, body }); toast.success(t('admin.masters.added', { name: v.name })); onClose(); } catch (e) { setErrors(e.fieldErrors || {}); if (!Object.keys(e.fieldErrors || {}).length) toast.error(e.message); }
  };
  return (
    <Modal open onClose={onClose} title={t('admin.masters.addTitle', { type: typeLabel(t, MASTER_TYPES.find((m) => m.path === path)).toLowerCase() })} size="sm"
      footer={<><Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button><Button loading={create.isPending} disabled={v.name.trim().length < 2} onClick={submit}>{t('admin.masters.add')}</Button></>}>
      <div className="space-y-4">
        <Input label={t('admin.masters.name')} required value={v.name} onChange={set('name')} error={errors.name} />
        {path === 'localities' && <Select label={t('admin.masters.city')} required placeholder={t('admin.masters.choose')} value={v.parentId} onChange={set('parentId')} options={(cities.data || []).map((c) => ({ value: c._id, label: c.name }))} error={errors.parentId} />}
        {path === 'cities' && <Input label={t('admin.masters.state')} value={v.state} onChange={set('state')} />}
        {['localities', 'cities'].includes(path) && (
          <div className="grid grid-cols-2 gap-3">
            <Input label={t('admin.masters.lat')} required={path === 'localities'} value={v.lat} onChange={set('lat')} error={errors.lat} />
            <Input label={t('admin.masters.lng')} required={path === 'localities'} value={v.lng} onChange={set('lng')} error={errors.lng} />
          </div>
        )}
        {path === 'property-types' && <Select label={t('admin.masters.category')} value={v.category} onChange={set('category')} options={CATEGORIES.map((c) => ({ value: c, label: categoryLabel(t, c) }))} />}
      </div>
    </Modal>
  );
}

function Requests() {
  const t = useT();
  const toast = useToast();
  const { data, isLoading } = useMasterList('localities', { requests: 'pending', limit: 100 });
  const decide = useDecideLocalityRequest();
  const run = async (id, decision) => { try { await decide.mutateAsync({ id, body: { decision } }); toast.success(decision === 'approve' ? t('admin.masters.localityAdded') : t('admin.masters.requestRejected')); } catch (e) { toast.error(e.message); } };
  const rows = (data && data.items) || [];
  if (!isLoading && !rows.length) return null;
  return (
    <Alert tone="info" className="mb-4" title={t('admin.masters.requests', { count: rows.length })}>
      <ul className="mt-2 space-y-2">
        {rows.map((r) => (
          <li key={r._id} className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{r.name}</span>
            <Button size="sm" icon={Check} onClick={() => run(r._id, 'approve')}>{t('admin.masters.approve')}</Button>
            <Button size="sm" variant="secondary" icon={X} onClick={() => run(r._id, 'reject')}>{t('admin.masters.reject')}</Button>
          </li>
        ))}
      </ul>
    </Alert>
  );
}

// Catalogue lists are short and ordered by hand; locations are long and searched.
const SORTABLE = ['property-types', 'amenities', 'landmark-types', 'doc-types', 'reasons'];
const invalidateMasters = (qc) => { qc.invalidateQueries({ queryKey: ['admin', 'masters'] }); qc.invalidateQueries({ queryKey: ['masters', 'public'] }); qc.invalidateQueries({ queryKey: ['locations'] }); };

// "city_code,name,code,pincodes(;),lat,lng,aliases(;)" - the same rules as the
// import endpoint (cms service importLocalities), checked before upload.
function parseLocalityCsv(text, cityCodes, t) {
  const lines = String(text || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length && /^city/i.test(lines[0])) lines.shift();
  return lines.map((line, i) => {
    const [cityCode = '', name = '', code = '', pins = '', lat = '', lng = '', aliases = ''] = line.split(',').map((x) => (x || '').trim());
    const problems = [];
    if (!cityCodes.has(cityCode)) problems.push(t('admin.masters.csv.unknownCity', { code: cityCode }));
    if (name.length < 2 || name.length > 80) problems.push(t('admin.masters.csv.nameLength'));
    if (code && !/^[a-z0-9_-]{2,40}$/.test(code.toLowerCase())) problems.push(t('admin.masters.csv.codeRule'));
    const pinList = pins ? pins.split(';').map((p) => p.trim()).filter(Boolean) : [];
    if (pinList.some((p) => !/^[1-9][0-9]{5}$/.test(p))) problems.push(t('admin.masters.csv.pincodes'));
    if ((lat || lng) && !(Number(lat) >= 6 && Number(lat) <= 37 && Number(lng) >= 68 && Number(lng) <= 98)) problems.push(t('admin.masters.csv.latLng'));
    return { line: i + 1, cityCode, name, code, pincodes: pinList, lat, lng, aliases: aliases ? aliases.split(';').map((a) => a.trim()).filter(Boolean) : [], problems };
  });
}

const EXAMPLE = 'city_code,name,code,pincodes,lat,lng,aliases\npune,Baner,baner,411045,18.559,73.786,Baner Road';

function ImportDialog({ onClose }) {
  const t = useT();
  const toast = useToast();
  const qc = useQueryClient();
  const cities = useMasterList('cities', { limit: 500 });
  const [csv, setCsv] = useState('');
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const cityCodes = useMemo(() => new Set(((cities.data && cities.data.items) || []).map((c) => c.code)), [cities.data]);
  const rows = preview || [];
  const bad = rows.filter((r) => r.problems.length);
  const ready = rows.length - bad.length;
  const onFile = async (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) { toast.error(t('admin.masters.fileTooLarge')); return; }
    setCsv(await f.text()); setPreview(null); setResult(null);
  };
  const check = () => {
    const parsed = parseLocalityCsv(csv, cityCodes, t);
    if (!parsed.length) { toast.error(t('admin.masters.noRows')); return; }
    if (parsed.length > 2000) { toast.error(t('admin.masters.tooManyRows')); return; }
    setPreview(parsed);
  };
  const confirm = async () => {
    setBusy(true);
    try {
      const keep = rows.filter((r) => !r.problems.length).map((r) => [r.cityCode, r.name, r.code, r.pincodes.join(';'), r.lat, r.lng, r.aliases.join(';')].join(','));
      const r = await api.post('/admin/masters/localities/import', { csv: keep.join('\n') });
      setResult(r);
      invalidateMasters(qc);
      toast.success(t('admin.masters.importToast', { created: r.created, updated: r.updated }));
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };
  const footer = result ? <Button onClick={onClose}>{t('admin.masters.done')}</Button> : (
    <>
      <Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
      {preview
        ? <Button icon={Upload} loading={busy} disabled={!ready} onClick={confirm}>{t('admin.masters.importRows', { count: ready })}</Button>
        : <Button disabled={!csv.trim() || cities.isLoading} onClick={check}>{t('admin.masters.preview')}</Button>}
    </>
  );
  return (
    <Modal open onClose={onClose} size="lg" title={t('admin.masters.importTitle')} footer={footer}
      description={t('admin.masters.importDesc')}>
      {result ? (
        <div className="space-y-3">
          <Alert tone={result.errors.length ? 'warning' : 'success'} title={t('admin.masters.resultTitle', { created: result.created, updated: result.updated })}>{result.errors.length ? t('admin.masters.rowsRejected', { n: result.errors.length }) : t('admin.masters.allImported')}</Alert>
          {result.errors.length > 0 && <ul className="max-h-48 overflow-y-auto text-xs text-danger-700">{result.errors.map((e) => <li key={e.line}>{t('admin.masters.rowError', { line: e.line, reason: e.reason })}</li>)}</ul>}
        </div>
      ) : preview ? (
        <div className="space-y-3">
          <p className="text-sm text-ink-muted">
            {t('admin.masters.readyOf', { ready, total: rows.length })}{bad.length ? ` ${t('admin.masters.skipped')}` : ''}{' '}
            <button type="button" className="font-medium text-brand-700 hover:underline" onClick={() => setPreview(null)}>{t('admin.masters.editCsv')}</button>
          </p>
          <div className="max-h-80 overflow-y-auto">
            <Table rows={rows} rowKey={(r) => r.line}
              columns={[
                { key: 'line', header: '#' },
                { key: 'cityCode', header: t('admin.masters.city') },
                { key: 'name', header: t('admin.masters.locality'), render: (r) => <span>{r.name}{r.code && <code className="ml-1 text-xs text-ink-subtle">{r.code}</code>}</span> },
                { key: 'pins', header: t('admin.masters.pincodes'), render: (r) => <span className="text-xs">{r.pincodes.join(', ') || '-'}</span> },
                { key: 'ok', header: t('admin.masters.check'), render: (r) => (r.problems.length ? <span className="text-xs text-danger-700">{r.problems.join('; ')}</span> : <Badge tone="success">{t('admin.masters.ok')}</Badge>) },
              ]} />
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <input type="file" accept=".csv,text/csv" onChange={onFile} className="block text-sm" aria-label={t('admin.masters.csvFile')} />
          <Textarea label={t('admin.masters.pasteCsv')} rows={8} value={csv} onChange={(e) => { setCsv(e.target.value); setPreview(null); }} placeholder={EXAMPLE} />
        </div>
      )}
    </Modal>
  );
}

// POST /admin/masters/localities/:id/merge { intoId }: listings move to the
// surviving locality; the merged name becomes one of its aliases.
function MergeDialog({ locality, onClose }) {
  const t = useT();
  const toast = useToast();
  const qc = useQueryClient();
  const { data } = useMasterList('localities', { cityId: locality.parentId, limit: 500, sort: 'name' });
  const [intoId, setIntoId] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const options = ((data && data.items) || []).filter((l) => l._id !== locality._id && l.active).map((l) => ({ value: l._id, label: l.name }));
  const into = options.find((o) => o.value === intoId);
  const run = async () => {
    setBusy(true);
    try {
      const r = await api.post(`/admin/masters/localities/${locality._id}/merge`, { intoId });
      invalidateMasters(qc);
      toast.success(t('admin.masters.merged', { name: locality.name, into: into.label, count: r.listingsMoved }));
      onClose();
    } catch (e) { toast.error(e.message); setConfirming(false); } finally { setBusy(false); }
  };
  return (
    <>
      <Modal open={!confirming} onClose={onClose} title={t('admin.masters.mergeTitle', { name: locality.name })} size="sm" description={t('admin.masters.mergeDesc')}
        footer={<><Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button><Button disabled={!intoId} onClick={() => setConfirming(true)}>{t('admin.masters.continue')}</Button></>}>
        <Select label={t('admin.masters.mergeInto')} required placeholder={t('admin.masters.mergeIntoPlaceholder')} value={intoId} onChange={(e) => setIntoId(e.target.value)} options={options} />
      </Modal>
      <ConfirmModal open={confirming} onClose={() => setConfirming(false)} onConfirm={run} loading={busy} tone="danger" confirmLabel={t('admin.masters.merge')} title={t('admin.masters.mergeConfirmTitle')}>
        {t('admin.masters.mergeConfirmText', { from: locality.name, to: into ? into.label : '' })}
      </ConfirmModal>
    </>
  );
}

export default function MastersPage() {
  const t = useT();
  const toast = useToast();
  const qc = useQueryClient();
  const [path, setPath] = useState('cities');
  const [page, setPage] = useState(1);
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [merging, setMerging] = useState(null);
  const [reordering, setReordering] = useState(false);
  const [editing, setEditing] = useState({});
  const edit = useEditMaster();
  const sortable = SORTABLE.includes(path);
  const { data, isLoading } = useMasterList(path, sortable ? { limit: 500 } : { page, limit: 50 });
  const items = (data && data.items) || [];
  const save = async (row, body, msg) => { try { await edit.mutateAsync({ path, id: row._id, body }); toast.success(msg); setEditing((x) => ({ ...x, [row._id]: undefined })); } catch (e) { toast.error(e.message); } };
  // PATCH /admin/masters/:type/reorder { ids } with the whole list in its new order.
  const move = async (index, delta) => {
    const ids = items.map((r) => r._id);
    const to = index + delta;
    if (to < 0 || to >= ids.length) return;
    [ids[index], ids[to]] = [ids[to], ids[index]];
    setReordering(true);
    try { await api.patch(`/admin/masters/${path}/reorder`, { ids }); invalidateMasters(qc); } catch (e) { toast.error(e.message); } finally { setReordering(false); }
  };

  return (
    <>
      <PageHeader title={t('admin.masters.title')} description={t('admin.masters.description')}
        actions={<>{path === 'localities' && <Button variant="secondary" icon={Upload} onClick={() => setImporting(true)}>{t('admin.masters.importCsv')}</Button>}<Button icon={Plus} onClick={() => setAdding(true)}>{t('admin.masters.add')}</Button></>} />
      <Tabs className="mb-4" value={path} onChange={(v) => { setPath(v); setPage(1); }} tabs={MASTER_TYPES.map((m) => ({ value: m.path, label: typeLabel(t, m) }))} />
      {path === 'localities' && <Requests />}
      {sortable && items.length > 1 && <p className="mb-2 text-xs text-ink-subtle">{t('admin.masters.orderHint')}</p>}
      <Table loading={isLoading} rows={items} empty={t('admin.masters.empty')}
        columns={[
          ...(sortable ? [{ key: 'order', header: t('admin.masters.order'), render: (r) => { const i = items.indexOf(r); return (
            <span className="flex gap-0.5">
              <Button size="sm" variant="ghost" icon={ArrowUp} disabled={i === 0 || reordering} onClick={() => move(i, -1)} aria-label={t('admin.masters.moveUp', { name: r.name })} />
              <Button size="sm" variant="ghost" icon={ArrowDown} disabled={i === items.length - 1 || reordering} onClick={() => move(i, 1)} aria-label={t('admin.masters.moveDown', { name: r.name })} />
            </span>
          ); } }] : []),
          { key: 'name', header: t('admin.masters.name'), render: (r) => (editing[r._id] !== undefined
            ? <span className="flex gap-2"><input className="h-8 rounded border border-line-strong px-2 text-sm" value={editing[r._id]} onChange={(e) => setEditing((x) => ({ ...x, [r._id]: e.target.value }))} aria-label={t('admin.masters.name')} /><Button size="sm" onClick={() => save(r, { name: editing[r._id] }, t('admin.masters.renamed'))}>{t('common.save')}</Button></span>
            : <button type="button" className="text-left font-medium text-ink hover:text-brand-700" onClick={() => setEditing((x) => ({ ...x, [r._id]: r.name }))}>{r.name}</button>) },
          { key: 'code', header: t('admin.masters.code'), render: (r) => <code className="text-xs text-ink-subtle">{r.code}</code> },
          { key: 'meta', header: t('admin.masters.details'), render: (r) => <span className="text-xs text-ink-subtle">{[r.meta?.state, r.meta?.category && categoryLabel(t, r.meta.category), r.meta?.appliesTo && t('admin.masters.meta.for', { list: r.meta.appliesTo.join(', ') }), r.meta?.required && t('admin.masters.meta.required'), r.meta?.aliases?.length && t('admin.masters.meta.aka', { list: r.meta.aliases.join(', ') }), r.meta?.centroid && `${r.meta.centroid.coordinates[1].toFixed(3)}, ${r.meta.centroid.coordinates[0].toFixed(3)}`].filter(Boolean).join(' · ')}</span> },
          { key: 'active', header: t('admin.masters.status'), render: (r) => <Badge tone={r.active ? 'success' : 'neutral'}>{r.active ? t('admin.masters.active') : t('admin.masters.inactive')}</Badge> },
          { key: 'act', header: '', render: (r) => (
            <span className="flex justify-end gap-1">
              {path === 'localities' && r.active && <Button size="sm" variant="ghost" icon={GitMerge} onClick={() => setMerging(r)}>{t('admin.masters.merge')}</Button>}
              <Button size="sm" variant="ghost" onClick={() => save(r, { active: !r.active }, r.active ? t('admin.masters.deactivated') : t('admin.masters.activated'))}>{r.active ? t('admin.masters.deactivate') : t('admin.masters.activate')}</Button>
            </span>
          ) },
        ]} />
      {data && !sortable && <Pagination page={data.meta.page} pages={data.meta.pages} onChange={setPage} />}
      {adding && <AddDialog path={path} onClose={() => setAdding(false)} />}
      {importing && <ImportDialog onClose={() => setImporting(false)} />}
      {merging && <MergeDialog locality={merging} onClose={() => setMerging(null)} />}
    </>
  );
}
