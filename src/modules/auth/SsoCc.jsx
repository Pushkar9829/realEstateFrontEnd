// /sso/cc - single sign-on hand-off from the Control Center (CC_CONTRACT.md 7.4).
// Posts the one-time assertion, stores the normal session, remembers the
// Control Center context for the Control bar and opens the requested page.
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import env from '@/config/env';
import { controlCenter, readAssertion, safePath } from '@/shared/lib/controlCenter';
import { useAuth } from './AuthProvider';

const MESSAGES = {
  SSO_REPLAYED: 'This sign-in link was already used. Open the platform again from the Control Center.',
  SSO_INVALID: 'The sign-in link is not valid or has expired (links last 60 seconds). Open the platform again from the Control Center.',
  SSO_ROLE_DENIED: 'Your Control Center role cannot open this admin.',
  SSO_UNAVAILABLE: 'The Control Center could not be reached to check the sign-in. Try again in a moment.',
  ACCOUNT_INACTIVE: 'Your linked account on this platform is disabled.',
  ROUTE_NOT_FOUND: 'Single sign-on from the Control Center is not switched on for this platform.',
};

export default function SsoCc() {
  const location = useLocation();
  const navigate = useNavigate();
  const { startSession } = useAuth();
  const [error, setError] = useState(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return; // the assertion is single use: never post it twice (StrictMode)
    started.current = true;
    const assertion = readAssertion(location);
    if (!assertion) { setError(MESSAGES.SSO_INVALID); return; }
    (async () => {
      try {
        const res = await fetch(`${env.apiUrl}/auth/cc-sso`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ assertion }) });
        const body = await res.json().catch(() => ({}));
        if (!res.ok || !body.success) {
          const code = body.error && body.error.code;
          setError(MESSAGES[code] || (body.error && body.error.message) || 'Sign-in failed.');
          return;
        }
        const { cc, ...payload } = body.data;
        controlCenter.set({ ...(cc.ctx || {}), ccUser: cc.ccUser, via: 'control-center' });
        await startSession(payload);
        navigate(safePath(cc.path, '/admin'), { replace: true });
      } catch {
        setError('The platform could not be reached. Try again in a moment.');
      }
    })();
  }, [location, navigate, startSession]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0B1220] px-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 text-center shadow-xl">
        {error ? (
          <>
            <ShieldAlert className="mx-auto h-8 w-8 text-red-600" aria-hidden />
            <h1 className="mt-3 text-lg font-semibold text-gray-900">Could not sign you in</h1>
            <p className="mt-1 text-sm text-gray-600" role="alert">{error}</p>
            <Link to="/login" className="mt-4 inline-block text-sm font-medium text-blue-700 hover:underline">Sign in with your own account instead</Link>
          </>
        ) : (
          <>
            <span className="mx-auto block h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-blue-600" aria-hidden />
            <p className="mt-3 text-sm text-gray-600" role="status">Signing you in from the Control Center...</p>
          </>
        )}
      </div>
    </div>
  );
}
