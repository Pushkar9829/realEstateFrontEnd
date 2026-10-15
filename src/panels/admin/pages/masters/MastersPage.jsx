// RE-L-01..04 masters (masters.manage): cities, localities (with lister
// requests), property types, amenities, landmark types, KYC document types and
// reasons. Codes are fixed once created; items are deactivated, never deleted.
import { useState } from 'react';
import { Check, Plus, X } from 'lucide-react';
import { Alert, Badge, Button, Input, Modal, PageHeader, Pagination, Select, Table, Tabs, useToast } from '@/shared/ui';
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

export default function MastersPage() {
  const toast = useToast();
  const [path, setPath] = useState('cities');
  const [page, setPage] = useState(1);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState({});
  const edit = useEditMaster();
  const { data, isLoading } = useMasterList(path, { page, limit: 50 });
  const save = async (row, body, msg) => { try { await edit.mutateAsync({ path, id: row._id, body }); toast.success(msg); setEditing((x) => ({ ...x, [row._id]: undefined })); } catch (e) { toast.error(e.message); } };

  return (
    <>
      <PageHeader title="Masters" description="Lists used across the platform. Deactivated items disappear from forms but stay on existing listings." actions={<Button icon={Plus} onClick={() => setAdding(true)}>Add</Button>} />
      <Tabs className="mb-4" value={path} onChange={(v) => { setPath(v); setPage(1); }} tabs={MASTER_TYPES.map((t) => ({ value: t.path, label: t.label }))} />
      {path === 'localities' && <Requests />}
      <Table loading={isLoading} rows={(data && data.items) || []} empty="Nothing here yet."
        columns={[
          { key: 'name', header: 'Name', render: (r) => (editing[r._id] !== undefined
            ? <span className="flex gap-2"><input className="h-8 rounded border border-line-strong px-2 text-sm" value={editing[r._id]} onChange={(e) => setEditing((x) => ({ ...x, [r._id]: e.target.value }))} aria-label="Name" /><Button size="sm" onClick={() => save(r, { name: editing[r._id] }, 'Renamed')}>Save</Button></span>
            : <button type="button" className="text-left font-medium text-ink hover:text-brand-700" onClick={() => setEditing((x) => ({ ...x, [r._id]: r.name }))}>{r.name}</button>) },
          { key: 'code', header: 'Code', render: (r) => <code className="text-xs text-ink-subtle">{r.code}</code> },
          { key: 'meta', header: 'Details', render: (r) => <span className="text-xs text-ink-subtle">{[r.meta?.state, r.meta?.category, r.meta?.appliesTo && `for ${r.meta.appliesTo.join(', ')}`, r.meta?.required && 'required', r.meta?.centroid && `${r.meta.centroid.coordinates[1].toFixed(3)}, ${r.meta.centroid.coordinates[0].toFixed(3)}`].filter(Boolean).join(' · ')}</span> },
          { key: 'active', header: 'Status', render: (r) => <Badge tone={r.active ? 'success' : 'neutral'}>{r.active ? 'Active' : 'Inactive'}</Badge> },
          { key: 'act', header: '', render: (r) => <Button size="sm" variant="ghost" onClick={() => save(r, { active: !r.active }, r.active ? 'Deactivated' : 'Activated')}>{r.active ? 'Deactivate' : 'Activate'}</Button> },
        ]} />
      {data && <Pagination page={data.meta.page} pages={data.meta.pages} onChange={setPage} />}
      {adding && <AddDialog path={path} onClose={() => setAdding(false)} />}
    </>
  );
}
