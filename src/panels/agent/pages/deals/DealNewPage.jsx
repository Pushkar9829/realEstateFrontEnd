// RE-S-AGT-13 (create): a draft deal from one of my open leads, optionally
// from an accepted offer (amount and token prefilled; a change needs a note).
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Alert, Card, PageHeader, Select, Skeleton, useToast } from '@/shared/ui';
import { rupees } from '@/shared/lib/format';
import { OPEN_STAGES, errorText, useAgentLead } from '@/modules/leads/agentApi';
import { dealApi, offerAmounts, toRupeesInput, useDealMutation } from '@/modules/deals/agentApi';
import DealForm, { dealInitial } from '../../components/DealForm';
import { ErrorState, LeadPicker, StageBadge } from '../../components/common';

export default function DealNewPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const leadId = params.get('leadId');
  const { data: lead, isLoading, error, refetch } = useAgentLead(leadId);
  const create = useDealMutation(dealApi.create);
  const [offerId, setOfferId] = useState(params.get('offerId') || '');
  const [propertyId, setPropertyId] = useState('');
  const [errors, setErrors] = useState({});

  const header = <PageHeader breadcrumb={<Link to="/agent/deals" className="hover:text-ink">My deals</Link>} title="New deal" description="Saved as a draft. Add receipts and the agreement, then submit for verification." />;
  if (!leadId) {
    return (
      <>
        {header}
        <Card className="max-w-lg"><LeadPicker label="Lead for this deal" required value={null} onChange={(l) => l && setParams({ leadId: l._id })} /></Card>
      </>
    );
  }
  if (isLoading) return <>{header}<Skeleton className="h-96" /></>;
  if (error) return <>{header}<ErrorState error={error} onRetry={refetch} title="Could not load the lead" /></>;

  const accepted = (lead.offers || []).filter((o) => o.status === 'accepted' && !o.dealId);
  const offer = accepted.find((o) => o._id === offerId);
  const amounts = offer ? offerAmounts(offer) : null;
  const props = lead.properties || [];
  const pid = (offer && offer.propertyId) || propertyId || lead.propertyId || (props[0] && props[0]._id);
  const prop = props.find((p) => String(p._id) === String(pid));
  const isProject = Boolean(lead.projectId);
  const dealType = isProject ? 'sale' : prop && prop.purpose === 'rent' ? 'rent' : 'sale';
  const initial = { ...dealInitial(null), ...(amounts ? { amount: toRupeesInput(amounts.amount), bookingAmount: toRupeesInput(amounts.token) } : {}) };
  const minDate = new Date(new Date(lead.createdAt).getTime() + 330 * 60000).toISOString().slice(0, 10);

  const save = async (body) => {
    try {
      const deal = await create.mutateAsync({ leadId: lead._id, ...(offer ? { offerId: offer._id } : {}), ...(!isProject && pid && !offer ? { propertyId: String(pid) } : {}), ...body });
      toast.success(`Draft ${deal.dealNo} created`);
      navigate(`/agent/deals/${deal._id}`, { replace: true });
    } catch (e) {
      setErrors(e.fieldErrors || {});
      toast.error(e.code === 'OPEN_DEAL_EXISTS' ? `${e.message}. Open it from My deals.` : errorText(e));
    }
  };

  return (
    <>
      {header}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          {!OPEN_STAGES.includes(lead.stage) && <Alert tone="danger" className="mb-4">A {lead.stage.replace('_', ' ')} lead cannot get a new deal.</Alert>}
          <div className="mb-4 grid gap-4 sm:grid-cols-2">
            {accepted.length > 0 && (
              <Select label="Accepted offer" placeholder="Not from an offer" value={offerId} onChange={(e) => setOfferId(e.target.value)}
                options={accepted.map((o) => ({ value: o._id, label: `${o.offerNo} · ${rupees(offerAmounts(o).amount)}` }))} />
            )}
            {!isProject && !offer && props.length > 1 && (
              <Select label="Property" required value={String(pid || '')} onChange={(e) => setPropertyId(e.target.value)} options={props.map((p) => ({ value: String(p._id), label: `${p.listingNo} · ${p.title}` }))} error={errors.propertyId} />
            )}
          </div>
          {!isProject && !prop && <Alert tone="warning" className="mb-4">This lead has no property. Link one on the lead page first.</Alert>}
          <DealForm key={`${offerId}-${pid}`} dealType={dealType} initial={initial} offer={amounts} isProject={isProject} minDate={minDate}
            previewTarget={isProject ? { leadId: lead._id, projectId: String(lead.projectId) } : pid ? { leadId: lead._id, propertyId: String(pid) } : null}
            errors={errors} loading={create.isPending} submitLabel="Create draft" onCancel={() => navigate(-1)} onSubmit={save} />
        </Card>
        <Card className="h-fit space-y-2 text-sm">
          <h3 className="font-semibold text-ink">Lead</h3>
          <p><Link className="font-medium text-brand-700 hover:underline" to={`/agent/leads/${lead._id}`}>{lead.leadNo}</Link> · {lead.buyer.name}</p>
          <StageBadge stage={lead.stage} />
          {prop && <p className="pt-2 text-ink-muted">{prop.listingNo} · {prop.title}<span className="block text-xs text-ink-subtle">{dealType === 'rent' ? 'Rent deal' : 'Sale deal'} (from the listing purpose)</span></p>}
          <p className="pt-2 text-xs text-ink-subtle">One open deal per lead. Submitting needs a completed site visit, at least one receipt and the agreement or booking form.</p>
        </Card>
      </div>
    </>
  );
}
