import { getPostgresConnection } from './postgres-connection.js';
import { ocrQuotaDay } from './ocr-quota.js';

// Cota diária do texto incluso no plano, por conta (MOO-11). Uma geração
// completa faz dezenas de pedidos; o objetivo é limitar abuso da chave da
// plataforma, não o uso normal. O teto acompanha o plano (auditoria Ingrid
// 23/11, D-3): 800 por dia valiam até no Essencial. Ajustável por plano com
// TEXT_DAILY_LIMIT_ESSENTIAL, _CREATOR, _PRO e _MAX.
export const DEFAULT_TEXT_DAILY_LIMITS = Object.freeze({
  essential: 150,
  creator: 400,
  pro: 800,
  max: 800,
});

const TEXT_LIMIT_ENV = Object.freeze({
  essential: 'TEXT_DAILY_LIMIT_ESSENTIAL',
  creator: 'TEXT_DAILY_LIMIT_CREATOR',
  pro: 'TEXT_DAILY_LIMIT_PRO',
  max: 'TEXT_DAILY_LIMIT_MAX',
});

/** Plano desconhecido ou ausente recebe o menor teto, nunca o maior. */
export function textDailyLimit(tier, env = process.env) {
  const plan = Object.hasOwn(DEFAULT_TEXT_DAILY_LIMITS, tier) ? tier : 'essential';
  const value = Number(env[TEXT_LIMIT_ENV[plan]]);
  return Number.isSafeInteger(value) && value > 0 ? value : DEFAULT_TEXT_DAILY_LIMITS[plan];
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
