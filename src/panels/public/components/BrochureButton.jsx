// "Download brochure" (RE-A-07) on the property and project pages and after an
// enquiry. When the brochure is gated (public.brochureGated) and this visitor
// has not enquired yet, it explains that and opens the enquiry form instead.
import { useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/shared/ui';
import { useT } from '@/shared/i18n';
import { fetchBrochure } from '@/modules/leads/publicApi';

export default function BrochureButton({ kind, slug, onEnquire, className, variant = 'outline' }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const open = async () => {
    setBusy(true); setNote('');
    try {
      const r = await fetchBrochure(kind, slug);
      window.open(r.url, '_blank', 'noopener,noreferrer');
    } catch (e) {
      if (e.code === 'ENQUIRE_FIRST' && onEnquire) { setNote(t('detail.brochure.enquireFirst')); onEnquire(); } else setNote(e.message);
    } finally { setBusy(false); }
  };
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button variant={variant} icon={Download} loading={busy} onClick={open} className={className || 'rounded-full'}>{t('detail.brochure.download')}</Button>
      {note && <span className="text-xs text-navy-500" role="status">{note}</span>}
    </span>
  );
}
