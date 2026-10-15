/**
 * Registo transacional da quota de imagens. Um período importa o contador
 * anterior antes de aceitar qualquer geração; se a origem falhar, não começa
 * em zero. Cada operação só pode reservar, confirmar ou devolver um crédito.
 */

import { getPostgresConnection } from './postgres-connection.js';

const SQL = {
  period: `/* moont_image_quota_period */
    SELECT owner_id, period_start_sec, period_end_sec, used, legacy_used
    FROM moont.image_quota_periods
    WHERE owner_id = $1 AND period_start_sec = $2`,
  insertPeriod: `/* moont_image_quota_insert_period */
    INSERT INTO moont.image_quota_periods
      (owner_id, period_start_sec, period_end_sec, used, legacy_used)
    VALUES ($1, $2, $3, $4, $4)
    ON CONFLICT (owner_id, period_start_sec) DO NOTHING`,
  lockedPeriod: `/* moont_image_quota_locked_period */
    SELECT owner_id, period_start_sec, period_end_sec, used, legacy_used
    FROM moont.image_quota_periods
    WHERE owner_id = $1 AND period_start_sec = $2 FOR UPDATE`,
  operation: `/* moont_image_quota_operation */
    SELECT status FROM moont.image_quota_operations
    WHERE owner_id = $1 AND period_start_sec = $2 AND operation_id = $3`,
  insertOperation: `/* moont_image_quota_insert_operation */
    INSERT INTO moont.image_quota_operations
      (owner_id, period_start_sec, operation_id, status)
    VALUES ($1, $2, $3, 'reserved')`,
  updateOperation: `/* moont_image_quota_update_operation */
    UPDATE moont.image_quota_operations
    SET status = $4, updated_at = now()
    WHERE owner_id = $1 AND period_start_sec = $2 AND operation_id = $3`,
  changeUsed: `/* moont_image_quota_change_used */
    UPDATE moont.image_quota_periods
    SET used = used + $3, updated_at = now()
    WHERE owner_id = $1 AND period_start_sec = $2
    RETURNING used`,
};

function fail(message, code) {
  return Object.assign(new Error(message), { code });
}

function ownerId(value) {
  const owner = String(value || '').trim();
  if (!owner || owner.length > 255 || owner.includes('\0')) {
    throw fail('Conta inválida para a quota de imagens.', 'quota_bad_owner');
  }
  return owner;
}

function period(value) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw fail('Período da assinatura inválido.', 'quota_period_unavailable');
  }
  return parsed;
}

function periodEnd(value, start) {
  if (value == null) return null;
  const parsed = period(value);
  if (parsed <= start) throw fail('Fim do período inválido.', 'quota_period_unavailable');
  return parsed;
}

function operationId(value) {
  const id = String(value || '').trim();
  if (!id || id.length > 160 || !/^[A-Za-z0-9._:-]+$/.test(id)) {
    throw fail('Identificador da geração inválido.', 'quota_bad_operation');
  }
  return id;
}

function capValue(value) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 0;
}

function count(value) {
  const parsed = typeof value === 'number' ? value
    : (typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : NaN);
  if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > 1_000_000_000) {
    throw fail('Contador anterior de imagens indisponível.', 'quota_store_unavailable');
  }
  return parsed;
}

function usage(used, cap) {
  return {
    used,
    limit: cap,
    remaining: Math.max(0, cap - used),
    allowed: cap > 0 && used < cap,
  };
}

async function run(sql, key, params) {
  return sql.unsafe(SQL[key], params);
}

async function defaultSql() {
  return getPostgresConnection();
}

async function defaultLegacyUsage(args) {
  const module = await import('./image-quota.js');
  if (typeof module.getLegacyQuotaUsage !== 'function') {
    throw fail('Leitura do contador anterior indisponível.', 'quota_store_unavailable');
  }
  return module.getLegacyQuotaUsage(args);
}

async function guardStorage(work) {
  try { return await work(); } catch (error) {
    if (typeof error?.code === 'string' && error.code.startsWith('quota_')) throw error;
    throw fail('Banco da quota de imagens indisponível.', 'quota_store_unavailable');
  }
}

/**
 * Factory injetável para testes. `readLegacyUsage` deve ler Upstash/Stripe sem
 * chamar este adapter. Um erro nesse leitor impede a criação do período.
 */
export function createImageQuotaPostgres({ sql: injectedSql, readLegacyUsage = defaultLegacyUsage } = {}) {
  async function connection() { return injectedSql || defaultSql(); }

  async function ensurePeriod(sql, owner, start, end) {
    const existing = (await run(sql, 'period', [owner, start]))[0];
    if (existing) return existing;
    const legacy = await readLegacyUsage({ customerId: owner, periodStartSec: start });
    if (legacy && typeof legacy === 'object'
      && (legacy.available === false || legacy.status === 'unavailable')) {
      throw fail('Contador anterior de imagens indisponível.', 'quota_store_unavailable');
    }
    const oldUsed = count(typeof legacy === 'object' && legacy !== null ? legacy.used : legacy);
    // Uma criação concorrente já pode ter importado e consumido créditos.
    // ON CONFLICT não altera a linha vencedora nem repõe o contador anterior.
    await run(sql, 'insertPeriod', [owner, start, end, oldUsed]);
    const created = (await run(sql, 'period', [owner, start]))[0];
    if (!created) throw fail('Não foi possível iniciar o período da quota.', 'quota_store_unavailable');
    return created;
  }

  async function locked(sql, owner, start) {
    const row = (await run(sql, 'lockedPeriod', [owner, start]))[0];
    if (!row) throw fail('Período da quota não encontrado.', 'quota_store_unavailable');
    return row;
  }

  async function getQuotaUsage({ customerId, periodStartSec, periodEndSec, limit }) {
    const owner = ownerId(customerId);
    const start = period(periodStartSec);
    const end = periodEnd(periodEndSec, start);
    const cap = capValue(limit);
    return guardStorage(async () => {
      const sql = await connection();
      const row = await ensurePeriod(sql, owner, start, end);
      return usage(count(row.used), cap);
    });
  }

  async function consumeImageCredit({ customerId, periodStartSec, periodEndSec, limit, operationId: rawId }) {
    const cap = capValue(limit);
    if (cap <= 0) {
      return { ...usage(0, 0), reason: 'no_quota' };
    }
    const owner = ownerId(customerId);
    const start = period(periodStartSec);
    const end = periodEnd(periodEndSec, start);
    const id = operationId(rawId);
    return guardStorage(async () => {
      const sql = await connection();
      await ensurePeriod(sql, owner, start, end);
      return sql.begin(async (tx) => {
        const row = await locked(tx, owner, start);
        const used = count(row.used);
        const existing = (await run(tx, 'operation', [owner, start, id]))[0];
        if (existing) {
          return { ...usage(used, cap), allowed: false,
            reason: `already_${existing.status}`, replayed: true };
        }
        if (used >= cap) {
          return { ...usage(used, cap), allowed: false, reason: 'exhausted' };
        }
        await run(tx, 'insertOperation', [owner, start, id]);
        const updated = (await run(tx, 'changeUsed', [owner, start, 1]))[0];
        return { ...usage(count(updated.used), cap), allowed: true,
          reason: null, operationId: id, status: 'reserved' };
      });
    });
  }

  async function settleImageCredit({ customerId, periodStartSec, operationId: rawId }) {
    const owner = ownerId(customerId);
    const start = period(periodStartSec);
    const id = operationId(rawId);
    return guardStorage(async () => {
      const sql = await connection();
      return sql.begin(async (tx) => {
        const row = await locked(tx, owner, start);
        const op = (await run(tx, 'operation', [owner, start, id]))[0];
        if (!op) throw fail('Reserva de imagem não encontrada.', 'quota_operation_not_found');
        if (op.status === 'reserved') {
          await run(tx, 'updateOperation', [owner, start, id, 'consumed']);
        }
        return { used: count(row.used), status: op.status === 'reserved' ? 'consumed' : op.status };
      });
    });
  }

  async function refundImageCredit({ customerId, periodStartSec, operationId: rawId }) {
    const owner = ownerId(customerId);
    const start = period(periodStartSec);
    const id = operationId(rawId);
    return guardStorage(async () => {
      const sql = await connection();
      return sql.begin(async (tx) => {
        const row = await locked(tx, owner, start);
        const op = (await run(tx, 'operation', [owner, start, id]))[0];
        if (!op) throw fail('Reserva de imagem não encontrada.', 'quota_operation_not_found');
        if (op.status === 'refunded') return { used: count(row.used), refunded: false };
        await run(tx, 'updateOperation', [owner, start, id, 'refunded']);
        const updated = (await run(tx, 'changeUsed', [owner, start, -1]))[0];
        return { used: count(updated.used), refunded: true };
      });
    });
  }

  return { getQuotaUsage, consumeImageCredit, settleImageCredit, refundImageCredit };
}

const production = createImageQuotaPostgres();
export const getQuotaUsagePostgres = production.getQuotaUsage;
export const consumeImageCreditPostgres = production.consumeImageCredit;
export const settleImageCreditPostgres = production.settleImageCredit;
export const refundImageCreditPostgres = production.refundImageCredit;
