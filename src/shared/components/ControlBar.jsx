// Shared Control bar (ARCHITECTURE 4.4): a 40 px bar on top of this admin, shown
// only when the session came from the Control Center. Control Center logo (back
// to the overview), project switcher, environment badge, the owner's name and
// the "acting via Control Center" notice. Same component in all four platforms;
// no runtime dependency on the Control Center (it only links to it).
import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ShieldCheck, ArrowLeft, Check } from 'lucide-react';
import { controlCenter } from '@/shared/lib/controlCenter';

const COLORS = { realestate: '#2a78d6', ecommerce: '#eb6834', lms: '#1baf7a', hub: '#eda100' };

export default function ControlBar({ current }) {
  const [ctx, setCtx] = useState(() => controlCenter.get());
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const onStorage = () => setCtx(controlCenter.get());
    window.addEventListener('storage', onStorage);
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => { window.removeEventListener('storage', onStorage); document.removeEventListener('mousedown', h); };
  }, []);
  if (!ctx || !ctx.ccUrl) return null;
  const projects = Array.isArray(ctx.projects) ? ctx.projects : [];
  const live = ctx.env === 'live';
  const name = ctx.ccUser && ctx.ccUser.name;

  return (
    <div role="region" aria-label="Control Center" className="relative z-40 flex h-10 items-center gap-2 bg-[#0B1220] px-3 text-xs text-white/80 sm:gap-3 sm:px-4" data-testid="control-bar">
      <a href={ctx.ccUrl} className="flex shrink-0 items-center gap-2 rounded px-1 py-0.5 font-semibold text-white hover:bg-white/10" title="Back to the Control Center overview">
        <svg width="18" height="18" viewBox="0 0 32 32" aria-hidden><rect width="32" height="32" rx="8" fill="#1E293B" /><circle cx="16" cy="16" r="8.5" fill="none" stroke="#5B7CFA" strokeWidth="3" /><circle cx="16" cy="16" r="3" fill="#34D399" /></svg>
        <span className="hidden sm:inline">Control Center</span>
      </a>
      <span className="h-4 w-px bg-white/15" aria-hidden />
      <div className="relative" ref={ref}>
        <button type="button" onClick={() => setOpen((v) => !v)} aria-haspopup="menu" aria-expanded={open}
          className="flex items-center gap-1.5 rounded px-2 py-1 font-medium text-white hover:bg-white/10">
          <span className="h-2 w-2 rounded-full" style={{ background: COLORS[current] || '#94A3B8' }} aria-hidden />
          {(projects.find((p) => p.code === current) || { name: 'Projects' }).name}
          <ChevronDown className="h-3.5 w-3.5 text-white/60" aria-hidden />
        </button>
        {open && (
          <div role="menu" className="absolute left-0 top-full mt-1 w-64 overflow-hidden rounded-md border border-white/10 bg-[#131C2E] py-1 shadow-xl">
            <a role="menuitem" href={ctx.ccUrl} className="flex items-center gap-2 px-3 py-2 text-white/90 hover:bg-white/10"><ArrowLeft className="h-3.5 w-3.5" />All projects (Control Center)</a>
            <div className="my-1 border-t border-white/10" />
            {projects.map((p) => (
              <a key={p.code} role="menuitem" href={p.code === current ? '#' : controlCenter.switchUrl(ctx, p.code)} onClick={p.code === current ? (e) => { e.preventDefault(); setOpen(false); } : undefined}
                className="flex items-center gap-2 px-3 py-2 text-white/90 hover:bg-white/10">
                <span className="h-2 w-2 rounded-full" style={{ background: COLORS[p.code] || '#94A3B8' }} aria-hidden />
                <span className="flex-1">{p.name}</span>
                {p.code === current && <Check className="h-3.5 w-3.5 text-emerald-400" aria-label="Current" />}
              </a>
            ))}
          </div>
        )}
      </div>
      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${live ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300'}`}>{live ? 'Live' : 'Demo'}</span>
      <span className="ml-auto flex min-w-0 items-center gap-1.5 truncate text-white/70">
        <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-400" aria-hidden />
        <span className="truncate">Acting via Control Center{name ? <> as <b className="font-semibold text-white">{name}</b></> : null}</span>
      </span>
      <a href={ctx.ccUrl} className="hidden shrink-0 rounded px-2 py-1 font-medium text-white hover:bg-white/10 sm:inline">Back to Control Center</a>
    </div>
  );
}
