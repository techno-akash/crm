import { toast } from '../components/Toast.jsx';
const BASE = (import.meta.env.VITE_AUTH_API_BASE_URL || '/api').replace(/\/$/, '');
async function request(path, body, { silent = false, method = body === undefined ? 'GET' : 'POST' } = {}) {
  let response;
  try {
    response = await fetch(`${BASE}${path}`, { method, credentials: 'include', cache: 'no-store',
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  } catch {
    const error = new Error('Unable to connect. Please try again.');
    if (!silent) toast(error.message, 'error');
    throw error;
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.message || 'Request failed. Please try again.');
    error.status = response.status;
    error.errors = payload.errors || [];
    if (!silent) toast(error.message, 'error');
    throw error;
  }
  return payload;
}
export const authApi = {
  login: (type, credentials) => request(type === 'staff' ? '/admin/auth/login' : '/auth/customer/login', credentials),
  verify: body => request('/admin/auth/verify-2fa', body),
  me: () => request('/auth/me', undefined, { silent: true }),
  refresh: () => request('/auth/refresh', undefined, { silent: true }),
  forgot: body => request('/auth/forgot-password', body),
  reset: body => request('/auth/reset-password', body),
  logout: () => request('/auth/logout', {}),
  home: type => request(type === 'staff' ? '/admin/auth/dashboard' : '/auth/customer/portal')
};
