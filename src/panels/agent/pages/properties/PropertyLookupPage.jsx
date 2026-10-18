// RE-S-AGT-10 Property lookup: live listings by search filters or listing ID.
// Results carry no owner contact, exact address or commission; those are on
// the sales sheet, which opens once the property is linked to one of your leads.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Link2, Search } from 'lucide-react';
import { Badge, Button, Input, Modal, PageHeader, Select, Table, useToast } from '@/shared/ui';
import { date, shortRupees } from '@/shared/lib/format';
import { useCities } from '@/modules/listings/api';
import { errorText, leadApi, useAgentMutation, usePropertySearch } from '@/modules/leads/agentApi';
import { useT } from '@/shared/i18n';
import { ErrorState, LeadPicker } from '../../components/common';

function AddToLeadModal({ property, onClose }) {
  const t = useT();
  const toast = useToast();
  const m = useAgentMutation(leadApi.link);
  const [lead, setLead] = useState(null);
  const save = async () => {
    try { await m.mutateAsync({ id: lead._id, propertyId: property.id }); toast.success(t('agent.lookup.linked', { no: lead.leadNo })); onClose(); } catch (e) { toast.error(errorText(e)); }
  };
  return (
    <Modal open={Boolean(property)} onClose={onClose} title={t('agent.lookup.addTitle')} description={property ? `${property.listingNo} · ${property.title}` : ''}
      footer={<><Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button><Button disabled={!lead} loading={m.isPending} onClick={save}>{t('agent.lookup.linkProperty')}</Button></>}>
      <LeadPicker required value={lead} onChange={setLead} />
      <p className="mt-3 text-xs text-ink-subtle">{t('agent.lookup.linkHint')}</p>
    </Modal>
  );
}

const BHK = ['1', '2', '3', '4+'].map((b) => ({ value: b, label: `${b} BHK` }));

export default function PropertyLookupPage() {
  const t = useT();
  const cities = useCities();
  const [form, setForm] = useState({ q: '', purpose: '', city: '', bhk: '', minPrice: '', maxPrice: '' });
  const [params, setParams] = useState({});
  const [page, setPage] = useState(1);
  const [adding, setAdding] = useState(null);
  const searched = Object.keys(params).length > 0;
  const { data, isFetching, error, refetch } = usePropertySearch({ ...params, page }, searched);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const run = (e) => {
    e.preventDefault();
    const p = Object.fromEntries(Object.entries(form).filter(([, v]) => String(v).trim() !== '').map(([k, v]) => [k, String(v).trim()]));
    setPage(1);
    setParams(Object.keys(p).length ? p : { all: '1' });
  };
  const rows = data || [];

  return (
    <>
      <PageHeader title={t('panel.nav.agentProperties')} description={t('agent.lookup.desc')} />
      <form onSubmit={run} className="mb-4 grid gap-3 rounded-lg border bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-6">
        <Input className="lg:col-span-2" aria-label={t('agent.common.search')} placeholder={t('agent.lookup.searchPh')} leading={<Search className="h-4 w-4" />} value={form.q} onChange={set('q')} />
        <Select aria-label={t('agent.req.purpose')} placeholder={t('agent.leads.buyOrRent')} value={form.purpose} onChange={set('purpose')} options={[{ value: 'sale', label: t('agent.purpose.sale') }, { value: 'rent', label: t('agent.purpose.rent') }]} />
        <Select aria-label={t('agent.req.city')} placeholder={t('common.allCities')} value={form.city} onChange={set('city')} options={(cities.data || []).map((c) => ({ value: c.name, label: c.name }))} />
        <Select aria-label="BHK" placeholder={t('agent.lookup.anyBhk')} value={form.bhk} onChange={set('bhk')} options={BHK} />
        <div className="flex gap-2">
          <Input aria-label={t('agent.lookup.maxPrice')} placeholder={t('agent.lookup.maxPricePh')} type="number" min={0} value={form.maxPrice} onChange={set('maxPrice')} />
          <Button type="submit" icon={Search} aria-label={t('agent.common.search')} />
        </div>
      </form>
      {!searched ? <p className="rounded-lg border border-dashed bg-white p-8 text-center text-sm text-ink-subtle">{t('agent.lookup.prompt')}</p>
        : error ? <ErrorState error={error} onRetry={refetch} title={t('agent.lookup.failed')} /> : (
          <>
            <Table loading={isFetching && !rows.length} rows={rows} rowKey={(r) => r.id} empty={t('agent.lookup.empty')}
              columns={[
                { key: 'id', header: t('agent.wa.listing'), render: (r) => <span><Link to={`/agent/properties/${r.id}`} className="block max-w-xs truncate font-medium text-ink hover:text-brand-700">{r.title}</Link><span className="text-xs text-ink-subtle">{r.listingNo}</span></span> },
                { key: 'price', header: t('agent.lookup.price'), render: (r) => { const p = r.purpose === 'rent' ? r.price && r.price.monthlyRent : r.price && r.price.amount; return <span className="whitespace-nowrap font-medium">{p ? `${shortRupees(p)}${r.purpose === 'rent' ? t('agent.common.perMonth') : ''}` : '-'}</span>; } },
                { key: 'loc', header: t('agent.lookup.locality'), render: (r) => <span className="text-sm">{[r.locality, r.city].filter(Boolean).join(', ')}</span> },
                { key: 'cfg', header: t('agent.lookup.config'), render: (r) => <span className="text-xs">{r.bhk ? `${r.bhk} BHK` : r.type}{r.areaSqft ? ` · ${t('agent.common.sqft', { n: r.areaSqft })}` : ''}</span> },
                { key: 'by', header: t('agent.lookup.postedBy'), render: (r) => (r.listerBadge ? <Badge tone="neutral">{r.listerBadge.label || r.listerBadge}</Badge> : '-') },
                { key: 'since', header: t('agent.lookup.liveSince'), render: (r) => <span className="whitespace-nowrap text-xs">{date(r.postedAt)}</span> },
                { key: 'act', header: '', render: (r) => <Button size="sm" variant="secondary" icon={Link2} onClick={() => setAdding(r)}>{t('agent.lookup.addToLead')}</Button> },
              ]} />
            <div className="mt-3 flex items-center justify-between text-sm text-ink-muted">
              <span>{t('agent.lookup.page', { n: page })}</span>
              <span className="flex gap-2">
                <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>{t('agent.lookup.previous')}</Button>
                <Button size="sm" variant="secondary" disabled={rows.length < 20} onClick={() => setPage((p) => p + 1)}>{t('common.next')}</Button>
              </span>
            </div>
          </>
        )}
      <AddToLeadModal property={adding} onClose={() => setAdding(null)} />
    </>
  );
}
