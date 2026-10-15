// Status of a lister invoice: cancelled invoices show their credit note,
// issued ones show the receivable's collection status.
import { Badge } from '@/shared/ui';
import { receivableStatus } from '@/modules/receivables/listerApi';

export default function InvoiceStatusBadge({ inv }) {
  if (inv.status === 'cancelled') return <Badge tone="neutral">Cancelled{inv.creditNote && inv.creditNote.no ? ` · CN ${inv.creditNote.no}` : ''}</Badge>;
  const s = receivableStatus(inv.receivableStatus);
  return <Badge tone={s.tone}>{s.label}</Badge>;
}
