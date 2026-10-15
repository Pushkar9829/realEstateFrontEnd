// Locality / keyword box with autocomplete (RE-E-15, min 2 chars, 300 ms) and
// the sentence parser (RE-E-19): "2 BHK under 60 lakh in Baner" becomes
// filter chips the user confirms before searching.
import { useId, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Landmark, Loader2, MapPin, Search, Sparkles, X } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { describeFilters, parseSentence, useAutocomplete } from '@/modules/search/api';

const KIND_ICON = { city: Building2, locality: MapPin, project: Building2, landmark: Landmark };
const KIND_LABEL = { city: 'City', locality: 'Locality', project: 'Project', landmark: 'Landmark' };
const looksLikeSentence = (t) => t.trim().split(/\s+/).length >= 3 && /\d|bhk|lakh|crore|cr\b|under|near|rent|buy|furnished|ready/i.test(t);

/**
 * onSearch(patch): patch is a partial filter object ({ q } | { city, localities } | parsed filters).
 */
export default function SearchBox({ city, initial = '', onSearch, placeholder = 'Locality, project, landmark or "2 BHK under 60 lakh in Baner"', className, inputClassName, autoFocus }) {
  const navigate = useNavigate();
  const listId = useId();
  const [text, setText] = useState(initial);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [parsed, setParsed] = useState(null);
  const [parsing, setParsing] = useState(false);
  const ac = useAutocomplete(open ? text : '', city);
  const items = (open && ac.data) || [];

  const pick = (s) => {
    setOpen(false); setActive(-1);
    if (s.kind === 'project') { navigate(`/projects/${s.value}`); return; }
    if (s.kind === 'city') { setText(s.label); onSearch({ city: s.value, localities: undefined, q: undefined }); return; }
    if (s.kind === 'locality') { setText(s.label); onSearch({ localities: s.value, q: undefined }); return; }
    setText(s.label); onSearch({ q: s.value });
  };

  const submit = async (e) => {
    e.preventDefault();
    if (open && active >= 0 && items[active]) { pick(items[active]); return; }
    setOpen(false);
    const t = text.trim();
    if (t && looksLikeSentence(t)) {
      setParsing(true);
      try {
        const r = await parseSentence(t, city);
        if (r && r.filters && Object.keys(r.filters).length > 1) { setParsed(r); return; }
      } catch { /* fall back to a keyword search */ } finally { setParsing(false); }
    }
    onSearch({ q: t || undefined });
  };

  const onKey = (e) => {
    if (!items.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => (a + 1) % items.length); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => (a - 1 + items.length) % items.length); }
    if (e.key === 'Escape') setOpen(false);
  };

  return (
    <div className={cn('relative', className)}>
      <form onSubmit={submit} className="relative" role="search">
        <label htmlFor={`${listId}-in`} className="sr-only">Search by locality, project or keyword</label>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" aria-hidden />
        <input id={`${listId}-in`} value={text} maxLength={100} autoFocus={autoFocus} autoComplete="off" placeholder={placeholder}
          role="combobox" aria-expanded={items.length > 0} aria-controls={listId} aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          onChange={(e) => { setText(e.target.value); setOpen(true); setActive(-1); setParsed(null); }}
          onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)} onKeyDown={onKey}
          className={cn('h-11 w-full rounded-md border border-line-strong bg-white pl-10 pr-10 text-sm text-ink placeholder:text-ink-subtle focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30', inputClassName)} />
        {(parsing || ac.isFetching) && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-ink-subtle" aria-hidden />}
      </form>
      {items.length > 0 && (
        <ul id={listId} role="listbox" className="absolute z-30 mt-1 max-h-80 w-full overflow-auto rounded-lg border bg-white py-1 shadow-lg">
          {items.map((s, i) => {
            const Icon = KIND_ICON[s.kind] || MapPin;
            return (
              <li key={`${s.kind}-${s.value}`} id={`${listId}-${i}`} role="option" aria-selected={i === active}
                onMouseDown={(e) => { e.preventDefault(); pick(s); }}
                className={cn('flex cursor-pointer items-center gap-3 px-3 py-2 text-sm', i === active ? 'bg-brand-50' : 'hover:bg-surface-muted')}>
                <Icon className="h-4 w-4 shrink-0 text-brand-600" aria-hidden />
                <span className="flex-1 truncate text-ink">{s.label}</span>
                <span className="text-xs text-ink-subtle">{KIND_LABEL[s.kind]}</span>
              </li>
            );
          })}
        </ul>
      )}
      {parsed && (
        <div className="mt-2 rounded-lg border border-brand-200 bg-brand-50 p-3 text-sm">
          <p className="flex items-center gap-1.5 font-medium text-brand-800"><Sparkles className="h-4 w-4" aria-hidden />We understood</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {describeFilters(parsed.filters).map((d) => <span key={d} className="rounded-full bg-white px-2.5 py-0.5 text-xs font-medium text-ink shadow-sm">{d}</span>)}
            {parsed.filters.near && <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-medium text-ink shadow-sm">Near {parsed.filters.near}</span>}
          </div>
          {parsed.unparsed && parsed.unparsed.length > 0 && <p className="mt-2 text-xs text-ink-subtle">Not used: {parsed.unparsed.join(' ')}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700"
              onClick={() => { const { near: _n, ...f } = parsed.filters; setParsed(null); setText(''); onSearch({ ...f, q: undefined }); }}>Search with these filters</button>
            <button type="button" className="rounded-md border border-line-strong bg-white px-3 py-1.5 text-xs font-medium text-ink hover:bg-surface-muted"
              onClick={() => { setParsed(null); onSearch({ q: text.trim() }); }}>Search the words instead</button>
            <button type="button" className="ml-auto rounded-md p-1 text-ink-subtle hover:text-ink" aria-label="Dismiss" onClick={() => setParsed(null)}><X className="h-4 w-4" /></button>
          </div>
        </div>
      )}
    </div>
  );
}
