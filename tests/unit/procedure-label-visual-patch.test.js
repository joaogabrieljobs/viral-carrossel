import { describe, expect, it } from 'vitest';
import { applyVisualPatchToEntry, projectDesignView, validateVisualPatch } from '../../api/lib/visual-patch.js';
import { mkSlide } from '../../src/utils/doc-schema.js';

describe('per-card procedure label emphasis', () => {
  it('is off for new cards and requires an explicit boolean visual patch', () => {
    expect(mkSlide().procedureLabelEmphasis).toBe(false);
    expect(validateVisualPatch({ procedureLabelEmphasis: true })).toEqual({ procedureLabelEmphasis: true });
    for (const invalid of ['true', 1, null]) {
      expect(() => validateVisualPatch({ procedureLabelEmphasis: invalid })).toThrow();
    }
  });

  it('enables only the selected card and preserves every content field', () => {
    const entry = {
      id: 'janine',
      doc: {
        brand: { name: 'Clínica Janine' },
        slides: [
          { id: 'one', title: 'Título', subtitle: 'EMAGRECIMENTO Acompanhamento médico.',
            bgImageAssetId: 'photo-one', overlays: [{ id: 'cta', type: 'cta', text: 'Agende sua avaliação' }] },
          { id: 'two', title: 'Outro', subtitle: 'TRANSPLANTE CAPILAR', bgImageAssetId: 'photo-two' },
        ],
      },
    };
    const before = JSON.stringify(entry);
    const result = applyVisualPatchToEntry(entry, { procedureLabelEmphasis: true }, ['one']);
    expect(JSON.stringify(entry)).toBe(before);
    expect(result.entry.doc.slides[0]).toMatchObject({
      procedureLabelEmphasis: true, title: 'Título',
      subtitle: 'EMAGRECIMENTO Acompanhamento médico.', bgImageAssetId: 'photo-one',
      overlays: [{ id: 'cta', text: 'Agende sua avaliação' }],
    });
    expect(result.entry.doc.slides[1]).toBe(entry.doc.slides[1]);
    expect(projectDesignView({ id: 'janine', version: 1, entry: result.entry }).slides[0]
      .visual.procedureLabelEmphasis).toBe(true);

    const repeated = applyVisualPatchToEntry(result.entry, { procedureLabelEmphasis: true }, ['one']);
    expect(repeated.entry).toBe(result.entry);
    expect(repeated.changes).toEqual([]);
  });
});
