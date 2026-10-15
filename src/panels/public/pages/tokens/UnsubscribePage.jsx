// Saved-search alert unsubscribe link (/alerts/unsubscribe/:token). Opening
// the link switches that saved search's alerts off.
import { useParams } from 'react-router-dom';
import { BellOff, Link2Off } from 'lucide-react';
import { Button, Skeleton } from '@/shared/ui';
import { useUnsubscribe } from '@/modules/search/api';
import { NarrowPage, NotAvailable } from '../../components/States';

export default function UnsubscribePage() {
  const { token } = useParams();
  const q = useUnsubscribe(token);
  if (q.isLoading) return <NarrowPage><Skeleton className="h-48 w-full" /></NarrowPage>;
  if (q.isError) return <NotAvailable icon={Link2Off} title="This link is not valid" description="Manage your alerts from Saved searches after logging in." action={<Button to="/account/saved-searches">Saved searches</Button>} />;
  return (
    <NotAvailable icon={BellOff} title="Alerts switched off" description={`You will not get alerts for “${q.data.name}” any more. You can switch them back on from Saved searches.`}
      action={<div className="flex flex-wrap justify-center gap-2"><Button to="/account/saved-searches">Manage saved searches</Button><Button variant="secondary" to="/search">Search properties</Button></div>} />
  );
}
