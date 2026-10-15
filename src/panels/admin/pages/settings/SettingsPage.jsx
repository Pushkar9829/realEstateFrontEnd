// RE-S-ADM-27 platform settings (settings.manage): keys grouped by prefix,
// edited by value type (boolean, number, text, list, JSON), the permission
// each key needs, and an unsaved-changes guard. PATCH sends changed keys only.
import { useEffect, useMemo, useState } from 'react';
import { useBlocker } from 'react-router-dom';
import { RotateCcw, Save, Search } from 'lucide-react';
import { Alert, Badge, Button, Card, CardHeader, Input, Modal, PageHeader, PageSpinner, Textarea, useToast } from '@/shared/ui';
import { cn } from '@/shared/lib/cn';
import { useAuth } from '@/modules/auth';
import { groupOf, useSettings, useUpdateSettings } from '@/modules/settings/api';

const typeOf = (v) => (Array.isArray(v) ? 'list' : v === null ? 'text' : typeof v === 'object' ? 'json' : typeof v);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Draft strings -> typed value; returns [value, error].
function parse(type, raw, original) {
  if (type === 'boolean') return [Boolean(raw), null];
  if (type === 'number') { const n = Number(raw); return raw === '' || Number.isNaN(n) ? [original, 'Enter a number'] : [n, null]; }
  if (type === 'list') {
    const parts = String(raw).split(',').map((s) => s.trim()).filter(Boolean);
    const numeric = Array.isArray(original) && original.length && original.every((x) => typeof x === 'number');
    if (numeric) { const nums = parts.map(Number); return nums.some(Number.isNaN) ? [original, 'Numbers separated by commas'] : [nums, null]; }
    return [parts, null];
  }
  if (type === 'json') { try { return [JSON.parse(raw), null]; } catch { return [original, 'Invalid JSON']; } }
  return [String(raw), null];
}
const toRaw = (type, v) => (type === 'boolean' ? Boolean(v) : type === 'list' ? (v || []).join(', ') : type === 'json' ? JSON.stringify(v, null, 2) : v == null ? '' : String(v));

function SettingRow({ s, raw, error, onChange, canEdit, changed }) {
  const type = typeOf(s.value);
  return (
    <div className={cn('grid gap-2 py-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:gap-6', changed && 'bg-warning-50/40')}>
      <div className="min-w-0">
        <p className="break-all font-mono text-xs text-ink">{s.key}{changed && <Badge tone="warning" className="ml-2">Changed</Badge>}</p>
        {s.description && <p className="mt-0.5 text-sm text-ink-muted">{s.description}</p>}
        <p className="mt-0.5 text-xs text-ink-subtle">Needs <code>{s.edit || 'settings.manage'}</code>{s.default !== undefined && !same(s.default, s.value) ? <> · default <code>{JSON.stringify(s.default)}</code></> : ''}</p>
      </div>
      <div>
        {type === 'boolean' ? (
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4 rounded border-line-strong text-brand-600" checked={Boolean(raw)} disabled={!canEdit} onChange={(e) => onChange(e.target.checked)} />
            {raw ? 'On' : 'Off'}
          </label>
        ) : type === 'json' ? (
          <Textarea aria-label={s.key} rows={4} value={raw} disabled={!canEdit} error={error} onChange={(e) => onChange(e.target.value)} className="font-mono" />
        ) : (
          <Input aria-label={s.key} type={type === 'number' ? 'number' : 'text'} step="any" value={raw} disabled={!canEdit} error={error} hint={type === 'list' ? 'Comma separated' : undefined} onChange={(e) => onChange(e.target.value)} />
        )}
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
    return [k, s ? parse(typeOf(s.value), raw, s.value) : [raw, null]];
  })), [drafts, settings]);
  const changes = Object.fromEntries(Object.entries(parsed).filter(([k, [v, err]]) => !err && !same(v, (settings.find((x) => x.key === k) || {}).value)));
  const hasErrors = Object.values(parsed).some(([, err]) => err);
  const dirty = Object.keys(changes).length > 0;

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
    settings.filter((s) => !term || s.key.toLowerCase().includes(term) || String(s.description || '').toLowerCase().includes(term))
      .forEach((s) => { (out[groupOf(s.key)] = out[groupOf(s.key)] || []).push(s); });
    return Object.entries(out).sort(([a], [b]) => a.localeCompare(b));
  }, [settings, q]);

  const save = async () => {
    try {
      await update.mutateAsync(changes);
      toast.success(`${Object.keys(changes).length} setting${Object.keys(changes).length > 1 ? 's' : ''} saved`);
      setDrafts({});
    } catch (e) { toast.error(Object.values(e.fieldErrors).join(' · ') || e.message); }
  };

  if (isLoading) return <PageSpinner />;
  const missing = error && (error.code === 'ROUTE_NOT_FOUND' || error.code === 'NOT_IMPLEMENTED' || error.status === 501);

  return (
    <>
      <PageHeader title="Settings" description="Platform configuration. Each change is audited with before and after values. Changing commission minimums does not alter existing agreements."
        actions={<>
          {dirty && <Button variant="ghost" icon={RotateCcw} onClick={() => setDrafts({})}>Discard</Button>}
          <Button icon={Save} disabled={!dirty || hasErrors} loading={update.isPending} onClick={save}>Save{dirty ? ` (${Object.keys(changes).length})` : ''}</Button>
        </>} />
      {missing && <Alert tone="warning" className="mb-4" title="Settings API not available">The backend does not expose GET / PATCH /api/admin/settings yet, so settings cannot be loaded or saved from this screen.</Alert>}
      {error && !missing && <Alert tone="danger" className="mb-4">{error.message}</Alert>}
      {!error && (
        <>
          <div className="mb-4 max-w-sm">
            <Input aria-label="Search settings" placeholder="Search key or description" leading={<Search className="h-4 w-4" />} value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="space-y-6">
            {groups.map(([g, rows]) => (
              <Card key={g}>
                <CardHeader title={g} description={`${rows.length} setting${rows.length > 1 ? 's' : ''}`} />
                <div className="divide-y">
                  {rows.map((s) => {
                    const type = typeOf(s.value);
                    const raw = s.key in drafts ? drafts[s.key] : toRaw(type, s.value);
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
      <Modal open={blocker.state === 'blocked'} onClose={() => blocker.reset && blocker.reset()} title="Discard unsaved changes?" description={`${Object.keys(changes).length} setting(s) have not been saved.`}
        footer={<><Button variant="secondary" onClick={() => blocker.reset && blocker.reset()}>Stay</Button><Button variant="danger" onClick={() => blocker.proceed && blocker.proceed()}>Leave without saving</Button></>}>
        <p className="text-sm text-ink-muted">Leaving this page drops the edits.</p>
      </Modal>
    </>
  );
}
