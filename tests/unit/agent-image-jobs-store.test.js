import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => ({ connection: vi.fn(), project: vi.fn(), list: vi.fn() }));
vi.mock('../../api/lib/postgres-connection.js', () => ({ getPostgresConnection: mocked.connection }));
vi.mock('../../api/lib/library-sync-postgres.js', () => ({
  getAccountProject: mocked.project,
  listAccountProjects: mocked.list,
}));

import {
  createAgentImageJob, expireAgentImageJob, finishAgentImageJob, getAgentVisualJob,
  isImageJobStale, selectImageSlides, undoAgentVisualBatch,
} from '../../api/lib/agent-visual-batch.js';

const clone = value => structuredClone(value);
const owner = 'cus_alice';
const id = 'janine';
const tokenId = 'token-1';

function fixture() {
  return {
    id, version: 4, deleted: false,
    entry: {
      id, name: 'Clínica', updatedAt: 10,
      doc: { formatId: 'stories', brand: { titleColor: '#FFFFFF' }, slides: [
        { id: 's1', title: 'Com foto', bgImageAssetId: 'photo-1', imageQuery: 'retrato editorial em luz natural' },
        { id: 's2', title: 'Sem foto', imageQuery: 'consultório moderno com plantas', bgImage: null },
        { id: 's3', title: 'Sem direção', imageQuery: '' },
        { id: 's4', title: 'Sem foto 2', imageQuery: 'close em mãos digitando no notebook' },
      ] },
    },
  };
}

let rows;
let jobs;
let db;
const columns = row => clone(row);

function fakeQuery(sql, params) {
  if (sql.includes('FROM moont.account_libraries') && sql.includes('FOR UPDATE')) {
    return rows.has(params[0]) ? [{ owner_id: params[0] }] : [];
  }
  if (sql.includes('FROM moont.account_projects') && sql.includes('FOR UPDATE')) {
    const row = rows.get(params[0])?.get(params[1]);
    return row ? [{ project_id: row.id, entry: clone(row.entry), version: row.version, deleted_at: null }] : [];
  }
  if (sql.includes('FROM moont.agent_visual_jobs')) {
    if (sql.includes('undo_request_id = $2')) {
      const job = [...(jobs.get(params[0])?.values() || [])].find(item => item.undo_request_id === params[1]);
      return job ? [{ request_id: job.request_id }] : [];
    }
    const job = jobs.get(params[0])?.get(params[1]);
    return job ? [columns(job)] : [];
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
      request_hash: params[4], before_version: params[5], after_version: params[5],
      changed_slide_count: 0, changed_brand_fields: [], before_entry: JSON.parse(params[6]),
      status: 'pending', slides: JSON.parse(params[7]), meta: JSON.parse(params[8]),
      created_at: new Date().toISOString(), undone_at: null, undo_request_id: null, undo_version: null,
      error_code: null, finished_at: null,
    };
    jobs.get(params[0]).set(params[1], row);
    return [columns(row)];
  }
  if (sql.includes('DELETE FROM moont.agent_visual_jobs')) return [];
  if (sql.includes('UPDATE moont.agent_visual_jobs') && sql.includes('finished_at = now()')) {
    const job = jobs.get(params[0]).get(params[1]);
    Object.assign(job, {
      status: params[2], after_version: params[3], changed_slide_count: params[4],
      changed_brand_fields: JSON.parse(params[5]), slides: JSON.parse(params[6]), error_code: params[7],
      finished_at: 'later',
    });
    return [columns(job)];
  }
  if (sql.includes('UPDATE moont.agent_visual_jobs')) {
    const job = jobs.get(params[0]).get(params[1]);
    Object.assign(job, { status: 'undone', undone_at: 'later', undo_request_id: params[2], undo_version: params[3] });
    return [columns(job)];
  }
  throw new Error(`Unexpected SQL: ${sql}`);
}

beforeEach(() => {
  rows = new Map([[owner, new Map([[id, fixture()]])]]);
  jobs = new Map([[owner, new Map()]]);
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
});

const slides = [
  { slideId: 's2', operationId: 'mcp_op_s2' },
  { slideId: 's4', operationId: 'mcp_op_s4' },
];
const start = (requestId = 'image-job-01', extra = {}) => createAgentImageJob(owner, tokenId, {
  projectId: id, baseVersion: 4, requestId, slideIds: ['s2', 's4'], slides,
  meta: { aspectRatio: '9:16', periodStartSec: 100 }, ...extra,
});

describe('selectImageSlides', () => {
  it('sem slideIds escolhe os cards sem foto e recusa os sem imageQuery', () => {
    const entry = fixture().entry;
    expect(() => selectImageSlides(entry, undefined)).toThrow(expect.objectContaining({ code: 'image_query_missing', slideIds: ['s3'] }));
    entry.doc.slides[2].imageQuery = 'bastidores da equipe sorrindo';
    expect(selectImageSlides(entry, undefined).map(slide => slide.slideId)).toEqual(['s2', 's3', 's4']);
  });

  it('com slideIds recusa card inexistente, com foto e lista vazia', () => {
    const entry = fixture().entry;
    expect(() => selectImageSlides(entry, ['s2', 'zz'])).toThrow(expect.objectContaining({ code: 'image_slide_missing', slideIds: ['zz'] }));
    expect(() => selectImageSlides(entry, ['s1'])).toThrow(expect.objectContaining({ code: 'image_already_present', slideIds: ['s1'] }));
    expect(() => selectImageSlides(entry, [])).toThrow(expect.objectContaining({ code: 'image_slide_ids_invalid' }));
    expect(selectImageSlides(entry, ['s4', 's4'])).toEqual([{ slideId: 's4', imageQuery: 'close em mãos digitando no notebook' }]);
  });

  it('limita a 8 cards por chamada', () => {
    const entry = fixture().entry;
    entry.doc.slides = Array.from({ length: 9 }, (_, index) => ({ id: `c${index}`, imageQuery: 'direção de imagem válida' }));
    expect(() => selectImageSlides(entry, undefined)).toThrow(expect.objectContaining({ code: 'image_too_many_slides', max: 8 }));
  });
});

describe('agent image jobs store', () => {
  it('registra o job pendente sem tocar no projeto e repete pelo requestId', async () => {
    const created = await start();
    expect(created.existing).toBe(false);
    expect(created.job).toMatchObject({
      requestId: 'image-job-01', status: 'pending', kind: 'image', beforeVersion: 4, afterVersion: null,
      changedSlideCount: 0, slides: [{ slideId: 's2', status: 'pending' }, { slideId: 's4', status: 'pending' }],
      pollAfterMs: 30_000,
    });
    expect(created.job.slides[0]).not.toHaveProperty('operationId');
    expect(created.slides[0].operationId).toBe('mcp_op_s2');
    expect(rows.get(owner).get(id).version).toBe(4);
    const again = await start();
    expect(again.existing).toBe(true);
    expect(again.job.requestId).toBe('image-job-01');
    await expect(start('image-job-01', { slideIds: ['s2'] })).rejects.toMatchObject({ code: 'image_request_reused' });
  });

  it('recusa versão desatualizada e card que ganhou foto enquanto isso', async () => {
    await expect(start('image-job-02', { baseVersion: 3 })).rejects.toMatchObject({ code: 'project_conflict', cloudVersion: 4 });
    rows.get(owner).get(id).entry.doc.slides[1].bgImageAssetId = 'photo-new';
    await expect(start('image-job-03')).rejects.toMatchObject({ code: 'image_already_present', slideIds: ['s2'] });
    expect(jobs.get(owner).size).toBe(0);
  });

  it('conclui gravando só os cards prontos numa versão nova e permite desfazer', async () => {
    const before = clone(rows.get(owner).get(id).entry);
    await start();
    const finished = await finishAgentImageJob(owner, 'image-job-01', [
      { slideId: 's2', assetId: 'original_abc' }, { slideId: 's4', errorCode: 'sjinn_timeout' },
    ]);
    expect(finished.finished).toBe(true);
    expect(finished.job).toMatchObject({
      status: 'applied', beforeVersion: 4, afterVersion: 5, changedSlideCount: 1, changedBrandFields: ['image:s2'],
      slides: [{ slideId: 's2', status: 'done', assetId: 'original_abc' }, { slideId: 's4', status: 'failed', errorCode: 'sjinn_timeout' }],
    });
    expect(finished.slides.map(slide => slide.operationId)).toEqual(['mcp_op_s2', 'mcp_op_s4']);
    const after = rows.get(owner).get(id);
    expect(after.version).toBe(5);
    expect(after.entry.doc.slides[1]).toMatchObject({ bgImageAssetId: 'original_abc', bgImageSource: 'ai', imgMode: 'dalle', title: 'Sem foto' });
    expect(after.entry.doc.slides[3]).toEqual(before.doc.slides[3]);
    expect(after.entry.doc.slides[0]).toEqual(before.doc.slides[0]);
    expect(await getAgentVisualJob(owner, 'image-job-01')).toMatchObject({ status: 'applied', afterVersion: 5 });
    const second = await finishAgentImageJob(owner, 'image-job-01', []);
    expect(second.finished).toBe(false);
    const undone = await undoAgentVisualBatch(owner, { requestId: 'image-job-01', undoRequestId: 'image-job-01-undo' });
    expect(undone.status).toBe('undone');
    expect(rows.get(owner).get(id).entry.doc.slides.map(slide => slide.bgImageAssetId)).toEqual(['photo-1', undefined, undefined, undefined]);
  });

  it('falha tudo com project_conflict se o projeto mudou durante a geração', async () => {
    await start();
    rows.get(owner).get(id).version = 5;
    const finished = await finishAgentImageJob(owner, 'image-job-01', [{ slideId: 's2', assetId: 'original_abc' }]);
    expect(finished.job).toMatchObject({ status: 'failed', errorCode: 'project_conflict', afterVersion: 4, changedSlideCount: 0 });
    expect(finished.slides.every(slide => slide.status === 'failed' && slide.errorCode === 'project_conflict')).toBe(true);
    expect(rows.get(owner).get(id).entry.doc.slides[1].bgImageAssetId).toBeUndefined();
    await expect(undoAgentVisualBatch(owner, { requestId: 'image-job-01', undoRequestId: 'image-job-01-undo' }))
      .rejects.toMatchObject({ code: 'visual_undo_not_applicable' });
  });

  it('marca como failed sem gerar nada e recusa desfazer enquanto pendente', async () => {
    await start();
    await expect(undoAgentVisualBatch(owner, { requestId: 'image-job-01', undoRequestId: 'image-job-01-undo' }))
      .rejects.toMatchObject({ code: 'visual_job_pending' });
    const finished = await finishAgentImageJob(owner, 'image-job-01', []);
    expect(finished.job).toMatchObject({ status: 'failed', errorCode: 'image_generation_failed', afterVersion: 4 });
    expect(finished.job.slides.map(slide => slide.errorCode)).toEqual(['image_generation_failed', 'image_generation_failed']);
  });

  it('expira um job pendente antigo e devolve os créditos ao chamador', async () => {
    await start();
    const fresh = await expireAgentImageJob(owner, 'image-job-01');
    expect(fresh.expired).toBe(false);
    jobs.get(owner).get('image-job-01').created_at = new Date(Date.now() - 15 * 60_000).toISOString();
    expect(isImageJobStale(await getAgentVisualJob(owner, 'image-job-01'))).toBe(true);
    const expired = await expireAgentImageJob(owner, 'image-job-01');
    expect(expired.expired).toBe(true);
    expect(expired.job).toMatchObject({ status: 'failed', errorCode: 'image_job_timeout' });
    expect(expired.slides.map(slide => [slide.status, slide.operationId]))
      .toEqual([['failed', 'mcp_op_s2'], ['failed', 'mcp_op_s4']]);
    expect(expired.meta).toMatchObject({ kind: 'image', periodStartSec: 100 });
    expect(rows.get(owner).get(id).version).toBe(4);
  });
});
