import { describe, expect, it } from 'vitest';
import { applyContentPatchToEntry, validateContentPatch } from '../../api/lib/content-patch.js';

const entry = () => ({
  id: 'project-1', name: 'Original', doc: { caption: 'Legenda antiga', brand: { bg: '#000' }, slides: [
    { id: 's1', title: 'Título 1', subtitle: 'Apoio 1', bgImageAssetId: 'asset-secret', overlays: [{ id: 'cta1', type: 'cta', text: 'Saiba mais', bg: '#fff' }] },
    { id: 's2', title: 'Título 2', subtitle: 'Apoio 2', layout: 'mc' },
  ] },
});

describe('patch de conteúdo do agente', () => {
  it('altera apenas textos selecionados e preserva mídia, visual e ordem', () => {
    const before = entry();
    const result = applyContentPatchToEntry(before, {
      projectName: 'Campanha revisada', caption: 'Nova legenda',
      slideEdits: [{ slideId: 's1', title: 'Novo título', imageQuery: 'editorial portrait' }],
      overlayEdits: [{ slideId: 's1', overlayId: 'cta1', text: 'Agende agora' }],
    });
    expect(result.changedSlideCount).toBe(1);
    expect(result.entry.name).toBe('Campanha revisada');
    expect(result.entry.doc.caption).toBe('Nova legenda');
    expect(result.entry.doc.slides[0]).toMatchObject({
      title: 'Novo título', subtitle: 'Apoio 1', imageQuery: 'editorial portrait',
      bgImageAssetId: 'asset-secret', overlays: [{ id: 'cta1', text: 'Agende agora', bg: '#fff' }],
    });
    expect(result.entry.doc.slides[1]).toBe(before.doc.slides[1]);
    expect(before.name).toBe('Original');
  });

  it('recusa campos visuais, IDs repetidos e áreas inexistentes', () => {
    expect(() => validateContentPatch({ slideEdits: [{ slideId: 's1', layout: 'tl' }] })).toThrow(/inválido/i);
    expect(() => validateContentPatch({ slideEdits: [{ slideId: 's1', title: 'A' }, { slideId: 's1', title: 'B' }] })).toThrow(/única vez/i);
    expect(() => applyContentPatchToEntry(entry(), { overlayEdits: [{ slideId: 's1', overlayId: 'nope', text: 'x' }] })).toThrow(/não existem/i);
  });
});
