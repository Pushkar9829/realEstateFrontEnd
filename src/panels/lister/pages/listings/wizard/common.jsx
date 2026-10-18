// Shared pieces for the listing wizard steps, including RE-A-16 autosave:
// a step that passes `value` (its form state) and `build` (value -> request
// body) to useStepSave is saved every 30 s while it differs from what was
// last saved, and reports "dirty" to the wizard shell for the unsaved guard.
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { Alert, Button, useToast } from '@/shared/ui';
import { useSaveStep, WARNING_LABELS } from '@/modules/listings/api';

export const num = (v) => (v === '' || v == null || Number.isNaN(Number(v)) ? undefined : Number(v));
export const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== '' && !(typeof v === 'number' && Number.isNaN(v))));

export const AUTOSAVE_MS = 30_000;

// Provided by WizardPage: { setDirty(bool), savedAt(date), autosaveError(msg|null), autosave: bool }.
export const WizardContext = createContext({ setDirty: () => {}, saved: () => {}, autosaveFailed: () => {}, autosave: false });

// Saves one wizard step; maps 422 field errors and reports draft vs revision.
export function useStepSave(listing, step, { onSaved, value, build } = {}) {
  const save = useSaveStep(listing._id);
  const toast = useToast();
  const wizard = useContext(WizardContext);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [warnings, setWarnings] = useState([]);
  const current = value === undefined ? null : JSON.stringify(value);
  const baseline = useRef(current);
  const [, setTick] = useState(0);
  const dirty = current !== null && current !== baseline.current;

  useEffect(() => { wizard.setDirty(dirty); }, [dirty]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => wizard.setDirty(false), []); // eslint-disable-line react-hooks/exhaustive-deps

  // setDirty(false) runs before onSaved navigates, so the unsaved guard does not fire; the next render re-reports.
  const markSaved = (snapshot) => { baseline.current = snapshot; wizard.setDirty(false); wizard.saved(new Date()); setTick((n) => n + 1); };

  // Quiet background save: no toast, no navigation, field errors stay hidden until a manual save.
  const autoRun = async () => {
    const body = build && build();
    if (!body) return;
    const snapshot = current;
    try {
      await save.mutateAsync({ step, body });
      markSaved(snapshot);
    } catch (e) {
      wizard.autosaveFailed(Object.keys(e.fieldErrors || {}).length ? 'Some fields need attention; save the step to see them' : e.message);
    }
  };
  const latest = useRef(null);
  latest.current = { dirty, autoRun, pending: save.isPending };
  useEffect(() => {
    if (!build || !wizard.autosave) return undefined;
    const t = setInterval(() => { const l = latest.current; if (l.dirty && !l.pending) l.autoRun(); }, AUTOSAVE_MS);
    return () => clearInterval(t);
  }, [Boolean(build), wizard.autosave]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (body) => {
    setErrors({}); setFormError(null);
    const snapshot = current;
    try {
      const res = await save.mutateAsync({ step, body });
      if (snapshot !== null) markSaved(snapshot);
      else wizard.saved(new Date());
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
  return { run, saving: save.isPending, errors, formError, warnings, dirty };
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
          className={`inline-flex items-center gap-1.5 rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${value === o.value ? 'bg-brand-600 text-white shadow-sm' : 'text-ink-muted hover:bg-white hover:text-ink'}`}>
          {value === o.value && <Check className="h-4 w-4" aria-hidden />}
          {o.label}
        </button>
      ))}
    </div>
  );
}
