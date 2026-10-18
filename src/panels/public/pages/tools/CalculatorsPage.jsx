// RE-S-PUB-20 EMI and affordability calculators (RE-E-18). Calculations run
// in the browser; nothing is stored or sent. Defaults mirror calc.* settings.
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Calculator, Search, Wallet } from 'lucide-react';

const CARD = `space-y-5 rounded-3xl bg-white p-6 shadow-card ring-1 ring-navy-900/5 sm:p-8 ${FORM_SKIN} [&_.bg-brand-600]:bg-navy-800 [&_.bg-accent-500]:bg-gold-400`;
const RESULT = 'self-start rounded-3xl bg-white p-6 shadow-lift ring-1 ring-navy-900/5 sm:p-8 lg:sticky lg:top-24';
const FIGURE = 'mt-2 font-display text-4xl font-semibold tracking-tight text-navy-900 sm:text-5xl';
const LABEL = 'text-xs font-semibold uppercase tracking-[0.16em] text-gold-700';
const ROWS = 'mt-6 divide-y divide-navy-900/5 border-t border-navy-900/5';
import { Alert, Button, Input } from '@/shared/ui';
import { shortRupees } from '@/shared/lib/format';
import { useT } from '@/shared/i18n';
import useDocumentMeta from '@/shared/hooks/useDocumentMeta';
import { PUBLIC_DEFAULTS } from '@/modules/search/api';
import { FORM_SKIN, PageBand, Segmented } from '../../components/States';
import { ResultRow, YearBars, emi, fmtInr, loanFor, schedule, useCalculatorUsed, useDebounced, validateLoanInputs } from '../../components/Calculators';

const D = PUBLIC_DEFAULTS.calc;

function EmiTab({ initialAmount }) {
  const t = useT();
  const used = useCalculatorUsed('emi');
  const [amount, setAmount] = useState(initialAmount ? String(Math.round((initialAmount * D.loanPercent) / 100)) : '5000000');
  const [rate, setRate] = useState(String(D.interestRate));
  const [years, setYears] = useState(String(D.tenureYears));
  const v = useDebounced({ amount, rate, years });
  const errors = validateLoanInputs(v, undefined, t);
  const out = useMemo(() => {
    if (Object.keys(validateLoanInputs(v)).length) return null;
    const P = Number(v.amount); const m = emi(P, Number(v.rate), Number(v.years));
    const total = m * Number(v.years) * 12;
    return { m, total, interest: total - P, rows: schedule(P, Number(v.rate), Number(v.years)) };
  }, [v]);
  const change = (setter) => (e) => { used(); setter(e.target.value); };
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_400px]">
      <div className={CARD}>
        <Input label={t('account.calc.loanAmountInr')} required type="number" min="100000" inputMode="numeric" value={amount} onChange={change(setAmount)} error={errors.amount} hint={!errors.amount && Number(amount) > 0 ? shortRupees(Number(amount) * 100) : t('account.calc.amountHint')} />
        <div className="grid grid-cols-2 gap-3">
          <Input label={t('account.calc.rateYear')} required type="number" step="0.01" min="1" max="20" value={rate} onChange={change(setRate)} error={errors.rate} />
          <Input label={t('account.calc.tenure')} required type="number" min="1" max="30" value={years} onChange={change(setYears)} error={errors.years} />
        </div>
        {out && <YearBars rows={out.rows} />}
      </div>
      <div className={RESULT}>
        <p className={LABEL}>{t('account.calc.monthlyEmi')}</p>
        <p className={FIGURE}>{out ? fmtInr(out.m) : '-'}</p>
        <div className={ROWS}>
          <ResultRow label={t('account.calc.principal')} value={out ? fmtInr(Number(v.amount)) : '-'} />
          <ResultRow label={t('account.calc.totalInterest')} value={out ? fmtInr(out.interest) : '-'} />
          <ResultRow label={t('account.calc.totalPayment')} value={out ? fmtInr(out.total) : '-'} strong />
        </div>
      </div>
    </div>
  );
}

function AffordTab({ price }) {
  const t = useT();
  const used = useCalculatorUsed('affordability');
  const [income, setIncome] = useState('');
  const [existing, setExisting] = useState('0');
  const [rate, setRate] = useState(String(D.interestRate));
  const [years, setYears] = useState(String(D.tenureYears));
  const [down, setDown] = useState('');
  const v = useDebounced({ income, existing, rate, years, down });
  const errors = { ...validateLoanInputs({ rate: v.rate, years: v.years }, undefined, t) };
  if (v.income !== '' && !(Number(v.income) > 0)) errors.income = t('account.calc.errIncome');
  if (!(Number(v.existing) >= 0)) errors.existing = t('account.calc.errZero');
  if (v.down !== '' && !(Number(v.down) >= 0)) errors.down = t('account.calc.errZero');
  const ok = Number(v.income) > 0 && !Object.keys(errors).length;
  const maxEmi = ok ? (Number(v.income) * D.foirPercent) / 100 - Number(v.existing || 0) : 0;
  const maxLoan = ok && maxEmi > 0 ? loanFor(maxEmi, Number(v.rate), Number(v.years)) : 0;
  const downPay = v.down !== '' ? Number(v.down) : maxLoan / (1 - D.downPaymentPercent / 100) - maxLoan;
  const maxPrice = maxLoan + downPay;
  const change = (setter) => (e) => { used(); setter(e.target.value); };
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_400px]">
      <div className={CARD}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label={t('account.calc.income')} required type="number" min="1" inputMode="numeric" value={income} onChange={change(setIncome)} error={errors.income} />
          <Input label={t('account.calc.existing')} type="number" min="0" inputMode="numeric" value={existing} onChange={change(setExisting)} error={errors.existing} />
          <Input label={t('account.calc.rateYear')} type="number" step="0.01" value={rate} onChange={change(setRate)} error={errors.rate} />
          <Input label={t('account.calc.tenure')} type="number" value={years} onChange={change(setYears)} error={errors.years} />
        </div>
        <Input label={t('account.calc.down')} type="number" min="0" inputMode="numeric" value={down} onChange={change(setDown)} error={errors.down} hint={t('account.calc.downHint', { pct: D.downPaymentPercent })} />
        {price > 0 && <p className="text-sm text-navy-500">{t('account.calc.viewingBefore')}<span className="font-semibold text-navy-900">{shortRupees(price * 100)}</span>{t('account.calc.viewingAfter')}</p>}
      </div>
      <div className={RESULT}>
        <p className={LABEL}>{t('account.calc.afford')}</p>
        <p className={FIGURE}>{ok && maxLoan > 0 ? shortRupees(maxPrice * 100) : '-'}</p>
        {ok && maxEmi <= 0 && <Alert tone="warning" className="mt-3">{t('account.calc.foirUsed', { pct: D.foirPercent })}</Alert>}
        {ok && price > 0 && maxLoan > 0 && <p className={maxPrice >= price ? 'mt-1 text-sm font-medium text-success-700' : 'mt-1 text-sm font-medium text-warning-700'}>{maxPrice >= price ? t('account.calc.fits') : t('account.calc.above')}</p>}
        <div className={ROWS}>
          <ResultRow label={t('account.calc.maxEmi', { pct: D.foirPercent })} value={ok && maxEmi > 0 ? fmtInr(maxEmi) : '-'} />
          <ResultRow label={t('account.calc.maxLoan')} value={ok && maxLoan > 0 ? fmtInr(maxLoan) : '-'} />
          <ResultRow label={t('account.calc.downPayment')} value={ok && maxLoan > 0 ? fmtInr(downPay) : '-'} />
          <ResultRow label={t('account.calc.maxPrice')} value={ok && maxLoan > 0 ? fmtInr(maxPrice) : '-'} strong />
        </div>
        {ok && maxLoan > 0 && <Button variant="gold" size="lg" className="mt-6 rounded-full" block icon={Search} to={`/search?purpose=sale&maxPrice=${Math.round(maxPrice)}`}>{t('account.calc.searchBudget')}</Button>}
      </div>
    </div>
  );
}

export default function CalculatorsPage() {
  const t = useT();
  const [sp, setSp] = useSearchParams();
  const tab = sp.get('tab') === 'afford' ? 'afford' : 'emi';
  const price = Number(sp.get('price')) || 0;
  useDocumentMeta({ title: t('account.meta.calcTitle'), description: t('account.meta.calcDesc'), path: '/tools/calculators' });
  const setTab = (next) => setSp((prev) => { const n = new URLSearchParams(prev); n.set('tab', next); return n; }, { replace: true });
  return (
    <>
      <PageBand image="kitchen-wood" crumbsLabel={t('home.place.breadcrumbAria')}
        crumbs={[{ to: '/', label: t('home.place.home') }, { label: t('account.calc.title') }]}
        eyebrow={t('discover.calc.eyebrow')} title={t('account.calc.title')} text={t('account.calc.description')}
        actions={<Segmented dark value={tab} onChange={setTab} options={[{ value: 'emi', label: t('account.calc.tabEmi'), icon: Calculator }, { value: 'afford', label: t('account.calc.tabAfford'), icon: Wallet }]} />}
        stats={[
          { label: t('discover.calc.rate'), value: `${D.interestRate}%` },
          { label: t('discover.calc.tenure'), value: t('discover.calc.tenureValue', { n: D.tenureYears }) },
          { label: t('discover.calc.loan'), value: `${D.loanPercent}%` },
        ]} />
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:py-16">
        {tab === 'emi' ? <EmiTab initialAmount={price} /> : <AffordTab price={price} />}
        <p className="mt-8 flex items-center gap-2 text-xs text-navy-500">{tab === 'emi' ? <Calculator className="h-4 w-4 text-gold-700" aria-hidden /> : <Wallet className="h-4 w-4 text-gold-700" aria-hidden />}{t('account.calc.disclaimer')}</p>
      </div>
    </>
  );
}
