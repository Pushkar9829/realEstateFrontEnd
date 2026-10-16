import { forwardRef } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/shared/lib/cn';
import Spinner from './Spinner';

const VARIANTS = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 focus-visible:outline-brand-600',
  secondary: 'bg-white text-ink border border-line-strong hover:bg-surface-muted focus-visible:outline-brand-600',
  accent: 'bg-accent-500 text-ink hover:bg-accent-600 focus-visible:outline-accent-600',
  ghost: 'text-ink-muted hover:bg-surface-sunken hover:text-ink focus-visible:outline-brand-600',
  danger: 'bg-danger-600 text-white hover:bg-danger-700 focus-visible:outline-danger-600',
  // Public marketing site (navy + gold design language).
  gold: 'bg-gold-500 text-navy-950 hover:bg-gold-400 focus-visible:outline-gold-500 shadow-sm',
  navy: 'bg-navy-900 text-white hover:bg-navy-800 focus-visible:outline-navy-900',
  outline: 'border border-navy-900/15 bg-white/70 text-navy-900 hover:border-navy-900/40 hover:bg-white focus-visible:outline-navy-900',
  glass: 'border border-white/25 bg-white/10 text-white backdrop-blur hover:bg-white/20 focus-visible:outline-white',
  link: 'text-brand-600 hover:text-brand-700 underline-offset-4 hover:underline px-0',
};
const SIZES = { sm: 'h-8 px-3 text-sm gap-1.5', md: 'h-10 px-4 text-sm gap-2', lg: 'h-12 px-5 text-base gap-2', xl: 'h-14 px-7 text-base gap-2' };

/**
 * Button variants: primary | secondary | accent | ghost | danger | link, and for the
 * public site gold | navy | outline | glass.
 * Pass `to` to render a router link styled as a button.
 */
const Button = forwardRef(function Button({ variant = 'primary', size = 'md', loading = false, disabled, icon: Icon, iconRight: IconRight, block, to, className, children, type = 'button', ...rest }, ref) {
  // A rounded-* class passed in replaces the default radius (cn does not merge Tailwind conflicts).
  const ownRadius = /(^|\s)!?rounded(-|\s|$)/.test(className || '');
  const classes = cn(
    'inline-flex shrink-0 items-center justify-center whitespace-nowrap font-medium transition-colors', !ownRadius && 'rounded-md',
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
    'disabled:cursor-not-allowed disabled:opacity-50',
    VARIANTS[variant], variant !== 'link' && SIZES[size], block && 'w-full', className,
  );
  const content = (
    <>
      {loading ? <Spinner size="sm" className="text-current" /> : Icon && <Icon className="h-4 w-4 shrink-0" aria-hidden />}
      {children}
      {IconRight && !loading && <IconRight className="h-4 w-4 shrink-0" aria-hidden />}
    </>
  );
  if (to) return <Link ref={ref} to={to} className={classes} {...rest}>{content}</Link>;
  return (
    <button ref={ref} type={type} className={classes} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {content}
    </button>
  );
});

export default Button;
