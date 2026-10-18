// Buyer card: masked phone with an audited Reveal, tel / WhatsApp links that
// open the call log after use, masked call (Could) and the seeker flag.
import { useState } from 'react';
import { Eye, Flag, Mail, MessageCircle, Phone, PhoneCall, ShieldAlert } from 'lucide-react';
import { Badge, Button, useToast } from '@/shared/ui';
import { plural } from '@/shared/lib/format';
import { errorText, leadApi, revealBuyerContact, useAgentMutation } from '@/modules/leads/agentApi';
import { ReasonModal, Section } from '../common';

export default function BuyerCard({ lead, onCall }) {
  const toast = useToast();
  const [shown, setShown] = useState({});
  const [busy, setBusy] = useState('');
  const [flagOpen, setFlagOpen] = useState(false);
  const flag = useAgentMutation(leadApi.seekerFlag);
  const flagged = lead.throttled || (lead.timeline || []).some((t) => t.type === 'seeker_flag');

  const reveal = async (field) => {
    setBusy(field);
    try {
      const r = await revealBuyerContact(lead._id, field);
      setShown((s) => ({ ...s, [field]: r.value || '(not given)' }));
    } catch (e) { toast.error(errorText(e)); } finally { setBusy(''); }
  };
  const masked = async () => {
    try { const r = await leadApi.maskedCall({ id: lead._id }); toast.info(r.message || 'Calling…'); } catch (e) { toast.error(errorText(e)); }
  };
  const submitFlag = async (note) => {
    try { const r = await flag.mutateAsync({ id: lead._id, note }); toast.success(`Flagged for review (${r.flagNo})`); setFlagOpen(false); } catch (e) { toast.error(errorText(e)); }
  };
  const digits = shown.phone ? shown.phone.replace(/[^\d]/g, '') : '';

  return (
    <Section title="Buyer" action={flagged ? <Badge tone="danger" icon={ShieldAlert}>Seeker flagged</Badge> : null}>
      <p className="text-lg font-semibold text-ink">{lead.buyer.name}</p>
      {lead.buyerLabel && <p className="text-xs text-ink-subtle">Owners see this buyer as &quot;{lead.buyerLabel}&quot;</p>}
      <div className="mt-3 space-y-2 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-2 text-ink"><Phone className="h-4 w-4 text-ink-subtle" aria-hidden />{shown.phone || lead.buyer.phone}</span>
          {!shown.phone && <Button size="sm" variant="secondary" icon={Eye} loading={busy === 'phone'} onClick={() => reveal('phone')}>Reveal</Button>}
        </div>
        {shown.phone && digits && (
          <div className="flex flex-wrap gap-2">
            <a href={`tel:${shown.phone}`} onClick={() => setTimeout(onCall, 300)} className="inline-flex h-8 items-center gap-1.5 rounded-md bg-brand-600 px-3 text-sm font-medium text-white hover:bg-brand-700"><PhoneCall className="h-4 w-4" />Call</a>
            <a href={`https://wa.me/${digits}`} target="_blank" rel="noreferrer" onClick={() => setTimeout(onCall, 300)} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line-strong bg-white px-3 text-sm font-medium text-ink hover:bg-surface-muted"><MessageCircle className="h-4 w-4" />WhatsApp</a>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-2 text-ink"><Mail className="h-4 w-4 text-ink-subtle" aria-hidden />{shown.email || (lead.buyer.hasEmail ? 'Email on file' : 'No email')}</span>
          {lead.buyer.hasEmail && !shown.email && <Button size="sm" variant="ghost" icon={Eye} loading={busy === 'email'} onClick={() => reveal('email')}>Reveal</Button>}
        </div>
        <p className="text-xs text-ink-subtle">Every reveal is logged. Never share owner contacts with the buyer.</p>
      </div>
      <div className="mt-4 flex flex-wrap gap-2 border-t pt-3">
        {lead.maskedCallAvailable && <Button size="sm" variant="ghost" icon={Phone} onClick={masked}>Masked call</Button>}
        <Button size="sm" variant="ghost" icon={Flag} onClick={() => setFlagOpen(true)}>Flag seeker</Button>
      </div>
      <p className="mt-2 text-xs text-ink-subtle">{plural(lead.callAttempts || 0, 'call attempt')} logged</p>
      <ReasonModal open={flagOpen} onClose={() => setFlagOpen(false)} title="Flag this seeker" description="For brokers posing as buyers or abusive behaviour. Trust and safety reviews the flag."
        label="What happened" min={10} max={1000} confirmLabel="Flag" danger loading={flag.isPending} onSubmit={submitFlag} />
    </Section>
  );
}
