// Header / auth-page language switcher (English | हिन्दी). Hidden when only one
// language is enabled in `i18n.languages`. Navy text with a gold mark on the
// active language; `inverse` for dark or photo backgrounds.
import { Languages } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { LANG_LABELS, useLang, useT } from './index';

export default function LanguageSwitcher({ className, inverse = false }) {
  const { lang, setLang, languages } = useLang();
  const t = useT();
  if (!languages || languages.length < 2) return null;
  return (
    <div role="group" aria-label={t('common.language')} className={cn('inline-flex items-center gap-1 text-sm', className)}>
      <Languages className={cn('h-4 w-4', inverse ? 'text-gold-300' : 'text-gold-600')} aria-hidden />
      {languages.map((l, i) => (
        <span key={l} className="inline-flex items-center gap-0.5">
          {i > 0 && <span className={cn('h-3.5 w-px', inverse ? 'bg-white/25' : 'bg-navy-900/15')} aria-hidden />}
          <button type="button" lang={l} onClick={() => setLang(l)} aria-pressed={lang === l}
            className={cn('relative inline-flex h-8 items-center rounded-md px-1.5 font-medium transition-colors',
              'after:absolute after:inset-x-1.5 after:bottom-1 after:h-0.5 after:rounded-full after:transition-colors',
              lang === l
                ? cn(inverse ? 'text-white after:bg-gold-400' : 'text-navy-900 after:bg-gold-500')
                : cn('after:bg-transparent', inverse ? 'text-navy-200 hover:text-white' : 'text-navy-400 hover:text-navy-900'))}>
            {LANG_LABELS[l] || l}
          </button>
        </span>
      ))}
    </div>
  );
}
