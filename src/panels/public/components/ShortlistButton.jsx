// Heart toggle (RE-E-07). Guests go to login first; staff accounts do not see it.
import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { useToast } from '@/shared/ui';
import { useAuth } from '@/modules/auth';
import { useShortlist, useToggleShortlist } from '@/modules/search/api';
import { useT } from '@/shared/i18n';
import { track } from '@/shared/lib/analytics';

export function useCanShortlist() {
  const { isAuthed, user } = useAuth();
  return { isAuthed, allowed: !isAuthed || ['buyer', 'lister'].includes(user.role), enabled: isAuthed && ['buyer', 'lister'].includes(user.role) };
}

export function useShortlistIds() {
  const { enabled } = useCanShortlist();
  const q = useShortlist(enabled);
  return useMemo(() => new Set((q.data || []).map((x) => x.id)), [q.data]);
}

// listingNo / purpose / city are optional and only feed the shortlist_add analytics event.
export default function ShortlistButton({ id, className, label = false, listingNo, purpose, city }) {
  const t = useT();
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
      onSuccess: () => {
        toast.success(saved ? t('search.shortlist.removed') : t('search.shortlist.saved'));
        if (!saved) track('shortlist_add', { listingNo, purpose, city });
      },
      onError: (err) => toast.error(err.message),
    });
  };
  return (
    <button type="button" onClick={onClick} disabled={toggle.isPending} aria-pressed={saved} aria-label={saved ? t('search.shortlist.removeAria') : t('search.shortlist.saveAria')}
      className={cn('inline-flex items-center justify-center gap-1.5 rounded-full transition-colors disabled:opacity-60', label ? 'h-11 border border-navy-900/15 bg-white px-5 text-sm font-medium text-navy-900 hover:border-navy-900/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500' : 'h-9 w-9 bg-white/95 shadow-sm backdrop-blur hover:scale-105 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-500', className)}>
      <Heart className={cn('h-4 w-4', saved ? 'fill-danger-600 text-danger-600' : 'text-navy-600')} aria-hidden />
      {label && (saved ? t('search.shortlist.savedLabel') : t('search.shortlist.saveLabel'))}
    </button>
  );
}
