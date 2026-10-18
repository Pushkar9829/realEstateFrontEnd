// Step 4: expected price (sale) or rent + deposit (rent), maintenance, flags.
// Entered in rupees; the API stores paise and computes price per sq ft.
import { useState } from 'react';
import { Checkbox, Input } from '@/shared/ui';
import { shortRupees } from '@/shared/lib/format';
import { clean, num, StepFooter, StepMessages, useStepSave } from './common';
import { useT } from '@/shared/i18n';

const r = (paise) => (paise == null ? '' : paise / 100);

export default function PriceStep({ listing, next, back }) {
  const t = useT();
  const p = listing.price || {};
  const sale = listing.purpose !== 'rent';
  const [v, setV] = useState({ amount: r(p.amount), monthlyRent: r(p.monthlyRent), deposit: r(p.deposit), maintenance: r(p.maintenance), negotiable: Boolean(p.negotiable), allInclusive: Boolean(p.allInclusive) });
  const body = () => clean({
    ...(sale ? { amount: num(v.amount) } : { monthlyRent: num(v.monthlyRent), deposit: num(v.deposit) }),
    maintenance: num(v.maintenance), negotiable: v.negotiable, allInclusive: v.allInclusive,
  });
  const s = useStepSave(listing, 4, { onSaved: next, value: v, build: body });
  const f = (k) => ({ value: v[k], onChange: (e) => setV((x) => ({ ...x, [k]: e.target.value })) });
  const main = num(sale ? v.amount : v.monthlyRent);
  const sqft = listing.details && listing.details.areaSqft;

  const save = () => s.run(body());

  return (
    <div className="space-y-6">
      <StepMessages formError={s.formError} />
      <div className="grid gap-4 sm:grid-cols-2">
        {sale ? (
          <Input label={t('lister.wizard.price.expected')} required leading="₹" type="number" min={0} {...f('amount')} error={s.errors.amount}
            hint={main ? `${shortRupees(main * 100)}${sqft ? ` · ${t('lister.wizard.price.perSqft', { price: shortRupees(Math.round((main * 100) / sqft)) })}` : ''}` : t('lister.wizard.price.hint')} />
        ) : (
          <>
            <Input label={t('lister.wizard.price.rent')} required leading="₹" type="number" min={0} {...f('monthlyRent')} error={s.errors.monthlyRent} hint={main ? t('lister.wizard.price.perMonth', { price: shortRupees(main * 100) }) : undefined} />
            <Input label={t('lister.wizard.price.deposit')} leading="₹" type="number" min={0} {...f('deposit')} error={s.errors.deposit} hint={main && num(v.deposit) ? t('lister.wizard.price.depositMonths', { n: (num(v.deposit) / main).toFixed(1) }) : t('lister.wizard.price.depositHint')} />
          </>
        )}
        <Input label={t('lister.wizard.price.maintenance')} leading="₹" type="number" min={0} {...f('maintenance')} />
      </div>
      <div className="space-y-3 rounded-md bg-surface-muted p-4">
        <Checkbox label={t('lister.wizard.price.negotiable')} checked={v.negotiable} onChange={(e) => setV((x) => ({ ...x, negotiable: e.target.checked }))} />
        <Checkbox label={t('lister.wizard.price.allInclusive')} description={sale ? t('lister.wizard.price.allSale') : t('lister.wizard.price.allRent')} checked={v.allInclusive} onChange={(e) => setV((x) => ({ ...x, allInclusive: e.target.checked }))} />
      </div>
      {listing.status === 'live' && <p className="text-xs text-ink-subtle">{t('lister.wizard.price.liveNote')}</p>}
      <StepFooter onBack={back} saving={s.saving} onSave={save} />
    </div>
  );
}
