import { execFile } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export const MOONT_ORIGIN = 'https://moont.ai';
export const KEYCHAIN_SERVICE = 'br.com.viralcarrossel.moont.agent';
export const KEYCHAIN_ACCOUNT = 'default';

export class MoontApiError extends Error {
  constructor(message, { status = 0, code = 'request_failed', cloudVersion } = {}) {
    super(message);
    this.name = 'MoontApiError';
    this.status = status;
    this.code = code;
    if (cloudVersion !== undefined) this.cloudVersion = cloudVersion;
  }
}

export async function readKeychainToken() {
  const fromEnv = String(process.env.MOONT_TOKEN || '').trim();
  if (fromEnv) return fromEnv;
  if (process.platform !== 'darwin') {
    throw new MoontApiError('Defina MOONT_TOKEN com a chave criada em Perfil → Integração Codex. O Chaves do macOS é opcional.', { code: 'connection_required' });
  }

  try {
    const { stdout } = await execFileAsync('/usr/bin/security', [
      'find-generic-password', '-a', KEYCHAIN_ACCOUNT, '-s', KEYCHAIN_SERVICE, '-w',
    ], { timeout: 15000, maxBuffer: 4096 });
    const token = stdout.trim();
    if (!token) throw new Error('empty credential');
    return token;
  } catch {
    throw new MoontApiError('Conecte sua conta: gere um token em Perfil > Integração Codex no Moont e execute plugins/moont/bin/setup.sh.', {
      code: 'connection_required',
    });
  }
}

export class MoontApiClient {
  constructor({ origin = MOONT_ORIGIN, getToken = readKeychainToken, fetchImpl = globalThis.fetch } = {}) {
    const parsed = new URL(origin);
    if (parsed.protocol !== 'https:') throw new Error('Moont API must use HTTPS');
    this.origin = parsed.origin;
    this.getToken = getToken;
    this.fetchImpl = fetchImpl;
    this.requestTimes = [];
    this.cachedToken = null;
    this.tokenLoadedAt = 0;
  }

  async authToken() {
    if (!this.cachedToken || Date.now() - this.tokenLoadedAt > 300000) {
      this.cachedToken = await this.getToken();
      this.tokenLoadedAt = Date.now();
    }
    return this.cachedToken;
  }

  async paceRequests() {
    // Leave room below the API's 120 requests/minute account limit.
    while (true) {
      const now = Date.now();
      this.requestTimes = this.requestTimes.filter((time) => now - time < 60000);
      if (this.requestTimes.length < 100) {
        this.requestTimes.push(now);
        return;
      }
      await delay(Math.min(30000, Math.max(50, 60000 - (now - this.requestTimes[0]))));
    }
  }

  async request(method, query = {}, body) {
    const url = new URL('/api/agent-visual-batch', this.origin);
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
    }

    const token = await this.authToken();
    let response;
    const rateLimitStarted = Date.now();
    for (let attempt = 0; attempt < 8; attempt += 1) {
      await this.paceRequests();
      try {
        response = await this.fetchImpl(url, {
          method,
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
            ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
          },
          body: body === undefined ? undefined : JSON.stringify(body),
          redirect: 'error',
          signal: AbortSignal.timeout(45000),
        });
      } catch {
        throw new MoontApiError('Não foi possível conectar ao Moont. Verifique a conexão e tente novamente.', { code: 'network_error' });
      }
      if (response.status !== 429) break;
      const waited = Date.now() - rateLimitStarted;
      if (attempt === 7 || waited >= 60_000) {
        throw new MoontApiError('O Moont limitou temporariamente as requisições. Retome o lote em alguns instantes.', { status: 429, code: 'rate_limited' });
      }
      const retryAfter = response.headers?.get?.('retry-after');
      const retrySeconds = Number(retryAfter);
      const retryDate = retryAfter && !Number.isFinite(retrySeconds) ? Date.parse(retryAfter) : NaN;
      const requestedWait = Number.isFinite(retrySeconds)
        ? Math.max(1000, retrySeconds * 1000)
        : Number.isFinite(retryDate)
          ? Math.max(1000, retryDate - Date.now())
          : Math.min(30000, 1000 * 2 ** attempt);
      const waitMs = Math.min(requestedWait, 60_000 - waited);
      let remaining = waitMs;
      while (remaining > 0) {
        const segment = Math.min(30000, remaining);
        await delay(segment);
        remaining -= segment;
      }
    }

    let payload;
    try {
      payload = await response.json();
    } catch {
      throw new MoontApiError(`O Moont respondeu com HTTP ${response.status} sem JSON válido.`, {
        status: response.status,
        code: 'invalid_response',
      });
    }

    if (!response.ok || payload?.ok === false) {
      if (response.status === 401) {
        this.cachedToken = null;
        this.tokenLoadedAt = 0;
      }
      const code = typeof payload?.code === 'string' ? payload.code : 'request_failed';
      const message = typeof payload?.error === 'string' ? payload.error.slice(0, 400) : `HTTP ${response.status}`;
      throw new MoontApiError(message.replaceAll(token, '[credencial]'), {
        status: response.status,
        code,
        cloudVersion: payload?.cloudVersion,
      });
    }
    return payload;
  }

  listProjects({ limit = 100, cursor } = {}) {
    return this.request('GET', { op: 'projects', limit, cursor });
  }

  getProject(id, { includeText = false } = {}) {
    return this.request('GET', { op: 'project', id, includeText: includeText ? '1' : undefined });
  }

  getVisualSchema() {
    return this.request('GET', { op: 'schema' });
  }

  getContentSchema() {
    return this.request('GET', { op: 'content_schema' });
  }

  getJob(requestId) {
    return this.request('GET', { op: 'job', requestId });
  }

  preview({ projectId, baseVersion, slideIds, patch, brandScope }) {
    return this.request('POST', {}, { action: 'preview', projectId, baseVersion, slideIds, patch, brandScope });
  }

  apply({ projectId, baseVersion, slideIds, patch, brandScope, requestId }) {
    return this.request('POST', {}, { action: 'apply', projectId, baseVersion, slideIds, patch, brandScope, requestId });
  }

  previewText({ projectId, baseVersion, patch }) {
    return this.request('POST', {}, { action: 'preview_text', projectId, baseVersion, patch });
  }

  applyText({ projectId, baseVersion, patch, requestId }) {
    return this.request('POST', {}, { action: 'apply_text', projectId, baseVersion, patch, requestId });
  }

  undo({ requestId, undoRequestId }) {
    return this.request('POST', {}, { action: 'undo', requestId, undoRequestId });
  }
}
