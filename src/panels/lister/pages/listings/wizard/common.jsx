// Shared pieces for the listing wizard steps.
import { useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Alert, Button, useToast } from '@/shared/ui';
import { useSaveStep, WARNING_LABELS } from '@/modules/listings/api';

export const num = (v) => (v === '' || v == null || Number.isNaN(Number(v)) ? undefined : Number(v));
export const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== '' && !(typeof v === 'number' && Number.isNaN(v))));

// Saves one wizard step; maps 422 field errors and reports draft vs revision.
export function useStepSave(listing, step, { onSaved } = {}) {
  const save = useSaveStep(listing._id);
  const toast = useToast();
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [warnings, setWarnings] = useState([]);

  const run = async (body) => {
    setErrors({}); setFormError(null);
    try {
      const res = await save.mutateAsync({ step, body });
      setWarnings(res.warnings || []);
      if (res.applied === 'revision') toast.info('Saved as a change for review. The live listing stays as it is until approved.');
      else if (res.applied === 'live') toast.success('Price updated on the live listing');
      else if ((res.warnings || []).length) toast.info(res.warnings.map((w) => WARNING_LABELS[w] || w).join('. '), { title: 'Saved, please check', duration: 8000 });
      else toast.success('Saved');
      onSaved && onSaved(res);
      return res;
    } catch (e) {
      const fe = e.fieldErrors || {};
      setErrors(fe);
      if (!Object.keys(fe).length) setFormError(e.message);
      else setFormError('Please fix the highlighted fields.');
      return null;
    }
  };
  return { run, saving: save.isPending, errors, formError, warnings };
}

export function StepFooter({ onBack, onSave, saving, saveLabel = 'Save and continue', disabled }) {
  return (
    <div className="mt-8 flex items-center justify-between gap-3 border-t pt-5">
      {onBack ? <Button variant="ghost" icon={ArrowLeft} onClick={onBack}>Back</Button> : <span />}
      <Button iconRight={ArrowRight} loading={saving} onClick={onSave} disabled={disabled}>{saveLabel}</Button>
    </div>
  );
}

export function StepMessages({ formError, warnings }) {
  return (
    <>
      {formError && <Alert tone="danger" className="mb-4">{formError}</Alert>}
      {(warnings || []).length > 0 && (
        <Alert tone="warning" className="mb-4" title="Please check">
          <ul className="list-disc pl-4">{warnings.map((w) => <li key={w}>{WARNING_LABELS[w] || w}</li>)}</ul>
        </Alert>
      )}
    </>
  );
}

export function Segmented({ options, value, onChange, disabled }) {
  return (
    <div className="inline-flex flex-wrap rounded-lg border bg-surface-muted p-1" role="radiogroup">
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} disabled={disabled} onClick={() => onChange(o.value)}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${value === o.value ? 'bg-white text-brand-700 shadow-sm' : 'text-ink-muted hover:text-ink'}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
