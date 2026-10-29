import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { FilePlanStore } from '../src/plan-store.mjs';
import { createMoontTools } from '../src/tools.mjs';

async function withTools(fakeClient, callback) {
  const directory = await mkdtemp(join(tmpdir(), 'moont-plugin-test-'));
  try {
    return await callback(createMoontTools(fakeClient, { plans: new FilePlanStore(directory) }), directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test('preview and apply preserve a complete multi-page selection and reuse request IDs', async () => {
  const projects = Array.from({ length: 205 }, (_, index) => ({ id: `project-${index}`, version: 2, name: `Project ${index}` }));
  const calls = { applied: [], previews: [] };
  const client = {
    async listProjects({ cursor }) {
      const start = cursor ? Number(cursor) : 0;
      const next = start + 100;
      return { ok: true, projects: projects.slice(start, next), nextCursor: next < projects.length ? String(next) : null, total: projects.length };
    },
    async getProject(id) {
      return { ok: true, project: { id, name: id, version: 2, slides: Array.from({ length: 23 }, (_, i) => ({ id: `${id}-slide-${i}` })) } };
    },
    async preview(input) {
      calls.previews.push(input);
      return { ok: true, selectedSlideCount: 23, changedSlideCount: 23, changes: [{ field: 'titleSize' }] };
    },
    async apply(input) {
      calls.applied.push(input);
      return { ok: true, job: { projectId: input.projectId, requestId: input.requestId, status: 'applied', beforeVersion: 2, afterVersion: 3 } };
    },
  };

  await withTools(client, async (tools) => {
    const preview = await tools.invoke('preview_visual_batch', { allProjects: true, patch: { titleSize: 110 } });
    assert.equal(preview.projectCount, 205);
    assert.equal(preview.changedSlideCount, 205 * 23);
    assert.equal(preview.projects.length, 20);
    assert.equal(preview.nextOffset, 20);
    assert.equal(calls.previews.length, 205);
    const lastPreviewPage = await tools.invoke('get_batch_preview', { planId: preview.planId, offset: 200 });
    assert.equal(lastPreviewPage.projects.length, 5);
    assert.equal(lastPreviewPage.nextOffset, null);
    assert.ok(calls.previews.every((call) => call.slideIds === null));
    const applied = await tools.invoke('apply_visual_batch', { planId: preview.planId });
    assert.equal(applied.appliedCount, 205);
    assert.equal(applied.applied.length, 20);
    assert.equal(new Set(calls.applied.map((call) => call.requestId)).size, 205);
    await tools.invoke('apply_visual_batch', { planId: preview.planId });
    assert.equal(calls.applied.length, 205, 'already applied projects should not be written twice');
  });
});

test('batch plan can resume after a preview failure and after plugin restart', async () => {
  let fail = true;
  const client = {
    async getProject(id) { return { ok: true, project: { id, version: 7, slides: [] } }; },
    async preview({ projectId }) {
      if (projectId === 'b' && fail) throw Object.assign(new Error('temporary failure'), { code: 'rate_limited' });
      return { ok: true, selectedSlideCount: 1, changedSlideCount: 1, changes: [] };
    },
  };
  await withTools(client, async (tools, directory) => {
    const first = await tools.invoke('preview_visual_batch', { projectIds: ['a', 'b', 'c'], patch: { titleSize: 105 } });
    assert.equal(first.status, 'partial_preview');
    assert.equal(first.previewedProjectCount, 1);
    await assert.rejects(() => tools.invoke('apply_visual_batch', { planId: first.planId }), { code: 'preview_incomplete' });
    fail = false;
    const restarted = createMoontTools(client, { plans: new FilePlanStore(directory) });
    const resumed = await restarted.invoke('preview_visual_batch', { resumePlanId: first.planId });
    assert.equal(resumed.projectCount, 3);
    assert.equal(resumed.status, 'previewed');
  });
});

test('brand scope is explicit and read-only design omits text by default', async () => {
  const client = {
    async getProject() {
      return { ok: true, project: { id: 'p', version: 1, name: 'P', slides: [{ id: 's', index: 1, title: 'Private title', subtitle: 'Private subtitle', visual: { titleSize: 90 } }] } };
    },
  };
  await withTools(client, async (tools) => {
    await assert.rejects(() => tools.invoke('preview_visual_batch', { projectId: 'p', patch: { brand: { titleColor: '#333333' } } }), { code: 'brand_scope_required' });
    const design = await tools.invoke('get_project_design', { projectId: 'p' });
    assert.equal(design.project.slides[0].title, undefined);
    assert.equal(design.project.slides[0].subtitle, undefined);
    assert.equal(design.project.slides[0].visual.titleSize, 90);
  });
});

test('text edit requires preview, preserves one plan and can be undone with the generic tool', async () => {
  const calls = { previews: [], applies: [], undos: [] };
  const client = {
    async getProject() {
      return { ok: true, project: { id: 'p', version: 4, name: 'Projeto', caption: 'Legenda', slides: [{ id: 's1', title: 'Antes', subtitle: 'Apoio' }] } };
    },
    async getContentSchema() { return { ok: true, schema: { slideEdits: {} } }; },
    async previewText(input) {
      calls.previews.push(input);
      return { ok: true, changedSlideCount: 1, changes: [{ slideId: 's1', fields: { title: { before: 'Antes', after: 'Depois' } } }] };
    },
    async applyText(input) {
      calls.applies.push(input);
      return { ok: true, job: { projectId: input.projectId, requestId: input.requestId, status: 'applied', beforeVersion: 4, afterVersion: 5 } };
    },
    async undo(input) {
      calls.undos.push(input);
      return { ok: true, job: { requestId: input.requestId, status: 'undone' } };
    },
  };
  await withTools(client, async tools => {
    assert.equal((await tools.invoke('get_project_content', { projectId: 'p' })).project.slides[0].title, 'Antes');
    assert.ok((await tools.invoke('get_content_schema', {})).schema.slideEdits);
    const preview = await tools.invoke('preview_text_edit', { projectId: 'p', patch: { slideEdits: [{ slideId: 's1', title: 'Depois' }] } });
    assert.equal(preview.changedSlideCount, 1);
    const applied = await tools.invoke('apply_text_edit', { planId: preview.planId });
    assert.equal(applied.status, 'applied');
    await tools.invoke('apply_text_edit', { planId: preview.planId });
    assert.equal(calls.applies.length, 1);
    const undone = await tools.invoke('undo_project_change', { planId: preview.planId });
    assert.equal(undone.status, 'undone');
    assert.equal(calls.undos.length, 1);
  });
});

test('generate_slide_image forwards version, cards and idempotency key', async () => {
  const calls = [];
  const client = {
    async generateImage(input) {
      calls.push(input);
      return { ok: true, job: { requestId: input.requestId, status: 'pending', slides: (input.slideIds || ['all']).map((slideId) => ({ slideId, status: 'pending' })) } };
    },
  };
  await withTools(client, async tools => {
    const result = await tools.invoke('generate_slide_image', {
      projectId: 'p', baseVersion: 7, slideIds: ['s1', 's2'], requestId: 'image-request-01',
    });
    assert.equal(result.job.status, 'pending');
    assert.deepEqual(calls, [{ projectId: 'p', baseVersion: 7, slideIds: ['s1', 's2'], requestId: 'image-request-01' }]);
    const all = await tools.invoke('generate_slide_image', { projectId: 'p', baseVersion: 7, requestId: 'image-request-02' });
    assert.equal(all.job.slides[0].slideId, 'all');
    assert.equal(calls[1].slideIds, undefined);
    await assert.rejects(
      tools.invoke('generate_slide_image', { projectId: 'p', baseVersion: 7, slideIds: [], requestId: 'image-request-03' }),
      (error) => error.code === 'invalid_input',
    );
  });
});

test('undo uses idempotent IDs and stops on a version conflict', async () => {
  const calls = [];
  const client = {
    async undo(payload) {
      calls.push(payload);
      if (payload.requestId === 'first') throw Object.assign(new Error('Project changed'), { code: 'version_conflict', cloudVersion: 9 });
      return { ok: true, job: { requestId: payload.requestId, status: 'undone' } };
    },
  };
  await withTools(client, async (tools) => {
    const result = await tools.invoke('undo_visual_batch', { requestIds: ['first', 'second'] });
    assert.equal(result.status, 'partial');
    assert.deepEqual(calls.map((call) => call.requestId), ['second', 'first']);
    assert.match(calls[0].undoRequestId, /^undo:[0-9a-f]{64}$/);
    assert.equal(result.failed.cloudVersion, 9);
  });
});

test('undo resumes across plugin restarts without repeating completed projects', async () => {
  const calls = [];
  let fail = true;
  const client = {
    async undo(payload) {
      calls.push(payload);
      if (payload.requestId === 'first' && fail) throw Object.assign(new Error('temporary'), { code: 'network_error' });
      return { ok: true, job: { requestId: payload.requestId, status: 'undone' } };
    },
  };
  await withTools(client, async (tools, directory) => {
    const first = await tools.invoke('undo_visual_batch', { requestIds: ['first', 'second'] });
    assert.equal(first.status, 'partial');
    assert.equal(first.undoneCount, 1);
    fail = false;
    const restarted = createMoontTools(client, { plans: new FilePlanStore(directory) });
    const result = await restarted.invoke('undo_visual_batch', { resumeUndoPlanId: first.undoPlanId });
    assert.equal(result.status, 'undone');
    assert.equal(result.undoneCount, 2);
    assert.deepEqual(calls.map((call) => call.requestId), ['second', 'first', 'first']);
    const status = await restarted.invoke('get_batch_status', { planId: first.undoPlanId });
    assert.equal(status.status, 'undone');
    assert.equal(status.total, 2);
  });
});
