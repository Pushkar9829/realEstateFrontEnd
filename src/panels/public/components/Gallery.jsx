// Photo gallery: hero image + thumbnail mosaic on desktop, a swipeable
// scroll-snap strip on phones, and a full-screen lightbox (keyboard arrows,
// swipe on touch, thumbnail rail). Only the listing's own photos are shown;
// with none, a neutral placeholder (never a stock photo).
import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, ChevronLeft, ChevronRight, Images, X } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { useT } from '@/shared/i18n';

function Lightbox({ photos, index, onIndex, onClose }) {
  const t = useT();
  const ref = useRef(null);
  const touch = useRef(null);
  const rail = useRef(null);
  const go = useCallback((d) => onIndex((index + d + photos.length) % photos.length), [index, photos.length, onIndex]);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    const key = (e) => { if (e.key === 'ArrowRight') go(1); if (e.key === 'ArrowLeft') go(-1); };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [go]);
  useEffect(() => {
    const el = rail.current && rail.current.children[index];
    if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }, [index]);
  const p = photos[index];
  return (
    <dialog ref={ref} className="m-0 h-full max-h-full w-full max-w-full bg-navy-950/[0.97] p-0 text-white backdrop:bg-navy-950/80" onCancel={(e) => { e.preventDefault(); onClose(); }}
      onTouchStart={(e) => { touch.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => { if (touch.current == null) return; const dx = e.changedTouches[0].clientX - touch.current; if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1); touch.current = null; }}>
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <span className="min-w-0 truncate text-sm text-navy-200">
            <span className="font-display text-lg font-medium text-white">{index + 1}</span>
            <span className="mx-1 text-navy-400">/</span>{photos.length}
            {p.caption ? <span className="ml-3 text-navy-200">{p.caption}</span> : null}
          </span>
          <button type="button" onClick={onClose} className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/15 transition-colors hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-400" aria-label={t('property.gallery.close')}><X className="h-5 w-5" /></button>
        </div>
        <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 pb-3 sm:px-20">
          <img src={p.url} alt={p.caption || t('property.gallery.photoN', { n: index + 1 })} className="max-h-full max-w-full rounded-xl object-contain shadow-lift" />
          {photos.length > 1 && (
            <>
              <button type="button" onClick={() => go(-1)} className="absolute left-2 inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/15 backdrop-blur transition-colors hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-400 sm:left-5" aria-label={t('property.gallery.prev')}><ChevronLeft className="h-6 w-6" /></button>
              <button type="button" onClick={() => go(1)} className="absolute right-2 inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/15 backdrop-blur transition-colors hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-400 sm:right-5" aria-label={t('property.gallery.next')}><ChevronRight className="h-6 w-6" /></button>
            </>
          )}
        </div>
        {photos.length > 1 && (
          <div ref={rail} className="flex gap-2 overflow-x-auto px-4 pb-4 sm:justify-center sm:px-6" role="group" aria-label={t('detail.gallery.thumbs')}>
            {photos.map((ph, i) => (
              <button key={ph.url} type="button" onClick={() => onIndex(i)} aria-label={ph.caption || t('property.gallery.photoN', { n: i + 1 })} aria-current={i === index || undefined}
                className={cn('h-14 w-20 shrink-0 overflow-hidden rounded-lg ring-2 transition', i === index ? 'opacity-100 ring-gold-400' : 'opacity-50 ring-transparent hover:opacity-90')}>
                <img src={ph.thumbUrl || ph.url} alt="" loading="lazy" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>
    </dialog>
  );
}

// Column spans for the 1-4 tiles beside the hero image (4-column, 2-row grid).
const SPANS = { 1: ['col-span-2 row-span-2'], 2: ['col-span-2', 'col-span-2'], 3: ['col-span-2', '', ''], 4: ['', '', '', ''] };

function MobileStrip({ list, onOpen }) {
  const t = useT();
  const [cur, setCur] = useState(0);
  const onScroll = (e) => {
    const el = e.currentTarget;
    const i = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
    if (i !== cur) setCur(Math.min(list.length - 1, Math.max(0, i)));
  };
  return (
    <div className="relative sm:hidden">
      <div className="flex snap-x snap-mandatory overflow-x-auto rounded-3xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" onScroll={onScroll}>
        {list.map((p, i) => (
          <button key={p.url} type="button" onClick={() => onOpen(i)} className="relative aspect-[4/3] w-full shrink-0 snap-center overflow-hidden bg-sand-200">
            <img src={i === 0 ? p.url : (p.thumbUrl || p.url)} alt={p.caption || (i === 0 ? t('property.gallery.cover') : t('property.gallery.photoN', { n: i + 1 }))} loading={i === 0 ? undefined : 'lazy'} className="h-full w-full object-cover" />
          </button>
        ))}
      </div>
      <span className="pointer-events-none absolute inset-x-0 bottom-0 h-20 rounded-b-3xl bg-gradient-to-t from-navy-950/50 to-transparent" aria-hidden />
      {list.length > 1 && (
        <>
          <span className="pointer-events-none absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5" aria-hidden>
            {list.slice(0, 8).map((p, i) => <span key={p.url} className={cn('h-1.5 rounded-full bg-white transition-all', i === Math.min(cur, 7) ? 'w-5' : 'w-1.5 opacity-60')} />)}
          </span>
          <span className="pointer-events-none absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-full bg-navy-950/60 px-2.5 py-1 text-xs font-medium text-white backdrop-blur" aria-hidden>
            <Camera className="h-3 w-3" />{cur + 1}/{list.length}
          </span>
        </>
      )}
    </div>
  );
}

export default function Gallery({ photos = [], className }) {
  const t = useT();
  const [open, setOpen] = useState(null);
  const list = photos.slice(0, 21);
  if (!list.length) {
    return (
      <div className={cn('relative flex aspect-[4/3] flex-col items-center justify-center overflow-hidden rounded-3xl bg-gradient-to-br from-sand-100 via-sand-200 to-sand-300 text-center sm:aspect-[16/6] sm:rounded-[2rem]', className)}>
        <span className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/40 blur-2xl" aria-hidden />
        <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-white/80 text-gold-700 shadow-card ring-1 ring-gold-200"><Camera className="h-7 w-7" aria-hidden /></span>
        <p className="relative mt-4 font-display text-xl font-medium text-navy-900">{t('detail.gallery.comingSoon')}<span className="sr-only">. {t('property.gallery.noPhotos')}</span></p>
        <p className="relative mt-1 max-w-xs px-4 text-sm text-navy-500">{t('detail.gallery.comingSoonText')}</p>
      </div>
    );
  }
  const side = list.slice(1, 5);
  const spans = SPANS[side.length] || [];
  return (
    <div className={className}>
      <MobileStrip list={list} onOpen={setOpen} />
      <div className="relative hidden h-[300px] grid-cols-4 grid-rows-2 gap-2 overflow-hidden rounded-[2rem] sm:grid md:h-[420px] lg:h-[500px]">
        <button type="button" onClick={() => setOpen(0)} className={cn('group relative overflow-hidden bg-sand-200', side.length ? 'col-span-2 row-span-2' : 'col-span-4 row-span-2')}>
          <img src={list[0].url} alt={list[0].caption || t('property.gallery.cover')} className="h-full w-full object-cover transition duration-700 ease-out group-hover:scale-[1.04]" />
          <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-navy-950/30 via-transparent to-transparent" aria-hidden />
        </button>
        {side.map((p, i) => (
          <button key={p.url} type="button" onClick={() => setOpen(i + 1)} className={cn('group relative overflow-hidden bg-sand-200', spans[i])}>
            <img src={p.thumbUrl || p.url} alt={p.caption || t('property.gallery.photoN', { n: i + 2 })} loading="lazy" className="h-full w-full object-cover transition duration-700 ease-out group-hover:scale-[1.06]" />
            {i === side.length - 1 && list.length > 5 && <span className="absolute inset-0 flex items-center justify-center bg-navy-950/55 font-display text-2xl font-medium text-white backdrop-blur-[2px]">{t('property.gallery.more', { n: list.length - 5 })}</span>}
          </button>
        ))}
        <button type="button" onClick={() => setOpen(0)} className="absolute bottom-4 right-4 inline-flex h-10 items-center gap-2 rounded-full bg-white/95 px-4 text-sm font-medium text-navy-900 shadow-card ring-1 ring-navy-900/10 backdrop-blur transition hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-500">
          <Images className="h-4 w-4 text-gold-700" aria-hidden />{t('property.gallery.viewAll', { n: list.length })}
        </button>
      </div>
      {open !== null && <Lightbox photos={list} index={open} onIndex={setOpen} onClose={() => setOpen(null)} />}
    </div>
  );
}
