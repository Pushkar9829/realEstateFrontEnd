// Search state lives in the URL (RE-S-PUB-02): filters, sort and page.
import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CATEGORIES, FURNISHING, POSSESSION, POSTED_BY, cleanFilters, filtersFromParams } from '@/modules/search/api';

const ENUMS = { category: CATEGORIES, furnishing: FURNISHING, possession: POSSESSION, postedBy: POSTED_BY };

// Translated label for a search enum code (t('search.<group>.<code>')); unknown
// codes are shown as they are, or as `fallback` when given.
export function enumLabel(t, group, code, fallback) {
  if (code && ENUMS[group] && ENUMS[group][code]) return t(`search.${group}.${code}`);
  return fallback !== undefined ? fallback : code;
}

export default function useSearchFilters({ extraKeys = [] } = {}) {
  const [sp, setSp] = useSearchParams();
  const filters = useMemo(() => filtersFromParams(sp), [sp]);
  const sort = sp.get('sort') || 'relevance';
  const page = Math.max(1, parseInt(sp.get('page'), 10) || 1);
  const extra = useMemo(() => Object.fromEntries(extraKeys.map((k) => [k, sp.get(k) || undefined])), [sp, extraKeys]);

  // patch: { key: value | undefined }. Any filter change resets the page.
  const update = useCallback((patch, { keepPage = false, replace = false } = {}) => {
    setSp((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('type');
      Object.entries(patch).forEach(([k, v]) => { if (v === undefined || v === null || v === '') next.delete(k); else next.set(k, String(v)); });
      if (!keepPage && !('page' in patch)) next.delete('page');
      return next;
    }, { replace });
  }, [setSp]);

  const clear = useCallback(() => {
    setSp((prev) => {
      const next = new URLSearchParams();
      if (prev.get('purpose')) next.set('purpose', prev.get('purpose'));
      if (prev.get('city')) next.set('city', prev.get('city'));
      return next;
    });
  }, [setSp]);

  const query = useMemo(() => cleanFilters(filters), [filters]);
  return { sp, filters, query, sort, page, extra, update, clear, qs: sp.toString() };
}
