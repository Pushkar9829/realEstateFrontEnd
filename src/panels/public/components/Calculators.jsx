// RE-E-18 EMI and affordability calculators. Everything runs in the browser;
// nothing is stored or sent. EMI = P r (1+r)^n / ((1+r)^n - 1), monthly r.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Input } from '@/shared/ui';
import { cn } from '@/shared/lib/cn';
import { shortRupees } from '@/shared/lib/format';
import { t as translateNow, useT } from '@/shared/i18n';
import { track } from '@/shared/lib/analytics';
import { FORM_SKIN } from './SmallModals';

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
export const fmtInr = (r) => (Number.isFinite(r) ? inr.format(Math.round(r)) : '-');

export function emi(principal, ratePct, years) {
  const n = Math.round(years * 12);
  const r = ratePct / 1200;
  if (!(principal > 0) || !(n > 0)) return 0;
  if (r === 0) return principal / n;
  const f = (1 + r) ** n;
  return (principal * r * f) / (f - 1);
}

// Loan that a monthly EMI can service (present value of the EMI stream).
export function loanFor(monthly, ratePct, years) {
  const n = Math.round(years * 12);
  const r = ratePct / 1200;
  if (!(monthly > 0) || !(n > 0)) return 0;
  if (r === 0) return monthly * n;
  const f = (1 + r) ** n;
  return (monthly * (f - 1)) / (r * f);
}

// Yearly principal / interest split for the bar chart.
export function schedule(principal, ratePct, years) {
  const m = emi(principal, ratePct, years);
  const r = ratePct / 1200;
  let bal = principal;
  const out = [];
  for (let y = 1; y <= Math.round(years); y += 1) {
    let p = 0; let i = 0;
    for (let k = 0; k < 12 && bal > 0.5; k += 1) {
      const int = bal * r;
      const pr = Math.min(m - int, bal);
      i += int; p += pr; bal -= pr;
    }
    out.push({ year: y, principal: p, interest: i });
  }
  return out;
}

export function useDebounced(value, ms = 200) {
  const key = JSON.stringify(value);
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(JSON.parse(key)), ms); return () => clearTimeout(t); }, [key, ms]);
  return v;
}

// Fires `calculator_used` once per mount, the first time the user changes an
// input (never on the initial render). Returns a function to call from onChange.
export function useCalculatorUsed(calculator, source) {
  const fired = useRef(false);
  return useCallback(() => {
    if (fired.current) return;
    fired.current = true;
    track('calculator_used', { calculator, ...(source ? { source } : {}) });
  }, [calculator, source]);
}

// `t` is the caller's useT() (defaults to the current language at call time).
export function validateLoanInputs({ amount, rate, years }, { amountLabel, minAmount = 100000 } = {}, t = translateNow) {
  const e = {};
  if (amount !== undefined && !(Number(amount) >= minAmount && Number(amount) <= 5e9)) e.amount = t('account.calc.errAmount', { label: amountLabel || t('account.calc.loanAmount') });
  if (!(Number(rate) >= 1 && Number(rate) <= 20) || !/^\d+(\.\d{1,2})?$/.test(String(rate))) e.rate = t('account.calc.errRate');
  if (!(Number.isInteger(Number(years)) && Number(years) >= 1 && Number(years) <= 30)) e.years = t('account.calc.errYears');
  return e;
}

export function YearBars({ rows }) {
  const t = useT();
  if (!rows.length) return null;
  const max = Math.max(...rows.map((r) => r.principal + r.interest));
  return (
    <div>
      <div className="mb-2 flex gap-4 text-xs text-navy-500">
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-navy-800" />{t('account.calc.principal')}</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-gold-500" />{t('account.calc.interest')}</span>
      </div>
      <div className="flex h-36 items-end gap-0.5" role="img" aria-label={t('account.calc.barsAria')}>
        {rows.map((r) => (
          <div key={r.year} className="group relative flex h-full flex-1 flex-col justify-end" title={t('account.calc.barTitle', { year: r.year, principal: fmtInr(r.principal), interest: fmtInr(r.interest) })}>
            <div className="w-full rounded-t-sm bg-gold-500" style={{ height: `${(r.interest / max) * 100}%` }} />
            <div className="w-full bg-navy-800" style={{ height: `${(r.principal / max) * 100}%` }} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-navy-400"><span>{t('account.calc.year', { n: 1 })}</span><span>{t('account.calc.year', { n: rows.length })}</span></div>
    </div>
  );
}

export function ResultRow({ label, value, strong }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <span className="text-sm text-navy-500">{label}</span>
      <span className={cn('text-right', strong ? 'font-display text-xl font-semibold text-navy-900' : 'text-sm font-medium text-navy-900')}>{value}</span>
    </div>
  );
}

// Compact EMI block for the property page (loan prefilled at 80% of price).
export function EmiMini({ pricePaise, defaults }) {
  const t = useT();
  const used = useCalculatorUsed('emi', 'property');
  const price = Math.round((pricePaise || 0) / 100);
  const [amount, setAmount] = useState(String(Math.round((price * defaults.loanPercent) / 100)));
  const [rate, setRate] = useState(String(defaults.interestRate));
  const [years, setYears] = useState(String(defaults.tenureYears));
  const d = useDebounced({ amount, rate, years });
  const errors = validateLoanInputs(d, undefined, t);
  const result = useMemo(() => {
    if (Object.keys(errors).length) return null;
    const m = emi(Number(d.amount), Number(d.rate), Number(d.years));
    return { m, total: m * Number(d.years) * 12 };
  }, [d]); // eslint-disable-line react-hooks/exhaustive-deps
  const change = (setter) => (e) => { used(); setter(e.target.value); };
  return (
    <div className="grid gap-4 md:grid-cols-[1fr_240px]">
      <div className={cn('grid gap-3 sm:grid-cols-3', FORM_SKIN)}>
        <Input label={t('account.calc.loanAmountInr')} type="number" inputMode="numeric" value={amount} onChange={change(setAmount)} error={errors.amount} />
        <Input label={t('account.calc.interestPa')} type="number" step="0.01" value={rate} onChange={change(setRate)} error={errors.rate} />
        <Input label={t('account.calc.tenure')} type="number" value={years} onChange={change(setYears)} error={errors.years} />
      </div>
      <div className="relative overflow-hidden rounded-2xl bg-navy-950 p-5 text-white">
        <span className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gold-500/15 blur-2xl" aria-hidden />
        <p className="relative text-xs font-semibold uppercase tracking-[0.16em] text-gold-300">{t('account.calc.monthlyEmi')}</p>
        <p className="relative mt-1 font-display text-3xl font-semibold tracking-tight">{result ? fmtInr(result.m) : '-'}</p>
        {result && <p className="relative mt-1 text-xs text-navy-200">{t('account.calc.totalPayable', { amount: shortRupees(result.total * 100) })}</p>}
      </div>
    </div>
  );
}
