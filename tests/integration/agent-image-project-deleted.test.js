// MOO-29 (c): projeto apagado durante um job de imagem do MCP. Antes, a
// exclusão apagava também o job pendente; o fechamento falhava e as reservas
// `mcp_` ficavam presas, ou o job expirava estornando imagens já pagas ao
// provedor e gravadas. Agora o job pendente sobrevive (sem o snapshot do
// projeto) e pode ser fechado registrando os cards com imagem gravada.
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const holder = vi.hoisted(() => ({ sql: null }));
vi.mock('../../api/lib/postgres-connection.js', () => ({ getPostgresConnection: () => holder.sql }));

import { createLibraryPostgresStore } from '../../api/lib/library-sync-postgres.js';
import { closeAgentImageJobWithoutProject } from '../../api/lib/agent-visual-batch.js';

vi.setConfig({ testTimeout: 30_000 });
const OWNER = 'cus_mcp';
let db; let store;

beforeAll(async () => {
  db = new PGlite();
  const dir = new URL('../../db/migrations/', import.meta.url);
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) await db.exec(readFileSync(new URL(f, dir), 'utf8'));
  holder.sql = {
    unsafe: (s, p = []) => db.query(s, p).then((r) => r.rows),
    begin: (...args) => {
      const work = args.at(-1);
      return db.transaction((tx) => work({ unsafe: (s, p = []) => tx.query(s, p).then((r) => r.rows) }));
    },
  };
  store = createLibraryPostgresStore({ sql: holder.sql, readLegacyManifest: async () => null });
}, 60_000);
afterAll(async () => { await db?.close(); });

async function job(requestId, status, projectId = 'p1') {
  await holder.sql.unsafe(`INSERT INTO moont.agent_visual_jobs
    (owner_id, request_id, project_id, token_id, request_hash, before_version, after_version,
     changed_slide_count, before_entry, status, slides, meta)
    VALUES ($1, $2, $3, 'tok', repeat('a', 64), 1, 1, 0, '{"id":"p1","name":"Segredo"}'::jsonb, $4, $5::jsonb, '{"kind":"image","periodStartSec":100}'::jsonb)`,
  [OWNER, requestId, projectId, status, JSON.stringify([
    { slideId: 's1', status: 'pending', operationId: 'mcp_op1' },
    { slideId: 's2', status: 'pending', operationId: 'mcp_op2' },
  ])]);
}

describe('MOO-29: job de imagem do MCP com o projeto apagado no meio', () => {
  it('excluir o projeto mantém o job pendente (sem o snapshot) e apaga os terminados', async () => {
    const saved = await store.putAccountProject(OWNER, { id: 'p1', name: 'Projeto', doc: { slides: [] } }, { baseVersion: 0 });
    await job('image-pendente-01', 'pending');
    await job('image-aplicado-01', 'applied');
    await store.deleteAccountProject(OWNER, 'p1', { baseVersion: saved.version });
    const rows = await holder.sql.unsafe('SELECT request_id, status, before_entry FROM moont.agent_visual_jobs WHERE owner_id = $1 ORDER BY 1', [OWNER]);
    expect(rows).toEqual([{ request_id: 'image-pendente-01', status: 'pending', before_entry: {} }]);
  });

  it('fecha o job sem projeto: card com imagem gravada fica com o assetId para ser cobrado', async () => {
    const closed = await closeAgentImageJobWithoutProject(OWNER, 'image-pendente-01', [
      { slideId: 's1', assetId: 'original_' + 'b'.repeat(64) },
      { slideId: 's2', errorCode: 'sjinn_timeout' },
    ]);
    expect(closed.finished).toBe(true);
    expect(closed.job.status).toBe('failed');
    expect(closed.slides).toEqual([
      expect.objectContaining({ slideId: 's1', status: 'failed', errorCode: 'visual_project_not_found', assetId: 'original_' + 'b'.repeat(64), operationId: 'mcp_op1' }),
      expect.objectContaining({ slideId: 's2', status: 'failed', errorCode: 'sjinn_timeout', operationId: 'mcp_op2' }),
    ]);
    // Repetir não reabre nem muda o job.
    expect((await closeAgentImageJobWithoutProject(OWNER, 'image-pendente-01', [])).finished).toBe(false);
  });

  it('não fecha como órfão um job cujo projeto ainda existe', async () => {
    const saved = await store.putAccountProject(OWNER, { id: 'p2', name: 'Vivo', doc: { slides: [] } }, { baseVersion: 0 });
    expect(saved.version).toBe(1);
    await job('image-vivo-0001', 'pending', 'p2');
    await expect(closeAgentImageJobWithoutProject(OWNER, 'image-vivo-0001', [])).rejects.toMatchObject({ code: 'visual_project_exists' });
  });
});
