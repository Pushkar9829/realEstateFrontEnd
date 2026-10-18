// True while the media query matches (false where matchMedia is missing, e.g. tests).
import { useEffect, useState } from 'react';

const get = (q) => { try { return typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(q).matches : false; } catch { return false; } };

export default function useMediaQuery(query) {
  const [match, setMatch] = useState(() => get(query));
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const m = window.matchMedia(query);
    const on = () => setMatch(m.matches);
    on();
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, [query]);
  return match;
}
