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

const DAYS = [[1, 'Monday'], [2, 'Tuesday'], [3, 'Wednesday'], [4, 'Thursday'], [5, 'Friday'], [6, 'Saturday'], [0, 'Sunday']];
const DAY_START = '08:00';
const DAY_END = '20:00';
const toMin = (s) => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
const toHHMM = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const TIMES = Array.from({ length: (toMin(DAY_END) - toMin(DAY_START)) / 30 + 1 }, (_, i) => toHHMM(toMin(DAY_START) + i * 30)).map((t) => ({ value: t, label: t }));
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
  const projects = useOwnProjects({ limit: 100 });
  const projectOptions = ((projects.data && projects.data.items) || []).map((p) => ({ value: `project:${p._id}`, label: `Project · ${p.name || p.projectNo}` }));
  return <ScopeSelect {...props} projectOptions={projectOptions} />;
}

function ScopeSelect({ value, onChange, projectOptions = [] }) {
  const listings = useListingOptions();
  const options = [{ value: 'account', label: 'All my listings (default)' }, ...projectOptions, ...listings.map((l) => ({ value: `property:${l.value}`, label: `Listing · ${l.label}` }))];
  return <Select className="sm:w-96" label="Calendar for" value={value} onChange={(e) => onChange(e.target.value)} options={options} hint="A listing or project calendar overrides the account default." />;
}

function WeeklyEditor({ weekly, setWeekly }) {
  const anySet = weekly.length > 0;
  const byDay = (d) => weekly.map((w, i) => ({ ...w, i })).filter((w) => w.day === d);
  const update = (i, patch) => setWeekly(weekly.map((w, j) => (j === i ? { ...w, ...patch } : w)));
  const remove = (i) => setWeekly(weekly.filter((_, j) => j !== i));
  const add = (day) => setWeekly([...weekly, { day, start: '10:00', end: '18:00' }]);
  const copyToAll = (day) => {
    const src = weekly.filter((w) => w.day === day);
    setWeekly(DAYS.flatMap(([d]) => src.map((w) => ({ ...w, day: d }))));
  };
  return (
    <ul className="divide-y">
      {DAYS.map(([d, label]) => {
        const ranges = byDay(d);
        return (
          <li key={d} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-start">
            <div className="w-28 shrink-0 pt-2 text-sm font-medium text-ink">{label}</div>
            <div className="flex-1 space-y-2">
              {ranges.length === 0 && <p className="pt-2 text-sm text-ink-subtle">{anySet ? 'Not available' : 'Any time (08:00-20:00)'}</p>}
              {ranges.map((w) => {
                const bad = toMin(w.start) >= toMin(w.end);
                return (
                  <div key={w.i} className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
                    <select aria-label={`${label} start`} className="h-9 rounded-md border border-line-strong bg-white px-2 text-sm" value={w.start} onChange={(e) => update(w.i, { start: e.target.value })}>
                      {TIMES.slice(0, -1).map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                    <span className="text-sm text-ink-subtle">to</span>
                    <select aria-label={`${label} end`} className="h-9 rounded-md border border-line-strong bg-white px-2 text-sm" value={w.end} onChange={(e) => update(w.i, { end: e.target.value })}>
                      {TIMES.slice(1).map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                    <Button size="sm" variant="ghost" icon={Trash2} aria-label="Remove range" onClick={() => remove(w.i)} />
                    {bad && <span className="text-xs text-danger-600">End must be after start</span>}
                  </div>
                );
              })}
            </div>
            <div className="flex shrink-0 gap-2">
              <Button size="sm" variant="secondary" icon={Plus} onClick={() => add(d)}>Add</Button>
              {ranges.length > 0 && <Button size="sm" variant="ghost" icon={Copy} title="Copy this day's ranges to every day" onClick={() => copyToAll(d)}>All days</Button>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function Blackouts({ availability, scopeParams }) {
  const toast = useToast();
  const add = useAddBlackout();
  const remove = useRemoveBlackout();
  const [form, setForm] = useState({ from: '', to: '', reason: '' });
  const [errors, setErrors] = useState({});
  const upcoming = (availability.blackouts || []).filter((b) => new Date(b.to) > new Date());

  const submit = async () => {
    setErrors({});
    if (!form.from || !form.to) { setErrors({ from: !form.from ? 'Pick a start date' : undefined, to: !form.to ? 'Pick an end date' : undefined }); return; }
    if (form.to < form.from) { setErrors({ to: 'The end date must be on or after the start date' }); return; }
    try {
      await add.mutateAsync({ ...scopeParams, from: `${form.from}T00:00:00+05:30`, to: `${addDays(form.to, 1)}T00:00:00+05:30`, ...(form.reason.trim() ? { reason: form.reason.trim() } : {}) });
      toast.success('Blackout added');
      setForm({ from: '', to: '', reason: '' });
    } catch (e) { setErrors(e.fieldErrors); toast.error(e.message); }
  };
  const drop = async (b) => {
    try { await remove.mutateAsync({ id: b._id }); toast.success('Blackout removed'); } catch (e) { toast.error(e.message); }
  };

  return (
    <Card>
      <CardHeader title="Blackout dates" description="No visits are booked on these days. The reason is visible to our staff only." />
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_2fr_auto] sm:items-end">
        <Input label="From" type="date" min={todayIst()} value={form.from} onChange={(e) => setForm((f) => ({ ...f, from: e.target.value }))} error={errors.from} />
        <Input label="To" type="date" min={form.from || todayIst()} max={addDays(todayIst(), 180)} value={form.to} onChange={(e) => setForm((f) => ({ ...f, to: e.target.value }))} error={errors.to} />
        <Input label="Reason (optional)" maxLength={100} value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} error={errors.reason} />
        <Button icon={Plus} loading={add.isPending} onClick={submit}>Add</Button>
      </div>
      {upcoming.length === 0 ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-ink-subtle"><CalendarOff className="h-4 w-4" aria-hidden />No blackout dates.</p>
      ) : (
        <ul className="mt-4 divide-y rounded-md border">
          {upcoming.map((b) => (
            <li key={b._id || `${b.from}-${b.to}`} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <span className="flex items-center gap-2"><CalendarX2 className="h-4 w-4 text-danger-600" aria-hidden />
                <span className="text-ink">{date(b.from)} to {date(new Date(new Date(b.to).getTime() - 1))}</span>
                {b.reason && <span className="text-ink-subtle">· {b.reason}</span>}
              </span>
              <Button size="sm" variant="ghost" icon={Trash2} disabled={!b._id} loading={remove.isPending && remove.variables && remove.variables.id === b._id} onClick={() => drop(b)}>Remove</Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export default function AvailabilityPage() {
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
    if (weekly.some((w) => toMin(w.start) >= toMin(w.end))) { setError('Each range must end after it starts'); return; }
    const n = Number(notice);
    if (!Number.isInteger(n) || n < 2 || n > 48) { setError('Minimum notice must be 2 to 48 hours'); return; }
    try {
      await save.mutateAsync({ ...scopeParams, weekly, noticeHours: n, ...(note.trim() ? { note: note.trim() } : {}) });
      const hit = next14.filter((v) => outsideWeekly(v.scheduledAt, weekly));
      setConflicts(hit);
      toast.success('Availability saved');
    } catch (e) { setError(e.fieldErrors.weekly || e.fieldErrors.noticeHours || e.message); }
  };

  return (
    <>
      <PageHeader title="Visit availability" description="Choose when our agents may bring buyers for site visits. Visits are booked in 30-minute slots between 08:00 and 20:00."
        actions={<Button icon={Save} loading={save.isPending} disabled={isLoading || isError} onClick={onSave}>Save availability</Button>} />
      <div className="mb-6">{user.listerType === 'builder' ? <BuilderScopeSelect value={scopeKey} onChange={setScopeKey} /> : <ScopeSelect value={scopeKey} onChange={setScopeKey} />}</div>

      {isError && <Alert tone="danger" title="Could not load your availability" action={<Button size="sm" variant="secondary" onClick={() => refetch()}>Retry</Button>} />}
      {isLoading && <Skeleton className="h-96" />}
      {av && (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {!av._id && <Alert tone="info" title="Not set yet">Visits can be booked any day 08:00-20:00 until you set your availability.</Alert>}
            {error && <Alert tone="danger">{error}</Alert>}
            {conflicts.length > 0 && (
              <Alert tone="warning" title={`${conflicts.length} booked visit${conflicts.length > 1 ? 's are' : ' is'} now outside your slots`}>
                <ul className="mt-1 list-disc pl-4">{conflicts.map((v) => <li key={v.id}>{dateTime(v.scheduledAt)} · {v.buyer} · {v.property && v.property.listingNo}</li>)}</ul>
                <p className="mt-1">Existing visits are not cancelled. Your agent will contact you to confirm or reschedule.</p>
              </Alert>
            )}
            <Card>
              <CardHeader title="Weekly slots" description="Add one or more ranges per day. Leave every day empty to allow visits any time." />
              <WeeklyEditor weekly={weekly} setWeekly={setWeekly} />
            </Card>
            <Card>
              <CardHeader title="Notice and note" />
              <div className="grid gap-4 sm:grid-cols-[12rem_1fr]">
                <Input label="Minimum notice (hours)" type="number" min={2} max={48} value={notice} onChange={(e) => setNotice(e.target.value)} hint="2 to 48 hours" />
                <Textarea label="Note for agents (optional)" rows={2} maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} hint="e.g. Bring ID at the gate" />
              </div>
            </Card>
            <Blackouts availability={av} scopeParams={scopeParams} />
          </div>
          <Card>
            <CardHeader title="Next 14 days" description="Visits already booked on your listings." />
            {visits.isLoading ? <Skeleton className="h-32" /> : next14.length === 0 ? (
              <EmptyState className="border-0 py-6" title="No visits booked" />
            ) : (
              <ul className="space-y-3">
                {next14.map((v) => {
                  const off = outsideWeekly(v.scheduledAt, weekly);
                  return (
                    <li key={v.id} className="rounded-md border p-3 text-sm">
                      <p className="font-medium text-ink">{dateTime(v.scheduledAt)}</p>
                      <p className="text-ink-subtle">{v.buyer} · {v.property && v.property.listingNo}</p>
                      {off && <Badge className="mt-1" tone="warning" icon={TriangleAlert}>Outside the slots above</Badge>}
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
