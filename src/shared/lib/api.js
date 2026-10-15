// One HTTP client for the whole app. It adds the bearer token, unwraps the
// API envelope ({ success, data, meta } / { success:false, error }) and on a
// 401 refreshes the session once (single-flight) before retrying.
import axios from 'axios';
import env from '@/config/env';
import { session } from './session';

export class ApiError extends Error {
  constructor({ status, code, message, details, requestId }) {
    super(message || 'Something went wrong');
    this.status = status;
    this.code = code || 'UNKNOWN';
    this.details = details;
    this.requestId = requestId;
  }

  // Field errors from the API ({ in, path, message }) keyed by field name.
  get fieldErrors() {
    if (!Array.isArray(this.details)) return {};
    return Object.fromEntries(this.details.filter((d) => d && d.path).map((d) => [String(d.path).split('.')[0], d.message]));
  }
}

export const http = axios.create({ baseURL: env.apiUrl, timeout: 30000 });

http.interceptors.request.use((config) => {
  const token = session.getAccess();
  if (token && !config.headers.Authorization) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let refreshing = null;
export function refreshSession() {
  if (!refreshing) {
    const refreshToken = session.getRefresh();
    refreshing = (refreshToken ? axios.post(`${env.apiUrl}/auth/refresh`, { refreshToken }) : Promise.reject(new Error('no refresh token')))
      .then((res) => {
        session.set(res.data.data);
        return res.data.data;
      })
      .catch((e) => {
        session.clear('expired');
        throw e;
      })
      .finally(() => { refreshing = null; });
  }
  return refreshing;
}

const NO_RETRY = ['/auth/login', '/auth/login/verify-2fa', '/auth/refresh', '/auth/register', '/auth/verify-contact'];

http.interceptors.response.use(
  (res) => res,
  async (err) => {
    const { config, response } = err;
    const shouldRefresh = response && response.status === 401 && config && !config._retried
      && !NO_RETRY.some((p) => (config.url || '').startsWith(p)) && session.getRefresh();
    if (shouldRefresh) {
      config._retried = true;
      try {
        await refreshSession();
        config.headers.Authorization = `Bearer ${session.getAccess()}`;
        return http(config);
      } catch { /* fall through to the original error */ }
    }
    const body = response && response.data && response.data.error;
    throw new ApiError({
      status: response ? response.status : 0,
      code: body ? body.code : response ? 'HTTP_ERROR' : 'NETWORK_ERROR',
      message: body ? body.message : response ? `Request failed (${response.status})` : 'Cannot reach the server. Check your connection.',
      details: body ? body.details : undefined,
      requestId: body ? body.requestId : undefined,
    });
  },
);

const unwrap = (res) => res.data.data;
const unwrapPage = (res) => ({ items: res.data.data, meta: res.data.meta || {} });

export const api = {
  get: (url, params) => http.get(url, { params }).then(unwrap),
  page: (url, params) => http.get(url, { params }).then(unwrapPage),
  post: (url, body) => http.post(url, body).then(unwrap),
  patch: (url, body) => http.patch(url, body).then(unwrap),
  put: (url, body) => http.put(url, body).then(unwrap),
  del: (url, body) => http.delete(url, { data: body }).then(unwrap),
};
