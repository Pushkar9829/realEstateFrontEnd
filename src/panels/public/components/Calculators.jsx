// RE-E-18 EMI and affordability calculators. Everything runs in the browser;
// nothing is stored or sent. EMI = P r (1+r)^n / ((1+r)^n - 1), monthly r.
import { useEffect, useMemo, useState } from 'react';
import { Input } from '@/shared/ui';
import { cn } from '@/shared/lib/cn';
import { shortRupees } from '@/shared/lib/format';

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

export function validateLoanInputs({ amount, rate, years }, { amountLabel = 'Loan amount', minAmount = 100000 } = {}) {
  const e = {};
  if (amount !== undefined && !(Number(amount) >= minAmount && Number(amount) <= 5e9)) e.amount = `${amountLabel} must be between ₹1,00,000 and ₹500 Cr`;
  if (!(Number(rate) >= 1 && Number(rate) <= 20) || !/^\d+(\.\d{1,2})?$/.test(String(rate))) e.rate = 'Rate between 1% and 20% (up to 2 decimals)';
  if (!(Number.isInteger(Number(years)) && Number(years) >= 1 && Number(years) <= 30)) e.years = 'Tenure between 1 and 30 years';
  return e;
}

export function YearBars({ rows }) {
  if (!rows.length) return null;
  const max = Math.max(...rows.map((r) => r.principal + r.interest));
  return (
    <div>
      <div className="mb-2 flex gap-4 text-xs text-ink-muted">
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-brand-600" />Principal</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-accent-500" />Interest</span>
      </div>
      <div className="flex h-36 items-end gap-0.5" role="img" aria-label="Principal and interest paid each year">
        {rows.map((r) => (
          <div key={r.year} className="group relative flex h-full flex-1 flex-col justify-end" title={`Year ${r.year}: principal ${fmtInr(r.principal)}, interest ${fmtInr(r.interest)}`}>
            <div className="w-full rounded-t-sm bg-accent-500" style={{ height: `${(r.interest / max) * 100}%` }} />
            <div className="w-full bg-brand-600" style={{ height: `${(r.principal / max) * 100}%` }} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-ink-subtle"><span>Year 1</span><span>Year {rows.length}</span></div>
    </div>
  );
}

export function ResultRow({ label, value, strong }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <span className="text-sm text-ink-muted">{label}</span>
      <span className={cn('text-right', strong ? 'text-xl font-semibold text-ink' : 'text-sm font-medium text-ink')}>{value}</span>
    </div>
  );
}

// Compact EMI block for the property page (loan prefilled at 80% of price).
export function EmiMini({ pricePaise, defaults }) {
  const price = Math.round((pricePaise || 0) / 100);
  const [amount, setAmount] = useState(String(Math.round((price * defaults.loanPercent) / 100)));
  const [rate, setRate] = useState(String(defaults.interestRate));
  const [years, setYears] = useState(String(defaults.tenureYears));
  const d = useDebounced({ amount, rate, years });
  const errors = validateLoanInputs(d);
  const result = useMemo(() => {
    if (Object.keys(errors).length) return null;
    const m = emi(Number(d.amount), Number(d.rate), Number(d.years));
    return { m, total: m * Number(d.years) * 12 };
  }, [d]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="grid gap-4 sm:grid-cols-[1fr_220px]">
      <div className="grid gap-3 sm:grid-cols-3">
        <Input label="Loan amount (₹)" type="number" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} error={errors.amount} />
        <Input label="Interest (% p.a.)" type="number" step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} error={errors.rate} />
        <Input label="Tenure (years)" type="number" value={years} onChange={(e) => setYears(e.target.value)} error={errors.years} />
      </div>
      <div className="rounded-lg bg-brand-50 p-4">
        <p className="text-xs text-brand-700">Monthly EMI</p>
        <p className="text-2xl font-semibold text-ink">{result ? fmtInr(result.m) : '-'}</p>
        {result && <p className="mt-1 text-xs text-ink-muted">Total payable {shortRupees(result.total * 100)}</p>}
      </div>
    </div>
  );
}
