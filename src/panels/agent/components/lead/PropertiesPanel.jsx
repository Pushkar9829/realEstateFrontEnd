// Linked properties (primary + up to 10), suggested matches and "share selected".
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Home, Link2, Send, Sparkles, Unlink } from 'lucide-react';
import { Alert, Badge, Button, Input, Skeleton, useToast } from '@/shared/ui';
import { shortRupees, titleCase } from '@/shared/lib/format';
import { errorText, leadApi, useAgentMutation, useLeadMatches } from '@/modules/leads/agentApi';
import { Section } from '../common';

// "Buy · Pune · 2 BHK · ₹60 L to ₹1.30 Cr" from the match filters (budgets are rupees).
const lakhs = (r) => shortRupees(Number(r) * 100);
function matchText(f = {}) {
  const parts = [];
  if (f.purpose) parts.push(f.purpose === 'rent' ? 'Rent' : 'Buy');
  if (f.city) parts.push(f.city);
  if (f.localities) parts.push(Array.isArray(f.localities) ? f.localities.join(', ') : f.localities);
  if (f.bhk) parts.push(`${Array.isArray(f.bhk) ? f.bhk.join('/') : f.bhk} BHK`);
  if (f.minPrice && f.maxPrice) parts.push(`${lakhs(f.minPrice)} to ${lakhs(f.maxPrice)}`);
  else if (f.maxPrice) parts.push(`up to ${lakhs(f.maxPrice)}`);
  else if (f.minPrice) parts.push(`from ${lakhs(f.minPrice)}`);
  return parts.join(' · ');
}

function PropRow({ p, primary, checked, onCheck, onUnlink, busy }) {
  const loc = p.location ? [p.location.locality, p.location.city].filter(Boolean).join(', ') : [p.locality, p.city].filter(Boolean).join(', ');
  const price = p.price && (p.purpose === 'rent' ? p.price.monthlyRent : p.price.amount);
  const id = p._id || p.id;
  return (
    <li className="flex items-start gap-3 py-2.5">
      {onCheck && <input type="checkbox" className="mt-1" aria-label={`Select ${p.listingNo}`} checked={checked} disabled={p.status && p.status !== 'live'} onChange={() => onCheck(id)} />}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link to={`/agent/properties/${id}`} className="truncate font-medium text-ink hover:text-brand-700">{p.title}</Link>
          {primary && <Badge tone="brand">Enquired</Badge>}
          {p.status && p.status !== 'live' && <Badge tone="warning">{titleCase(p.status)}</Badge>}
        </div>
        <p className="text-xs text-ink-subtle">{p.listingNo} · {loc || '-'}{(p.details && p.details.bhk) || p.bhk ? ` · ${(p.details && p.details.bhk) || p.bhk} BHK` : ''} · {price ? `${shortRupees(price)}${p.purpose === 'rent' ? '/mo' : ''}` : '-'}</p>
      </div>
      {onUnlink && !primary && <Button size="sm" variant="ghost" icon={Unlink} loading={busy} aria-label="Unlink" onClick={() => onUnlink(id)} />}
    </li>
  );
}

export default function PropertiesPanel({ lead }) {
  const toast = useToast();
  const [showMatches, setShowMatches] = useState(false);
  const [selected, setSelected] = useState([]);
  const [note, setNote] = useState('');
  const matches = useLeadMatches(lead._id, showMatches);
  const link = useAgentMutation(leadApi.link);
  const unlink = useAgentMutation(leadApi.unlink);
  const share = useAgentMutation(leadApi.shareListings);
  const props = lead.properties || [];
  const linkedIds = props.map((p) => String(p._id));
  const toggle = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= 5 ? s : [...s, id]));

  const doLink = async (id) => { try { await link.mutateAsync({ id: lead._id, propertyId: id }); toast.success('Property linked'); } catch (e) { toast.error(errorText(e)); } };
  const doUnlink = async (id) => { try { await unlink.mutateAsync({ id: lead._id, propertyId: id }); setSelected((s) => s.filter((x) => x !== id)); toast.success('Property unlinked'); } catch (e) { toast.error(errorText(e)); } };
  const doShare = async () => {
    try { const r = await share.mutateAsync({ id: lead._id, body: { propertyIds: selected, ...(note.trim() ? { note: note.trim() } : {}) } }); toast.success(`${r.shared} listing link${r.shared > 1 ? 's' : ''} sent to the buyer`); setSelected([]); setNote(''); } catch (e) { toast.error(errorText(e)); }
  };
  const matchItems = (matches.data && matches.data.items) || [];

  return (
    <Section title="Properties" action={<Button size="sm" variant="secondary" icon={Sparkles} onClick={() => setShowMatches((s) => !s)}>{showMatches ? 'Hide matches' : 'Suggest matches'}</Button>}>
      {props.length ? (
        <ul className="divide-y">
          {props.map((p) => <PropRow key={p._id} p={p} primary={String(p._id) === String(lead.propertyId)} checked={selected.includes(String(p._id))} onCheck={toggle} onUnlink={doUnlink} busy={unlink.isPending} />)}
        </ul>
      ) : <p className="py-4 text-center text-sm text-ink-subtle"><Home className="mx-auto mb-1 h-5 w-5" />No property yet. Suggest matches or add one from Property lookup.</p>}
      <p className="mt-1 text-xs text-ink-subtle">{props.length - (lead.propertyId ? 1 : 0)}/10 linked by you</p>

      {showMatches && (
        <div className="mt-4 rounded-md border bg-surface-muted p-3">
          <p className="mb-2 text-sm font-medium text-ink">Suggested live listings</p>
          {matches.isLoading && <Skeleton className="h-20" />}
          {matches.error && <Alert tone="danger">{matches.error.message}</Alert>}
          {matches.data && (
            <>
              <p className="mb-2 text-xs text-ink-subtle">Matching on {matchText(matches.data.filters) || 'the lead requirement'}</p>
              {matchItems.length === 0 ? <p className="text-sm text-ink-subtle">No other live listing matches yet.</p> : (
                <ul className="divide-y rounded-md border bg-white px-3">
                  {matchItems.map((p) => (
                    <li key={p.id} className="flex items-center gap-2">
                      <div className="min-w-0 flex-1"><PropRow p={p} checked={selected.includes(p.id)} onCheck={toggle} /></div>
                      {!linkedIds.includes(p.id) && <Button size="sm" variant="ghost" icon={Link2} loading={link.isPending} onClick={() => doLink(p.id)}>Link</Button>}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}

      {selected.length > 0 && (
        <div className="mt-4 flex flex-col gap-2 rounded-md border border-brand-100 bg-brand-50 p-3 sm:flex-row sm:items-end">
          <Input className="flex-1" label={`Share ${selected.length} listing${selected.length > 1 ? 's' : ''} with the buyer (max 5)`} placeholder="Optional note" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />
          <Button icon={Send} loading={share.isPending} onClick={doShare}>Share selected</Button>
        </div>
      )}
    </Section>
  );
}
