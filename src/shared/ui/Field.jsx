import { forwardRef, useId, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import DateInput from './DateInput';

// Label + control + hint/error. Every form control goes through this so
// labels, error text and aria wiring are identical everywhere.
export function Field({ label, hint, error, required, children, className, id }) {
  const auto = useId();
  const fieldId = id || auto;
  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <label htmlFor={fieldId} className="block text-sm font-medium text-ink">
          {label}{required && <span className="text-danger-600"> *</span>}
        </label>
      )}
      {children({ id: fieldId, 'aria-invalid': error ? true : undefined, 'aria-describedby': error || hint ? `${fieldId}-msg` : undefined })}
      {(error || hint) && (
        <p id={`${fieldId}-msg`} className={cn('text-xs', error ? 'text-danger-600' : 'text-ink-subtle')}>{error || hint}</p>
      )}
    </div>
  );
}

const control = 'block w-full rounded-md border bg-white px-3 text-sm text-ink placeholder:text-ink-subtle shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500/30 disabled:bg-surface-sunken disabled:text-ink-subtle';
const state = (error) => (error ? 'border-danger-600 focus:border-danger-600' : 'border-line-strong focus:border-brand-500');

export const Input = forwardRef(function Input({ label, hint, error, required, className, inputClassName, leading, ...rest }, ref) {
  return (
    <Field label={label} hint={hint} error={error} required={required} className={className} id={rest.id}>
      {(a) => (
        <div className="relative">
          {leading && <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-ink-subtle">{leading}</span>}
          {rest.type === 'date' && rest.value !== undefined
            ? <DateInput ref={ref} className={cn(control, 'h-10', state(error), inputClassName)} required={required} {...a} {...rest} />
            : <input ref={ref} className={cn(control, 'h-10', state(error), leading && 'pl-10', inputClassName)} required={required} {...a} {...rest} />}
        </div>
      )}
    </Field>
  );
});

export const PasswordInput = forwardRef(function PasswordInput({ label = 'Password', hint, error, required, className, ...rest }, ref) {
  const [show, setShow] = useState(false);
  return (
    <Field label={label} hint={hint} error={error} required={required} className={className}>
      {(a) => (
        <div className="relative">
          <input ref={ref} type={show ? 'text' : 'password'} className={cn(control, 'h-10 pr-10', state(error))} required={required} {...a} {...rest} />
          <button type="button" onClick={() => setShow((s) => !s)} className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-ink-subtle hover:text-ink" aria-label={show ? 'Hide password' : 'Show password'}>
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      )}
    </Field>
  );
});

export const Select = forwardRef(function Select({ label, hint, error, required, options = [], placeholder, className, ...rest }, ref) {
  return (
    <Field label={label} hint={hint} error={error} required={required} className={className}>
      {(a) => (
        <select ref={ref} className={cn(control, 'h-10 pr-8', state(error))} required={required} {...a} {...rest}>
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      )}
    </Field>
  );
});

export const Textarea = forwardRef(function Textarea({ label, hint, error, required, className, rows = 4, ...rest }, ref) {
  return (
    <Field label={label} hint={hint} error={error} required={required} className={className}>
      {(a) => <textarea ref={ref} rows={rows} className={cn(control, 'py-2', state(error))} required={required} {...a} {...rest} />}
    </Field>
  );
});

export const Checkbox = forwardRef(function Checkbox({ label, description, error, className, ...rest }, ref) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="flex cursor-pointer items-start gap-3">
        <input ref={ref} id={id} type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 rounded border-line-strong text-brand-600 focus:ring-brand-500" aria-invalid={error ? true : undefined} {...rest} />
        <span className="text-sm">
          <span className="text-ink">{label}</span>
          {description && <span className="block text-ink-subtle">{description}</span>}
        </span>
      </label>
      {error && <p className="mt-1 pl-7 text-xs text-danger-600">{error}</p>}
    </div>
  );
});
