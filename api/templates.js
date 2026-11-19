/**
 * Galeria de modelos publicados (docs/product/publicar-modelo.md).
 *
 * Decisões do João (19/11): galeria pública dentro do app; publica direto, com
 * denúncia; qualquer conta publica e usa, inclusive o plano grátis; o modelo
 * leva só a estrutura; nome do autor opcional.
 *
 * Por isso a rota exige CONTA (sessão válida), não assinatura. O dono vem
 * sempre da sessão, nunca do corpo. Escrita em modelo alheio responde 404.
 *
 *   GET  /api/templates                 galeria (página de 24, ?cursor, ?format)
 *   GET  /api/templates?mine=1          meus modelos
 *   GET  /api/templates?id=tpl_…        um modelo
 *   POST { action:'publish', name, description, authorName, content }
 *   POST { action:'update', id, name, description, authorName }
 *   POST { action:'delete', id }
 *   POST { action:'use', id }           conta um uso (aplicar no projeto)
 *   POST { action:'report', id, reason }
 *
 * Moderação (só contas em `moont.template_moderators`; para as outras, 404):
 *   GET  /api/templates?moderation=1    fila: denunciados e ocultos
 *   POST { action:'moderate', id, decision: 'keep' | 'hide' | 'remove' }
 */
import { applyCors } from './lib/cors.js';
import { readCurrentAccessCookie } from './lib/access.js';
import { consumeRateLimit, rateLimitResponse } from './lib/rate-limit.js';
import { resolveLibraryOwnerId } from './lib/library-sync-store.js';
import defaultStore from './lib/published-templates-store.js';
import {
  sanitizeTemplateContent, sanitizeTemplateMeta, templateContentBytes, TEMPLATE_FORMATS, TEMPLATE_MAX_BYTES,
} from '../src/utils/published-template.js';

export const config = { maxDuration: 30 };

const MAX_BODY_BYTES = TEMPLATE_MAX_BYTES + 4096;

function parseBody(req) {
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return null; }
  }
  return req.body && typeof req.body === 'object' ? req.body : null;
}

function bodyBytes(req) {
  if (typeof req.body === 'string') return Buffer.byteLength(req.body);
  try { return Buffer.byteLength(JSON.stringify(req.body ?? {})); } catch { return Infinity; }
}

function send(res, cause) {
  const status = Number.isInteger(cause?.status) ? cause.status : 500;
  if (status >= 500 && status !== 503) console.error('[templates]', cause?.code || '', cause?.message || cause);
  return res.status(status).json({
    error: status >= 500 && status !== 503 ? 'Não foi possível acessar a galeria de modelos.' : cause.message,
    code: cause?.code || 'templates_error',
    ...(cause?.limit ? { limit: cause.limit } : {}),
  });
}

export function createTemplatesHandler({ store = defaultStore, readAccess = readCurrentAccessCookie } = {}) {
  return async function handler(req, res) {
    applyCors(req, res, { credentials: true });
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Cache-Control', 'no-store');
    if (req.method === 'OPTIONS') return res.status(204).end();
    if (!['GET', 'POST'].includes(req.method)) {
      res.setHeader('Allow', 'GET, POST, OPTIONS');
      return res.status(405).json({ error: 'Use GET ou POST.' });
    }

    let access;
    try { access = await readAccess(req); }
    catch { return res.status(503).json({ error: 'Não foi possível verificar sua sessão. Tente novamente.', code: 'session_unavailable' }); }
    const owner = access?.customerId ? resolveLibraryOwnerId(access) : '';
    if (!owner) return res.status(401).json({ error: 'Entre na sua conta para ver os modelos.', code: 'session_required' });

    const limited = await consumeRateLimit(req, { limit: 120, windowMs: 60_000, keyPrefix: 'templates', subject: owner });
    if (limited) return rateLimitResponse(res, limited.retryAfterSec);

    try {
      if (req.method === 'GET') {
        const url = new URL(req.url || '/', 'https://moont.ai');
        const id = url.searchParams.get('id');
        if (id) return res.status(200).json({ ok: true, template: await store.getTemplate(id, owner) });
        if (url.searchParams.get('mine') === '1') return res.status(200).json({ ok: true, templates: await store.listMine(owner) });
        if (url.searchParams.get('moderation') === '1') return res.status(200).json({ ok: true, templates: await store.listModerationQueue(owner) });
        const format = url.searchParams.get('format');
        if (format && !TEMPLATE_FORMATS.includes(format)) return res.status(400).json({ error: 'Formato inválido.', code: 'template_format' });
        const [page, moderator] = await Promise.all([
          store.listGallery({ viewer: owner, cursor: url.searchParams.get('cursor'), format }),
          store.isModerator ? store.isModerator(owner).catch(() => false) : false,
        ]);
        return res.status(200).json({ ok: true, ...page, ...(moderator ? { moderator: true } : {}) });
      }

      if (bodyBytes(req) > MAX_BODY_BYTES) return res.status(413).json({ error: 'O modelo ficou grande demais.', code: 'template_too_large' });
      const body = parseBody(req);
      if (!body) return res.status(400).json({ error: 'Pedido inválido.', code: 'template_bad_request' });

      switch (body.action) {
        case 'publish': {
          const writeLimited = await consumeRateLimit(req, { limit: 10, windowMs: 60_000, keyPrefix: 'templates-publish', subject: owner });
          if (writeLimited) return rateLimitResponse(res, writeLimited.retryAfterSec);
          const meta = sanitizeTemplateMeta(body);
          // Reconstrói por lista permitida: o que vier fora dela não é gravado.
          const content = sanitizeTemplateContent(body.content);
          const template = await store.publish(owner, {
            ...meta, format: content.format, content, contentBytes: templateContentBytes(content),
          });
          return res.status(201).json({ ok: true, template });
        }
        case 'update': {
          const meta = sanitizeTemplateMeta(body);
          return res.status(200).json({ ok: true, template: await store.updateMine(owner, body.id, meta) });
        }
        case 'delete':
          return res.status(200).json({ ok: true, ...await store.deleteMine(owner, body.id) });
        case 'use':
          return res.status(200).json({ ok: true, ...await store.recordUse(body.id) });
        case 'report': {
          const reportLimited = await consumeRateLimit(req, { limit: 20, windowMs: 60 * 60_000, keyPrefix: 'templates-report', subject: owner });
          if (reportLimited) return rateLimitResponse(res, reportLimited.retryAfterSec);
          return res.status(200).json({ ok: true, ...await store.report(owner, body.id, body.reason) });
        }
        case 'moderate':
          return res.status(200).json({ ok: true, ...await store.moderate(owner, body.id, body.decision) });
        default:
          return res.status(400).json({ error: 'Ação inválida.', code: 'template_bad_action' });
      }
    } catch (cause) {
      return send(res, cause);
    }
  };
}

export default createTemplatesHandler();
