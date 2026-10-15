import { createHash } from 'node:crypto';
import { getPostgresConnection } from './postgres-connection.js';

const UPSERT = `
  INSERT INTO moont.rate_limit_buckets (bucket_hash, window_slot, hits, expires_at)
  VALUES ($1, $2, 1, to_timestamp($3 / 1000.0))
  ON CONFLICT (bucket_hash, window_slot) DO UPDATE
    SET hits = LEAST(2147483647, moont.rate_limit_buckets.hits::bigint + 1)::integer,
        expires_at = GREATEST(moont.rate_limit_buckets.expires_at, EXCLUDED.expires_at)
  RETURNING hits
`;

const CLEANUP = `
  DELETE FROM moont.rate_limit_buckets
  WHERE ctid IN (
    SELECT ctid FROM moont.rate_limit_buckets
    WHERE expires_at < now()
    ORDER BY expires_at LIMIT 1000
  )
`;

/** Uma única operação SQL determina o resultado, mesmo entre lambdas. */
export async function consumePostgresRateLimit({ ip, keyPrefix, limit, windowMs, now = Date.now() }) {
  const slot = Math.floor(now / windowMs);
  const bucketHash = createHash('sha256')
    .update(`${windowMs}:${keyPrefix}:${ip}`)
    .digest('hex');
  const database = getPostgresConnection();
  const [row] = await database.unsafe(UPSERT, [bucketHash, slot, (slot + 2) * windowMs]);
  if (!row) throw new Error('Contador de rate limit sem resposta.');

  // Limpeza oportunista e limitada; não adiciona uma consulta a cada pedido.
  if (Math.random() < 0.01) {
    try { await database.unsafe(CLEANUP); }
    catch (error) { console.warn('[rate-limit] limpeza adiada:', error?.message || error); }
  }

  if (Number(row.hits) > limit) {
    return { retryAfterSec: Math.max(1, Math.ceil(((slot + 1) * windowMs - now) / 1000)) };
  }
  return null;
}
