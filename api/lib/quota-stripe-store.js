/**
 * Contador de imagens guardado nos metadados do cliente Stripe.
 *
 * Porquê existir: a quota vivia só no Upstash e, quando a base foi apagada, o
 * fallback era um Map por instância — ou seja quota nenhuma, reiniciada a cada
 * cold start. O Stripe já é a fonte de verdade do acesso e do plano, está sempre
 * disponível e é por cliente, logo serve de contador sem juntar mais um serviço.
 *
 * Limites do sítio onde se grava: metadados do cliente aceitam 50 chaves e 500
 * caracteres por valor. Guardamos uma chave por período de facturação e podamos
 * as antigas, ficando com duas.
 *
 * Concorrência: o Stripe não tem incremento atómico em metadata. Usamos um
 * lock optimista com token (vc_img_lock) + retries — dois consumes paralelos
 * não podem ambos gravar o mesmo valor (auditoria BE-001).
 */
import { getStripe } from './stripe.js';

const PREFIXO = 'vc_img_';
const LOCK_KEY = 'vc_img_lock';
const MAX_PERIODOS_GUARDADOS = 2;
const LOCK_MAX_ATTEMPTS = 8;
const LOCK_TTL_MS = 4_000;

function chaveDoPeriodo(periodStartSec) {
  return `${PREFIXO}${periodStartSec || 'nop'}`;
}

function chaveDasOperacoes(periodStartSec) {
  return `vc_imgops_${periodStartSec || 'nop'}`;
}

function idDeOperacao(operationId) {
  const id = String(operationId || '');
  return /^[A-Za-z0-9_-]{8,80}$/.test(id) ? id : '';
}

function lerOperacoes(metadados, periodStartSec) {
  const map = new Map();
  const raw = String(metadados[chaveDasOperacoes(periodStartSec)] || '');
  for (const part of raw.split(',')) {
    const [id, status] = part.split(':');
    if (id && status) map.set(id, status);
  }
  return map;
}

function serializarOperacoes(map) {
  return [...map.entries()].slice(-12).map(([id, status]) => `${id}:${status}`).join(',').slice(0, 480);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function novoLockToken() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

async function lerMetadados(customerId) {
  const stripe = getStripe();
  const cliente = await stripe.customers.retrieve(customerId);
  if (!cliente || cliente.deleted) throw new Error('Cliente Stripe inexistente.');
  return cliente.metadata || {};
}

/** Escreve o contador e apaga períodos antigos (valor '' remove a chave no Stripe). */
async function escreverContador(customerId, metadados, chave, valor, extra = {}) {
  const patch = { [chave]: String(valor), ...extra };
  const antigas = Object.keys(metadados)
    .filter((k) => k.startsWith(PREFIXO) && k !== chave && k !== LOCK_KEY)
    .sort()
    .reverse()
    .slice(MAX_PERIODOS_GUARDADOS - 1);
  for (const k of antigas) patch[k] = '';
  const stripe = getStripe();
  await stripe.customers.update(customerId, { metadata: patch });
}

/**
 * Adquire lock optimista nos metadados. Se outro writer ganhar, retenta.
 * `fn(metadados)` deve devolver o valor a propagar ao caller.
 */
async function comLockStripe(customerId, fn) {
  const stripe = getStripe();
  for (let attempt = 0; attempt < LOCK_MAX_ATTEMPTS; attempt += 1) {
    const metadados = await lerMetadados(customerId);
    const lockUntil = Number(String(metadados[LOCK_KEY] || '').split(':')[0] || 0);
    if (Number.isFinite(lockUntil) && lockUntil > Date.now()) {
      await sleep(40 + Math.floor(Math.random() * 80));
      continue;
    }
    const token = novoLockToken();
    const until = Date.now() + LOCK_TTL_MS;
    await stripe.customers.update(customerId, {
      metadata: { [LOCK_KEY]: `${until}:${token}` },
    });
    const confirmados = await lerMetadados(customerId);
    if (confirmados[LOCK_KEY] !== `${until}:${token}`) {
      await sleep(40 + Math.floor(Math.random() * 80));
      continue;
    }
    try {
      return await fn(confirmados);
    } finally {
      try {
        await stripe.customers.update(customerId, { metadata: { [LOCK_KEY]: '' } });
      } catch { /* best-effort */ }
    }
  }
  throw new Error('Não foi possível obter lock do contador Stripe.');
}

export async function stripeQuotaGet({ customerId, periodStartSec }) {
  const metadados = await lerMetadados(customerId);
  const bruto = Number(metadados[chaveDoPeriodo(periodStartSec)]);
  return Number.isFinite(bruto) && bruto > 0 ? Math.floor(bruto) : 0;
}

/** Lê, valida contra o tecto e grava. Devolve o total usado depois desta imagem. */
export async function stripeQuotaConsume({ customerId, periodStartSec, cap, operationId }) {
  return comLockStripe(customerId, async (metadados) => {
    const chave = chaveDoPeriodo(periodStartSec);
    const atual = Number(metadados[chave]);
    const usadas = Number.isFinite(atual) && atual > 0 ? Math.floor(atual) : 0;
    const operacao = idDeOperacao(operationId);
    const ops = lerOperacoes(metadados, periodStartSec);
    if (operacao && ops.has(operacao)) {
      return { replayed: true, reason: `already_${ops.get(operacao)}`, used: usadas };
    }
    if (usadas >= cap) return cap + 1; // sinaliza esgotado, sem gravar
    const proximo = usadas + 1;
    if (operacao) ops.set(operacao, 'R');
    await escreverContador(customerId, metadados, chave, proximo, operacao
      ? { [chaveDasOperacoes(periodStartSec)]: serializarOperacoes(ops) }
      : {});
    return proximo;
  });
}

export async function stripeQuotaRefund({ customerId, periodStartSec, operationId }) {
  return comLockStripe(customerId, async (metadados) => {
    const chave = chaveDoPeriodo(periodStartSec);
    const atual = Number(metadados[chave]);
    const usadas = Number.isFinite(atual) && atual > 0 ? Math.floor(atual) : 0;
    const operacao = idDeOperacao(operationId);
    const ops = lerOperacoes(metadados, periodStartSec);
    if (operacao && ops.get(operacao) === 'F') return usadas;
    const proximo = Math.max(0, usadas - 1);
    if (operacao && ops.has(operacao)) ops.set(operacao, 'F');
    await escreverContador(customerId, metadados, chave, proximo, operacao && ops.has(operacao)
      ? { [chaveDasOperacoes(periodStartSec)]: serializarOperacoes(ops) }
      : {});
    return proximo;
  });
}

export { chaveDoPeriodo as _chaveDoPeriodo, LOCK_KEY as _LOCK_KEY };
