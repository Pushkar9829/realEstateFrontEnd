// Module M - Authentication & Account Security: API calls and query hooks.
// Endpoints: backend/src/modules/auth/routes/public.routes.js
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/shared/lib/api';

export const authApi = {
  register: (body) => api.post('/auth/register', body),
  verifyContact: (body) => api.post('/auth/verify-contact', body),
  login: (body) => api.post('/auth/login', body),
  verify2fa: (body) => api.post('/auth/login/verify-2fa', body),
  resendOtp: (body) => api.post('/auth/otp/resend', body),
  logout: (refreshToken) => api.post('/auth/logout', refreshToken ? { refreshToken } : {}),
  logoutAll: () => api.post('/auth/logout-all'),
  forgot: (body) => api.post('/auth/password/forgot', body),
  reset: (body) => api.post('/auth/password/reset', body),
  me: () => api.get('/me'),
  updateMe: (body) => api.patch('/me', body),
  changePassword: (body) => api.patch('/me/password', body),
  totpSetup: () => api.post('/me/totp/setup'),
  totpEnable: (body) => api.post('/me/totp/enable', body),
  totpDisable: (body) => api.del('/me/totp', body),
  sessions: () => api.get('/me/sessions'),
  loginHistory: () => api.get('/me/login-history'),
};

export const authKeys = {
  me: ['auth', 'me'],
  sessions: ['auth', 'sessions'],
  history: ['auth', 'history'],
};

export const useSessions = () => useQuery({ queryKey: authKeys.sessions, queryFn: authApi.sessions });
export const useLoginHistory = () => useQuery({ queryKey: authKeys.history, queryFn: authApi.loginHistory });

export function useUpdateMe() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: authApi.updateMe, onSuccess: () => qc.invalidateQueries({ queryKey: authKeys.me }) });
}
