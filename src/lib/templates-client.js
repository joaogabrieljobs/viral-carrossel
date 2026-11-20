/** Cliente da galeria de modelos (api/templates.js). */
const API = '/api/templates';

async function request(method, { query = '', body } = {}) {
  const res = await fetch(`${API}${query}`, {
    method,
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw Object.assign(new Error(data.error || 'Não foi possível acessar a galeria de modelos.'), { code: data.code, status: res.status });
  }
  return data;
}

export function listGalleryTemplates({ cursor = '', format = '' } = {}) {
  const params = new URLSearchParams();
  if (cursor) params.set('cursor', cursor);
  if (format) params.set('format', format);
  const query = params.toString();
  return request('GET', { query: query ? `?${query}` : '' });
}
export const listMyTemplates = () => request('GET', { query: '?mine=1' });
export const publishTemplate = ({ name, description, authorName, content }) => request('POST', { body: { action: 'publish', name, description, authorName, content } });
export const updateTemplate = ({ id, name, description, authorName }) => request('POST', { body: { action: 'update', id, name, description, authorName } });
export const deleteTemplate = (id) => request('POST', { body: { action: 'delete', id } });
export const recordTemplateUse = (id) => request('POST', { body: { action: 'use', id } });
export const reportTemplate = (id, reason = '') => request('POST', { body: { action: 'report', id, reason } });
export const listModerationQueue = (view = 'pending') => request('GET', { query: `?moderation=1${view === 'removed' ? '&view=removed' : ''}` });
export const moderateTemplate = (id, decision) => request('POST', { body: { action: 'moderate', id, decision } });
