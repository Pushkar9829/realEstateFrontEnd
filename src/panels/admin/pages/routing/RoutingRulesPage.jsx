// RE-S-ADM-14 routing rules (RE-C-05, RE-J-03, routing.manage): ordered rule
// list (drag or arrows to reorder), rule editor and the "where would this
// lead go?" simulator. The first active rule that matches wins.
import { useState } from 'react';
import { ArrowDown, ArrowUp, GripVertical, Pencil, Plus, Route, Trash2, Wand2 } from 'lucide-react';
import { Alert, Badge, Button, Card, CardHeader, Checkbox, EmptyState, Input, Modal, PageHeader, Select, Skeleton, useToast } from '@/shared/ui';
import { cn } from '@/shared/lib/cn';
import { titleCase } from '@/shared/lib/format';
import { useCities, useMasters } from '@/modules/listings/api';
import { LEAD_SOURCES } from '@/modules/leads/adminApi';
import {
  LISTER_TYPES, TEAM_MODES, modeLabel, useCreateRule, useDeleteRule, useEditRule, useReorderRules, useRoutingRules, useSimulateRouting, useTeams,
} from '@/modules/teams/api';

const CATEGORIES = ['residential', 'commercial', 'land'];
const list = (s) => String(s || '').split(',').map((x) => x.trim()).filter(Boolean);
const rupeesOrUndef = (s) => (s === '' || s == null ? undefined : Number(s));

const EMPTY = { name: '', active: true, teamId: '', modeOverride: '', cities: '', localities: '', purpose: '', category: '', types: '', budgetMin: '', budgetMax: '', sources: [], listerTypes: [] };

function toForm(r) {
  const c = r.conditions || {};
  return {
    name: r.name, active: r.active !== false, teamId: String((r.teamId && r.teamId._id) || r.teamId || ''), modeOverride: r.modeOverride || '',
    cities: (c.cities || []).join(', '), localities: (c.localities || []).join(', '), purpose: c.purpose || '', category: c.category || '', types: (c.types || []).join(', '),
    budgetMin: c.budgetMin ?? '', budgetMax: c.budgetMax ?? '', sources: c.sources || [], listerTypes: c.listerTypes || [],
  };
}

function toBody(f) {
  const conditions = {
    cities: list(f.cities), localities: list(f.localities), types: list(f.types), sources: f.sources, listerTypes: f.listerTypes,
    ...(f.purpose ? { purpose: f.purpose } : {}), ...(f.category ? { category: f.category } : {}),
    ...(rupeesOrUndef(f.budgetMin) !== undefined ? { budgetMin: rupeesOrUndef(f.budgetMin) } : {}),
    ...(rupeesOrUndef(f.budgetMax) !== undefined ? { budgetMax: rupeesOrUndef(f.budgetMax) } : {}),
  };
  return { name: f.name.trim(), active: f.active, teamId: f.teamId, conditions, ...(f.modeOverride ? { modeOverride: f.modeOverride } : {}) };
}

function summary(c = {}) {
  const parts = [];
  if ((c.cities || []).length) parts.push(`City ${c.cities.join(' / ')}`);
  if ((c.localities || []).length) parts.push(`Locality ${c.localities.join(' / ')}`);
  if (c.purpose) parts.push(titleCase(c.purpose));
  if (c.category) parts.push(titleCase(c.category));
  if ((c.types || []).length) parts.push(`Type ${c.types.join(' / ')}`);
  if (c.budgetMin != null || c.budgetMax != null) parts.push(`Budget ₹${c.budgetMin ?? 0} - ${c.budgetMax != null ? `₹${c.budgetMax}` : 'any'}`);
  if ((c.sources || []).length) parts.push(`Source ${c.sources.map(titleCase).join(' / ')}`);
  if ((c.listerTypes || []).length) parts.push(`Lister ${c.listerTypes.join(' / ')}`);
  return parts.length ? parts.join(' · ') : 'Every lead (no conditions)';
}

function MultiCheck({ label, values, options, onChange }) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium text-ink">{label}</legend>
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {options.map((o) => <Checkbox key={o} label={titleCase(o)} checked={values.includes(o)} onChange={(e) => onChange(e.target.checked ? [...values, o] : values.filter((x) => x !== o))} />)}
      </div>
    </fieldset>
  );
}

function RuleEditor({ open, rule, onClose, teams, types, cities }) {
  const toast = useToast();
  const create = useCreateRule();
  const edit = useEditRule();
  const [f, setF] = useState(() => (rule ? toForm(rule) : EMPTY));
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e && e.target ? (e.target.type === 'checkbox' ? e.target.checked : e.target.value) : e }));

  const save = async () => {
    setErrors({}); setFormError(null);
    if (f.name.trim().length < 2) { setErrors({ name: 'Give the rule a name' }); return; }
    if (!f.teamId) { setErrors({ teamId: 'Choose the target team' }); return; }
    try {
      if (rule) await edit.mutateAsync({ id: rule._id, body: toBody(f) }); else await create.mutateAsync(toBody(f));
      toast.success(rule ? 'Rule saved' : 'Rule added at the end of the list');
      onClose();
    } catch (e) { setErrors(e.fieldErrors || {}); setFormError(e.message); }
  };

  return (
    <Modal open={open} onClose={onClose} size="lg" title={rule ? `Edit rule "${rule.name}"` : 'New routing rule'} description="All conditions are optional and combined with AND. Leave a field empty to match anything."
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button loading={create.isPending || edit.isPending} onClick={save}>Save rule</Button></>}>
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Name" required maxLength={80} value={f.name} onChange={set('name')} error={errors.name} />
          <Select label="Target team" required placeholder="Choose a team" value={f.teamId} onChange={set('teamId')} error={errors.teamId} options={teams.map((t) => ({ value: t._id, label: t.name }))} />
          <Select label="Distribution" value={f.modeOverride} onChange={set('modeOverride')} options={[{ value: '', label: 'Inherit from the team' }, ...TEAM_MODES]} />
          <div className="flex items-end pb-2"><Checkbox label="Active" checked={f.active} onChange={set('active')} /></div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Cities" list="routing-cities" placeholder="e.g. Pune, Mumbai" hint="Comma separated" value={f.cities} onChange={set('cities')} />
          <Input label="Localities" placeholder="e.g. Baner, Wakad" hint="Comma separated" value={f.localities} onChange={set('localities')} />
          <Select label="Purpose" value={f.purpose} onChange={set('purpose')} options={[{ value: '', label: 'Any' }, { value: 'sale', label: 'Sale' }, { value: 'rent', label: 'Rent' }]} />
          <Select label="Category" value={f.category} onChange={set('category')} options={[{ value: '', label: 'Any' }, ...CATEGORIES.map((c) => ({ value: c, label: titleCase(c) }))]} />
          <MultiCheck label="Property types" values={list(f.types)} options={types.map((t) => ({ value: t.code, label: t.name }))} onChange={(v) => setF((x) => ({ ...x, types: v.join(', ') }))} />
          <div className="grid grid-cols-2 gap-2">
            <Input label="Budget from (₹)" type="number" min={0} value={f.budgetMin} onChange={set('budgetMin')} />
            <Input label="Budget to (₹)" type="number" min={0} value={f.budgetMax} onChange={set('budgetMax')} />
          </div>
        </div>
        <MultiCheck label="Sources" values={f.sources} options={LEAD_SOURCES} onChange={(v) => setF((x) => ({ ...x, sources: v }))} />
        <MultiCheck label="Lister types" values={f.listerTypes} options={LISTER_TYPES} onChange={(v) => setF((x) => ({ ...x, listerTypes: v }))} />
        <datalist id="routing-cities">{cities.map((c) => <option key={c._id} value={c.name} />)}</datalist>
        {formError && <Alert tone="danger">{formError}</Alert>}
      </div>
    </Modal>
  );
}

function Simulator({ types, cities }) {
  const sim = useSimulateRouting();
  const [f, setF] = useState({ city: '', locality: '', purpose: '', category: '', type: '', budget: '', source: '', listerType: '' });
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const run = (e) => {
    e.preventDefault();
    const body = Object.fromEntries(Object.entries(f).filter(([, v]) => v !== ''));
    if (body.budget !== undefined) body.budget = Number(body.budget);
    sim.mutate(body);
  };
  const r = sim.data;
  return (
    <Card>
      <CardHeader title="Where would this lead go?" description="Runs the rules without creating a lead." />
      <form onSubmit={run} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="City" list="sim-cities" value={f.city} onChange={set('city')} />
          <Input label="Locality" value={f.locality} onChange={set('locality')} />
          <Select label="Purpose" value={f.purpose} onChange={set('purpose')} options={[{ value: '', label: 'Any' }, { value: 'sale', label: 'Sale' }, { value: 'rent', label: 'Rent' }]} />
          <Select label="Category" value={f.category} onChange={set('category')} options={[{ value: '', label: 'Any' }, ...CATEGORIES.map((c) => ({ value: c, label: titleCase(c) }))]} />
          <Select label="Type" value={f.type} onChange={set('type')} options={[{ value: '', label: 'Any' }, ...types.map((t) => ({ value: t.code, label: t.name }))]} />
          <Input label="Budget (₹)" type="number" min={0} value={f.budget} onChange={set('budget')} />
          <Select label="Source" value={f.source} onChange={set('source')} options={[{ value: '', label: 'Any' }, ...LEAD_SOURCES.map((s) => ({ value: s, label: titleCase(s) }))]} />
          <Select label="Lister type" value={f.listerType} onChange={set('listerType')} options={[{ value: '', label: 'Any' }, ...LISTER_TYPES.map((s) => ({ value: s, label: titleCase(s) }))]} />
        </div>
        <datalist id="sim-cities">{cities.map((c) => <option key={c._id} value={c.name} />)}</datalist>
        <Button type="submit" icon={Wand2} loading={sim.isPending}>Simulate</Button>
      </form>
      {sim.error && <Alert tone="danger" className="mt-4">{sim.error.message}</Alert>}
      {r && (
        <div className="mt-4 space-y-3 border-t pt-4 text-sm">
          {!r.team ? <Alert tone="warning">{r.note || 'No team matched: the lead goes to the manager queue.'}</Alert> : (
            <>
              <p><span className="text-ink-subtle">Rule:</span> <span className="font-medium text-ink">{r.rule ? r.rule.name : '-'}</span>{r.rule?.priority != null && <span className="text-ink-subtle"> (priority {r.rule.priority})</span>}</p>
              <p><span className="text-ink-subtle">Team:</span> <span className="font-medium text-ink">{r.team.name}</span> · {modeLabel(r.team.mode)}</p>
              <div>
                <p className="mb-1 text-ink-subtle">Agents who can take it now ({r.agents.length}):</p>
                {r.agents.length === 0 ? <Alert tone="warning">Nobody is available (away, on leave, at capacity or outside working hours). The lead would wait in the unassigned queue.</Alert> : (
                  <ul className="space-y-1">{r.agents.map((a) => <li key={String(a.agentId)} className="flex justify-between gap-2"><span>{a.name || 'Agent'}</span><span className="text-ink-subtle">{a.openLeads} / {a.capacity} open</span></li>)}</ul>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </Card>
  );
}

export default function RoutingRulesPage() {
  const toast = useToast();
  const { data: rules, isLoading, error } = useRoutingRules();
  const teams = useTeams();
  const masters = useMasters();
  const citiesQ = useCities();
  const reorder = useReorderRules();
  const remove = useDeleteRule();
  const [editing, setEditing] = useState(null); // null | 'new' | rule
  const [deleting, setDeleting] = useState(null);
  const [dragId, setDragId] = useState(null);
  const types = (masters.data && masters.data.propertyTypes) || [];
  const cities = citiesQ.data || [];
  const items = rules || [];

  const move = async (ids) => { try { await reorder.mutateAsync(ids); } catch (e) { toast.error(e.message); } };
  const shift = (i, d) => { const ids = items.map((r) => r._id); const j = i + d; if (j < 0 || j >= ids.length) return; [ids[i], ids[j]] = [ids[j], ids[i]]; move(ids); };
  const drop = (targetId) => {
    if (!dragId || dragId === targetId) return;
    const ids = items.map((r) => r._id).filter((x) => x !== dragId);
    ids.splice(ids.indexOf(targetId), 0, dragId);
    setDragId(null);
    move(ids);
  };
  const doDelete = async () => { try { await remove.mutateAsync(deleting._id); toast.success('Rule deleted'); setDeleting(null); } catch (e) { toast.error(e.message); } };

  return (
    <>
      <PageHeader title="Routing rules" description="Rules run top to bottom; the first active match picks the team. With no match, leads go to the default team or the manager queue."
        actions={<Button icon={Plus} disabled={!(teams.data || []).length} onClick={() => setEditing('new')}>New rule</Button>} />
      {teams.data && !teams.data.length && <Alert tone="warning" className="mb-4">Create a team first; every rule targets a team.</Alert>}
      {error && <Alert tone="danger" className="mb-4">{error.message}</Alert>}

      <div className="grid gap-6 xl:grid-cols-5">
        <div className="xl:col-span-3">
          {isLoading ? <div className="space-y-2"><Skeleton className="h-16" /><Skeleton className="h-16" /></div>
            : items.length === 0 ? <EmptyState icon={Route} title="No routing rules" description="All leads go to the default team (set in Settings > Routing) or the manager queue." action={<Button icon={Plus} disabled={!(teams.data || []).length} onClick={() => setEditing('new')}>Add the first rule</Button>} />
              : (
                <ol className="space-y-2" aria-label="Routing rules in order">
                  {items.map((r, i) => (
                    <li key={r._id} draggable onDragStart={() => setDragId(r._id)} onDragOver={(e) => e.preventDefault()} onDrop={() => drop(r._id)} onDragEnd={() => setDragId(null)}
                      className={cn('flex items-start gap-3 rounded-lg border bg-white p-3 shadow-sm', dragId === r._id && 'opacity-50', r.active === false && 'bg-surface-muted')}>
                      <GripVertical className="mt-1 h-4 w-4 shrink-0 cursor-grab text-ink-subtle" aria-hidden />
                      <span className="mt-0.5 w-6 shrink-0 text-sm font-semibold text-ink-subtle">{i + 1}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-ink">{r.name} {r.active === false && <Badge>Inactive</Badge>}</p>
                        <p className="text-xs text-ink-muted">{summary(r.conditions)}</p>
                        <p className="mt-1 text-xs text-ink-subtle">→ {r.teamId?.name || 'Unknown team'}{r.modeOverride ? ` · ${modeLabel(r.modeOverride)}` : ''}</p>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button size="sm" variant="ghost" icon={ArrowUp} aria-label="Move up" disabled={i === 0 || reorder.isPending} onClick={() => shift(i, -1)} />
                        <Button size="sm" variant="ghost" icon={ArrowDown} aria-label="Move down" disabled={i === items.length - 1 || reorder.isPending} onClick={() => shift(i, 1)} />
                        <Button size="sm" variant="ghost" icon={Pencil} aria-label="Edit" onClick={() => setEditing(r)} />
                        <Button size="sm" variant="ghost" icon={Trash2} aria-label="Delete" onClick={() => setDeleting(r)} />
                      </div>
                    </li>
                  ))}
                </ol>
              )}
        </div>
        <div className="xl:col-span-2"><Simulator types={types} cities={cities} /></div>
      </div>

      {editing && <RuleEditor open rule={editing === 'new' ? null : editing} onClose={() => setEditing(null)} teams={teams.data || []} types={types} cities={cities} />}
      <Modal open={Boolean(deleting)} onClose={() => setDeleting(null)} title="Delete rule" size="sm"
        footer={<><Button variant="ghost" onClick={() => setDeleting(null)}>Cancel</Button><Button variant="danger" loading={remove.isPending} onClick={doDelete}>Delete</Button></>}>
        <p className="text-sm text-ink-muted">Delete "{deleting?.name}"? Leads it would have matched fall through to the next rule.</p>
      </Modal>
    </>
  );
}
