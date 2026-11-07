import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function migration(name) {
  return readFileSync(new URL(`../../db/migrations/${name}`, import.meta.url), 'utf8');
}

describe('migrações de hardening do banco', () => {
  it('permite reaplicar a migração de jobs de imagem sem duplicar constraints', () => {
    const ddl = migration('009_agent_image_jobs.sql');
    for (const constraint of [
      'agent_visual_jobs_status_check',
      'agent_visual_jobs_slides_check',
      'agent_visual_jobs_meta_check',
    ]) {
      const drop = ddl.indexOf(`DROP CONSTRAINT IF EXISTS ${constraint}`);
      const add = ddl.indexOf(`ADD CONSTRAINT ${constraint}`);
      expect(drop, `${constraint} precisa ser removida com guarda`).toBeGreaterThan(-1);
      expect(add, `${constraint} precisa ser recriada`).toBeGreaterThan(drop);
    }
  });

  it('vincula refresh tokens e authorization codes à época de segurança da conta', () => {
    const ddl = migration('010_oauth_refresh_security_context.sql');
    expect(ddl).toContain('ALTER TABLE moont.oauth_refresh_tokens');
    expect(ddl).toContain('ALTER TABLE moont.oauth_codes');
    expect(ddl.match(/ADD COLUMN IF NOT EXISTS agent_epoch/g)).toHaveLength(2);
    expect(ddl.match(/ADD COLUMN IF NOT EXISTS account_id/g)).toHaveLength(2);
    expect(ddl).toContain('ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now()');
  });
});
