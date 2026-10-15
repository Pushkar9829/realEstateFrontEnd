// RE-S-PUB-20 EMI and affordability calculators (RE-E-18). Calculations run
// in the browser; nothing is stored or sent. Defaults mirror calc.* settings.
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Calculator, Search, Wallet } from 'lucide-react';
import { Alert, Button, Card, Input, PageHeader, Tabs } from '@/shared/ui';
import { shortRupees } from '@/shared/lib/format';
import { PUBLIC_DEFAULTS } from '@/modules/search/api';
import { ResultRow, YearBars, emi, fmtInr, loanFor, schedule, useDebounced, validateLoanInputs } from '../../components/Calculators';

const D = PUBLIC_DEFAULTS.calc;

function EmiTab({ initialAmount }) {
  const [amount, setAmount] = useState(initialAmount ? String(Math.round((initialAmount * D.loanPercent) / 100)) : '5000000');
  const [rate, setRate] = useState(String(D.interestRate));
  const [years, setYears] = useState(String(D.tenureYears));
  const v = useDebounced({ amount, rate, years });
  const errors = validateLoanInputs(v);
  const out = useMemo(() => {
    if (Object.keys(validateLoanInputs(v)).length) return null;
    const P = Number(v.amount); const m = emi(P, Number(v.rate), Number(v.years));
    const total = m * Number(v.years) * 12;
    return { m, total, interest: total - P, rows: schedule(P, Number(v.rate), Number(v.years)) };
  }, [v]);
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <Card className="space-y-4">
        <Input label="Loan amount (₹)" required type="number" min="100000" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} error={errors.amount} hint={!errors.amount && Number(amount) > 0 ? shortRupees(Number(amount) * 100) : '₹1 lakh to ₹500 Cr'} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Interest rate (% per year)" required type="number" step="0.01" min="1" max="20" value={rate} onChange={(e) => setRate(e.target.value)} error={errors.rate} />
          <Input label="Tenure (years)" required type="number" min="1" max="30" value={years} onChange={(e) => setYears(e.target.value)} error={errors.years} />
        </div>
        {out && <YearBars rows={out.rows} />}
      </Card>
      <Card className="self-start">
        <p className="text-sm text-ink-subtle">Monthly EMI</p>
        <p className="text-3xl font-bold text-ink">{out ? fmtInr(out.m) : '-'}</p>
        <div className="mt-4 divide-y border-t">
          <ResultRow label="Principal" value={out ? fmtInr(Number(v.amount)) : '-'} />
          <ResultRow label="Total interest" value={out ? fmtInr(out.interest) : '-'} />
          <ResultRow label="Total payment" value={out ? fmtInr(out.total) : '-'} strong />
        </div>
      </Card>
    </div>
  );
}

function AffordTab({ price }) {
  const [income, setIncome] = useState('');
  const [existing, setExisting] = useState('0');
  const [rate, setRate] = useState(String(D.interestRate));
  const [years, setYears] = useState(String(D.tenureYears));
  const [down, setDown] = useState('');
  const v = useDebounced({ income, existing, rate, years, down });
  const errors = { ...validateLoanInputs({ rate: v.rate, years: v.years }) };
  if (v.income !== '' && !(Number(v.income) > 0)) errors.income = 'Enter your net monthly income';
  if (!(Number(v.existing) >= 0)) errors.existing = 'Enter 0 or more';
  if (v.down !== '' && !(Number(v.down) >= 0)) errors.down = 'Enter 0 or more';
  const ok = Number(v.income) > 0 && !Object.keys(errors).length;
  const maxEmi = ok ? (Number(v.income) * D.foirPercent) / 100 - Number(v.existing || 0) : 0;
  const maxLoan = ok && maxEmi > 0 ? loanFor(maxEmi, Number(v.rate), Number(v.years)) : 0;
  const downPay = v.down !== '' ? Number(v.down) : maxLoan / (1 - D.downPaymentPercent / 100) - maxLoan;
  const maxPrice = maxLoan + downPay;
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <Card className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="Net monthly income (₹)" required type="number" min="1" inputMode="numeric" value={income} onChange={(e) => setIncome(e.target.value)} error={errors.income} />
          <Input label="Existing monthly EMIs (₹)" type="number" min="0" inputMode="numeric" value={existing} onChange={(e) => setExisting(e.target.value)} error={errors.existing} />
          <Input label="Interest rate (% per year)" type="number" step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} error={errors.rate} />
          <Input label="Tenure (years)" type="number" value={years} onChange={(e) => setYears(e.target.value)} error={errors.years} />
        </div>
        <Input label="Own contribution / down payment (₹, optional)" type="number" min="0" inputMode="numeric" value={down} onChange={(e) => setDown(e.target.value)} error={errors.down} hint={`Leave empty to assume ${D.downPaymentPercent}% of the property price`} />
        {price > 0 && <p className="text-sm text-ink-muted">The property you were viewing costs <span className="font-semibold text-ink">{shortRupees(price * 100)}</span>.</p>}
      </Card>
      <Card className="self-start">
        <p className="text-sm text-ink-subtle">You could afford a home of about</p>
        <p className="text-3xl font-bold text-ink">{ok && maxLoan > 0 ? shortRupees(maxPrice * 100) : '-'}</p>
        {ok && maxEmi <= 0 && <Alert tone="warning" className="mt-3">Your existing EMIs already use {D.foirPercent}% of your income.</Alert>}
        {ok && price > 0 && maxLoan > 0 && <p className={maxPrice >= price ? 'mt-1 text-sm font-medium text-success-700' : 'mt-1 text-sm font-medium text-warning-700'}>{maxPrice >= price ? 'This property fits your budget.' : 'This property is above your estimated budget.'}</p>}
        <div className="mt-4 divide-y border-t">
          <ResultRow label={`Max EMI (${D.foirPercent}% of income less EMIs)`} value={ok && maxEmi > 0 ? fmtInr(maxEmi) : '-'} />
          <ResultRow label="Max loan" value={ok && maxLoan > 0 ? fmtInr(maxLoan) : '-'} />
          <ResultRow label="Down payment" value={ok && maxLoan > 0 ? fmtInr(downPay) : '-'} />
          <ResultRow label="Max property price" value={ok && maxLoan > 0 ? fmtInr(maxPrice) : '-'} strong />
        </div>
        {ok && maxLoan > 0 && <Button className="mt-4" block icon={Search} to={`/search?purpose=sale&maxPrice=${Math.round(maxPrice)}`}>Search homes in this budget</Button>}
      </Card>
    </div>
  );
}

export default function CalculatorsPage() {
  const [sp, setSp] = useSearchParams();
  const tab = sp.get('tab') === 'afford' ? 'afford' : 'emi';
  const price = Number(sp.get('price')) || 0;
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <PageHeader title="EMI and affordability calculators" description="Plan your home loan. Nothing you type here is stored or sent." />
      <Tabs className="mb-6" value={tab} onChange={(t) => setSp((prev) => { const n = new URLSearchParams(prev); n.set('tab', t); return n; }, { replace: true })}
        tabs={[{ value: 'emi', label: 'EMI calculator' }, { value: 'afford', label: 'Affordability' }]} />
      {tab === 'emi' ? <EmiTab initialAmount={price} /> : <AffordTab price={price} />}
      <p className="mt-6 flex items-center gap-2 text-xs text-ink-subtle">{tab === 'emi' ? <Calculator className="h-4 w-4" aria-hidden /> : <Wallet className="h-4 w-4" aria-hidden />}Indicative only. Actual eligibility depends on your lender.</p>
    </div>
  );
}
