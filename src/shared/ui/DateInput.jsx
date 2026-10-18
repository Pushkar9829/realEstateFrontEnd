// Indian date entry (dd/mm/yyyy) for every date field. The browser's native
// picker follows the browser locale (often mm/dd/yyyy), so the visible field
// is a text input in dd/mm/yyyy; the calendar button opens the native picker
// as a shortcut. The value in and out stays ISO (yyyy-mm-dd), and onChange
// receives an event-like { target: { value, name, type: 'date' } }.
// <Input type="date" value=… /> renders this automatically.
import { forwardRef, useEffect, useRef, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { useT } from '@/shared/i18n';

export const isoToDmy = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
};
export const dmyToIso = (dmy) => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dmy || '');
  if (!m) return null;
  const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
};
// Typing helper: keeps digits and inserts the slashes (2/2/4).
export const maskDmy = (raw) => {
  const d = String(raw || '').replace(/\D/g, '').slice(0, 8);
  return [d.slice(0, 2), d.slice(2, 4), d.slice(4)].filter(Boolean).join('/');
};

const DateInput = forwardRef(function DateInput({ value, onChange, name, min, max, className, disabled, required, type: _type, ...rest }, ref) {
  const t = useT();
  const [text, setText] = useState(isoToDmy(value));
  const native = useRef(null);
  useEffect(() => { setText((cur) => (dmyToIso(cur) === (value || null) || (!value && !cur) ? cur : isoToDmy(value))); }, [value]);
  const emit = (iso) => onChange && onChange({ target: { value: iso, name, type: 'date' } });
  const typed = (e) => {
    const next = maskDmy(e.target.value);
    setText(next);
    if (!next) emit('');
    else { const iso = dmyToIso(next); if (iso) emit(iso); }
  };
  const open = () => {
    const n = native.current;
    if (!n) return;
    try { if (n.showPicker) n.showPicker(); else n.click(); } catch { n.click(); }
  };
  return (
    <div className="relative">
      <input ref={ref} type="text" inputMode="numeric" autoComplete="off" placeholder="dd/mm/yyyy" pattern="\d{2}/\d{2}/\d{4}" title={t('common.dateFormat')}
        value={text} onChange={typed} disabled={disabled} required={required} name={name} className={cn(className, 'pr-9')} {...rest} />
      <button type="button" onClick={open} disabled={disabled} className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-ink-subtle hover:text-ink disabled:opacity-40" aria-label={t('common.openCalendar')} tabIndex={-1}>
        <CalendarDays className="h-4 w-4" aria-hidden />
      </button>
      <input ref={native} type="date" tabIndex={-1} aria-hidden className="pointer-events-none absolute bottom-0 right-0 h-0 w-0 opacity-0" value={value || ''} min={min} max={max}
        onChange={(e) => { setText(isoToDmy(e.target.value)); emit(e.target.value); }} />
    </div>
  );
});

export default DateInput;
