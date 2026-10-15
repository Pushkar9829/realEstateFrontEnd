// Small building blocks shared by the agent screens: SLA countdown, status
// badges, error state, lead picker, reason modal and IST time helpers.
import { useEffect, useState } from 'react';
import { AlarmClock, CheckCircle2, RefreshCw, Search, X } from 'lucide-react';
import { Alert, Badge, Button, Input, Modal, Textarea } from '@/shared/ui';
import { cn } from '@/shared/lib/cn';
import { firstName, priorityInfo, stageInfo, useAgentLeads } from '@/modules/leads/agentApi';

// ---------------------------------------------------------------- time

const IST = 330 * 60000;
export const istKey = (d) => new Date(new Date(d).getTime() + IST).toISOString().slice(0, 10);
const tf = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' });
const df = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short' });
export const timeOnly = (d) => (d ? tf.format(new Date(d)) : '-');
export const dayLabel = (d) => (d ? df.format(new Date(d)) : '-');
// Midnight IST of the day containing d, as a Date.
export const istMidnight = (d = new Date()) => new Date(Date.parse(`${istKey(d)}T00:00:00+05:30`));

// Value for <input type="datetime-local"> in the browser's local time.
export function toLocalInput(d) {
  if (!d) return '';
  const x = new Date(d);
  const pad = (n) => String(n).padStart(2, '0');
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}T${pad(x.getHours())}:${pad(x.getMinutes())}`;
}
export const fromLocalInput = (s) => (s ? new Date(s).toISOString() : undefined);

export function humanDuration(ms) {
  const m = Math.max(0, Math.round(Math.abs(ms) / 60000));
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  const days = Math.floor(h / 24);
  return `${days}d ${h % 24}h`;
}

export function useNow(intervalMs = 30000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

// ---------------------------------------------------------------- badges

export function StageBadge({ stage }) {
  const s = stageInfo(stage);
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

export function PriorityBadge({ priority }) {
  const p = priorityInfo(priority);
  return <Badge tone={p.tone}>{p.label}</Badge>;
}

export function StatusBadge({ map, status }) {
  const s = (map && map[status]) || { label: status, tone: 'neutral' };
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

// First-contact SLA: counts down while the lead is new and uncontacted.
export function SlaTimer({ lead, compact }) {
  const now = useNow(compact ? 30000 : 1000);
  if (!lead) return null;
  if (lead.firstContactAt) {
    const met = !lead.slaDueAt || new Date(lead.firstContactAt) <= new Date(lead.slaDueAt);
    return <Badge tone={met ? 'success' : 'warning'} icon={CheckCircle2}>{met ? 'SLA met' : 'Contacted late'}</Badge>;
  }
  if (!lead.slaDueAt) return <span className="text-xs text-ink-subtle">-</span>;
  const left = new Date(lead.slaDueAt).getTime() - now;
  if (left <= 0 || lead.slaBreachedAt) return <Badge tone="danger" icon={AlarmClock}>Breached {humanDuration(left)} ago</Badge>;
  return <Badge tone={left < 30 * 60000 ? 'warning' : 'info'} icon={AlarmClock}>{humanDuration(left)} left</Badge>;
}

// ---------------------------------------------------------------- states

export function ErrorState({ error, onRetry, title = 'Could not load this' }) {
  return (
    <Alert tone="danger" title={title} action={onRetry && <Button size="sm" variant="secondary" icon={RefreshCw} onClick={onRetry}>Retry</Button>}>
      {error ? error.message : 'Something went wrong.'}
    </Alert>
  );
}

// ---------------------------------------------------------------- lead picker

// Search own open leads by lead no., name or phone; value is { _id, leadNo, buyerName }.
export function LeadPicker({ value, onChange, label = 'Lead', error, required }) {
  const [q, setQ] = useState('');
  const term = q.trim();
  const { data, isFetching } = useAgentLeads({ q: term, limit: 8, sort: 'recent' }, { enabled: !value && term.length >= 2 });
  if (value) {
    return (
      <div className="space-y-1.5">
        <span className="block text-sm font-medium text-ink">{label}{required && <span className="text-danger-600"> *</span>}</span>
        <div className="flex items-center justify-between gap-2 rounded-md border border-line-strong bg-surface-muted px-3 py-2 text-sm">
          <span><span className="font-medium text-ink">{value.leadNo}</span> <span className="text-ink-subtle">· {value.buyerName}</span></span>
          <button type="button" className="text-ink-subtle hover:text-ink" onClick={() => onChange(null)} aria-label="Change lead"><X className="h-4 w-4" /></button>
        </div>
      </div>
    );
  }
  const rows = (data && data.items) || [];
  return (
    <div>
      <Input label={label} required={required} error={error} leading={<Search className="h-4 w-4" />} placeholder="Lead no., buyer name or phone" value={q} onChange={(e) => setQ(e.target.value)} />
      {term.length >= 2 && (
        <ul className="mt-1 max-h-56 overflow-y-auto rounded-md border bg-white text-sm shadow-sm">
          {isFetching && !rows.length && <li className="px-3 py-2 text-ink-subtle">Searching…</li>}
          {!isFetching && !rows.length && <li className="px-3 py-2 text-ink-subtle">No open lead matches</li>}
          {rows.map((r) => (
            <li key={r._id}>
              <button type="button" className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-surface-muted"
                onClick={() => { onChange({ _id: r._id, leadNo: r.leadNo, buyerName: r.buyerName, propertyId: r.propertyId, stage: r.stage }); setQ(''); }}>
                <span><span className="font-medium text-ink">{r.leadNo}</span> · {firstName(r.buyerName)}<span className="block text-xs text-ink-subtle">{r.property ? r.property.title : 'No property'}</span></span>
                <StageBadge stage={r.stage} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- reason modal

export function ReasonModal({ open, onClose, title, description, label = 'Reason', min = 3, max = 500, confirmLabel = 'Confirm', danger, loading, onSubmit, error }) {
  const [text, setText] = useState('');
  useEffect(() => { if (open) setText(''); }, [open]);
  const ok = text.trim().length >= min;
  return (
    <Modal open={open} onClose={onClose} title={title} description={description} size="sm"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant={danger ? 'danger' : 'primary'} loading={loading} disabled={!ok} onClick={() => onSubmit(text.trim())}>{confirmLabel}</Button></>}>
      <Textarea label={label} rows={3} maxLength={max} value={text} onChange={(e) => setText(e.target.value)} error={error}
        hint={`${text.trim().length}/${max}${min > 1 ? ` · at least ${min} characters` : ''}`} />
    </Modal>
  );
}

// Card section with a title row and an optional action.
export function Section({ title, action, children, className }) {
  return (
    <section className={cn('rounded-lg border bg-white p-4 shadow-sm sm:p-5', className)}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-ink">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
