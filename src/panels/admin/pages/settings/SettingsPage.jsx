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
import { useT } from '@/shared/i18n';
import { groupIdOf, groupLabel, useSettings, useUpdateSettings } from '@/modules/settings/api';
import { ENUMS, LIST_OPTIONS, ORDERED, kindOf, labelOf, unitOf } from '@/modules/settings/meta';

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Draft -> typed value; returns [value, error].
function parse(kind, raw, original, t) {
  if (kind === 'boolean') return [Boolean(raw), null];
  if (kind === 'number') { const n = Number(raw); return raw === '' || Number.isNaN(n) ? [original, t('admin.settings.errors.number')] : [n, null]; }
  if (kind === 'list') {
    const numeric = Array.isArray(original) && original.length > 0 && original.every((x) => typeof x === 'number');
    if (numeric) { const nums = raw.map(Number); return nums.some(Number.isNaN) ? [original, t('admin.settings.errors.numbersOnly')] : [nums, null]; }
    return [raw, null];
  }
  if (kind === 'pick') return [raw, null];
  if (kind === 'json') { try { return [JSON.parse(raw), null]; } catch { return [original, t('admin.settings.errors.json')]; } }
  return [String(raw), null];
}
const toRaw = (kind, v) => {
  if (kind === 'boolean') return Boolean(v);
  if (kind === 'list' || kind === 'pick') return (v || []).map((x) => (kind === 'list' ? String(x) : x));
  if (kind === 'json') return JSON.stringify(v, null, 2);
  return v == null ? '' : String(v);
};
const show = (t, kind, s, v) => {
  if (kind === 'boolean') return v ? t('admin.settings.on') : t('admin.settings.off');
  if (kind === 'enum') { const o = (ENUMS[s.key] || []).find(([x]) => x === v); return o ? o[1] : String(v); }
  if (Array.isArray(v)) return v.length ? v.join(', ') : t('admin.settings.none');
  return v === '' || v == null ? t('admin.settings.empty') : typeof v === 'object' ? JSON.stringify(v) : `${v}${unitOf(s.key) ? ` ${unitOf(s.key)}` : ''}`;
};

function Switch({ checked, onChange, disabled, label }) {
  const t = useT();
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)}
      className={cn('inline-flex items-center gap-2 rounded-full text-sm font-medium disabled:opacity-50')}>
      <span className={cn('relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors', checked ? 'bg-brand-600' : 'bg-line-strong')}>
        <span className={cn('inline-block h-5 w-5 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-5' : 'translate-x-0.5')} />
      </span>
      <span className={checked ? 'text-ink' : 'text-ink-muted'}>{checked ? t('admin.settings.on') : t('admin.settings.off')}</span>
    </button>
  );
}

// Free list (chips + add box); `ordered` adds move up / down.
function ListEditor({ value, onChange, disabled, label, ordered, numeric, options }) {
  const t = useT();
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
                  {ordered && <button type="button" className="rounded p-1 text-ink-subtle hover:bg-white hover:text-ink disabled:opacity-30" disabled={i === 0} onClick={() => move(i, -1)} aria-label={t('admin.settings.list.moveUp', { name: labelFor(v) })}><ArrowUp className="h-3.5 w-3.5" aria-hidden /></button>}
                  {ordered && <button type="button" className="rounded p-1 text-ink-subtle hover:bg-white hover:text-ink disabled:opacity-30" disabled={i === value.length - 1} onClick={() => move(i, 1)} aria-label={t('admin.settings.list.moveDown', { name: labelFor(v) })}><ArrowDown className="h-3.5 w-3.5" aria-hidden /></button>}
                  <button type="button" className="rounded p-1 text-ink-subtle hover:bg-white hover:text-danger-700" onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label={t('admin.settings.list.remove', { name: labelFor(v) })}><X className="h-3.5 w-3.5" aria-hidden /></button>
                </span>
              )}
            </li>
          ))}
        </ol>
      ) : <p className="text-sm text-ink-subtle">{t('admin.settings.list.none')}</p>}
      {!disabled && (options ? (left.length > 0 && (
        <Select aria-label={t('admin.settings.list.addTo', { name: label })} placeholder={t('admin.settings.list.addPlaceholder')} value="" onChange={(e) => e.target.value && onChange([...value, e.target.value])} options={left.map(([v, l]) => ({ value: v, label: l }))} />
      )) : (
        <div className="flex gap-2">
          <Input className="flex-1" aria-label={t('admin.settings.list.addTo', { name: label })} placeholder={numeric ? t('admin.settings.list.addNumber') : t('admin.settings.list.addValue')} inputMode={numeric ? 'numeric' : undefined} value={add}
            onChange={(e) => setAdd(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); push(); } }} />
          <Button variant="secondary" icon={Plus} onClick={push} disabled={!add.trim()}>{t('admin.settings.list.add')}</Button>
        </div>
      ))}
    </div>
  );
}

function SettingRow({ s, raw, error, onChange, canEdit, changed }) {
  const t = useT();
  const kind = kindOf(s);
  const label = labelOf(s);
  const unit = unitOf(s.key, s.description);
  const numericList = Array.isArray(s.value) && s.value.length > 0 && s.value.every((x) => typeof x === 'number');
  return (
    <div className={cn('grid gap-2 py-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:gap-6', changed && '-mx-5 bg-warning-50/50 px-5')}>
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">
          {label}
          {changed && <Badge tone="warning" className="ml-2">{t('admin.settings.unsaved')}</Badge>}
          {!canEdit && <Badge tone="neutral" icon={Lock} className="ml-2">{t('admin.settings.needs', { perm: s.edit })}</Badge>}
        </p>
        <p className="mt-0.5 text-xs text-ink-subtle">
          <span className="font-mono" title={t('admin.settings.keyTitle')}>{s.key}</span>
          {s.default !== undefined && !same(s.default, s.value) ? <> · {t('admin.settings.defaultValue', { value: show(t, kind, s, s.default) })}</> : ''}
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
  const t = useT();
  const toast = useToast();
  const { hasPermission } = useAuth();
  const { data, isLoading, error } = useSettings();
  const update = useUpdateSettings();
  const [drafts, setDrafts] = useState({});
  const [q, setQ] = useState('');
  const settings = useMemo(() => data || [], [data]);

  const parsed = useMemo(() => Object.fromEntries(Object.entries(drafts).map(([k, raw]) => {
    const s = settings.find((x) => x.key === k);
    return [k, s ? parse(kindOf(s), raw, s.value, t) : [raw, null]];
  })), [drafts, settings, t]);
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

  // Grouped by the stable group id; sorted and searched by the shown
  // (translated) name, so this is worked out on every render.
  const groups = (() => {
    const term = q.trim().toLowerCase();
    const out = {};
    settings.filter((s) => !term || s.key.toLowerCase().includes(term) || labelOf(s).toLowerCase().includes(term) || groupLabel(groupIdOf(s.key)).toLowerCase().includes(term))
      .forEach((s) => { const id = groupIdOf(s.key); (out[id] = out[id] || []).push(s); });
    return Object.entries(out).map(([id, rows]) => [id, groupLabel(id), rows]).sort(([, a], [, b]) => a.localeCompare(b));
  })();

  const save = async () => {
    try {
      await update.mutateAsync(changes);
      toast.success(t('admin.settings.savedToast', { count }));
      setDrafts({});
    } catch (e) { toast.error(Object.values(e.fieldErrors).join(' · ') || e.message); }
  };

  if (isLoading) return <PageSpinner />;
  const missing = error && (error.code === 'ROUTE_NOT_FOUND' || error.code === 'NOT_IMPLEMENTED' || error.status === 501);

  return (
    <>
      <PageHeader title={t('admin.settings.title')} description={t('admin.settings.description')} />
      {missing && <Alert tone="warning" className="mb-4" title={t('admin.settings.missingTitle')}>{t('admin.settings.missingText')}</Alert>}
      {error && !missing && <Alert tone="danger" className="mb-4">{error.message}</Alert>}
      {!error && (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <Input className="w-full max-w-sm" aria-label={t('admin.settings.search')} placeholder={t('admin.settings.searchPlaceholder')} leading={<Search className="h-4 w-4" />} value={q} onChange={(e) => setQ(e.target.value)} />
            <nav aria-label={t('admin.settings.areas')} className="flex flex-wrap gap-1.5">
              {groups.map(([id, name]) => <a key={id} href={`#set-${id}`} className="rounded-full border bg-white px-2.5 py-1 text-xs text-ink-muted hover:border-brand-300 hover:text-ink">{name}</a>)}
            </nav>
          </div>
          <div className={cn('space-y-6', dirty && 'pb-24')}>
            {groups.map(([id, name, rows]) => (
              <Card key={id} id={`set-${id}`} className="scroll-mt-20">
                <CardHeader title={name} description={t('admin.settings.count', { count: rows.length })} />
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
            {!groups.length && <p className="text-sm text-ink-subtle">{t('admin.settings.noMatch')}</p>}
          </div>
        </>
      )}
      {(dirty || hasErrors) && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-white/95 px-4 py-3 shadow-lg backdrop-blur lg:left-64" role="region" aria-label={t('admin.settings.unsavedRegion')}>
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-ink">{hasErrors ? t('admin.settings.fixFields') : t('admin.settings.unsavedCount', { count })}</p>
            <div className="flex gap-2">
              <Button variant="ghost" icon={RotateCcw} onClick={() => setDrafts({})}>{t('admin.settings.discard')}</Button>
              <Button icon={Save} disabled={!dirty || hasErrors} loading={update.isPending} onClick={save}>{t('common.save')} {count > 0 ? `(${count})` : ''}</Button>
            </div>
          </div>
        </div>
      )}
      <Modal open={blocker.state === 'blocked'} onClose={() => blocker.reset && blocker.reset()} title={t('admin.settings.leave.title')} description={t('admin.settings.leave.description', { n: count })}
        footer={<><Button variant="secondary" onClick={() => blocker.reset && blocker.reset()}>{t('admin.settings.leave.stay')}</Button><Button variant="danger" onClick={() => blocker.proceed && blocker.proceed()}>{t('admin.settings.leave.leave')}</Button></>}>
        <p className="text-sm text-ink-muted">{t('admin.settings.leave.text')}</p>
      </Modal>
    </>
  );
}
