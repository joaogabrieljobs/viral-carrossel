import { getPostgresConnection } from './postgres-connection.js';

const ENSURE_DAY = `
  INSERT INTO moont.ocr_daily_quotas (owner_id, quota_day, used)
  VALUES ($1, $2::date, 0)
  ON CONFLICT (owner_id, quota_day) DO NOTHING
`;
const LOCK_DAY = `
  SELECT used FROM moont.ocr_daily_quotas
  WHERE owner_id = $1 AND quota_day = $2::date FOR UPDATE
`;
const READ_OPERATION = `
  SELECT status FROM moont.ocr_daily_operations
  WHERE owner_id = $1 AND quota_day = $2::date AND operation_id = $3
`;
const INCREMENT = `
  UPDATE moont.ocr_daily_quotas
  SET used = used + 1, updated_at = now()
  WHERE owner_id = $1 AND quota_day = $2::date
  RETURNING used
`;
const RESERVE_OPERATION = `
  INSERT INTO moont.ocr_daily_operations (owner_id, quota_day, operation_id, status)
  VALUES ($1, $2::date, $3, 'reserved')
`;
const MARK_REFUNDED = `
  UPDATE moont.ocr_daily_operations
  SET status = 'refunded', updated_at = now()
  WHERE owner_id = $1 AND quota_day = $2::date AND operation_id = $3
    AND status = 'reserved'
  RETURNING operation_id
`;
const DECREMENT = `
  UPDATE moont.ocr_daily_quotas
  SET used = GREATEST(0, used - 1), updated_at = now()
  WHERE owner_id = $1 AND quota_day = $2::date
  RETURNING used
`;
const CLEANUP = `
  DELETE FROM moont.ocr_daily_quotas
  WHERE ctid IN (
    SELECT ctid FROM moont.ocr_daily_quotas
    WHERE quota_day < (CURRENT_DATE - INTERVAL '90 days')
    ORDER BY quota_day LIMIT 50
  )
`;

function ownerId(customerId) {
  return String(customerId || 'unknown').slice(0, 255);
}

function day(now) {
  return new Date(now).toISOString().slice(0, 10);
}

function validOperationId(operationId) {
  const value = String(operationId || '');
  if (!value || value.length > 160) throw new TypeError('Operação OCR inválida.');
  return value;
}

/** A linha diária serializa reservas; a operação permite reembolso uma única vez. */
export async function consumePostgresOcrCredit({ customerId, now, limit, operationId }) {
  const database = getPostgresConnection();
  const key = [ownerId(customerId), day(now)];
  const operation = validOperationId(operationId);
  const result = await database.begin(async (tx) => {
    await tx.unsafe(ENSURE_DAY, key);
    const [quota] = await tx.unsafe(LOCK_DAY, key);
    if (!quota) throw new Error('Contador OCR sem resposta.');
    const [existing] = await tx.unsafe(READ_OPERATION, [...key, operation]);
    if (existing?.status === 'reserved') {
      return { allowed: true, used: Number(quota.used), limit, operationId: operation };
    }
    if (existing?.status === 'refunded') {
      return { allowed: false, reason: 'refunded', used: Number(quota.used), limit };
    }
    if (Number(quota.used) >= limit) {
      return { allowed: false, reason: 'exhausted', used: limit, limit };
    }
    const [updated] = await tx.unsafe(INCREMENT, key);
    await tx.unsafe(RESERVE_OPERATION, [...key, operation]);
    return { allowed: true, used: Number(updated.used), limit, operationId: operation };
  });
  if (Math.random() < 0.05) {
    try { await database.unsafe(CLEANUP); }
    catch (error) { console.warn('[ocr-quota] limpeza adiada:', error?.message || error); }
  }
  return result;
}

export async function refundPostgresOcrCredit({ customerId, now, operationId }) {
  const key = [ownerId(customerId), day(now)];
  const operation = validOperationId(operationId);
  return getPostgresConnection().begin(async (tx) => {
    const [quota] = await tx.unsafe(LOCK_DAY, key);
    if (!quota) return 0;
    const [changed] = await tx.unsafe(MARK_REFUNDED, [...key, operation]);
    if (!changed) return Number(quota.used);
    const [updated] = await tx.unsafe(DECREMENT, key);
    return Math.max(0, Number(updated?.used) || 0);
  });
}
