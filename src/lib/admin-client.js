/** Cliente do console admin (api/admin.js). 404 significa "sem acesso". */
const API = '/api/admin';

async function request(method, { query = '', body } = {}) {
  const res = await fetch(`${API}${query}`, {
    method,
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || 'Não foi possível carregar o console.'), { code: data.code, status: res.status });
  return data;
}

const view = (name, params = {}) => {
  const search = new URLSearchParams({ view: name });
  for (const [k, v] of Object.entries(params)) if (v != null && v !== '') search.set(k, String(v));
  return request('GET', { query: `?${search}` });
};

export const adminMe = () => view('me');
export const adminOverview = () => view('overview');
export const adminAccounts = (q = '', page = 1) => view('accounts', { q, page });
export const adminAccount = (id) => view('account', { id });
export const adminGrants = (all = false) => view('grants', all ? { all: 1 } : {});
export const adminHealth = () => view('health');
export const adminActions = (target = '') => view('actions', { target });
export const adminChallenge = (intent, payload) => request('POST', { body: { action: 'challenge', intent, payload } });
export const adminGrant = (input) => request('POST', { body: { action: 'grant', ...input } });
export const adminRevoke = (input) => request('POST', { body: { action: 'revoke', ...input } });
