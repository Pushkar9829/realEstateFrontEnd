// Maintenance banner set from the Control Center (CC_CONTRACT.md 6). Only polls
// when the build sets VITE_CC_ENABLED=true; otherwise it renders nothing and
// makes no request, so sites without the Control Center are unchanged.
import { useEffect, useState } from 'react';
import { Wrench } from 'lucide-react';
import env from '@/config/env';

const ENABLED = import.meta.env.VITE_CC_ENABLED === 'true';

export default function MaintenanceBanner() {
  const [m, setM] = useState(null);
  useEffect(() => {
    if (!ENABLED) return undefined;
    let stop = false;
    const load = () => fetch(`${env.apiUrl}/cc-status`).then((r) => (r.ok ? r.json() : null)).then((b) => { if (!stop) setM(b && b.data ? b.data.maintenance : null); }).catch(() => {});
    load();
    const t = setInterval(load, 60000);
    return () => { stop = true; clearInterval(t); };
  }, []);
  if (!m || !m.on) return null;
  return (
    <div role="status" className="flex items-center justify-center gap-2 bg-[#1D4ED8] px-4 py-2 text-center text-sm font-medium text-white">
      <Wrench className="h-4 w-4 shrink-0" aria-hidden />
      <span>{m.message || 'We are doing some maintenance. Browsing works; changes are paused for a short while.'}</span>
    </div>
  );
}
