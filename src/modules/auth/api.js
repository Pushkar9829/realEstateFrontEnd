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
  // RE-M-10 data rights
  consents: () => api.get('/me/consents'),
  withdrawConsent: (purpose) => api.post(`/me/consents/${purpose}/withdraw`),
  dataExport: () => api.get('/me/data-export'),
  startDataExport: () => api.post('/me/data-export'),
  deletionRequest: () => api.get('/me/deletion-request'),
  requestDeletion: (body) => api.post('/me/deletion-request', body),
};

export const authKeys = {
  me: ['auth', 'me'],
  sessions: ['auth', 'sessions'],
  history: ['auth', 'history'],
  consents: ['auth', 'consents'],
  dataExport: ['auth', 'data-export'],
  deletion: ['auth', 'deletion-request'],
};

export const useSessions = () => useQuery({ queryKey: authKeys.sessions, queryFn: authApi.sessions });
export const useLoginHistory = () => useQuery({ queryKey: authKeys.history, queryFn: authApi.loginHistory });

export function useUpdateMe() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: authApi.updateMe, onSuccess: () => qc.invalidateQueries({ queryKey: authKeys.me }) });
}

// ---------------------------------------------------------------- RE-M-10 privacy and data rights

export const useConsents = () => useQuery({ queryKey: authKeys.consents, queryFn: authApi.consents });
export function useWithdrawConsent() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: authApi.withdrawConsent, onSuccess: () => qc.invalidateQueries({ queryKey: authKeys.consents }) });
}

// Latest "download my data" job; polls every 4 s while it is queued or running.
export const useDataExport = () => useQuery({
  queryKey: authKeys.dataExport, queryFn: authApi.dataExport,
  refetchInterval: (q) => (q.state.data && ['queued', 'running'].includes(q.state.data.status) ? 4000 : false),
});
export function useStartDataExport() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: authApi.startDataExport, onSettled: () => qc.invalidateQueries({ queryKey: authKeys.dataExport }) });
}

// Buyers and listers only (the endpoint answers 403 for staff).
export const useMyDeletionRequest = ({ enabled = true } = {}) => useQuery({ queryKey: authKeys.deletion, queryFn: authApi.deletionRequest, enabled, retry: false });
export function useRequestDeletion() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: authApi.requestDeletion, onSuccess: () => qc.invalidateQueries({ queryKey: authKeys.deletion }) });
}
