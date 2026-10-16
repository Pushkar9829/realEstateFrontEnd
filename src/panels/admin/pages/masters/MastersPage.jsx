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

function AddDialog({ path, onClose }) {
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
    try { await create.mutateAsync({ path, body }); toast.success(`${v.name} added`); onClose(); } catch (e) { setErrors(e.fieldErrors || {}); if (!Object.keys(e.fieldErrors || {}).length) toast.error(e.message); }
  };
  return (
    <Modal open onClose={onClose} title={`Add to ${MASTER_TYPES.find((t) => t.path === path).label.toLowerCase()}`} size="sm"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button loading={create.isPending} disabled={v.name.trim().length < 2} onClick={submit}>Add</Button></>}>
      <div className="space-y-4">
        <Input label="Name" required value={v.name} onChange={set('name')} error={errors.name} />
        {path === 'localities' && <Select label="City" required placeholder="Choose" value={v.parentId} onChange={set('parentId')} options={(cities.data || []).map((c) => ({ value: c._id, label: c.name }))} error={errors.parentId} />}
        {path === 'cities' && <Input label="State" value={v.state} onChange={set('state')} />}
        {['localities', 'cities'].includes(path) && (
          <div className="grid grid-cols-2 gap-3">
            <Input label="Centre latitude" required={path === 'localities'} value={v.lat} onChange={set('lat')} error={errors.lat} />
            <Input label="Centre longitude" required={path === 'localities'} value={v.lng} onChange={set('lng')} error={errors.lng} />
          </div>
        )}
        {path === 'property-types' && <Select label="Category" value={v.category} onChange={set('category')} options={['residential', 'commercial', 'land'].map((c) => ({ value: c, label: c }))} />}
      </div>
    </Modal>
  );
}

function Requests() {
  const toast = useToast();
  const { data, isLoading } = useMasterList('localities', { requests: 'pending', limit: 100 });
  const decide = useDecideLocalityRequest();
  const run = async (id, decision) => { try { await decide.mutateAsync({ id, body: { decision } }); toast.success(decision === 'approve' ? 'Locality added' : 'Request rejected'); } catch (e) { toast.error(e.message); } };
  const rows = (data && data.items) || [];
  if (!isLoading && !rows.length) return null;
  return (
    <Alert tone="info" className="mb-4" title={`${rows.length} locality request${rows.length === 1 ? '' : 's'} from listers`}>
      <ul className="mt-2 space-y-2">
        {rows.map((r) => (
          <li key={r._id} className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{r.name}</span>
            <Button size="sm" icon={Check} onClick={() => run(r._id, 'approve')}>Approve</Button>
            <Button size="sm" variant="secondary" icon={X} onClick={() => run(r._id, 'reject')}>Reject</Button>
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
function parseLocalityCsv(text, cityCodes) {
  const lines = String(text || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length && /^city/i.test(lines[0])) lines.shift();
  return lines.map((line, i) => {
    const [cityCode = '', name = '', code = '', pins = '', lat = '', lng = '', aliases = ''] = line.split(',').map((x) => (x || '').trim());
    const problems = [];
    if (!cityCodes.has(cityCode)) problems.push(`unknown city "${cityCode}"`);
    if (name.length < 2 || name.length > 80) problems.push('name 2-80 characters');
    if (code && !/^[a-z0-9_-]{2,40}$/.test(code.toLowerCase())) problems.push('code: letters, digits, - or _');
    const pinList = pins ? pins.split(';').map((p) => p.trim()).filter(Boolean) : [];
    if (pinList.some((p) => !/^[1-9][0-9]{5}$/.test(p))) problems.push('pincodes are 6 digits');
    if ((lat || lng) && !(Number(lat) >= 6 && Number(lat) <= 37 && Number(lng) >= 68 && Number(lng) <= 98)) problems.push('lat 6-37, lng 68-98 (India)');
    return { line: i + 1, cityCode, name, code, pincodes: pinList, lat, lng, aliases: aliases ? aliases.split(';').map((a) => a.trim()).filter(Boolean) : [], problems };
  });
}

const EXAMPLE = 'city_code,name,code,pincodes,lat,lng,aliases\npune,Baner,baner,411045,18.559,73.786,Baner Road';

function ImportDialog({ onClose }) {
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
    if (f.size > 2 * 1024 * 1024) { toast.error('The file is larger than 2 MB'); return; }
    setCsv(await f.text()); setPreview(null); setResult(null);
  };
  const check = () => {
    const parsed = parseLocalityCsv(csv, cityCodes);
    if (!parsed.length) { toast.error('No rows found'); return; }
    if (parsed.length > 2000) { toast.error('At most 2,000 rows per import'); return; }
    setPreview(parsed);
  };
  const confirm = async () => {
    setBusy(true);
    try {
      const keep = rows.filter((r) => !r.problems.length).map((r) => [r.cityCode, r.name, r.code, r.pincodes.join(';'), r.lat, r.lng, r.aliases.join(';')].join(','));
      const r = await api.post('/admin/masters/localities/import', { csv: keep.join('\n') });
      setResult(r);
      invalidateMasters(qc);
      toast.success(`${r.created} created, ${r.updated} updated`);
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };
  const footer = result ? <Button onClick={onClose}>Done</Button> : (
    <>
      <Button variant="ghost" onClick={onClose}>Cancel</Button>
      {preview
        ? <Button icon={Upload} loading={busy} disabled={!ready} onClick={confirm}>Import {ready} row{ready === 1 ? '' : 's'}</Button>
        : <Button disabled={!csv.trim() || cities.isLoading} onClick={check}>Preview</Button>}
    </>
  );
  return (
    <Modal open onClose={onClose} size="lg" title="Import localities from CSV" footer={footer}
      description="Columns: city_code, name, code, pincodes (separated by ;), lat, lng, aliases (separated by ;). A header row is optional. Existing codes are updated.">
      {result ? (
        <div className="space-y-3">
          <Alert tone={result.errors.length ? 'warning' : 'success'} title={`${result.created} created · ${result.updated} updated`}>{result.errors.length ? `${result.errors.length} rows were rejected by the server.` : 'All rows imported.'}</Alert>
          {result.errors.length > 0 && <ul className="max-h-48 overflow-y-auto text-xs text-danger-700">{result.errors.map((e) => <li key={e.line}>Row {e.line}: {e.reason}</li>)}</ul>}
        </div>
      ) : preview ? (
        <div className="space-y-3">
          <p className="text-sm text-ink-muted">
            {ready} of {rows.length} rows are ready.{bad.length ? ' Rows with problems are skipped.' : ''}{' '}
            <button type="button" className="font-medium text-brand-700 hover:underline" onClick={() => setPreview(null)}>Edit the CSV</button>
          </p>
          <div className="max-h-80 overflow-y-auto">
            <Table rows={rows} rowKey={(r) => r.line}
              columns={[
                { key: 'line', header: '#' },
                { key: 'cityCode', header: 'City' },
                { key: 'name', header: 'Locality', render: (r) => <span>{r.name}{r.code && <code className="ml-1 text-xs text-ink-subtle">{r.code}</code>}</span> },
                { key: 'pins', header: 'Pincodes', render: (r) => <span className="text-xs">{r.pincodes.join(', ') || '-'}</span> },
                { key: 'ok', header: 'Check', render: (r) => (r.problems.length ? <span className="text-xs text-danger-700">{r.problems.join('; ')}</span> : <Badge tone="success">OK</Badge>) },
              ]} />
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <input type="file" accept=".csv,text/csv" onChange={onFile} className="block text-sm" aria-label="CSV file" />
          <Textarea label="Or paste CSV" rows={8} value={csv} onChange={(e) => { setCsv(e.target.value); setPreview(null); }} placeholder={EXAMPLE} />
        </div>
      )}
    </Modal>
  );
}

// POST /admin/masters/localities/:id/merge { intoId }: listings move to the
// surviving locality; the merged name becomes one of its aliases.
function MergeDialog({ locality, onClose }) {
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
      toast.success(`${locality.name} merged into ${into.label}. ${r.listingsMoved} listing${r.listingsMoved === 1 ? '' : 's'} moved.`);
      onClose();
    } catch (e) { toast.error(e.message); setConfirming(false); } finally { setBusy(false); }
  };
  return (
    <>
      <Modal open={!confirming} onClose={onClose} title={`Merge ${locality.name}`} size="sm" description="Use this for duplicates. The merged locality is deactivated and its name kept as a search alias."
        footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button disabled={!intoId} onClick={() => setConfirming(true)}>Continue</Button></>}>
        <Select label="Merge into" required placeholder="Choose a locality in the same city" value={intoId} onChange={(e) => setIntoId(e.target.value)} options={options} />
      </Modal>
      <ConfirmModal open={confirming} onClose={() => setConfirming(false)} onConfirm={run} loading={busy} tone="danger" confirmLabel="Merge" title="Merge localities?">
        Every listing in {locality.name} moves to {into ? into.label : ''}. This cannot be undone from here.
      </ConfirmModal>
    </>
  );
}

export default function MastersPage() {
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
      <PageHeader title="Masters" description="Lists used across the platform. Deactivated items disappear from forms but stay on existing listings."
        actions={<>{path === 'localities' && <Button variant="secondary" icon={Upload} onClick={() => setImporting(true)}>Import CSV</Button>}<Button icon={Plus} onClick={() => setAdding(true)}>Add</Button></>} />
      <Tabs className="mb-4" value={path} onChange={(v) => { setPath(v); setPage(1); }} tabs={MASTER_TYPES.map((t) => ({ value: t.path, label: t.label }))} />
      {path === 'localities' && <Requests />}
      {sortable && items.length > 1 && <p className="mb-2 text-xs text-ink-subtle">Use the arrows to change the order shown in forms and filters.</p>}
      <Table loading={isLoading} rows={items} empty="Nothing here yet."
        columns={[
          ...(sortable ? [{ key: 'order', header: 'Order', render: (r) => { const i = items.indexOf(r); return (
            <span className="flex gap-0.5">
              <Button size="sm" variant="ghost" icon={ArrowUp} disabled={i === 0 || reordering} onClick={() => move(i, -1)} aria-label={`Move ${r.name} up`} />
              <Button size="sm" variant="ghost" icon={ArrowDown} disabled={i === items.length - 1 || reordering} onClick={() => move(i, 1)} aria-label={`Move ${r.name} down`} />
            </span>
          ); } }] : []),
          { key: 'name', header: 'Name', render: (r) => (editing[r._id] !== undefined
            ? <span className="flex gap-2"><input className="h-8 rounded border border-line-strong px-2 text-sm" value={editing[r._id]} onChange={(e) => setEditing((x) => ({ ...x, [r._id]: e.target.value }))} aria-label="Name" /><Button size="sm" onClick={() => save(r, { name: editing[r._id] }, 'Renamed')}>Save</Button></span>
            : <button type="button" className="text-left font-medium text-ink hover:text-brand-700" onClick={() => setEditing((x) => ({ ...x, [r._id]: r.name }))}>{r.name}</button>) },
          { key: 'code', header: 'Code', render: (r) => <code className="text-xs text-ink-subtle">{r.code}</code> },
          { key: 'meta', header: 'Details', render: (r) => <span className="text-xs text-ink-subtle">{[r.meta?.state, r.meta?.category, r.meta?.appliesTo && `for ${r.meta.appliesTo.join(', ')}`, r.meta?.required && 'required', r.meta?.aliases?.length && `aka ${r.meta.aliases.join(', ')}`, r.meta?.centroid && `${r.meta.centroid.coordinates[1].toFixed(3)}, ${r.meta.centroid.coordinates[0].toFixed(3)}`].filter(Boolean).join(' · ')}</span> },
          { key: 'active', header: 'Status', render: (r) => <Badge tone={r.active ? 'success' : 'neutral'}>{r.active ? 'Active' : 'Inactive'}</Badge> },
          { key: 'act', header: '', render: (r) => (
            <span className="flex justify-end gap-1">
              {path === 'localities' && r.active && <Button size="sm" variant="ghost" icon={GitMerge} onClick={() => setMerging(r)}>Merge</Button>}
              <Button size="sm" variant="ghost" onClick={() => save(r, { active: !r.active }, r.active ? 'Deactivated' : 'Activated')}>{r.active ? 'Deactivate' : 'Activate'}</Button>
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
