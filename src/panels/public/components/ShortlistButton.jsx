// Heart toggle (RE-E-07). Guests go to login first; staff accounts do not see it.
import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { useToast } from '@/shared/ui';
import { useAuth } from '@/modules/auth';
import { useShortlist, useToggleShortlist } from '@/modules/search/api';

export function useCanShortlist() {
  const { isAuthed, user } = useAuth();
  return { isAuthed, allowed: !isAuthed || ['buyer', 'lister'].includes(user.role), enabled: isAuthed && ['buyer', 'lister'].includes(user.role) };
}

export function useShortlistIds() {
  const { enabled } = useCanShortlist();
  const q = useShortlist(enabled);
  return useMemo(() => new Set((q.data || []).map((x) => x.id)), [q.data]);
}

export default function ShortlistButton({ id, className, label = false }) {
  const { isAuthed, allowed } = useCanShortlist();
  const ids = useShortlistIds();
  const toggle = useToggleShortlist();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  if (!allowed) return null;
  const saved = ids.has(id);
  const onClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isAuthed) { navigate('/login', { state: { from: location.pathname + location.search } }); return; }
    toggle.mutate({ id, saved }, {
      onSuccess: () => toast.success(saved ? 'Removed from your shortlist' : 'Saved to your shortlist'),
      onError: (err) => toast.error(err.message),
    });
  };
  return (
    <button type="button" onClick={onClick} disabled={toggle.isPending} aria-pressed={saved} aria-label={saved ? 'Remove from shortlist' : 'Save to shortlist'}
      className={cn('inline-flex items-center justify-center gap-1.5 rounded-full transition-colors disabled:opacity-60', label ? 'h-10 border border-line-strong bg-white px-4 text-sm font-medium text-ink hover:bg-surface-muted' : 'h-9 w-9 bg-white/95 shadow-sm hover:bg-white', className)}>
      <Heart className={cn('h-4 w-4', saved ? 'fill-danger-600 text-danger-600' : 'text-ink-muted')} aria-hidden />
      {label && (saved ? 'Saved' : 'Save')}
    </button>
  );
}
