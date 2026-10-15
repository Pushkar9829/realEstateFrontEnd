import { useRef } from 'react';
import { cn } from '@/shared/lib/cn';

// Six single-digit boxes; paste of a full code fills all boxes. With autoSubmit
// the surrounding form submits as soon as the last digit is entered.
export default function OtpInput({ value = '', onChange, length = 6, error, autoFocus, disabled, autoSubmit = false, label = 'Verification code' }) {
  const refs = useRef([]);
  const digits = Array.from({ length }, (_, i) => value[i] || '');

  const submitIfComplete = (code, el) => {
    if (autoSubmit && code.length === length && el && el.form) setTimeout(() => el.form.requestSubmit(), 0);
  };

  const set = (i, d, el) => {
    const next = digits.slice();
    next[i] = d;
    const code = next.join('').slice(0, length);
    onChange(code);
    submitIfComplete(code, el);
  };

  const onKey = (i, e) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) refs.current[i - 1].focus();
    if (e.key === 'ArrowLeft' && i > 0) refs.current[i - 1].focus();
    if (e.key === 'ArrowRight' && i < length - 1) refs.current[i + 1].focus();
  };

  const onInput = (i, e) => {
    const v = e.target.value.replace(/\D/g, '');
    if (v.length > 1) {
      onChange(v.slice(0, length));
      refs.current[Math.min(v.length, length) - 1]?.focus();
      submitIfComplete(v.slice(0, length), e.target);
      return;
    }
    set(i, v, e.target);
    if (v && i < length - 1) refs.current[i + 1].focus();
  };

  return (
    <div>
      <div className="flex gap-2" role="group" aria-label={label}>
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => { refs.current[i] = el; }}
            value={d}
            onChange={(e) => onInput(i, e)}
            onKeyDown={(e) => onKey(i, e)}
            onFocus={(e) => e.target.select()}
            inputMode="numeric"
            autoComplete={i === 0 ? 'one-time-code' : 'off'}
            maxLength={length}
            autoFocus={autoFocus && i === 0}
            disabled={disabled}
            aria-label={`Digit ${i + 1}`}
            className={cn('h-12 w-11 rounded-md border bg-white text-center text-lg font-semibold text-ink shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30',
              error ? 'border-danger-600' : 'border-line-strong focus:border-brand-500')}
          />
        ))}
      </div>
      {error && <p className="mt-1.5 text-xs text-danger-600">{error}</p>}
    </div>
  );
}
