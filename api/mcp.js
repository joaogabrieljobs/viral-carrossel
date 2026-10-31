/** Streamable HTTP MCP endpoint for authenticated Moont subscribers. */
import { authenticateAgentRequest, AgentTokenError } from './lib/agent-token-store.js';
import {
  applyAgentTextEdit, applyAgentVisualBatch, getAgentProject,
  listAgentProjects, previewAgentTextEdit, previewAgentVisualBatch, undoAgentVisualBatch,
} from './lib/agent-visual-batch.js';
import { getAgentChangeStatus, startAgentImageJob } from './lib/agent-image-generation.js';
import { CONTENT_PATCH_SCHEMA } from './lib/content-patch.js';
import { VISUAL_PATCH_SCHEMA } from './lib/visual-patch.js';
import { consumeRateLimit, rateLimitResponse } from './lib/rate-limit.js';

export const config = { maxDuration: 300 };
const PROTOCOL_VERSION = '2025-06-18';
const SERVER = { name: 'moont', version: '0.3.0' };
const object = { type: 'object', additionalProperties: true };

const tools = [
  {
    ...tool('get_connection_profile', 'Confirma a conta Moont conectada e as permissões concedidas.', {}, [], true),
    _meta: { 'openai/profile': true },
  },
  tool('list_projects', 'Lista os projetos da conta Moont conectada sem retornar fotos.', {
    limit: { type: 'integer', minimum: 1, maximum: 100 }, cursor: { type: 'string' },
  }, [], true),
  tool('get_project_content', 'Lê textos, IDs e versão de um projeto. Não retorna bytes de fotos ou logos.', {
    projectId: { type: 'string' },
  }, ['projectId'], true),
  tool('get_project_design', 'Lê campos visuais, IDs e versão de um projeto sem retornar mídia.', {
    projectId: { type: 'string' }, includeText: { type: 'boolean' },
  }, ['projectId'], true),
  tool('get_content_schema', 'Mostra os campos de conteúdo aceitos e seus limites.', {}, [], true),
  tool('get_visual_schema', 'Mostra os campos visuais aceitos, seus limites e o catálogo de fontes locais do Moont com os valores exatos para aplicar.', {}, [], true),
  tool('preview_text_edit', 'Mostra antes e depois de uma edição textual sem gravar.', {
    projectId: { type: 'string' }, baseVersion: { type: 'integer', minimum: 1 }, patch: object,
  }, ['projectId', 'baseVersion', 'patch'], true),
  tool('apply_text_edit', 'Aplica exatamente uma edição textual já conferida. Preserva fotos, logo e layout.', {
    projectId: { type: 'string' }, baseVersion: { type: 'integer', minimum: 1 }, patch: object,
    requestId: { type: 'string', minLength: 8, maxLength: 128 },
  }, ['projectId', 'baseVersion', 'patch', 'requestId'], false),
  tool('preview_visual_edit', 'Mostra uma alteração visual em um projeto sem gravar.', {
    projectId: { type: 'string' }, baseVersion: { type: 'integer', minimum: 1 },
    slideIds: { type: 'array', items: { type: 'string' } }, patch: object,
    brandScope: { type: 'string', enum: ['project'] },
  }, ['projectId', 'baseVersion', 'patch'], true),
  tool('apply_visual_edit', 'Aplica uma alteração visual conferida, com versão e repetição segura.', {
    projectId: { type: 'string' }, baseVersion: { type: 'integer', minimum: 1 },
    slideIds: { type: 'array', items: { type: 'string' } }, patch: object,
    brandScope: { type: 'string', enum: ['project'] }, requestId: { type: 'string', minLength: 8, maxLength: 128 },
  }, ['projectId', 'baseVersion', 'patch', 'requestId'], false),
  tool('get_change_status', 'Consulta uma alteração pelo seu requestId. Para generate_slide_image, mostra status (pending, applied, failed), o estado de cada card e afterVersion ao concluir.', {
    requestId: { type: 'string' },
  }, ['requestId'], true),
  tool('generate_slide_image', 'Gera imagens para cards a partir da imageQuery salva em cada um e grava no projeto. Lento (minutos) e pago: consome 1 crédito de imagem do plano por card; sem crédito, recusa sem cobrar. Sem slideIds, atende todos os cards sem foto (até 8 por chamada). Leia o projeto imediatamente antes e informe a versão atual; conflito é recusado. Responde na hora com status pending; acompanhe com get_change_status(requestId) até applied ou failed, que traz o estado por card e a versão nova. Para outra imagem, edite a imageQuery com apply_text_edit antes.', {
    projectId: { type: 'string' }, baseVersion: { type: 'integer', minimum: 1 },
    slideIds: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 8 },
    requestId: { type: 'string', minLength: 8, maxLength: 128 },
  }, ['projectId', 'baseVersion', 'requestId'], false),
  tool('undo_project_change', 'Desfaz uma alteração do MCP quando o projeto continua na versão produzida por ela.', {
    requestId: { type: 'string' }, undoRequestId: { type: 'string' },
  }, ['requestId', 'undoRequestId'], false),
];

function tool(name, description, properties, required, readOnly) {
  return {
    name, description,
    inputSchema: { type: 'object', properties, ...(required.length ? { required } : {}), additionalProperties: false },
    annotations: { readOnlyHint: readOnly, destructiveHint: false, idempotentHint: !readOnly },
    securitySchemes: [{ type: 'oauth2', scopes: readOnly ? ['projects:read'] : ['projects:write'] }],
  };
}

function rpc(id, result) { return { jsonrpc: '2.0', id, result }; }
function rpcError(id, code, message, data) {
  return { jsonrpc: '2.0', id: id ?? null, error: { code, message, ...(data ? { data } : {}) } };
}
function content(value, isError = false) {
  return { content: [{ type: 'text', text: JSON.stringify(value) }], structuredContent: value, ...(isError ? { isError: true } : {}) };
}
function sendChallenge(res, scope = 'projects:read') {
  res.setHeader('WWW-Authenticate', `Bearer resource_metadata="https://moont.ai/.well-known/oauth-protected-resource", scope="${scope}"`);
  return res.status(401).json({ error: 'Conecte sua conta Moont.', code: 'mcp_auth_required' });
}

async function call(name, args, agent) {
  switch (name) {
    case 'get_connection_profile': return { connected: true, service: 'Moont', scopes: agent.scopes };
    case 'list_projects': return listAgentProjects(agent.ownerId, args);
    case 'get_project_content': return getAgentProject(agent.ownerId, args.projectId, { includeText: true });
    case 'get_project_design': return getAgentProject(agent.ownerId, args.projectId, { includeText: args.includeText === true });
    case 'get_content_schema': return { schema: CONTENT_PATCH_SCHEMA };
    case 'get_visual_schema': return { schema: VISUAL_PATCH_SCHEMA };
    case 'preview_text_edit': return previewAgentTextEdit(agent.ownerId, args);
    case 'apply_text_edit': return applyAgentTextEdit(agent.ownerId, agent.tokenId, args);
    case 'preview_visual_edit': return previewAgentVisualBatch(agent.ownerId, args);
    case 'apply_visual_edit': return applyAgentVisualBatch(agent.ownerId, agent.tokenId, args);
    case 'get_change_status': return getAgentChangeStatus(agent.ownerId, args.requestId);
    case 'generate_slide_image': return startAgentImageJob(agent.ownerId, agent.tokenId, args);
    case 'undo_project_change': return undoAgentVisualBatch(agent.ownerId, args);
    default: throw Object.assign(new Error('Ferramenta desconhecida.'), { code: 'mcp_tool_unknown', status: 404 });
  }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('MCP-Protocol-Version', PROTOCOL_VERSION);
  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(204).end();
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST.' });
  if (!/^application\/json(?:;|$)/i.test(String(req.headers?.['content-type'] || ''))) {
    return res.status(415).json({ error: 'Envie JSON.', code: 'mcp_json_required' });
  }
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = null; } }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return res.status(400).json(rpcError(null, -32700, 'JSON inválido.'));
  const writeNames = new Set(['apply_text_edit', 'apply_visual_edit', 'generate_slide_image', 'undo_project_change']);
  const requestedTool = body?.method === 'tools/call' ? body?.params?.name : '';
  const scope = writeNames.has(requestedTool) ? 'projects:write' : 'projects:read';
  let agent;
  try { agent = await authenticateAgentRequest(req, { scope }); }
  catch (cause) {
    if (cause instanceof AgentTokenError && cause.status === 401) return sendChallenge(res, scope);
    const status = Number(cause?.status) || 500;
    return res.status(status).json({ error: cause?.message || 'Falha de autenticação.', code: cause?.code || 'mcp_auth_error' });
  }
  const limited = await consumeRateLimit(req, { limit: 120, windowMs: 60_000, keyPrefix: 'mcp', subject: agent.tokenId });
  if (limited) return rateLimitResponse(res, limited.retryAfterSec);
  const { id, method } = body;
  if (method?.startsWith('notifications/')) return res.status(202).end();
  if (method === 'initialize') return res.status(200).json(rpc(id, {
    protocolVersion: PROTOCOL_VERSION, capabilities: { tools: { listChanged: false } }, serverInfo: SERVER,
    instructions: 'Leia o projeto antes de editar. Para design, consulte get_visual_schema: ele contém o catálogo de fontes locais e os valores exatos aceitos; escolha fontes de título e corpo coerentes com a intenção e use preview antes de apply. Para imagens, use generate_slide_image com a versão atual: consome 1 crédito por card, responde pending e termina em minutos; acompanhe com get_change_status. Use requestId único; em conflito, leia novamente.',
  }));
  if (method === 'ping') return res.status(200).json(rpc(id, {}));
  if (method === 'tools/list') return res.status(200).json(rpc(id, { tools }));
  if (method !== 'tools/call') return res.status(200).json(rpcError(id, -32601, 'Método não encontrado.'));
  try {
    const value = await call(body.params?.name, body.params?.arguments || {}, agent);
    return res.status(200).json(rpc(id, content(value)));
  } catch (cause) {
    const safe = { error: cause?.message || 'Não foi possível executar a ferramenta.', code: cause?.code || 'mcp_tool_error' };
    if (cause?.cloudVersion) safe.cloudVersion = cause.cloudVersion;
    for (const key of ['slideIds', 'needed', 'remaining', 'limit', 'max']) if (cause?.[key] !== undefined) safe[key] = cause[key];
    return res.status(200).json(rpc(id, content(safe, true)));
  }
}

export { tools as MCP_TOOLS };
