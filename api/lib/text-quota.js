import { getPostgresConnection } from './postgres-connection.js';
import { ocrQuotaDay } from './ocr-quota.js';

// Cota diária do texto incluso no plano, por conta (MOO-11). Generosa: uma
// geração completa faz dezenas de pedidos; o objetivo é limitar abuso da
// chave da plataforma, não o uso normal. Ajustável por TEXT_DAILY_LIMIT.
export const DEFAULT_TEXT_DAILY_LIMIT = 800;

export function textDailyLimit(env = process.env) {
  const value = Number(env.TEXT_DAILY_LIMIT);
  return Number.isSafeInteger(value) && value > 0 ? value : DEFAULT_TEXT_DAILY_LIMIT;
}

export function createTextQuota({ sql: injectedSql } = {}) {
  const connection = () => injectedSql || getPostgresConnection();
  async function consume({ customerId, limit = textDailyLimit(), now = Date.now() }) {
    const owner = String(customerId || '').slice(0, 255);
    if (!owner) return { allowed: false, used: 0, limit };
    const day = ocrQuotaDay(now);
    const rows = await connection().unsafe(
      `INSERT INTO moont.text_daily_usage (owner_id, quota_day, used) VALUES ($1, $2::date, 1)
       ON CONFLICT (owner_id, quota_day) DO UPDATE
         SET used = moont.text_daily_usage.used + 1, updated_at = now()
         WHERE moont.text_daily_usage.used < $3
       RETURNING used`, [owner, day, limit]);
    if (rows.length) return { allowed: true, used: Number(rows[0].used), limit };
    return { allowed: false, used: limit, limit };
  }
  return { consume };
}

const production = createTextQuota();
export const consumeTextCredit = (input) => production.consume(input);
