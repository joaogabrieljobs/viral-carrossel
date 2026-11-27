import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { analyzeReferenceVisuals, resolveReferenceVisualRecordForKit } from '../../src/utils/reference-visual-client.js';
import { matchingReferenceVisualRecord, referenceVisualAnalysisForSavedPlan,
  recordMatchesKit, rebindReferenceVisualRecord, referenceVisualRecordForKit } from '../../src/utils/reference-visual-cache.js';
import { originalImageAssetId } from '../../src/utils/cloud-image-assets.js';
import { packLibraryForCloud, hydrateProjectEntryFromCloud } from '../../src/utils/library-sync.js';
import { normalizeStyleKit } from '../../src/utils/style-kit.js';
import { migrateProjectReferences } from '../../src/utils/style-kit-storage.js';

const stored = vi.hoisted(() => ({ bytes: new Map(), nextId: 0 }));
vi.mock('../../src/utils/image-store.js', async importOriginal => ({
  ...(await importOriginal()),
  imagemComoDataUrl: async id => stored.bytes.get(id) || null,
  newImageId: () => `reopened-${++stored.nextId}`,
  imagePut: async (id, blob) => stored.bytes.set(id,
    `data:${blob.type};base64,${Buffer.from(await blob.arrayBuffer()).toString('base64')}`),
}));

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a6xkAAAAASUVORK5CYII=';
const OTHER = 'data:image/png;base64,YW5vdGhlci1vcmlnaW5hbA==';
const THUMBNAIL = 'data:image/jpeg;base64,dHJhbnNwb3J0LWNvcHk=';
const analysis = {
  schemaVersion: 1,
  evidence: { medium: 'Editorial photograph.', light: 'Lateral orange light.',
    finish: 'Visible grain.', graphics: 'Sparse cyan marks.' },
  interpretation: { atmosphere: 'Warm and energetic.' },
  direction: { invariants: ['Preserve the observed texture.'], variables: ['Gesture and framing.'],
    restrictions: ['No baked lettering.'], composition: 'Keep the text region quiet.' },
  synthesis: 'Editorial photograph with orange lateral light, visible grain and sparse cyan marks.',
};
const context = { brief: 'A new cultural event.', application: 'Presentation 16:9' };
const kit = normalizeStyleKit({ stylePrompt: 'Follow the attached reference.', contextMd: '# The project',
  refImages: [{ id: 'stable-reference', imageId: 'local-original', name: 'Reference' }] });
const plan = { referenceVisualAnalysis: analysis };

function memoryStorage() {
  const map = new Map();
  return { getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, String(value)),
    removeItem: key => map.delete(key), clear: () => map.clear(), key: index => [...map.keys()][index] ?? null,
    get length() { return map.size; } };
}

async function analyzed(input = kit, sources = [PNG]) {
  return analyzeReferenceVisuals({ kit: input, ...context, loadSources: async () => sources }, {
    transport: async () => analysis, prepare: async () => sources.map(() => THUMBNAIL),
  });
}

async function packed(input) {
  return packLibraryForCloud({ library: [{ id: 'project', name: 'Project', doc: {
    slides: [{ id: 'slide', title: 'Unchanged text' }], brand: { name: 'Brand' },
    styleKit: input, presentationPlan: plan,
  } }], brandRoster: [], libraryFolders: [], activeDocId: 'project', activeBrandId: '' });
}

beforeEach(() => {
  stored.bytes.clear(); stored.nextId = 0;
  stored.bytes.set('local-original', PNG);
  vi.stubGlobal('localStorage', memoryStorage());
  vi.stubGlobal('sessionStorage', memoryStorage());
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('No network expected.'); }));
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('a análise acompanha os mesmos pixels entre o navegador e a nuvem', () => {
  it('identifica o original, não o JPEG de transporte, sem persistir pixels ou briefing', async () => {
    const { record } = await analyzed();
    expect(record.contentIds).toEqual([await originalImageAssetId(PNG)]);
    expect(record.contentIds).not.toContain(await originalImageAssetId(THUMBNAIL));
    expect(record.briefKey).toMatch(/^[a-f0-9]{16}$/);
    expect(JSON.stringify(record)).not.toContain('data:image');
    expect(JSON.stringify(record)).not.toContain(context.brief);
  });

  it('salva, hidrata com novo ID local e mantém análise e cache do mesmo briefing', async () => {
    const { record } = await analyzed();
    const source = { ...kit, referenceVisual: record };
    const sourceSnapshot = structuredClone(source);
    const { manifest, assets } = await packed(source);
    const remote = manifest.docs[0].doc.styleKit;
    expect(remote.refImages[0].assetId).toBe(await originalImageAssetId(PNG));
    expect(matchingReferenceVisualRecord(remote, context)).not.toBeNull();
    const { entry } = await hydrateProjectEntryFromCloud(manifest.docs[0], { localAssets: assets });
    const reopened = entry.doc.styleKit;
    expect(reopened.refImages[0].imageId).not.toBe('local-original');
    expect(recordMatchesKit(reopened.referenceVisual, reopened)).toBe(true);
    expect(referenceVisualAnalysisForSavedPlan(entry.doc.presentationPlan, reopened)?.synthesis).toBe(analysis.synthesis);
    const transport = vi.fn();
    const prepare = vi.fn();
    const result = await analyzeReferenceVisuals({ kit: reopened, ...context,
      loadSources: async () => [stored.bytes.get(reopened.refImages[0].imageId)] }, { transport, prepare });
    expect(result.cached).toBe(true);
    expect(transport).not.toHaveBeenCalled();
    expect(prepare).not.toHaveBeenCalled();
    expect(matchingReferenceVisualRecord(reopened, { ...context, brief: 'A different event.' })).toBeNull();
    expect(source).toEqual(sourceSnapshot);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('reavalia se os bytes mudarem mesmo mantendo o ID local', async () => {
    const { record } = await analyzed();
    const transport = vi.fn(async () => analysis);
    const result = await analyzeReferenceVisuals({ kit: { ...kit, referenceVisual: record }, ...context,
      loadSources: async () => [OTHER] }, { transport, prepare: async value => value });
    expect(result.cached).toBe(false);
    expect(transport).toHaveBeenCalledTimes(1);
    expect(result.record.contentIds).toEqual([await originalImageAssetId(OTHER)]);
    expect(record.contentIds).toEqual([await originalImageAssetId(PNG)]);
  });

  it('aplica resultado pendente quando o mesmo original foi canonizado antes do fim da análise', async () => {
    const started = { ...kit, refImages: [{ ...kit.refImages[0], assetId: 'legacy-reference' }] };
    const { record } = await analyzed(started);
    // A sincronização terminou enquanto a visão/redação ainda estava em curso:
    // o novo record ainda não estava no kit entregue ao pack.
    const { manifest, assets } = await packed(started);
    const { entry } = await hydrateProjectEntryFromCloud(manifest.docs[0], { localAssets: assets });
    const current = entry.doc.styleKit;
    expect(current).not.toHaveProperty('referenceVisual');
    expect(recordMatchesKit(record, current)).toBe(false);
    const restored = referenceVisualRecordForKit(record, started, current);
    expect(recordMatchesKit(restored, current)).toBe(true);
    expect(restored.contentIds).toEqual([await originalImageAssetId(PNG)]);
    expect(restored.briefKey).toBe(record.briefKey);
    expect(referenceVisualAnalysisForSavedPlan(plan, { ...current, referenceVisual: restored })?.synthesis).toBe(analysis.synthesis);
  });

  it('não confunde edição concorrente de imagem ou direção com canonização do mesmo original', async () => {
    const { record } = await analyzed();
    stored.bytes.set('local-original', OTHER);
    const { manifest } = await packed(kit);
    expect(referenceVisualRecordForKit(record, kit, manifest.docs[0].doc.styleKit)).toBeNull();
    expect(referenceVisualRecordForKit(record, kit, { ...kit, stylePrompt: 'A new direction.' })).toBeNull();
  });

  it('conserva o resultado compatível sem exigir uma conversão de IDs', async () => {
    const { record } = await analyzed();
    expect(referenceVisualRecordForKit(record, kit, kit)).toEqual(record);
  });

  it('confere os bytes após migração inline→IndexedDB que ainda conserva assetId legado', async () => {
    const source = normalizeStyleKit({ ...kit, refImages: [{ id: 'legacy-reference', assetId: 'legacy-reference', dataUrl: PNG }] });
    const { record } = await analyzed(source);
    const current = await migrateProjectReferences(source);
    expect(current.refImages[0]).toMatchObject({ assetId: 'legacy-reference', imageId: expect.any(String) });
    expect(current.refImages[0]).not.toHaveProperty('dataUrl');
    expect(referenceVisualRecordForKit(record, source, current)).toBeNull();
    const loadSources = vi.fn(async () => [stored.bytes.get(current.refImages[0].imageId)]);
    const bound = await resolveReferenceVisualRecordForKit(record, source, current, { loadSources });
    expect(loadSources).toHaveBeenCalledTimes(1);
    expect(recordMatchesKit(bound, current)).toBe(true);
    const { manifest, assets } = await packed({ ...current, referenceVisual: bound });
    const { entry } = await hydrateProjectEntryFromCloud(manifest.docs[0], { localAssets: assets });
    expect(referenceVisualAnalysisForSavedPlan(plan, entry.doc.styleKit)?.synthesis).toBe(analysis.synthesis);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('não vincula assetId legado só pelo nome quando faltam bytes ou são de outra imagem', async () => {
    const source = normalizeStyleKit({ ...kit, refImages: [{ id: 'legacy-reference', assetId: 'legacy-reference', dataUrl: PNG }] });
    const { record } = await analyzed(source);
    const current = await migrateProjectReferences(source);
    for (const loadSources of [async () => [], async () => [OTHER], async () => { throw new Error('missing'); }]) {
      expect(await resolveReferenceVisualRecordForKit(record, source, current, { loadSources })).toBeNull();
    }
  });

  it('não relê mídia quando o vínculo já é compatível ou a conversão canônica está comprovada', async () => {
    const { record } = await analyzed();
    const loadSources = vi.fn(() => { throw new Error('No read expected.'); });
    expect(await resolveReferenceVisualRecordForKit(record, kit, kit, { loadSources })).toEqual(record);
    const current = { ...kit, refImages: [{ id: kit.refImages[0].id, assetId: await originalImageAssetId(PNG) }] };
    expect(recordMatchesKit(await resolveReferenceVisualRecordForKit(record, kit, current, { loadSources }), current)).toBe(true);
    expect(loadSources).not.toHaveBeenCalled();
  });

  it('propaga cancelamento enquanto os originais atuais estão sendo lidos', async () => {
    const source = normalizeStyleKit({ ...kit, refImages: [{ id: 'legacy-reference', assetId: 'legacy-reference', dataUrl: PNG }] });
    const { record } = await analyzed(source);
    const current = await migrateProjectReferences(source);
    const controller = new AbortController();
    const loadSources = async () => { controller.abort(); return [PNG]; };
    await expect(resolveReferenceVisualRecordForKit(record, source, current, { loadSources, signal: controller.signal }))
      .rejects.toMatchObject({ name: 'AbortError' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('não vincula a leitura antiga a bytes novos no pack, mesmo sob o mesmo ID', async () => {
    const { record } = await analyzed();
    stored.bytes.set('local-original', OTHER);
    const { manifest } = await packed({ ...kit, referenceVisual: record });
    const remote = manifest.docs[0].doc.styleKit;
    expect(remote.refImages[0].assetId).toBe(await originalImageAssetId(OTHER));
    expect(remote).not.toHaveProperty('referenceVisual');
    expect(referenceVisualAnalysisForSavedPlan(plan, remote)).toBeNull();
  });

  it('rejeita bytes locais alterados que ainda alegam o assetId antigo na hidratação', async () => {
    const { record } = await analyzed();
    const { manifest } = await packed({ ...kit, referenceVisual: record });
    const remote = manifest.docs[0];
    const localEntry = structuredClone(remote);
    localEntry.doc.styleKit.refImages[0].imageId = 'changed-under-the-same-asset';
    stored.bytes.set('changed-under-the-same-asset', OTHER);
    const { entry } = await hydrateProjectEntryFromCloud(remote, { localEntry });
    expect(entry.doc.styleKit).not.toHaveProperty('referenceVisual');
    expect(referenceVisualAnalysisForSavedPlan(plan, entry.doc.styleKit)).toBeNull();
  });

  it('não usa um rebind para aceitar novo look, ordem diferente ou outro conteúdo', async () => {
    const moodboard = normalizeStyleKit({ ...kit, refImages: [kit.refImages[0],
      { id: 'second-reference', imageId: 'second-local', name: 'Second' }] });
    const { record } = await analyzed(moodboard, [PNG, OTHER]);
    const cloud = { ...moodboard, refImages: moodboard.refImages.map((ref, index) => ({
      id: ref.id, name: ref.name, assetId: record.contentIds?.[index],
    })) };
    const rebound = rebindReferenceVisualRecord(record, moodboard, cloud);
    expect(recordMatchesKit(rebound, cloud)).toBe(true);
    expect(rebindReferenceVisualRecord(record, moodboard, { ...cloud, stylePrompt: 'New look.' })).toBeNull();
    expect(rebindReferenceVisualRecord(record, moodboard, { ...cloud, refImages: [...cloud.refImages].reverse() })).toBeNull();
    expect(rebindReferenceVisualRecord(record, moodboard, { ...cloud,
      refImages: [{ ...cloud.refImages[0], assetId: await originalImageAssetId(THUMBNAIL) }, cloud.refImages[1]] })).toBeNull();
  });

  it('detecta alteração inline sob o mesmo assetId, sem confiar apenas no ID da referência', async () => {
    const inline = normalizeStyleKit({ ...kit, refImages: [{ id: 'same-id', dataUrl: PNG,
      assetId: await originalImageAssetId(PNG) }] });
    const { record } = await analyzed(inline);
    const changed = { ...inline, referenceVisual: record,
      refImages: [{ ...inline.refImages[0], dataUrl: OTHER }] };
    expect(recordMatchesKit(record, changed)).toBe(false);
    expect(matchingReferenceVisualRecord(changed, context)).toBeNull();
    expect(rebindReferenceVisualRecord(record, changed, {
      ...changed, refImages: [{ id: 'same-id', assetId: await originalImageAssetId(PNG) }],
    })).toBeNull();
  });

  it('não cria análise nem muda conteúdo em projetos que não têm o novo record', async () => {
    const { manifest, assets } = await packed(kit);
    const { entry } = await hydrateProjectEntryFromCloud(manifest.docs[0], { localAssets: assets });
    expect(manifest.docs[0].doc.styleKit).not.toHaveProperty('referenceVisual');
    expect(entry.doc.styleKit).not.toHaveProperty('referenceVisual');
    expect(entry.doc.slides).toHaveLength(1);
    expect(entry.doc.slides[0]).toMatchObject({ id: 'slide', title: 'Unchanged text' });
    expect(entry.doc.styleKit.stylePrompt).toBe(kit.stylePrompt);
  });
});
