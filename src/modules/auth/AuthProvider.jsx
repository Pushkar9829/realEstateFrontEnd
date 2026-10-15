// Session state for the whole app: who is signed in, and the login,
// verification and logout actions. Server data stays in TanStack Query; this
// context only tracks the signed-in user.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { session } from '@/shared/lib/session';
import { refreshSession } from '@/shared/lib/api';
import { authApi, authKeys } from './api';

const AuthContext = createContext(null);

export const HOME = { buyer: '/', lister: '/lister', agent: '/agent', manager: '/agent', admin: '/admin', superadmin: '/admin' };
export const STAFF = ['agent', 'manager', 'admin', 'superadmin'];

export function AuthProvider({ children }) {
  const qc = useQueryClient();
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | guest | authed

  const loadMe = useCallback(async () => {
    const me = await authApi.me();
    qc.setQueryData(authKeys.me, me);
    setUser(me);
    setStatus('authed');
    return me;
  }, [qc]);

  // Resume a session after a reload using the stored refresh token.
  useEffect(() => {
    let alive = true;
    if (!session.getRefresh()) { setStatus('guest'); return undefined; }
    refreshSession().then(loadMe).catch(() => { if (alive) setStatus('guest'); });
    return () => { alive = false; };
  }, [loadMe]);

  // Any forced sign-out (refresh failed, token reuse) resets the app state.
  useEffect(() => session.onClear(() => {
    setUser(null);
    setStatus('guest');
    qc.clear();
  }), [qc]);

  // Called with the API's session payload: { accessToken, refreshToken, user, home, mustChangePassword }.
  const startSession = useCallback(async (payload) => {
    session.set(payload);
    const me = await loadMe();
    return { ...payload, user: me, home: payload.home || HOME[me.role] };
  }, [loadMe]);

  const logout = useCallback(async () => {
    try { await authApi.logout(session.getRefresh()); } catch { /* already signed out */ }
    session.clear('logout');
  }, []);

  const value = useMemo(() => ({
    user, status, isAuthed: status === 'authed',
    startSession, logout, refreshUser: loadMe,
    home: user ? HOME[user.role] : '/',
    hasPermission: (key) => Boolean(user && (user.role === 'superadmin' || (user.permissions || []).includes(key))),
  }), [user, status, startSession, logout, loadMe]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
