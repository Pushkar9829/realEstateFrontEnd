// Locality / keyword box with autocomplete (RE-E-15, min 2 chars, 300 ms) and
// the sentence parser (RE-E-19): "2 BHK under 60 lakh in Baner" becomes
// filter chips the user confirms before searching.
import { useId, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Landmark, Loader2, MapPin, Search, Sparkles, X } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { useT } from '@/shared/i18n';
import { describeFilters, parseSentence, useAutocomplete } from '@/modules/search/api';

const KIND_ICON = { city: Building2, locality: MapPin, project: Building2, landmark: Landmark };
const looksLikeSentence = (t) => t.trim().split(/\s+/).length >= 3 && /\d|bhk|lakh|crore|cr\b|under|near|rent|buy|furnished|ready/i.test(t);

/**
 * onSearch(patch): patch is a partial filter object ({ q } | { city, localities } | parsed filters).
 */
export default function SearchBox({ city, initial = '', onSearch, placeholder, className, inputClassName, autoFocus }) {
  const t = useT();
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
    const words = text.trim();
    if (words && looksLikeSentence(words)) {
      setParsing(true);
      try {
        const r = await parseSentence(words, city);
        if (r && r.filters && Object.keys(r.filters).length > 1) { setParsed(r); return; }
      } catch { /* fall back to a keyword search */ } finally { setParsing(false); }
    }
    onSearch({ q: words || undefined });
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
        <label htmlFor={`${listId}-in`} className="sr-only">{t('home.searchBox.label')}</label>
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-400" aria-hidden />
        <input id={`${listId}-in`} value={text} maxLength={100} autoFocus={autoFocus} autoComplete="off" placeholder={placeholder || t('home.searchBox.placeholder')}
          role="combobox" aria-expanded={items.length > 0} aria-controls={listId} aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          onChange={(e) => { setText(e.target.value); setOpen(true); setActive(-1); setParsed(null); }}
          onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)} onKeyDown={onKey}
          className={cn('w-full pl-10 pr-10 text-sm text-navy-900 placeholder:text-navy-400 transition focus:outline-none', inputClassName || 'h-12 rounded-xl border-0 bg-sand-100 ring-1 ring-inset ring-navy-900/10 focus:bg-white focus:ring-2 focus:ring-gold-500')} />
        {(parsing || ac.isFetching) && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-gold-600" aria-hidden />}
      </form>
      {items.length > 0 && (
        <ul id={listId} role="listbox" className="absolute z-30 mt-2 max-h-80 w-full overflow-auto rounded-2xl bg-white p-1.5 shadow-lift ring-1 ring-navy-900/5">
          {items.map((s, i) => {
            const Icon = KIND_ICON[s.kind] || MapPin;
            return (
              <li key={`${s.kind}-${s.value}`} id={`${listId}-${i}`} role="option" aria-selected={i === active}
                onMouseDown={(e) => { e.preventDefault(); pick(s); }}
                className={cn('flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors', i === active ? 'bg-sand-100' : 'hover:bg-sand-50')}>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gold-50 text-gold-700 ring-1 ring-gold-200"><Icon className="h-4 w-4" aria-hidden /></span>
                <span className="flex-1 truncate font-medium text-navy-900">{s.label}</span>
                <span className="text-[11px] font-medium uppercase tracking-wider text-navy-400">{['city', 'locality', 'project', 'landmark'].includes(s.kind) ? t(`home.searchBox.kinds.${s.kind}`) : ''}</span>
              </li>
            );
          })}
        </ul>
      )}
      {parsed && (
        <div className="mt-2 rounded-2xl bg-white p-4 text-sm shadow-card ring-1 ring-gold-200">
          <p className="flex items-center gap-1.5 font-semibold text-navy-900"><Sparkles className="h-4 w-4 text-gold-600" aria-hidden />{t('home.searchBox.understood')}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {describeFilters(parsed.filters).map((d) => <span key={d} className="rounded-full bg-navy-900 px-3 py-1 text-xs font-medium text-white">{d}</span>)}
            {parsed.filters.near && <span className="rounded-full bg-navy-900 px-3 py-1 text-xs font-medium text-white">{t('home.searchBox.near', { place: parsed.filters.near })}</span>}
          </div>
          {parsed.unparsed && parsed.unparsed.length > 0 && <p className="mt-2 text-xs text-navy-400">{t('home.searchBox.notUsed', { words: parsed.unparsed.join(' ') })}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="h-9 rounded-full bg-gold-500 px-4 text-xs font-semibold text-navy-950 transition-colors hover:bg-gold-400"
              onClick={() => { const { near: _n, ...f } = parsed.filters; setParsed(null); setText(''); onSearch({ ...f, q: undefined }); }}>{t('home.searchBox.withFilters')}</button>
            <button type="button" className="h-9 rounded-full bg-white px-4 text-xs font-medium text-navy-900 ring-1 ring-inset ring-navy-900/15 transition hover:ring-navy-900/40"
              onClick={() => { setParsed(null); onSearch({ q: text.trim() }); }}>{t('home.searchBox.wordsInstead')}</button>
            <button type="button" className="ml-auto rounded-full p-2 text-navy-400 hover:bg-sand-100 hover:text-navy-900" aria-label={t('home.searchBox.dismiss')} onClick={() => setParsed(null)}><X className="h-4 w-4" /></button>
          </div>
        </div>
      )}
    </div>
  );
}
