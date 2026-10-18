// Shared Control bar (ARCHITECTURE 4.4): a 40 px bar on top of this admin, shown
// only when the session came from the Control Center. Control Center logo (back
// to the overview), project switcher, environment badge, the owner's name and
// the "acting via Control Center" notice. Same component in all four platforms;
// no runtime dependency on the Control Center (it only links to it).
// Rendered by PanelLayout after the skip link (topBar), sticky, and the layout
// subtracts its 40 px (--cc-bar) from the sidebar height. Links come only from
// a context whose ccUrl passed safeCcUrl (https, or http on localhost).
import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ShieldCheck, ArrowLeft, Check } from 'lucide-react';
import { controlCenter } from '@/shared/lib/controlCenter';
import { useT } from '@/shared/i18n';

const initials = (name) => String(name || '').trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');

// The current hand-off context, kept in sync across tabs.
export function useControlContext() {
  const [ctx, setCtx] = useState(() => controlCenter.get());
  useEffect(() => {
    const onStorage = () => setCtx(controlCenter.get());
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
  return ctx;
}

const COLORS = { realestate: '#2a78d6', ecommerce: '#eb6834', lms: '#1baf7a', hub: '#eda100' };

export default function ControlBar({ current, ctx: given }) {
  const t = useT();
  const own = useControlContext();
  const ctx = given || own;
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const k = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', h);
    document.addEventListener('keydown', k);
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('keydown', k); };
  }, []);
  if (!ctx || !ctx.ccUrl) return null;
  const projects = Array.isArray(ctx.projects) ? ctx.projects : [];
  const live = ctx.env === 'live';
  const name = ctx.ccUser && ctx.ccUser.name;

  return (
    <div role="region" aria-label={t('panel.controlBar.region')} className="sticky top-0 z-40 flex h-10 items-center gap-2 bg-[#0B1220] px-3 text-xs text-white/80 sm:gap-3 sm:px-4" data-testid="control-bar">
      <a href={ctx.ccUrl} className="flex shrink-0 items-center gap-2 rounded px-1 py-0.5 font-semibold text-white hover:bg-white/10" title={t('panel.controlBar.homeTitle')}>
        <svg width="18" height="18" viewBox="0 0 32 32" aria-hidden><rect width="32" height="32" rx="8" fill="#1E293B" /><circle cx="16" cy="16" r="8.5" fill="none" stroke="#5B7CFA" strokeWidth="3" /><circle cx="16" cy="16" r="3" fill="#34D399" /></svg>
        <span className="hidden sm:inline">{t('panel.controlBar.home')}</span>
        <span className="sr-only sm:hidden">{t('panel.controlBar.home')}</span>
      </a>
      <span className="h-4 w-px bg-white/15" aria-hidden />
      <div className="relative" ref={ref}>
        <button type="button" onClick={() => setOpen((v) => !v)} aria-haspopup="menu" aria-expanded={open}
          className="flex items-center gap-1.5 whitespace-nowrap rounded px-2 py-1 font-medium text-white hover:bg-white/10">
          <span className="h-2 w-2 rounded-full" style={{ background: COLORS[current] || '#94A3B8' }} aria-hidden />
          {(projects.find((p) => p.code === current) || { name: t('panel.controlBar.projects') }).name}
          <ChevronDown className="h-3.5 w-3.5 text-white/60" aria-hidden />
        </button>
        {open && (
          <div role="menu" className="absolute left-0 top-full mt-1 w-64 overflow-hidden rounded-md border border-white/10 bg-[#131C2E] py-1 shadow-xl">
            <a role="menuitem" href={ctx.ccUrl} className="flex items-center gap-2 px-3 py-2 text-white/90 hover:bg-white/10"><ArrowLeft className="h-3.5 w-3.5" aria-hidden />{t('panel.controlBar.allProjects')}</a>
            <div className="my-1 border-t border-white/10" />
            {projects.map((p) => (
              <a key={p.code} role="menuitem" href={p.code === current ? '#' : controlCenter.switchUrl(ctx, p.code)} onClick={p.code === current ? (e) => { e.preventDefault(); setOpen(false); } : undefined}
                className="flex items-center gap-2 px-3 py-2 text-white/90 hover:bg-white/10">
                <span className="h-2 w-2 rounded-full" style={{ background: COLORS[p.code] || '#94A3B8' }} aria-hidden />
                <span className="flex-1">{p.name}</span>
                {p.code === current && <Check className="h-3.5 w-3.5 text-emerald-400" aria-label={t('panel.controlBar.current')} />}
              </a>
            ))}
          </div>
        )}
      </div>
      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${live ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300'}`}>{live ? t('panel.controlBar.live') : t('panel.controlBar.demo')}</span>
      <span className="ml-auto flex min-w-0 items-center gap-1.5 text-white/70">
        <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-400" aria-hidden />
        {name ? (
          <>
            <span className="sr-only sm:hidden">{t('panel.controlBar.actingAs')} {name}</span>
            <span aria-hidden title={name} data-testid="control-bar-initials" className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/15 text-[10px] font-semibold text-white sm:hidden">{initials(name)}</span>
            <span className="hidden min-w-0 truncate sm:inline"><span className="hidden md:inline">{t('panel.controlBar.actingAs')} </span><b className="font-semibold text-white" title={name}>{name}</b></span>
          </>
        ) : (
          <span className="truncate"><span className="hidden md:inline">{t('panel.controlBar.acting')}</span><span className="md:hidden">{t('panel.controlBar.via')}</span></span>
        )}
      </span>
      <a href={ctx.ccUrl} className="hidden shrink-0 rounded px-2 py-1 font-medium text-white hover:bg-white/10 sm:inline">{t('panel.controlBar.back')}</a>
    </div>
  );
}
