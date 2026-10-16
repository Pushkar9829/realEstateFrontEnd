// Photo gallery with a full-screen lightbox (keyboard arrows, swipe on touch).
import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, ChevronLeft, ChevronRight, Images, X } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { useT } from '@/shared/i18n';

function Lightbox({ photos, index, onIndex, onClose }) {
  const t = useT();
  const ref = useRef(null);
  const touch = useRef(null);
  const go = useCallback((d) => onIndex((index + d + photos.length) % photos.length), [index, photos.length, onIndex]);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    const key = (e) => { if (e.key === 'ArrowRight') go(1); if (e.key === 'ArrowLeft') go(-1); };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [go]);
  const p = photos[index];
  return (
    <dialog ref={ref} className="m-0 h-full max-h-full w-full max-w-full bg-ink/95 p-0 text-white backdrop:bg-ink/80" onCancel={(e) => { e.preventDefault(); onClose(); }}
      onTouchStart={(e) => { touch.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => { if (touch.current == null) return; const dx = e.changedTouches[0].clientX - touch.current; if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1); touch.current = null; }}>
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between px-4 py-3 text-sm">
          <span>{index + 1} / {photos.length}{p.caption ? ` · ${p.caption}` : ''}</span>
          <button type="button" onClick={onClose} className="rounded-md p-2 hover:bg-white/10" aria-label={t('property.gallery.close')}><X className="h-5 w-5" /></button>
        </div>
        <div className="relative flex flex-1 items-center justify-center px-2 pb-4">
          <img src={p.url} alt={p.caption || t('property.gallery.photoN', { n: index + 1 })} className="max-h-full max-w-full object-contain" />
          {photos.length > 1 && (
            <>
              <button type="button" onClick={() => go(-1)} className="absolute left-2 rounded-full bg-white/10 p-2 hover:bg-white/20" aria-label={t('property.gallery.prev')}><ChevronLeft className="h-6 w-6" /></button>
              <button type="button" onClick={() => go(1)} className="absolute right-2 rounded-full bg-white/10 p-2 hover:bg-white/20" aria-label={t('property.gallery.next')}><ChevronRight className="h-6 w-6" /></button>
            </>
          )}
        </div>
      </div>
    </dialog>
  );
}

export default function Gallery({ photos = [], className }) {
  const t = useT();
  const [open, setOpen] = useState(null);
  const list = photos.slice(0, 21);
  if (!list.length) {
    return <div className={cn('flex aspect-[16/7] items-center justify-center rounded-lg bg-surface-sunken text-ink-subtle', className)}><Camera className="h-10 w-10" aria-hidden /><span className="sr-only">{t('property.gallery.noPhotos')}</span></div>;
  }
  const side = list.slice(1, 5);
  return (
    <div className={className}>
      <div className="grid gap-2 overflow-hidden rounded-lg sm:grid-cols-4 sm:grid-rows-2" style={{ maxHeight: 460 }}>
        <button type="button" onClick={() => setOpen(0)} className={cn('relative block aspect-[4/3] overflow-hidden bg-surface-sunken sm:aspect-auto', side.length ? 'sm:col-span-2 sm:row-span-2' : 'sm:col-span-4 sm:row-span-2 sm:aspect-[16/7]')}>
          <img src={list[0].url} alt={list[0].caption || t('property.gallery.cover')} className="h-full w-full object-cover" />
        </button>
        {side.map((p, i) => (
          <button key={p.url} type="button" onClick={() => setOpen(i + 1)} className="relative hidden overflow-hidden bg-surface-sunken sm:block">
            <img src={p.thumbUrl || p.url} alt={p.caption || t('property.gallery.photoN', { n: i + 2 })} loading="lazy" className="h-full w-full object-cover transition hover:scale-105" />
            {i === side.length - 1 && list.length > 5 && <span className="absolute inset-0 flex items-center justify-center bg-ink/50 text-sm font-semibold text-white">{t('property.gallery.more', { n: list.length - 5 })}</span>}
          </button>
        ))}
      </div>
      <button type="button" onClick={() => setOpen(0)} className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:underline">
        <Images className="h-4 w-4" aria-hidden />{t('property.gallery.viewAll', { n: list.length })}
      </button>
      {open !== null && <Lightbox photos={list} index={open} onIndex={setOpen} onClose={() => setOpen(null)} />}
    </div>
  );
}
