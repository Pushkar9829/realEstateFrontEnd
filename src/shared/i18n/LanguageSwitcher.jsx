// Header / auth-page language switcher (English | हिन्दी). Hidden when only one
// language is enabled in `i18n.languages`.
import { Languages } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { LANG_LABELS, useLang, useT } from './index';

export default function LanguageSwitcher({ className, inverse = false }) {
  const { lang, setLang, languages } = useLang();
  const t = useT();
  if (!languages || languages.length < 2) return null;
  return (
    <div role="group" aria-label={t('common.language')} className={cn('inline-flex items-center gap-1 text-sm', className)}>
      <Languages className={cn('h-4 w-4', inverse ? 'text-brand-200' : 'text-ink-subtle')} aria-hidden />
      {languages.map((l, i) => (
        <span key={l} className="inline-flex items-center gap-1">
          {i > 0 && <span className={inverse ? 'text-brand-300' : 'text-ink-subtle'} aria-hidden>|</span>}
          <button type="button" lang={l} onClick={() => setLang(l)} aria-pressed={lang === l}
            className={cn('rounded px-1 py-0.5 font-medium',
              lang === l ? (inverse ? 'text-white' : 'text-brand-700') : (inverse ? 'text-brand-200 hover:text-white' : 'text-ink-muted hover:text-ink'))}>
            {LANG_LABELS[l] || l}
          </button>
        </span>
      ))}
    </div>
  );
}
