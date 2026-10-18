// List filters: shown inline from 640 px; on phones they move into a
// "Filters (n)" button that opens a side drawer, so the results come first.
// `count` = number of active filters; `keep` = controls that stay visible on
// phones (usually the search box).
import { useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import useMediaQuery from '@/shared/hooks/useMediaQuery';
import { useT } from '@/shared/i18n';
import Button from './Button';
import { Drawer } from './Overlay';

export default function FiltersBox({ count = 0, keep = null, children, onClear }) {
  const t = useT();
  const narrow = useMediaQuery('(max-width: 639px)');
  const [open, setOpen] = useState(false);
  if (!narrow) return <>{keep}{children}</>;
  return (
    <>
      {keep}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" size="sm" icon={SlidersHorizontal} aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen(true)}>
          {count ? t('common.table.filtersCount', { count }) : t('common.table.filters')}
        </Button>
        {count > 0 && onClear && <Button variant="ghost" size="sm" onClick={onClear}>{t('common.table.clear')}</Button>}
      </div>
      <Drawer open={open} onClose={() => setOpen(false)} title={t('common.table.filters')} side="right">
        <div className="space-y-3 p-4 [&>*]:w-full">{children}</div>
        <div className="sticky bottom-0 border-t bg-white p-4">
          <Button className="w-full" onClick={() => setOpen(false)}>{t('common.table.showResults')}</Button>
        </div>
      </Drawer>
    </>
  );
}
