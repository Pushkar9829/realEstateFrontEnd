// Small building blocks shared by the agent screens: SLA countdown, status
// badges, error state, lead picker, reason modal and IST time helpers.
import { useEffect, useState } from 'react';
import { AlarmClock, CheckCircle2, RefreshCw, Search, X } from 'lucide-react';
import { Alert, Badge, Button, Input, Modal, Textarea } from '@/shared/ui';
import { cn } from '@/shared/lib/cn';
import { date, time, titleCase } from '@/shared/lib/format';
import { firstName, priorityInfo, stageInfo, useAgentLeads } from '@/modules/leads/agentApi';
import { t as tt, useT } from '@/shared/i18n';

// ---------------------------------------------------------------- time

const IST = 330 * 60000;
export const istKey = (d) => new Date(new Date(d).getTime() + IST).toISOString().slice(0, 10);
export const timeOnly = (d) => time(d);
// Short weekday name in IST (agent.common.weekdays, Sunday first).
const weekday = (d) => { const names = tt('agent.common.weekdays'); return Array.isArray(names) ? names[new Date(new Date(d).getTime() + IST).getUTCDay()] : ''; };
// "Fri, 17/10/2026"
export const dayLabel = (d) => (d ? `${weekday(d)}, ${date(d)}` : '-');
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
  if (m < 60) return tt('agent.common.durM', { m });
  const h = Math.floor(m / 60);
  if (h < 24) return tt('agent.common.durHM', { h, m: m % 60 });
  const days = Math.floor(h / 24);
  return tt('agent.common.durDH', { d: days, h: h % 24 });
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

// Label of an API enum value (agent.enum.<group>.<value>), else the value in title case.
export const enumLabel = (group, v) => { const k = `agent.enum.${group}.${v}`; const x = tt(k); return x === k ? titleCase(v || '') : x; };
export const listingStatus = (s) => enumLabel('listingStatus', s);

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
  const t = useT();
  if (!lead) return null;
  if (lead.firstContactAt) {
    const met = !lead.slaDueAt || new Date(lead.firstContactAt) <= new Date(lead.slaDueAt);
    return <Badge tone={met ? 'success' : 'warning'} icon={CheckCircle2}>{met ? t('agent.sla.met') : t('agent.sla.late')}</Badge>;
  }
  if (!lead.slaDueAt) return <span className="text-xs text-ink-subtle">-</span>;
  const left = new Date(lead.slaDueAt).getTime() - now;
  if (left <= 0 || lead.slaBreachedAt) return <Badge tone="danger" icon={AlarmClock}>{t('agent.sla.breached', { time: humanDuration(left) })}</Badge>;
  return <Badge tone={left < 30 * 60000 ? 'warning' : 'info'} icon={AlarmClock}>{t('agent.sla.left', { time: humanDuration(left) })}</Badge>;
}

// ---------------------------------------------------------------- states

export function ErrorState({ error, onRetry, title }) {
  const t = useT();
  return (
    <Alert tone="danger" title={title || t('agent.common.loadError')} action={onRetry && <Button size="sm" variant="secondary" icon={RefreshCw} onClick={onRetry}>{t('common.retry')}</Button>}>
      {error ? error.message : t('agent.common.somethingWrong')}
    </Alert>
  );
}

// ---------------------------------------------------------------- lead picker

// Search own open leads by lead no., name or phone; value is { _id, leadNo, buyerName }.
export function LeadPicker({ value, onChange, label: labelProp, error, required }) {
  const t = useT();
  const label = labelProp || t('agent.common.lead');
  const [q, setQ] = useState('');
  const term = q.trim();
  const { data, isFetching } = useAgentLeads({ q: term, limit: 8, sort: 'recent' }, { enabled: !value && term.length >= 2 });
  if (value) {
    return (
      <div className="space-y-1.5">
        <span className="block text-sm font-medium text-ink">{label}{required && <span className="text-danger-600"> *</span>}</span>
        <div className="flex items-center justify-between gap-2 rounded-md border border-line-strong bg-surface-muted px-3 py-2 text-sm">
          <span><span className="font-medium text-ink">{value.leadNo}</span> <span className="text-ink-subtle">· {value.buyerName}</span></span>
          <button type="button" className="text-ink-subtle hover:text-ink" onClick={() => onChange(null)} aria-label={t('agent.picker.change')}><X className="h-4 w-4" /></button>
        </div>
      </div>
    );
  }
  const rows = (data && data.items) || [];
  return (
    <div>
      <Input label={label} required={required} error={error} leading={<Search className="h-4 w-4" />} placeholder={t('agent.picker.placeholder')} value={q} onChange={(e) => setQ(e.target.value)} />
      {term.length >= 2 && (
        <ul className="mt-1 max-h-56 overflow-y-auto rounded-md border bg-white text-sm shadow-sm">
          {isFetching && !rows.length && <li className="px-3 py-2 text-ink-subtle">{t('agent.picker.searching')}</li>}
          {!isFetching && !rows.length && <li className="px-3 py-2 text-ink-subtle">{t('agent.picker.noMatch')}</li>}
          {rows.map((r) => (
            <li key={r._id}>
              <button type="button" className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-surface-muted"
                onClick={() => { onChange({ _id: r._id, leadNo: r.leadNo, buyerName: r.buyerName, propertyId: r.propertyId, stage: r.stage }); setQ(''); }}>
                <span><span className="font-medium text-ink">{r.leadNo}</span> · {firstName(r.buyerName)}<span className="block text-xs text-ink-subtle">{r.property ? r.property.title : t('agent.common.noProperty')}</span></span>
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

export function ReasonModal({ open, onClose, title, description, label, min = 3, max = 500, confirmLabel, danger, loading, onSubmit, error }) {
  const t = useT();
  const [text, setText] = useState('');
  useEffect(() => { if (open) setText(''); }, [open]);
  const ok = text.trim().length >= min;
  return (
    <Modal open={open} onClose={onClose} title={title} description={description} size="sm"
      footer={<><Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button><Button variant={danger ? 'danger' : 'primary'} loading={loading} disabled={!ok} onClick={() => onSubmit(text.trim())}>{confirmLabel || t('common.confirm')}</Button></>}>
      <Textarea label={label || t('agent.common.reason')} rows={3} maxLength={max} value={text} onChange={(e) => setText(e.target.value)} error={error}
        hint={`${text.trim().length}/${max}${min > 1 ? ` · ${t('agent.common.atLeastChars', { n: min })}` : ''}`} />
    </Modal>
  );
}

// Card section with a title row and an optional action.
export function Section({ title, action, children, className }) {
  return (
    <section className={cn('min-w-0 rounded-lg border bg-white p-4 shadow-sm sm:p-5', className)}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="min-w-0 text-base font-semibold text-ink">{title}</h2>
        {action && <div className="flex max-w-full flex-wrap gap-2">{action}</div>}
      </div>
      {children}
    </section>
  );
}
