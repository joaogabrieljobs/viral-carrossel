// MOO-04 (auditoria 20/11): refresh token já usado só recebia invalid_grant.
// Quem roubasse um refresh e renovasse primeiro mantinha uma família própria,
// viva para sempre, mesmo depois de o usuário reconectar.
import { beforeAll, beforeEach, afterAll, describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';

vi.setConfig({ testTimeout: 30_000 });
const box = vi.hoisted(() => ({ sql: null }));
vi.mock('../../api/lib/postgres-connection.js', () => ({ getPostgresConnection: () => box.sql }));
vi.mock('../../api/lib/agent-token-store.js', async (original) => ({
  ...(await original()),
  getCurrentAgentSecurityContext: async () => ({ agentEpoch: 'e1', accountId: null, sessionRevokedBefore: 0 }),
}));
const { rotateRefreshToken, revokeSupersededRefreshTokens } = await import('../../api/lib/oauth-store.js');

const CLIENT = '11111111-1111-4111-8111-111111111111';
const OWNER = 'cus_alice';
const sha = (v) => createHash('sha256').update(v).digest('hex');
let db;
beforeAll(async () => {
  db = new PGlite();
  const dir = new URL('../../db/migrations/', import.meta.url);
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) await db.exec(readFileSync(new URL(f, dir), 'utf8'));
  box.sql = {
    unsafe: (s, p = []) => db.query(s, p).then((r) => r.rows),
    begin: (work) => db.transaction((tx) => work({ unsafe: (s, p = []) => tx.query(s, p).then((r) => r.rows) })),
  };
  await db.exec(`INSERT INTO moont.oauth_clients (client_id, client_name, redirect_uris) VALUES ('${CLIENT}', 'Claude', ARRAY['https://claude.ai/cb'])`);
}, 60_000);
afterAll(async () => { await db?.close(); });
beforeEach(async () => {
  await db.exec('DELETE FROM moont.oauth_refresh_tokens; DELETE FROM moont.agent_tokens;');
});

const insertRefresh = (token, extra = '') => db.exec(`INSERT INTO moont.oauth_refresh_tokens
  (token_hash, client_id, owner_id, resource, scopes, agent_epoch, expires_at${extra ? ', revoked_at' : ''})
  VALUES ('${sha(token)}', '${CLIENT}', '${OWNER}', 'https://moont.ai/mcp', ARRAY['projects:read','projects:write'], 'e1', now() + interval '20 days'${extra ? `, ${extra}` : ''})`);
const insertAccess = () => db.exec(`INSERT INTO moont.agent_tokens (id, owner_id, agent_epoch, token_hash, label, scopes, expires_at, oauth_client_id)
  VALUES ('33333333-3333-4333-8333-333333333333', '${OWNER}', 'e1', '${'a'.repeat(64)}', 'MCP', ARRAY['projects:read'], now() + interval '1 hour', '${CLIENT}')`);
const live = async (table, column) => (await db.query(`SELECT ${column} FROM moont.${table} WHERE revoked_at IS NULL`)).rows.length;

describe('MOO-04 — reuso de refresh token derruba a família', () => {
  it('refresh já rotacionado reapresentado depois da janela revoga refresh e acesso do par conta+cliente', async () => {
    await insertRefresh('moont_refresh_velho', "now() - interval '1 minute'");
    await insertRefresh('moont_refresh_atual');
    await insertAccess();
    await expect(rotateRefreshToken({ token: 'moont_refresh_velho', clientId: CLIENT, resource: 'https://moont.ai/mcp' }))
      .rejects.toMatchObject({ code: 'invalid_grant' });
    expect(await live('oauth_refresh_tokens', 'token_hash')).toBe(0);
    expect(await live('agent_tokens', 'id')).toBe(0);
  });

  it('nova tentativa do mesmo refresh logo após a rotação (rede caiu) não derruba a família', async () => {
    await insertRefresh('moont_refresh_velho', "now() - interval '2 seconds'");
    await insertRefresh('moont_refresh_atual');
    await expect(rotateRefreshToken({ token: 'moont_refresh_velho', clientId: CLIENT, resource: 'https://moont.ai/mcp' }))
      .rejects.toMatchObject({ code: 'invalid_grant' });
    expect(await live('oauth_refresh_tokens', 'token_hash')).toBe(1);
  });

  it('nova autorização do mesmo cliente revoga os refresh anteriores, menos o recém-emitido', async () => {
    await insertRefresh('moont_refresh_a');
    await insertRefresh('moont_refresh_b');
    await revokeSupersededRefreshTokens(OWNER, CLIENT, 'moont_refresh_b');
    const rows = (await db.query('SELECT token_hash FROM moont.oauth_refresh_tokens WHERE revoked_at IS NULL')).rows;
    expect(rows.map((r) => r.token_hash)).toEqual([sha('moont_refresh_b')]);
  });
});
