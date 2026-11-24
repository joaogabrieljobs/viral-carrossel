/**
 * Plano grátis no cliente (docs/product/plano-gratis.md).
 *
 * Três responsabilidades, todas locais ao navegador:
 *  1. lembrar desde quando esta conta usa o grátis aqui (`vc_free_plan_since`);
 *  2. ao assinar, separar os projetos mexidos no grátis para que a biblioteca
 *     da nuvem não os substitua (`vc_free_plan_drafts`);
 *  3. lembrar qual projeto estava aberto quando a pessoa foi para a
 *     assinatura, para voltar a ele (`vc_upgrade_return`).
 *
 * O bloqueio de IA NÃO mora aqui: quem recusa é o servidor (402). Este módulo
 * só cuida de não perder trabalho.
 */
import { FREE_PLAN, FREE_PROJECT_LIMIT } from '../../shared/plans.js';

export const FREE_PLAN_SINCE_KEY = 'vc_free_plan_since';
export const FREE_PLAN_DRAFTS_KEY = 'vc_free_plan_drafts';
export const UPGRADE_RETURN_KEY = 'vc_upgrade_return';
const UPGRADE_RETURN_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export { FREE_PLAN, FREE_PROJECT_LIMIT };

function readJson(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function writeJson(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; }
  catch { return false; }
}

function remove(key) {
  try { localStorage.removeItem(key); } catch { /* armazenamento indisponível */ }
}

/** Sessão de conta autenticada sem assinatura. Nunca verdadeiro para anônimo. */
export function isFreeSession(session) {
  return !!session && session.active !== true && session.free === true
    && !!(session.email || session.customerId);
}

/** Criar projeto novo é o único gesto que o limite bloqueia; os existentes continuam editáveis. */
export function freeProjectLimitReached(library, limit = FREE_PROJECT_LIMIT) {
  return Array.isArray(library) && library.length >= limit;
}

/** Guarda o primeiro momento de uso do grátis; chamadas seguintes não o adiantam. */
export function markFreePlanUse(owner, now = Date.now()) {
  if (!owner) return null;
  const current = readJson(FREE_PLAN_SINCE_KEY);
  if (current?.owner === owner && Number.isFinite(current.since)) return current.since;
  writeJson(FREE_PLAN_SINCE_KEY, { owner, since: now });
  return now;
}

export function readFreePlanSince(owner) {
  const current = readJson(FREE_PLAN_SINCE_KEY);
  return owner && current?.owner === owner && Number.isFinite(current.since) ? current.since : null;
}

/**
 * Antes de restaurar a biblioteca da conta que acabou de assinar: separa os
 * projetos tocados desde o início do grátis. Fica em disco até a recuperação
 * terminar, para sobreviver a um recarregamento no meio do caminho.
 */
export function stashFreePlanDrafts(owner, library) {
  if (!owner) return [];
  const pending = readJson(FREE_PLAN_DRAFTS_KEY);
  if (pending?.owner === owner && Array.isArray(pending.entries) && pending.entries.length) {
    return pending.entries;
  }
  const since = readFreePlanSince(owner);
  if (since == null || !Array.isArray(library)) return [];
  const entries = library.filter((entry) => entry?.id && entry.doc
    && Number(entry.updatedAt || 0) >= since);
  if (!entries.length) { remove(FREE_PLAN_SINCE_KEY); return []; }
  // Sem espaço para a cópia, os rascunhos seguem em memória nesta carga.
  writeJson(FREE_PLAN_DRAFTS_KEY, { owner, entries });
  return entries;
}

/**
 * Decide o que volta para a biblioteca depois que a nuvem foi aplicada.
 * Nunca descarta: projeto ausente volta como estava; projeto que existe na
 * conta com conteúdo diferente e mais antigo volta como cópia.
 */
export function planFreePlanDraftRecovery(drafts, library, { newId, sameContent } = {}) {
  const current = new Map((library || []).map((entry) => [entry?.id, entry]));
  const additions = [];
  for (const draft of drafts || []) {
    if (!draft?.id) continue;
    const existing = current.get(draft.id);
    if (!existing) { additions.push(draft); continue; }
    if (existing === draft || sameContent?.(existing, draft)) continue;
    if (Number(draft.updatedAt || 0) <= Number(existing.updatedAt || 0)) continue;
    additions.push({
      ...draft,
      id: newId(),
      name: `${draft.name || 'Projeto'} (feito no grátis)`,
      doc: { ...draft.doc, shareCode: '', shareProjectId: '', shareRevision: 0, shareUpdatedAt: 0 },
    });
  }
  return additions;
}

export function clearFreePlanDrafts() {
  remove(FREE_PLAN_DRAFTS_KEY);
  remove(FREE_PLAN_SINCE_KEY);
}

/** Chamado ao sair para a assinatura. `owner` impede abrir projeto de outra conta. */
export function rememberUpgradeReturn({ owner, docId, slideIndex = 0, feature = '' } = {}, now = Date.now()) {
  if (!owner || !docId) { remove(UPGRADE_RETURN_KEY); return false; }
  return writeJson(UPGRADE_RETURN_KEY, {
    owner, docId: String(docId), slideIndex: Math.max(0, Number(slideIndex) || 0),
    feature: String(feature || '').slice(0, 60), at: now,
  });
}

/** Lê e consome: o retorno vale uma vez. */
export function takeUpgradeReturn(owner, now = Date.now()) {
  const saved = readJson(UPGRADE_RETURN_KEY);
  remove(UPGRADE_RETURN_KEY);
  if (!saved || !owner || saved.owner !== owner || !saved.docId) return null;
  if (!Number.isFinite(saved.at) || now - saved.at > UPGRADE_RETURN_MAX_AGE_MS) return null;
  return { docId: saved.docId, slideIndex: saved.slideIndex || 0, feature: saved.feature || '' };
}

/** Texto único para todo ponto que leva à assinatura. */
export const PLAN_REQUIRED_CODE = 'plan_required';
export const PLAN_REQUIRED_MESSAGES = {
  text: 'Criar texto com IA faz parte dos planos pagos.',
  image: 'Gerar imagem faz parte dos planos pagos. No grátis você envia suas próprias fotos.',
  cloud: 'Guardar projetos na conta faz parte dos planos pagos. No grátis eles ficam neste aparelho.',
  keys: 'Usar chave própria de IA faz parte dos planos pagos.',
  share: 'Compartilhar com a equipe faz parte dos planos pagos.',
  agents: 'Conectar assistentes faz parte dos planos pagos.',
  projects: `O plano grátis guarda até ${FREE_PROJECT_LIMIT} projetos. Assine para criar mais projetos e guardá-los na conta.`,
};

export function planRequiredError(feature = 'text') {
  return Object.assign(new Error(PLAN_REQUIRED_MESSAGES[feature] || PLAN_REQUIRED_MESSAGES.text), {
    code: PLAN_REQUIRED_CODE, feature,
  });
}

export function isPlanRequiredError(error) {
  return error?.code === PLAN_REQUIRED_CODE;
}

/**
 * Portão de recurso pago no cliente. O editor registra aqui se a conta é
 * grátis e o que fazer quando ela tenta um recurso pago (abrir a assinatura).
 * As funções de IA chamam `assertPaidFeature` antes de qualquer rede: assim
 * um botão esquecido na interface, ou a chave própria que fala direto com o
 * provedor, também param aqui. Não substitui o gate do servidor.
 */
let paidFeatureGate = { blocked: false, onBlocked: null };

export function setPaidFeatureGate({ blocked = false, onBlocked = null } = {}) {
  paidFeatureGate = { blocked: !!blocked, onBlocked: typeof onBlocked === 'function' ? onBlocked : null };
}

export function isPaidFeatureBlocked() {
  return paidFeatureGate.blocked;
}

export function assertPaidFeature(feature = 'text') {
  if (!paidFeatureGate.blocked) return;
  try { paidFeatureGate.onBlocked?.(feature); } catch { /* a recusa não depende da interface */ }
  throw planRequiredError(feature);
}
