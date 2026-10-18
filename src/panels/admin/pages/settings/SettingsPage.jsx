// RE-S-ADM-27 platform settings (settings.manage): grouped by area, each with
// a readable label (the raw key only as a small hint), a typed control (switch,
// number with unit, choice list, ordered list, chips, JSON), the default when
// changed, and a sticky "unsaved changes" bar with Save / Discard. PATCH sends
// changed keys only; every change is audited by the API.
import { useEffect, useMemo, useState } from 'react';
import { useBlocker } from 'react-router-dom';
import { ArrowDown, ArrowUp, Lock, Plus, RotateCcw, Save, Search, X } from 'lucide-react';
import { Alert, Badge, Button, Card, CardHeader, Input, Modal, PageHeader, PageSpinner, Select, Textarea, useToast } from '@/shared/ui';
import { cn } from '@/shared/lib/cn';
import { useAuth } from '@/modules/auth';
import { groupOf, useSettings, useUpdateSettings } from '@/modules/settings/api';
import { ENUMS, LIST_OPTIONS, ORDERED, kindOf, labelOf, unitOf } from '@/modules/settings/meta';

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Draft -> typed value; returns [value, error].
function parse(kind, raw, original) {
  if (kind === 'boolean') return [Boolean(raw), null];
  if (kind === 'number') { const n = Number(raw); return raw === '' || Number.isNaN(n) ? [original, 'Enter a number'] : [n, null]; }
  if (kind === 'list') {
    const numeric = Array.isArray(original) && original.length > 0 && original.every((x) => typeof x === 'number');
    if (numeric) { const nums = raw.map(Number); return nums.some(Number.isNaN) ? [original, 'Numbers only'] : [nums, null]; }
    return [raw, null];
  }
  if (kind === 'pick') return [raw, null];
  if (kind === 'json') { try { return [JSON.parse(raw), null]; } catch { return [original, 'Invalid JSON']; } }
  return [String(raw), null];
}
const toRaw = (kind, v) => {
  if (kind === 'boolean') return Boolean(v);
  if (kind === 'list' || kind === 'pick') return (v || []).map((x) => (kind === 'list' ? String(x) : x));
  if (kind === 'json') return JSON.stringify(v, null, 2);
  return v == null ? '' : String(v);
};
const show = (kind, s, v) => {
  if (kind === 'boolean') return v ? 'On' : 'Off';
  if (kind === 'enum') { const o = (ENUMS[s.key] || []).find(([x]) => x === v); return o ? o[1] : String(v); }
  if (Array.isArray(v)) return v.length ? v.join(', ') : 'none';
  return v === '' || v == null ? 'empty' : typeof v === 'object' ? JSON.stringify(v) : `${v}${unitOf(s.key) ? ` ${unitOf(s.key)}` : ''}`;
};

function Switch({ checked, onChange, disabled, label }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)}
      className={cn('inline-flex items-center gap-2 rounded-full text-sm font-medium disabled:opacity-50')}>
      <span className={cn('relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors', checked ? 'bg-brand-600' : 'bg-line-strong')}>
        <span className={cn('inline-block h-5 w-5 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-5' : 'translate-x-0.5')} />
      </span>
      <span className={checked ? 'text-ink' : 'text-ink-muted'}>{checked ? 'On' : 'Off'}</span>
    </button>
  );
}

// Free list (chips + add box); `ordered` adds move up / down.
function ListEditor({ value, onChange, disabled, label, ordered, numeric, options }) {
  const [add, setAdd] = useState('');
  const move = (i, d) => { const next = [...value]; const [x] = next.splice(i, 1); next.splice(i + d, 0, x); onChange(next); };
  const labelFor = (v) => { const o = options && options.find(([x]) => x === v); return o ? o[1] : v; };
  const left = options ? options.filter(([x]) => !value.includes(x)) : [];
  const push = () => { const v = add.trim(); if (v && !value.includes(v)) onChange([...value, v]); setAdd(''); };
  return (
    <div className="space-y-2">
      {value.length ? (
        <ol className={cn(ordered ? 'space-y-1' : 'flex flex-wrap gap-1.5')} aria-label={label}>
          {value.map((v, i) => (
            <li key={`${v}-${i}`} className={cn('inline-flex items-center gap-1 rounded-md border bg-surface-muted text-sm text-ink', ordered ? 'flex w-full justify-between px-2 py-1' : 'px-2 py-0.5')}>
              <span className="min-w-0 truncate">{ordered && <span className="mr-2 text-xs text-ink-subtle">{i + 1}.</span>}{labelFor(v)}</span>
              {!disabled && (
                <span className="flex shrink-0 items-center">
                  {ordered && <button type="button" className="rounded p-1 text-ink-subtle hover:bg-white hover:text-ink disabled:opacity-30" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move ${labelFor(v)} up`}><ArrowUp className="h-3.5 w-3.5" aria-hidden /></button>}
                  {ordered && <button type="button" className="rounded p-1 text-ink-subtle hover:bg-white hover:text-ink disabled:opacity-30" disabled={i === value.length - 1} onClick={() => move(i, 1)} aria-label={`Move ${labelFor(v)} down`}><ArrowDown className="h-3.5 w-3.5" aria-hidden /></button>}
                  <button type="button" className="rounded p-1 text-ink-subtle hover:bg-white hover:text-danger-700" onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label={`Remove ${labelFor(v)}`}><X className="h-3.5 w-3.5" aria-hidden /></button>
                </span>
              )}
            </li>
          ))}
        </ol>
      ) : <p className="text-sm text-ink-subtle">None</p>}
      {!disabled && (options ? (left.length > 0 && (
        <Select aria-label={`Add to ${label}`} placeholder="Add…" value="" onChange={(e) => e.target.value && onChange([...value, e.target.value])} options={left.map(([v, l]) => ({ value: v, label: l }))} />
      )) : (
        <div className="flex gap-2">
          <Input className="flex-1" aria-label={`Add to ${label}`} placeholder={numeric ? 'Add a number' : 'Add a value'} inputMode={numeric ? 'numeric' : undefined} value={add}
            onChange={(e) => setAdd(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); push(); } }} />
          <Button variant="secondary" icon={Plus} onClick={push} disabled={!add.trim()}>Add</Button>
        </div>
      ))}
    </div>
  );
}

function SettingRow({ s, raw, error, onChange, canEdit, changed }) {
  const kind = kindOf(s);
  const label = labelOf(s);
  const unit = unitOf(s.key, s.description);
  const numericList = Array.isArray(s.value) && s.value.length > 0 && s.value.every((x) => typeof x === 'number');
  return (
    <div className={cn('grid gap-2 py-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:gap-6', changed && '-mx-5 bg-warning-50/50 px-5')}>
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">
          {label}
          {changed && <Badge tone="warning" className="ml-2">Unsaved</Badge>}
          {!canEdit && <Badge tone="neutral" icon={Lock} className="ml-2">Needs {s.edit}</Badge>}
        </p>
        <p className="mt-0.5 text-xs text-ink-subtle">
          <span className="font-mono" title="Setting key (used by the API and the audit log)">{s.key}</span>
          {s.default !== undefined && !same(s.default, s.value) ? <> · default: {show(kind, s, s.default)}</> : ''}
        </p>
      </div>
      <div className="min-w-0">
        {kind === 'boolean' ? <Switch checked={Boolean(raw)} disabled={!canEdit} label={label} onChange={onChange} />
          : kind === 'enum' ? <Select aria-label={label} value={raw} disabled={!canEdit} onChange={(e) => onChange(e.target.value)} options={ENUMS[s.key].map(([value, l]) => ({ value, label: l }))} />
            : kind === 'pick' ? <ListEditor value={raw} disabled={!canEdit} label={label} ordered={ORDERED.has(s.key)} options={LIST_OPTIONS[s.key]} onChange={onChange} />
              : kind === 'list' ? <ListEditor value={raw} disabled={!canEdit} label={label} numeric={numericList} ordered={ORDERED.has(s.key)} onChange={onChange} />
                : kind === 'json' ? <Textarea aria-label={label} rows={4} value={raw} disabled={!canEdit} error={error} hint="JSON" onChange={(e) => onChange(e.target.value)} className="font-mono" />
                  : kind === 'number' ? (
                    <div className="flex items-start gap-2">
                      {unit === '₹' && <span className="mt-2.5 text-sm text-ink-muted">₹</span>}
                      <Input className="w-40" aria-label={label} type="number" step="any" inputMode="decimal" value={raw} disabled={!canEdit} error={error} onChange={(e) => onChange(e.target.value)} />
                      {unit && unit !== '₹' && <span className="mt-2.5 text-sm text-ink-muted">{unit}</span>}
                    </div>
                  ) : <Input aria-label={label} value={raw} disabled={!canEdit} error={error} onChange={(e) => onChange(e.target.value)} />}
        {error && kind === 'list' && <p className="mt-1 text-xs text-danger-600">{error}</p>}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const toast = useToast();
  const { hasPermission } = useAuth();
  const { data, isLoading, error } = useSettings();
  const update = useUpdateSettings();
  const [drafts, setDrafts] = useState({});
  const [q, setQ] = useState('');
  const settings = useMemo(() => data || [], [data]);

  const parsed = useMemo(() => Object.fromEntries(Object.entries(drafts).map(([k, raw]) => {
    const s = settings.find((x) => x.key === k);
    return [k, s ? parse(kindOf(s), raw, s.value) : [raw, null]];
  })), [drafts, settings]);
  const changes = Object.fromEntries(Object.entries(parsed).filter(([k, [v, err]]) => !err && !same(v, (settings.find((x) => x.key === k) || {}).value)));
  const hasErrors = Object.values(parsed).some(([, err]) => err);
  const count = Object.keys(changes).length;
  const dirty = count > 0;

  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && currentLocation.pathname !== nextLocation.pathname);
  useEffect(() => {
    if (!dirty) return undefined;
    const h = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  const groups = useMemo(() => {
    const term = q.trim().toLowerCase();
    const out = {};
    settings.filter((s) => !term || s.key.toLowerCase().includes(term) || labelOf(s).toLowerCase().includes(term) || groupOf(s.key).toLowerCase().includes(term))
      .forEach((s) => { (out[groupOf(s.key)] = out[groupOf(s.key)] || []).push(s); });
    return Object.entries(out).sort(([a], [b]) => a.localeCompare(b));
  }, [settings, q]);

  const save = async () => {
    try {
      await update.mutateAsync(changes);
      toast.success(`${count} setting${count > 1 ? 's' : ''} saved`);
      setDrafts({});
    } catch (e) { toast.error(Object.values(e.fieldErrors).join(' · ') || e.message); }
  };

  if (isLoading) return <PageSpinner />;
  const missing = error && (error.code === 'ROUTE_NOT_FOUND' || error.code === 'NOT_IMPLEMENTED' || error.status === 501);

  return (
    <>
      <PageHeader title="Settings" description="Platform configuration. Each change is audited with before and after values. Changing commission minimums does not alter existing agreements." />
      {missing && <Alert tone="warning" className="mb-4" title="Settings API not available">The backend does not expose GET / PATCH /api/admin/settings yet, so settings cannot be loaded or saved from this screen.</Alert>}
      {error && !missing && <Alert tone="danger" className="mb-4">{error.message}</Alert>}
      {!error && (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <Input className="w-full max-w-sm" aria-label="Search settings" placeholder="Search by name, area or key" leading={<Search className="h-4 w-4" />} value={q} onChange={(e) => setQ(e.target.value)} />
            <nav aria-label="Setting areas" className="flex flex-wrap gap-1.5">
              {groups.map(([g]) => <a key={g} href={`#set-${g.replace(/\W+/g, '-')}`} className="rounded-full border bg-white px-2.5 py-1 text-xs text-ink-muted hover:border-brand-300 hover:text-ink">{g}</a>)}
            </nav>
          </div>
          <div className={cn('space-y-6', dirty && 'pb-24')}>
            {groups.map(([g, rows]) => (
              <Card key={g} id={`set-${g.replace(/\W+/g, '-')}`} className="scroll-mt-20">
                <CardHeader title={g} description={`${rows.length} setting${rows.length > 1 ? 's' : ''}`} />
                <div className="divide-y">
                  {rows.map((s) => {
                    const kind = kindOf(s);
                    const raw = s.key in drafts ? drafts[s.key] : toRaw(kind, s.value);
                    return <SettingRow key={s.key} s={s} raw={raw} error={parsed[s.key] && parsed[s.key][1]} changed={s.key in changes}
                      canEdit={hasPermission(s.edit || 'settings.manage')} onChange={(v) => setDrafts((d) => ({ ...d, [s.key]: v }))} />;
                  })}
                </div>
              </Card>
            ))}
            {!groups.length && <p className="text-sm text-ink-subtle">No settings match.</p>}
          </div>
        </>
      )}
      {(dirty || hasErrors) && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-white/95 px-4 py-3 shadow-lg backdrop-blur lg:left-64" role="region" aria-label="Unsaved changes">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-ink">{hasErrors ? 'Fix the highlighted fields to save.' : `${count} unsaved change${count > 1 ? 's' : ''}`}</p>
            <div className="flex gap-2">
              <Button variant="ghost" icon={RotateCcw} onClick={() => setDrafts({})}>Discard</Button>
              <Button icon={Save} disabled={!dirty || hasErrors} loading={update.isPending} onClick={save}>Save {count > 0 ? `(${count})` : ''}</Button>
            </div>
          </div>
        </div>
      )}
      <Modal open={blocker.state === 'blocked'} onClose={() => blocker.reset && blocker.reset()} title="Discard unsaved changes?" description={`${count} setting(s) have not been saved.`}
        footer={<><Button variant="secondary" onClick={() => blocker.reset && blocker.reset()}>Stay</Button><Button variant="danger" onClick={() => blocker.proceed && blocker.proceed()}>Leave without saving</Button></>}>
        <p className="text-sm text-ink-muted">Leaving this page drops the edits.</p>
      </Modal>
    </>
  );
}
