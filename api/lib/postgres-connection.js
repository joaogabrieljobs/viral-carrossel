/**
 * Conexão curta para o pooler de transações do Supabase. `pg` envia uma query
 * por vez e mantém cada transação no mesmo cliente; funções Vercel não devem
 * usar o pooler com pipelining do Postgres.js.
 */
import pg from 'pg';
import { readFileSync } from 'node:fs';

const { Pool } = pg;
const pools = new Map();

function connectionUrl() {
  const value = process.env.DATABASE_URL?.trim() || process.env.POSTGRES_URL?.trim();
  if (!value) {
    throw Object.assign(new Error('Banco Postgres não configurado.'), {
      code: 'library_storage_unconfigured',
    });
  }
  return value;
}

function queryOn(client, statement, params = []) {
  if (typeof statement !== 'string' || !statement.trim() || !Array.isArray(params)) {
    throw new TypeError('Consulta Postgres inválida.');
  }
  return client.query(statement, params).then((result) => result.rows);
}

function transactionStatement(mode) {
  if (mode == null) return 'BEGIN';
  if (mode === 'isolation level repeatable read read only') {
    return 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY';
  }
  throw new TypeError('Modo de transação não permitido.');
}

function wrapPool(pool) {
  return {
    unsafe(statement, params = []) { return queryOn(pool, statement, params); },
    async begin(modeOrWork, maybeWork) {
      const mode = typeof modeOrWork === 'function' ? null : modeOrWork;
      const work = typeof modeOrWork === 'function' ? modeOrWork : maybeWork;
      if (typeof work !== 'function') throw new TypeError('Transação sem callback.');
      const client = await pool.connect();
      try {
        await client.query(transactionStatement(mode));
        const tx = { unsafe(statement, params = []) { return queryOn(client, statement, params); } };
        const value = await work(tx);
        await client.query('COMMIT');
        return value;
      } catch (error) {
        try { await client.query('ROLLBACK'); } catch { /* preservar erro original */ }
        throw error;
      } finally {
        client.release();
      }
    },
  };
}

export function getPostgresConnection() {
  const url = connectionUrl();
  if (!pools.has(url)) {
    // A flag do banco pode ficar desligada durante o rollout. Carregar o CA
    // apenas ao abrir a primeira conexão evita derrubar rotas legadas se o
    // arquivo não estiver no bundle de uma versão intermediária.
    const supabaseCa = readFileSync(new URL('./certs/prod-ca-2021.crt', import.meta.url), 'utf8');
    const pool = new Pool({
      connectionString: url,
      ssl: { ca: supabaseCa, rejectUnauthorized: true },
      max: 2,
      idleTimeoutMillis: 20_000,
      connectionTimeoutMillis: 10_000,
      query_timeout: 15_000,
      statement_timeout: 15_000,
    });
    pools.set(url, wrapPool(pool));
  }
  return pools.get(url);
}
