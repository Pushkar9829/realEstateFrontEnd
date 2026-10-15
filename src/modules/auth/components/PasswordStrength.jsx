import { cn } from '@/shared/lib/cn';

// Guidance only; the API enforces the real rule (8-64 chars, a letter and a digit).
export function scorePassword(pw = '') {
  let s = 0;
  if (pw.length >= 8) s += 1;
  if (pw.length >= 12) s += 1;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s += 1;
  if (/\d/.test(pw)) s += 1;
  if (/[^A-Za-z0-9]/.test(pw)) s += 1;
  return Math.min(4, s);
}

const LEVELS = [
  ['Too short', 'bg-danger-600'],
  ['Weak', 'bg-danger-600'],
  ['Fair', 'bg-warning-600'],
  ['Good', 'bg-success-600'],
  ['Strong', 'bg-success-700'],
];

export default function PasswordStrength({ value }) {
  if (!value) return null;
  const score = value.length < 8 ? 0 : scorePassword(value);
  const [label, color] = LEVELS[score];
  return (
    <div className="mt-1.5" aria-live="polite">
      <div className="flex gap-1" aria-hidden>
        {[1, 2, 3, 4].map((i) => <span key={i} className={cn('h-1.5 flex-1 rounded-full', i <= score ? color : 'bg-surface-sunken')} />)}
      </div>
      <p className="mt-1 text-xs text-ink-subtle">Password strength: <span className="font-medium text-ink">{label}</span></p>
    </div>
  );
}
