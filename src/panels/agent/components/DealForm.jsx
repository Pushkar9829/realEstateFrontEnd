// Commercial terms of a deal (create and edit). Amounts are typed in rupees.
// A live commission preview (debounced, computed by the server with the same
// function as the deal) is shown before saving when previewTarget is given.
import { useEffect, useState } from 'react';
import { Alert, Button, Input, Select, Spinner, Textarea } from '@/shared/ui';
import { rupees } from '@/shared/lib/format';
import { PAYMENT_MODES, toRupeesInput, useCommissionPreview } from '@/modules/deals/agentApi';
import { useT } from '@/shared/i18n';

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

const BASIS = { sale_price: 'agent.dealForm.basisSale', annual_rent: 'agent.dealForm.basisRent' };

function Line({ label, value, strong }) {
  return <div className="flex justify-between gap-3 py-1"><dt className="text-ink-subtle">{label}</dt><dd className={strong ? 'font-semibold text-ink' : 'text-ink'}>{value}</dd></div>;
}

// target: { leadId, propertyId } or { leadId, projectId }.
function CommissionPreview({ target, dealType, amount, bookingDate }) {
  const n = Number(amount);
  const body = target && n > 0 ? { ...target, dealType, [dealType === 'rent' ? 'monthlyRent' : 'agreedPrice']: n, ...(bookingDate ? { bookingDate } : {}) } : null;
  const debounced = useDebounced(body ? JSON.stringify(body) : '');
  const { data: p, isFetching, error } = useCommissionPreview(debounced ? JSON.parse(debounced) : null);
  const t = useT();
  if (!target) return null;
  return (
    <section aria-label={t('agent.dealForm.preview')} aria-live="polite" className="rounded-md border border-line bg-surface-muted p-3 text-sm">
      <div className="mb-1 flex items-center justify-between gap-2">
        <h4 className="font-medium text-ink">{t('agent.dealForm.preview')}</h4>
        {isFetching && <Spinner size="sm" />}
      </div>
      {!body ? <p className="text-ink-subtle">{t(dealType === 'rent' ? 'agent.dealForm.enterRent' : 'agent.dealForm.enterPrice')}</p>
        : error ? <p className="text-danger-700">{error.message}</p>
          : !p ? <p className="text-ink-subtle">{t('agent.dealForm.calculating')}</p>
            : !p.available ? <p className="text-warning-700">{p.reason}</p>
              : (
                <dl className="divide-y divide-line">
                  <Line label={`${p.percent}% ${BASIS[p.basis] ? t(BASIS[p.basis]) : ''}`} value={rupees(p.basisAmount)} />
                  <Line label={t('agent.dealForm.commission')} value={rupees(p.commission)} />
                  {p.gst && p.gst.interState
                    ? <Line label={`IGST ${p.gst.percent}%`} value={rupees(p.gst.igst)} />
                    : p.gst && <><Line label={`CGST ${p.gst.percent / 2}%`} value={rupees(p.gst.cgst)} /><Line label={`SGST ${p.gst.percent / 2}%`} value={rupees(p.gst.sgst)} /></>}
                  <Line label={t('agent.dealForm.totalGst')} value={rupees(p.total)} strong />
                </dl>
              )}
      <p className="mt-1 text-xs text-ink-subtle">{p && p.agreementNo ? `${t('agent.dealForm.agreement', { no: p.agreementNo })} ` : ''}{t('agent.dealForm.recomputed')}</p>
    </section>
  );
}

/**
 * dealType: sale | rent. offer: { amount, token } in paise when linked to an accepted offer.
 * onSubmit(body) gets the API body (rupees). minDate: lead created date (YYYY-MM-DD).
 * previewTarget: { leadId, propertyId | projectId } enables the commission preview.
 */
export default function DealForm({ dealType, initial, offer, isProject, minDate, onSubmit, loading, errors = {}, submitLabel, onCancel, previewTarget }) {
  const t = useT();
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
    if (v.amount !== '' && !(amount > 0)) e[rent ? 'monthlyRent' : 'agreedPrice'] = t('agent.dealForm.errPositive');
    if (v.bookingAmount !== '' && !(booking > 0)) e.bookingAmount = t('agent.dealForm.errBookingZero');
    if (!rent && amount > 0 && booking > amount) e.bookingAmount = t('agent.dealForm.errBookingMax');
    if (v.bookingDate && v.bookingDate > todayInput()) e.bookingDate = t('agent.dealForm.errFuture');
    if (v.bookingDate && minDate && v.bookingDate < minDate) e.bookingDate = t('agent.dealForm.errBeforeEnquiry');
    if (offerDiff && v.offerNote.trim().length < 20) e.offerNote = t('agent.dealForm.errOfferNote');
    if (isProject && v.unitNo && v.unitNo.trim().length > 30) e.unitNo = t('agent.dealForm.errUnit');
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
      {offer && offer.amount && <Alert tone="info">{offer.token ? t('agent.dealForm.prefilledToken', { amount: rupees(offer.amount), token: rupees(offer.token) }) : t('agent.dealForm.prefilled', { amount: rupees(offer.amount) })}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label={rent ? t('agent.dealForm.rent') : t('agent.dealForm.price')} required leading="₹" type="number" min={1} value={v.amount} onChange={set('amount')} error={err[rent ? 'monthlyRent' : 'agreedPrice']} />
        <Input label={rent ? t('agent.dealForm.deposit') : t('agent.dealForm.booking')} required leading="₹" type="number" min={1} value={v.bookingAmount} onChange={set('bookingAmount')} error={err.bookingAmount} />
        <Input label={t('agent.dealForm.bookingDate')} required type="date" max={todayInput()} min={minDate || undefined} value={v.bookingDate} onChange={set('bookingDate')} error={err.bookingDate} />
        <Select label={t('agent.dealForm.paymentMode')} required placeholder={t('agent.common.choose')} value={v.paymentMode} onChange={set('paymentMode')} options={PAYMENT_MODES} error={err.paymentMode} />
        <Input label={t('agent.dealForm.paymentRef')} required={Boolean(v.paymentMode && v.paymentMode !== 'cash')} maxLength={80} placeholder={t('agent.dealForm.paymentRefPh')} value={v.paymentReference} onChange={set('paymentReference')} error={err.paymentReference} />
        {isProject && <Input label={t('agent.dealForm.unitNo')} required maxLength={30} value={v.unitNo} onChange={set('unitNo')} error={err.unitNo} />}
      </div>
      <CommissionPreview target={previewTarget} dealType={dealType} amount={v.amount} bookingDate={v.bookingDate} />
      {cash && <Alert tone="warning" title={t('agent.dealForm.cashTitle')}>{t('agent.dealForm.cashText')}</Alert>}
      {offerDiff && <Textarea label={t('agent.dealForm.offerNote')} required rows={2} maxLength={1000} value={v.offerNote} onChange={set('offerNote')} error={err.offerNote} hint={t('agent.dealForm.atLeast20')} />}
      <Textarea label={t('agent.dealForm.justification')} rows={2} maxLength={2000} value={v.justification} onChange={set('justification')} error={err.justification}
        hint={t('agent.dealForm.justificationHint')} />
      <Textarea label={t('agent.dealForm.notes')} rows={3} maxLength={2000} value={v.notes} onChange={set('notes')} />
      <div className="flex justify-end gap-2">
        {onCancel && <Button variant="ghost" onClick={onCancel}>{t('common.cancel')}</Button>}
        <Button loading={loading} onClick={submit}>{submitLabel || t('common.save')}</Button>
      </div>
    </div>
  );
}
