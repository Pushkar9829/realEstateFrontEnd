// RE-S-LIS-17 visit availability: weekly visit ranges, minimum notice and
// blackout dates for the whole account, one listing or one builder project.
// Agents can only book site visits inside these slots.
import { useEffect, useMemo, useState } from 'react';
import { CalendarOff, CalendarX2, Copy, Plus, Save, Trash2, TriangleAlert } from 'lucide-react';
import { Alert, Badge, Button, Card, CardHeader, EmptyState, Input, PageHeader, Select, Skeleton, Textarea, useToast } from '@/shared/ui';
import { date, dateTime } from '@/shared/lib/format';
import { useAuth } from '@/modules/auth';
import { useAddBlackout, useAvailability, useListerVisits, useRemoveBlackout, useSaveWeekly } from '@/modules/leads/listerApi';
import { useOwnProjects } from '@/modules/projects/api';
import { useListingOptions } from '../../components/ListingPicker';
import { useT } from '@/shared/i18n';
import { buyerText } from '@/panels/lister/components/buyerLabel';

// Day names: lister.availability.days.<0-6> (Sunday = 0).
const DAYS = [1, 2, 3, 4, 5, 6, 0];
const DAY_START = '08:00';
const DAY_END = '20:00';
const toMin = (s) => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
const toHHMM = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const TIMES = Array.from({ length: (toMin(DAY_END) - toMin(DAY_START)) / 30 + 1 }, (_, i) => toHHMM(toMin(DAY_START) + i * 30)).map((v) => ({ value: v, label: v }));
const IST = 330 * 60000;
const todayIst = () => new Date(Date.now() + IST).toISOString().slice(0, 10);
const addDays = (d, n) => new Date(new Date(`${d}T00:00:00Z`).getTime() + n * 86400000).toISOString().slice(0, 10);

// Would a visit at `at` fall outside the weekly ranges? (no ranges = any time)
function outsideWeekly(at, weekly) {
  if (!weekly.length) return false;
  const local = new Date(new Date(at).getTime() + IST);
  const day = local.getUTCDay();
  const min = local.getUTCHours() * 60 + local.getUTCMinutes();
  return !weekly.some((w) => w.day === day && min >= toMin(w.start) && min + 30 <= toMin(w.end));
}

// Builders also get one calendar per project (projects are builder-only).
function BuilderScopeSelect(props) {
  const t = useT();
  const projects = useOwnProjects({ limit: 100 });
  const projectOptions = ((projects.data && projects.data.items) || []).map((p) => ({ value: `project:${p._id}`, label: t('lister.availability.projectOpt', { name: p.name || p.projectNo }) }));
  return <ScopeSelect {...props} projectOptions={projectOptions} />;
}

function ScopeSelect({ value, onChange, projectOptions = [] }) {
  const t = useT();
  const listings = useListingOptions();
  const options = [{ value: 'account', label: t('lister.availability.allListings') }, ...projectOptions, ...listings.map((l) => ({ value: `property:${l.value}`, label: t('lister.availability.listingOpt', { name: l.label }) }))];
  return <Select className="sm:w-96" label={t('lister.availability.calendarFor')} value={value} onChange={(e) => onChange(e.target.value)} options={options} hint={t('lister.availability.calendarHint')} />;
}

function WeeklyEditor({ weekly, setWeekly }) {
  const t = useT();
  const anySet = weekly.length > 0;
  const byDay = (d) => weekly.map((w, i) => ({ ...w, i })).filter((w) => w.day === d);
  const update = (i, patch) => setWeekly(weekly.map((w, j) => (j === i ? { ...w, ...patch } : w)));
  const remove = (i) => setWeekly(weekly.filter((_, j) => j !== i));
  const add = (day) => setWeekly([...weekly, { day, start: '10:00', end: '18:00' }]);
  const copyToAll = (day) => {
    const src = weekly.filter((w) => w.day === day);
    setWeekly(DAYS.flatMap((d) => src.map((w) => ({ ...w, day: d }))));
  };
  return (
    <ul className="divide-y">
      {DAYS.map((d) => {
        const label = t(`lister.availability.days.${d}`);
        const ranges = byDay(d);
        return (
          <li key={d} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-start">
            <div className="w-28 shrink-0 pt-2 text-sm font-medium text-ink">{label}</div>
            <div className="flex-1 space-y-2">
              {ranges.length === 0 && <p className="pt-2 text-sm text-ink-subtle">{anySet ? t('lister.availability.notAvailable') : t('lister.availability.anyTime')}</p>}
              {ranges.map((w) => {
                const bad = toMin(w.start) >= toMin(w.end);
                return (
                  <div key={w.i} className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
                    <select aria-label={t('lister.availability.start', { day: label })} className="h-9 rounded-md border border-line-strong bg-white px-2 text-sm" value={w.start} onChange={(e) => update(w.i, { start: e.target.value })}>
                      {TIMES.slice(0, -1).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    <span className="text-sm text-ink-subtle">{t('lister.availability.to')}</span>
                    <select aria-label={t('lister.availability.end', { day: label })} className="h-9 rounded-md border border-line-strong bg-white px-2 text-sm" value={w.end} onChange={(e) => update(w.i, { end: e.target.value })}>
                      {TIMES.slice(1).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    <Button size="sm" variant="ghost" icon={Trash2} aria-label={t('lister.availability.removeRange')} onClick={() => remove(w.i)} />
                    {bad && <span className="text-xs text-danger-600">{t('lister.availability.endAfterStart')}</span>}
                  </div>
                );
              })}
            </div>
            <div className="flex shrink-0 gap-2">
              <Button size="sm" variant="secondary" icon={Plus} onClick={() => add(d)}>{t('lister.availability.add')}</Button>
              {ranges.length > 0 && <Button size="sm" variant="ghost" icon={Copy} title={t('lister.availability.copyAll')} onClick={() => copyToAll(d)}>{t('lister.availability.allDays')}</Button>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function Blackouts({ availability, scopeParams }) {
  const t = useT();
  const toast = useToast();
  const add = useAddBlackout();
  const remove = useRemoveBlackout();
  const [form, setForm] = useState({ from: '', to: '', reason: '' });
  const [errors, setErrors] = useState({});
  const upcoming = (availability.blackouts || []).filter((b) => new Date(b.to) > new Date());

  const submit = async () => {
    setErrors({});
    if (!form.from || !form.to) { setErrors({ from: !form.from ? t('lister.availability.pickStart') : undefined, to: !form.to ? t('lister.availability.pickEnd') : undefined }); return; }
    if (form.to < form.from) { setErrors({ to: t('lister.availability.endOnOrAfter') }); return; }
    try {
      await add.mutateAsync({ ...scopeParams, from: `${form.from}T00:00:00+05:30`, to: `${addDays(form.to, 1)}T00:00:00+05:30`, ...(form.reason.trim() ? { reason: form.reason.trim() } : {}) });
      toast.success(t('lister.availability.blackoutAdded'));
      setForm({ from: '', to: '', reason: '' });
    } catch (e) { setErrors(e.fieldErrors); toast.error(e.message); }
  };
  const drop = async (b) => {
    try { await remove.mutateAsync({ id: b._id }); toast.success(t('lister.availability.blackoutRemoved')); } catch (e) { toast.error(e.message); }
  };

  return (
    <Card>
      <CardHeader title={t('lister.availability.blackouts')} description={t('lister.availability.blackoutsDesc')} />
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_2fr_auto] sm:items-end">
        <Input label={t('lister.stats.from')} type="date" min={todayIst()} value={form.from} onChange={(e) => setForm((f) => ({ ...f, from: e.target.value }))} error={errors.from} />
        <Input label={t('lister.stats.to')} type="date" min={form.from || todayIst()} max={addDays(todayIst(), 180)} value={form.to} onChange={(e) => setForm((f) => ({ ...f, to: e.target.value }))} error={errors.to} />
        <Input label={t('lister.availability.reasonOptional')} maxLength={100} value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} error={errors.reason} />
        <Button icon={Plus} loading={add.isPending} onClick={submit}>{t('lister.availability.add')}</Button>
      </div>
      {upcoming.length === 0 ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-ink-subtle"><CalendarOff className="h-4 w-4" aria-hidden />{t('lister.availability.noBlackouts')}</p>
      ) : (
        <ul className="mt-4 divide-y rounded-md border">
          {upcoming.map((b) => (
            <li key={b._id || `${b.from}-${b.to}`} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <span className="flex items-center gap-2"><CalendarX2 className="h-4 w-4 text-danger-600" aria-hidden />
                <span className="text-ink">{t('lister.availability.range', { from: date(b.from), to: date(new Date(new Date(b.to).getTime() - 1)) })}</span>
                {b.reason && <span className="text-ink-subtle">· {b.reason}</span>}
              </span>
              <Button size="sm" variant="ghost" icon={Trash2} disabled={!b._id} loading={remove.isPending && remove.variables && remove.variables.id === b._id} onClick={() => drop(b)}>{t('lister.availability.remove')}</Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export default function AvailabilityPage() {
  const t = useT();
  const toast = useToast();
  const { user } = useAuth();
  const [scopeKey, setScopeKey] = useState('account');
  const scopeParams = useMemo(() => {
    const [scope, scopeId] = scopeKey.split(':');
    return scopeId ? { scope, scopeId } : { scope };
  }, [scopeKey]);
  const { data, isLoading, isError, refetch } = useAvailability(scopeParams);
  const visits = useListerVisits({ upcoming: 'true' });
  const save = useSaveWeekly();
  const [weekly, setWeekly] = useState([]);
  const [notice, setNotice] = useState(2);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [conflicts, setConflicts] = useState([]);
  const av = data && data.availability;

  useEffect(() => {
    if (!av) return;
    setWeekly((av.weekly || []).map(({ day, start, end }) => ({ day, start, end })));
    setNotice(av.noticeHours || 2);
    setNote(av.note || '');
    setConflicts([]);
    setError('');
  }, [av]);

  const horizon = Date.now() + 14 * 86400000;
  const next14 = ((visits.data && visits.data.items) || []).filter((v) => new Date(v.scheduledAt).getTime() < horizon).sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));

  const onSave = async () => {
    setError('');
    if (weekly.some((w) => toMin(w.start) >= toMin(w.end))) { setError(t('lister.availability.errRange')); return; }
    const n = Number(notice);
    if (!Number.isInteger(n) || n < 2 || n > 48) { setError(t('lister.availability.errNotice')); return; }
    try {
      await save.mutateAsync({ ...scopeParams, weekly, noticeHours: n, ...(note.trim() ? { note: note.trim() } : {}) });
      const hit = next14.filter((v) => outsideWeekly(v.scheduledAt, weekly));
      setConflicts(hit);
      toast.success(t('lister.availability.saved'));
    } catch (e) { setError(e.fieldErrors.weekly || e.fieldErrors.noticeHours || e.message); }
  };

  return (
    <>
      <PageHeader title={t('panel.nav.listerAvailability')} description={t('lister.availability.desc')}
        actions={<Button icon={Save} loading={save.isPending} disabled={isLoading || isError} onClick={onSave}>{t('lister.availability.save')}</Button>} />
      <div className="mb-6">{user.listerType === 'builder' ? <BuilderScopeSelect value={scopeKey} onChange={setScopeKey} /> : <ScopeSelect value={scopeKey} onChange={setScopeKey} />}</div>

      {isError && <Alert tone="danger" title={t('lister.availability.loadError')} action={<Button size="sm" variant="secondary" onClick={() => refetch()}>{t('common.retry')}</Button>} />}
      {isLoading && <Skeleton className="h-96" />}
      {av && (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {!av._id && <Alert tone="info" title={t('lister.availability.notSet')}>{t('lister.availability.notSetText')}</Alert>}
            {error && <Alert tone="danger">{error}</Alert>}
            {conflicts.length > 0 && (
              <Alert tone="warning" title={t('lister.availability.conflicts', { count: conflicts.length })}>
                <ul className="mt-1 list-disc pl-4">{conflicts.map((v) => <li key={v.id}>{dateTime(v.scheduledAt)} · {buyerText(t, v.buyer)} · {v.property && v.property.listingNo}</li>)}</ul>
                <p className="mt-1">{t('lister.availability.conflictsText')}</p>
              </Alert>
            )}
            <Card>
              <CardHeader title={t('lister.availability.weekly')} description={t('lister.availability.weeklyDesc')} />
              <WeeklyEditor weekly={weekly} setWeekly={setWeekly} />
            </Card>
            <Card>
              <CardHeader title={t('lister.availability.noticeNote')} />
              <div className="grid gap-4 sm:grid-cols-[12rem_1fr]">
                <Input label={t('lister.availability.notice')} type="number" min={2} max={48} value={notice} onChange={(e) => setNotice(e.target.value)} hint={t('lister.availability.noticeHint')} />
                <Textarea label={t('lister.availability.note')} rows={2} maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} hint={t('lister.availability.noteHint')} />
              </div>
            </Card>
            <Blackouts availability={av} scopeParams={scopeParams} />
          </div>
          <Card>
            <CardHeader title={t('lister.availability.next14')} description={t('lister.availability.next14Desc')} />
            {visits.isLoading ? <Skeleton className="h-32" /> : next14.length === 0 ? (
              <EmptyState className="border-0 py-6" title={t('lister.availability.noVisits')} />
            ) : (
              <ul className="space-y-3">
                {next14.map((v) => {
                  const off = outsideWeekly(v.scheduledAt, weekly);
                  return (
                    <li key={v.id} className="rounded-md border p-3 text-sm">
                      <p className="font-medium text-ink">{dateTime(v.scheduledAt)}</p>
                      <p className="text-ink-subtle">{buyerText(t, v.buyer)} · {v.property && v.property.listingNo}</p>
                      {off && <Badge className="mt-1" tone="warning" icon={TriangleAlert}>{t('lister.availability.outside')}</Badge>}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      )}
    </>
  );
}
