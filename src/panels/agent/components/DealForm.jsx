// Commercial terms of a deal (create and edit). Amounts are typed in rupees.
// A live commission preview (debounced, computed by the server with the same
// function as the deal) is shown before saving when previewTarget is given.
import { useEffect, useState } from 'react';
import { Alert, Button, Input, Select, Spinner, Textarea } from '@/shared/ui';
import { rupees } from '@/shared/lib/format';
import { PAYMENT_MODES, toRupeesInput, useCommissionPreview } from '@/modules/deals/agentApi';

const CASH_LIMIT = 199999; // deal.cashWarnLimit default (INR); the server has the final say
const todayInput = () => new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10);

export function dealInitial(deal) {
  return {
    amount: toRupeesInput(deal ? (deal.dealType === 'rent' ? deal.monthlyRent : deal.agreedPrice) : null),
    bookingAmount: toRupeesInput(deal && deal.bookingAmount),
    bookingDate: deal && deal.bookingDate ? new Date(new Date(deal.bookingDate).getTime() + 330 * 60000).toISOString().slice(0, 10) : todayInput(), // new deals default to today
    paymentMode: (deal && deal.paymentMode) || '',
    paymentReference: (deal && deal.paymentReference) || '',
    unitNo: (deal && deal.unitNo) || '',
    justification: (deal && deal.justification) || '',
    notes: (deal && deal.notes) || '',
    offerNote: '',
  };
}

function useDebounced(value, ms = 500) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

const BASIS = { sale_price: 'of the agreed price', annual_rent: 'of the annual rent (12 x monthly)' };

function Line({ label, value, strong }) {
  return <div className="flex justify-between gap-3 py-1"><dt className="text-ink-subtle">{label}</dt><dd className={strong ? 'font-semibold text-ink' : 'text-ink'}>{value}</dd></div>;
}

// target: { leadId, propertyId } or { leadId, projectId }.
function CommissionPreview({ target, dealType, amount, bookingDate }) {
  const n = Number(amount);
  const body = target && n > 0 ? { ...target, dealType, [dealType === 'rent' ? 'monthlyRent' : 'agreedPrice']: n, ...(bookingDate ? { bookingDate } : {}) } : null;
  const debounced = useDebounced(body ? JSON.stringify(body) : '');
  const { data: p, isFetching, error } = useCommissionPreview(debounced ? JSON.parse(debounced) : null);
  if (!target) return null;
  return (
    <section aria-label="Commission preview" aria-live="polite" className="rounded-md border border-line bg-surface-muted p-3 text-sm">
      <div className="mb-1 flex items-center justify-between gap-2">
        <h4 className="font-medium text-ink">Commission preview</h4>
        {isFetching && <Spinner size="sm" />}
      </div>
      {!body ? <p className="text-ink-subtle">Enter the {dealType === 'rent' ? 'monthly rent' : 'agreed price'} to see the commission.</p>
        : error ? <p className="text-danger-700">{error.message}</p>
          : !p ? <p className="text-ink-subtle">Calculating...</p>
            : !p.available ? <p className="text-warning-700">{p.reason}</p>
              : (
                <dl className="divide-y divide-line">
                  <Line label={`${p.percent}% ${BASIS[p.basis] || ''}`} value={rupees(p.basisAmount)} />
                  <Line label="Commission" value={rupees(p.commission)} />
                  {p.gst && p.gst.interState
                    ? <Line label={`IGST ${p.gst.percent}%`} value={rupees(p.gst.igst)} />
                    : p.gst && <><Line label={`CGST ${p.gst.percent / 2}%`} value={rupees(p.gst.cgst)} /><Line label={`SGST ${p.gst.percent / 2}%`} value={rupees(p.gst.sgst)} /></>}
                  <Line label="Total with GST" value={rupees(p.total)} strong />
                </dl>
              )}
      <p className="mt-1 text-xs text-ink-subtle">{p && p.agreementNo ? `Agreement ${p.agreementNo}. ` : ''}Recomputed on save, submit and verification.</p>
    </section>
  );
}

/**
 * dealType: sale | rent. offer: { amount, token } in paise when linked to an accepted offer.
 * onSubmit(body) gets the API body (rupees). minDate: lead created date (YYYY-MM-DD).
 * previewTarget: { leadId, propertyId | projectId } enables the commission preview.
 */
export default function DealForm({ dealType, initial, offer, isProject, minDate, onSubmit, loading, errors = {}, submitLabel = 'Save', onCancel, previewTarget }) {
  const [v, setV] = useState(initial);
  const [local, setLocal] = useState({});
  const set = (k) => (e) => setV((x) => ({ ...x, [k]: e.target.value }));
  const rent = dealType === 'rent';
  const offerDiff = offer && ((offer.amount && v.amount && Math.round(Number(v.amount) * 100) !== offer.amount) || (offer.token && v.bookingAmount && Math.round(Number(v.bookingAmount) * 100) !== offer.token));
  const cash = v.paymentMode === 'cash' && Number(v.bookingAmount) > CASH_LIMIT;
  const err = { ...errors, ...local };

  const submit = () => {
    const e = {};
    const amount = Number(v.amount);
    const booking = Number(v.bookingAmount);
    if (v.amount !== '' && !(amount > 0)) e[rent ? 'monthlyRent' : 'agreedPrice'] = 'Enter a positive amount';
    if (v.bookingAmount !== '' && !(booking > 0)) e.bookingAmount = 'The booking amount must be more than 0';
    if (!rent && amount > 0 && booking > amount) e.bookingAmount = 'The booking amount cannot exceed the agreed price';
    if (v.bookingDate && v.bookingDate > todayInput()) e.bookingDate = 'The booking date cannot be in the future';
    if (v.bookingDate && minDate && v.bookingDate < minDate) e.bookingDate = 'The booking date cannot be before the enquiry';
    if (offerDiff && v.offerNote.trim().length < 20) e.offerNote = 'The amount differs from the accepted offer; explain in at least 20 characters';
    if (isProject && v.unitNo && v.unitNo.trim().length > 30) e.unitNo = 'Up to 30 characters';
    setLocal(e);
    if (Object.keys(e).length) return;
    const body = {
      ...(v.amount !== '' ? { [rent ? 'monthlyRent' : 'agreedPrice']: amount } : {}),
      ...(v.bookingAmount !== '' ? { bookingAmount: booking } : {}),
      ...(v.bookingDate ? { bookingDate: v.bookingDate } : {}),
      ...(v.paymentMode ? { paymentMode: v.paymentMode } : {}),
      paymentReference: v.paymentReference.trim(), notes: v.notes.trim(), justification: v.justification.trim(),
      ...(isProject ? { unitNo: v.unitNo.trim() } : {}),
      ...(v.offerNote.trim() ? { offerNote: v.offerNote.trim() } : {}),
    };
    onSubmit(body);
  };

  return (
    <div className="space-y-4">
      {offer && offer.amount && <Alert tone="info">Prefilled from the accepted offer: {rupees(offer.amount)}{offer.token ? `, token ${rupees(offer.token)}` : ''}. A different amount needs a note.</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label={rent ? 'Agreed monthly rent' : 'Agreed price'} required leading="₹" type="number" min={1} value={v.amount} onChange={set('amount')} error={err[rent ? 'monthlyRent' : 'agreedPrice']} />
        <Input label={rent ? 'Deposit / first rent paid' : 'Booking / token amount'} required leading="₹" type="number" min={1} value={v.bookingAmount} onChange={set('bookingAmount')} error={err.bookingAmount} />
        <Input label="Booking date" required type="date" max={todayInput()} min={minDate || undefined} value={v.bookingDate} onChange={set('bookingDate')} error={err.bookingDate} />
        <Select label="Payment mode" required placeholder="Choose" value={v.paymentMode} onChange={set('paymentMode')} options={PAYMENT_MODES} error={err.paymentMode} />
        <Input label="Payment reference" required={Boolean(v.paymentMode && v.paymentMode !== 'cash')} maxLength={80} placeholder="UTR, cheque no. or UPI ref" value={v.paymentReference} onChange={set('paymentReference')} error={err.paymentReference} />
        {isProject && <Input label="Unit number" required maxLength={30} value={v.unitNo} onChange={set('unitNo')} error={err.unitNo} />}
      </div>
      <CommissionPreview target={previewTarget} dealType={dealType} amount={v.amount} bookingDate={v.bookingDate} />
      {cash && <Alert tone="warning" title="Cash above ₹1,99,999">Section 269ST of the Income Tax Act limits cash receipts. Verification will need a note; prefer a bank transfer.</Alert>}
      {offerDiff && <Textarea label="Why the amount differs from the accepted offer" required rows={2} maxLength={1000} value={v.offerNote} onChange={set('offerNote')} error={err.offerNote} hint="At least 20 characters" />}
      <Textarea label="Price justification" rows={2} maxLength={2000} value={v.justification} onChange={set('justification')} error={err.justification}
        hint="Required when the price is more than 30% away from the listed price" />
      <Textarea label="Negotiation notes (internal)" rows={3} maxLength={2000} value={v.notes} onChange={set('notes')} />
      <div className="flex justify-end gap-2">
        {onCancel && <Button variant="ghost" onClick={onCancel}>Cancel</Button>}
        <Button loading={loading} onClick={submit}>{submitLabel}</Button>
      </div>
    </div>
  );
}
