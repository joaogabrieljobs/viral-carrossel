// MOO-18 (auditoria 20/11): códigos OAuth, refresh tokens vencidos e códigos
// do admin nunca eram apagados (34 de 34 códigos vencidos no banco vivo).
import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { cleanupExpiredOAuthArtifacts } from '../../api/lib/oauth-store.js';

vi.setConfig({ testTimeout: 30_000 });
let db; let sql;
beforeAll(async () => {
  db = new PGlite();
  const dir = new URL('../../db/migrations/', import.meta.url);
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) await db.exec(readFileSync(new URL(f, dir), 'utf8'));
  sql = { unsafe: (s, p = []) => db.query(s, p).then((r) => r.rows) };
  await db.exec(`
    INSERT INTO moont.oauth_clients (client_id, client_name, redirect_uris) VALUES ('11111111-1111-4111-8111-111111111111', 'Teste', ARRAY['https://claude.ai/cb']);
    INSERT INTO moont.oauth_codes (code_hash, client_id, owner_id, redirect_uri, resource, scopes, code_challenge, expires_at) VALUES
      ('velho', '11111111-1111-4111-8111-111111111111', 'cus_a', 'https://claude.ai/cb', 'r', ARRAY['projects:read'], 'c', now() - interval '3 days'),
      ('novo', '11111111-1111-4111-8111-111111111111', 'cus_a', 'https://claude.ai/cb', 'r', ARRAY['projects:read'], 'c', now() + interval '5 minutes');
    INSERT INTO moont.oauth_refresh_tokens (token_hash, client_id, owner_id, resource, scopes, expires_at, revoked_at) VALUES
      ('vencido', '11111111-1111-4111-8111-111111111111', 'cus_a', 'r', ARRAY['projects:read'], now() - interval '10 days', NULL),
      ('revogado', '11111111-1111-4111-8111-111111111111', 'cus_a', 'r', ARRAY['projects:read'], now() + interval '20 days', now() - interval '10 days'),
      ('ativo', '11111111-1111-4111-8111-111111111111', 'cus_a', 'r', ARRAY['projects:read'], now() + interval '20 days', NULL);
    INSERT INTO moont.admin_challenges (owner_id, action, payload_hash, code_hash, attempts, expires_at) VALUES
      ('cus_admin', 'grant', repeat('a', 64), repeat('b', 64), 0, now() - interval '2 days'),
      ('cus_admin', 'grant', repeat('c', 64), repeat('d', 64), 0, now() + interval '5 minutes');
  `);
}, 60_000);
afterAll(async () => { await db?.close(); });

describe('MOO-18 — limpeza diária de credenciais OAuth e códigos do admin', () => {
  it('apaga só o que venceu há mais de um dia (códigos) ou sete dias (refresh)', async () => {
    const result = await cleanupExpiredOAuthArtifacts({ sql });
    expect(result).toEqual({ codes: 1, refreshTokens: 2, adminChallenges: 1 });
    expect((await sql.unsafe('SELECT code_hash FROM moont.oauth_codes')).map((r) => r.code_hash)).toEqual(['novo']);
    expect((await sql.unsafe('SELECT token_hash FROM moont.oauth_refresh_tokens')).map((r) => r.token_hash)).toEqual(['ativo']);
    expect(await sql.unsafe('SELECT id FROM moont.admin_challenges')).toHaveLength(1);
  });
});
