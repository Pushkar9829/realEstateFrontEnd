// Status of a lister invoice: cancelled invoices show their credit note,
// issued ones show the receivable's collection status.
import { Badge } from '@/shared/ui';
import { receivableStatus } from '@/modules/receivables/listerApi';
import { useT } from '@/shared/i18n';

export default function InvoiceStatusBadge({ inv }) {
  const t = useT();
  if (inv.status === 'cancelled') return <Badge tone="neutral">{t('lister.invoices.invoiceStatus.cancelled')}{inv.creditNote && inv.creditNote.no ? ` · ${t('lister.invoices.cn', { no: inv.creditNote.no })}` : ''}</Badge>;
  const s = receivableStatus(inv.receivableStatus);
  return <Badge tone={s.tone}>{s.label}</Badge>;
}
