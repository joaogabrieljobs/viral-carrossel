import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => ({ connection: vi.fn(), project: vi.fn(), list: vi.fn() }));
vi.mock('../../api/lib/postgres-connection.js', () => ({ getPostgresConnection: mocked.connection }));
vi.mock('../../api/lib/library-sync-postgres.js', () => ({
  getAccountProject: mocked.project,
  listAccountProjects: mocked.list,
}));

import {
  applyAgentVisualBatch, getAgentVisualJob, previewAgentVisualBatch, undoAgentVisualBatch,
} from '../../api/lib/agent-visual-batch.js';

const clone = value => structuredClone(value);
const owner = 'cus_alice';
const other = 'cus_bob';
const id = 'janine';
const tokenId = 'token-1';

function fixture() {
  return {
    id, version: 4, deleted: false,
    entry: {
      id, name: 'Clínica', updatedAt: 10, caption: 'Legenda final',
      doc: { brand: { titleColor: '#FFFFFF', logoImageId: 'logo-1' }, slides: [
        { id: 's1', title: 'Texto final', subtitle: 'Não alterar', bgImageAssetId: 'photo-1', titleSize: 100 },
        { id: 's2', title: 'Outro', bgImageAssetId: 'photo-2', titleSize: 100 },
      ] },
    },
  };
}

let rows;
let jobs;
let db;

function fakeQuery(sql, params) {
  if (sql.includes('FROM moont.account_libraries') && sql.includes('FOR UPDATE')) {
    return rows.has(params[0]) ? [{ owner_id: params[0] }] : [];
  }
  if (sql.includes('FROM moont.account_projects') && sql.includes('FOR UPDATE')) {
    const row = rows.get(params[0])?.get(params[1]);
    return row ? [{ project_id: row.id, entry: clone(row.entry), version: row.version, deleted_at: row.deleted ? 1 : null }] : [];
  }
  if (sql.includes('FROM moont.agent_visual_jobs')) {
    if (sql.includes('undo_request_id = $2')) {
      const job = [...(jobs.get(params[0])?.values() || [])]
        .find(item => item.undo_request_id === params[1]);
      return job ? [{ request_id: job.request_id }] : [];
    }
    const job = jobs.get(params[0])?.get(params[1]);
    return job ? [clone(job)] : [];
  }
  if (sql.includes('UPDATE moont.account_projects')) {
    const row = rows.get(params[0])?.get(params[1]);
    if (!row || row.version !== params[4]) return [];
    row.entry = JSON.parse(params[2]);
    row.version += 1;
    return [{ version: row.version }];
  }
  if (sql.includes('UPDATE moont.account_libraries')) return [];
  if (sql.includes('INSERT INTO moont.agent_visual_jobs')) {
    const row = {
      owner_id: params[0], request_id: params[1], project_id: params[2], token_id: params[3],
      request_hash: params[4], before_version: params[5], after_version: params[6],
      changed_slide_count: params[7], changed_brand_fields: JSON.parse(params[8]),
      before_entry: JSON.parse(params[9]), status: 'applied', created_at: 'now',
      undone_at: null, undo_request_id: null, undo_version: null,
    };
    jobs.get(params[0]).set(params[1], row);
    return [clone(row)];
  }
  if (sql.includes('DELETE FROM moont.agent_visual_jobs')) return [];
  if (sql.includes('UPDATE moont.agent_visual_jobs')) {
    const job = jobs.get(params[0]).get(params[1]);
    job.status = 'undone';
    job.undone_at = 'later';
    job.undo_request_id = params[2];
    job.undo_version = params[3];
    return [clone(job)];
  }
  throw new Error(`Unexpected SQL: ${sql}`);
}

beforeEach(() => {
  rows = new Map([[owner, new Map([[id, fixture()]])], [other, new Map()]]);
  jobs = new Map([[owner, new Map()], [other, new Map()]]);
  db = {
    unsafe: vi.fn(async (sql, params) => fakeQuery(sql, params)),
    begin: vi.fn(async work => {
      const priorRows = clone([...rows].map(([key, map]) => [key, [...map]]));
      const priorJobs = clone([...jobs].map(([key, map]) => [key, [...map]]));
      try { return await work({ unsafe: db.unsafe }); }
      catch (error) {
        rows = new Map(priorRows.map(([key, items]) => [key, new Map(items)]));
        jobs = new Map(priorJobs.map(([key, items]) => [key, new Map(items)]));
        throw error;
      }
    }),
  };
  mocked.connection.mockReturnValue(db);
  mocked.project.mockImplementation(async (who, projectId) => rows.get(who)?.get(projectId) || null);
  mocked.list.mockReset();
});

const applyInput = (requestId = 'janine-batch-01', patch = { titleSize: 112 }) => ({
  action: 'apply', projectId: id, baseVersion: 4, requestId, patch,
});

describe('agent visual batch store', () => {
  it('aplica todos os cards sem regravar texto, fotos, logo ou legenda; replay é idempotente', async () => {
    const before = clone(rows.get(owner).get(id).entry);
    const first = await applyAgentVisualBatch(owner, tokenId, applyInput());
    expect(first).toMatchObject({ status: 'applied', beforeVersion: 4, afterVersion: 5, changedSlideCount: 2 });
    const after = rows.get(owner).get(id).entry;
    expect(after.doc.slides.map(slide => slide.titleSize)).toEqual([112, 112]);
    expect(after.doc.slides.map(slide => [slide.title, slide.subtitle, slide.bgImageAssetId]))
      .toEqual(before.doc.slides.map(slide => [slide.title, slide.subtitle, slide.bgImageAssetId]));
    expect(after.doc.brand).toEqual(before.doc.brand);
    expect(after.caption).toBe(before.caption);
    const replay = await applyAgentVisualBatch(owner, tokenId, applyInput());
    expect(replay).toEqual(first);
    expect(rows.get(owner).get(id).version).toBe(5);
    expect(jobs.get(owner).size).toBe(1);
    await expect(applyAgentVisualBatch(owner, tokenId,
      applyInput('janine-batch-01', { titleSize: 130 }))).rejects.toMatchObject({ code: 'visual_request_reused' });
  });

  it('não cria nova versão num patch sem mudanças e ainda registra requestId', async () => {
    const job = await applyAgentVisualBatch(owner, tokenId,
      applyInput('janine-noop-01', { titleSize: 100 }));
    expect(job).toMatchObject({ beforeVersion: 4, afterVersion: 4, changedSlideCount: 0 });
    expect(rows.get(owner).get(id).version).toBe(4);
    expect(await getAgentVisualJob(owner, 'janine-noop-01')).toEqual(job);
  });

  it('recusa versão desatualizada e desfazer após edição de outra pessoa', async () => {
    await expect(previewAgentVisualBatch(owner, { projectId: id, baseVersion: 3,
      patch: { titleSize: 112 } })).rejects.toMatchObject({ code: 'project_conflict', cloudVersion: 4 });
    await expect(applyAgentVisualBatch(owner, tokenId,
      { ...applyInput('janine-stale-01'), baseVersion: 3 })).rejects.toMatchObject({ code: 'project_conflict', cloudVersion: 4 });
    await applyAgentVisualBatch(owner, tokenId, applyInput());
    rows.get(owner).get(id).version = 6;
    await expect(undoAgentVisualBatch(owner,
      { requestId: 'janine-batch-01', undoRequestId: 'janine-undo-01' }))
      .rejects.toMatchObject({ code: 'project_conflict', cloudVersion: 6 });
    expect(jobs.get(owner).get('janine-batch-01').status).toBe('applied');
  });

  it('desfaz com CAS e mantém isolamento por conta', async () => {
    await applyAgentVisualBatch(owner, tokenId, applyInput());
    await expect(getAgentVisualJob(other, 'janine-batch-01'))
      .rejects.toMatchObject({ code: 'visual_job_not_found' });
    await expect(applyAgentVisualBatch(other, tokenId, applyInput()))
      .rejects.toMatchObject({ code: 'visual_project_not_found' });
    const undone = await undoAgentVisualBatch(owner,
      { requestId: 'janine-batch-01', undoRequestId: 'janine-undo-01' });
    expect(undone).toMatchObject({ status: 'undone', beforeVersion: 4, afterVersion: 5, undoVersion: 6 });
    expect(rows.get(owner).get(id).entry.doc.slides[0].titleSize).toBe(100);
    expect(rows.get(owner).get(id).entry.doc.slides[0].bgImageAssetId).toBe('photo-1');
    expect(await undoAgentVisualBatch(owner,
      { requestId: 'janine-batch-01', undoRequestId: 'janine-undo-01' })).toEqual(undone);
  });
});
