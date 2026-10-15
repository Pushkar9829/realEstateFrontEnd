// Step 4: expected price (sale) or rent + deposit (rent), maintenance, flags.
// Entered in rupees; the API stores paise and computes price per sq ft.
import { useState } from 'react';
import { Checkbox, Input } from '@/shared/ui';
import { shortRupees } from '@/shared/lib/format';
import { clean, num, StepFooter, StepMessages, useStepSave } from './common';

const r = (paise) => (paise == null ? '' : paise / 100);

export default function PriceStep({ listing, next, back }) {
  const p = listing.price || {};
  const sale = listing.purpose !== 'rent';
  const [v, setV] = useState({ amount: r(p.amount), monthlyRent: r(p.monthlyRent), deposit: r(p.deposit), maintenance: r(p.maintenance), negotiable: Boolean(p.negotiable), allInclusive: Boolean(p.allInclusive) });
  const s = useStepSave(listing, 4, { onSaved: next });
  const f = (k) => ({ value: v[k], onChange: (e) => setV((x) => ({ ...x, [k]: e.target.value })) });
  const main = num(sale ? v.amount : v.monthlyRent);
  const sqft = listing.details && listing.details.areaSqft;

  const save = () => s.run(clean({
    ...(sale ? { amount: num(v.amount) } : { monthlyRent: num(v.monthlyRent), deposit: num(v.deposit) }),
    maintenance: num(v.maintenance), negotiable: v.negotiable, allInclusive: v.allInclusive,
  }));

  return (
    <div className="space-y-6">
      <StepMessages formError={s.formError} />
      <div className="grid gap-4 sm:grid-cols-2">
        {sale ? (
          <Input label="Expected price" required leading="₹" type="number" min={0} {...f('amount')} error={s.errors.amount}
            hint={main ? `${shortRupees(main * 100)}${sqft ? ` · ${shortRupees(Math.round((main * 100) / sqft))} per sq ft` : ''}` : 'In rupees, e.g. 8500000 for 85 lakh'} />
        ) : (
          <>
            <Input label="Monthly rent" required leading="₹" type="number" min={0} {...f('monthlyRent')} error={s.errors.monthlyRent} hint={main ? `${shortRupees(main * 100)} per month` : undefined} />
            <Input label="Security deposit" leading="₹" type="number" min={0} {...f('deposit')} error={s.errors.deposit} hint={main && num(v.deposit) ? `${(num(v.deposit) / main).toFixed(1)} months of rent (max 24)` : 'Up to 24 months of rent'} />
          </>
        )}
        <Input label="Maintenance per month" leading="₹" type="number" min={0} {...f('maintenance')} />
      </div>
      <div className="space-y-3 rounded-md bg-surface-muted p-4">
        <Checkbox label="Price is negotiable" checked={v.negotiable} onChange={(e) => setV((x) => ({ ...x, negotiable: e.target.checked }))} />
        <Checkbox label="All-inclusive price" description={sale ? 'Includes parking, club membership and other charges.' : 'Rent includes maintenance.'} checked={v.allInclusive} onChange={(e) => setV((x) => ({ ...x, allInclusive: e.target.checked }))} />
      </div>
      {listing.status === 'live' && <p className="text-xs text-ink-subtle">On a live listing, a price change within 10% applies immediately; larger changes go to review.</p>}
      <StepFooter onBack={back} saving={s.saving} onSave={save} />
    </div>
  );
}
