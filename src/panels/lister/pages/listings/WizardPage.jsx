// RE-A-03 listing wizard shell: 8 steps, each saved separately. Live and
// paused listings are edited as a pending revision (RE-A-12).
import { useSearchParams, useParams, Link } from 'react-router-dom';
import { ArrowLeft, Check } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { Alert, Badge, Card, PageHeader, PageSpinner } from '@/shared/ui';
import { EDITABLE, listingStatus, REVISABLE, useListing, WIZARD_STEPS } from '@/modules/listings/api';
import BasicStep from './wizard/BasicStep';
import LocationStep from './wizard/LocationStep';
import DetailsStep from './wizard/DetailsStep';
import PriceStep from './wizard/PriceStep';
import AmenitiesStep from './wizard/AmenitiesStep';
import MediaStep from './wizard/MediaStep';
import CommissionStep from './wizard/CommissionStep';
import ReviewStep from './wizard/ReviewStep';

const STEP_COMPONENTS = { 1: BasicStep, 2: LocationStep, 3: DetailsStep, 4: PriceStep, 5: AmenitiesStep, 6: MediaStep, 7: CommissionStep, 8: ReviewStep };

export default function WizardPage() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const { data: listing, isLoading, error } = useListing(id);
  const step = Math.min(8, Math.max(1, Number(params.get('step')) || 1));
  const goto = (n) => { setParams({ step: String(n) }); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  if (isLoading) return <PageSpinner />;
  if (error) return <Alert tone="danger">{error.message}</Alert>;

  const done = (listing.wizard && listing.wizard.stepsDone) || [];
  const s = listingStatus(listing.status);
  const editable = EDITABLE.includes(listing.status) || REVISABLE.includes(listing.status);
  const Step = STEP_COMPONENTS[step];
  // Step 1 must exist before the rest (type and purpose drive the other steps).
  const locked = (n) => n > 1 && !done.includes(1);

  return (
    <>
      <Link to="/lister/listings" className="mb-3 inline-flex items-center gap-1 text-sm text-brand-700 hover:underline"><ArrowLeft className="h-4 w-4" /> My listings</Link>
      <PageHeader title={listing.title || 'New listing'} breadcrumb={listing.listingNo}
        actions={<><Badge tone={s.tone}>{s.label}</Badge><Badge>{listing.wizard?.completeness || 0}% complete</Badge></>} />
      {REVISABLE.includes(listing.status) && <Alert tone="info" className="mb-4">This listing is {s.label.toLowerCase()}. Your edits are saved as changes for review; buyers keep seeing the current version until they are approved.</Alert>}
      {listing.status === 'pending_approval' && <Alert tone="info" className="mb-4">Submitted for approval. You can still correct details; withdraw from My listings to stop the review.</Alert>}
      {!editable && <Alert tone="warning" className="mb-4">A {s.label.toLowerCase()} listing cannot be edited.</Alert>}

      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <nav aria-label="Wizard steps">
          <ol className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:gap-1 lg:overflow-visible">
            {WIZARD_STEPS.map((w) => {
              const isDone = done.includes(w.n) || (w.n === 7 && listing.activeAgreementId);
              const active = w.n === step;
              return (
                <li key={w.n} className="shrink-0">
                  <button type="button" disabled={locked(w.n)} onClick={() => goto(w.n)}
                    className={cn('flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                      active ? 'bg-brand-50 font-semibold text-brand-700' : 'text-ink-muted hover:bg-surface-sunken')}>
                    <span className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                      active ? 'bg-brand-600 text-white' : isDone ? 'bg-success-100 text-success-700' : 'bg-surface-sunken text-ink-subtle')}>
                      {isDone && !active ? <Check className="h-3.5 w-3.5" /> : w.n}
                    </span>
                    <span className="whitespace-nowrap">{w.label}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>
        <Card className="min-w-0">
          <h2 className="mb-5 text-lg font-semibold text-ink">{step}. {WIZARD_STEPS[step - 1].label}</h2>
          <fieldset disabled={!editable} className="min-w-0">
            <Step key={`${step}-${listing._id}`} listing={listing} next={() => goto(Math.min(8, step + 1))} back={step > 1 ? () => goto(step - 1) : undefined} goto={goto} />
          </fieldset>
        </Card>
      </div>
    </>
  );
}
