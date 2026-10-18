// "Skip to main content": the first focusable element on every layout; visible
// only while focused. Targets <main id="main" tabIndex={-1}>.
import { useT } from '@/shared/i18n';

export default function SkipLink({ target = 'main' }) {
  const t = useT();
  return (
    <a href={`#${target}`} className="sr-only z-[100] rounded-md bg-white px-4 py-2 text-sm font-semibold text-navy-900 shadow-lg ring-2 ring-gold-500 focus:not-sr-only focus:fixed focus:left-3 focus:top-3">
      {t('common.skipToContent')}
    </a>
  );
}
