import { describe, expect, it } from 'vitest';
import { applyVisualPatchToEntry, projectDesignView, validateVisualPatch, VISUAL_PATCH_SCHEMA } from '../../api/lib/visual-patch.js';

const DATA_URL = `data:image/png;base64,${'A'.repeat(200)}`;

function sampleEntry() {
  return {
    id: 'janine', name: 'Clínica Janine', updatedAt: 10, caption: 'Legenda preservada',
    doc: {
      title: 'Documento preservado',
      brand: { id: 'brand-1', titleColor: '#FFFFFF', logo: DATA_URL, logoImageId: 'asset-logo' },
      slides: [
        { id: 's1', title: 'Texto final', subtitle: 'Subtítulo final', bodyAfterImage: 'CTA final',
          bgImage: DATA_URL, bgImageAssetId: 'asset-photo', refImageId: 'asset-ref',
          logoImageId: 'asset-logo-card', titleSize: 100,
          textFonts: { title: 'Inter', subtitle: 'Inter' },
          elementOffsets: { title: { x: 0, y: 0 }, photo: { x: 4, y: 2 } },
          canvas: { enabled: true, variant: 'classic', zones: { title: { x: 5, y: 10, w: 80, h: 20 } }, media: DATA_URL },
          overlays: [{ id: 'cta1', type: 'cta', text: 'Agende sua avaliação', bg: '#000000', x: 50, y: 78 }],
        },
        { id: 's2', title: 'Outro título', subtitle: 'Outro subtítulo', bgImageAssetId: 'asset-photo-2' },
      ],
    },
  };
}

describe('visual-only agent patch', () => {
  it('publica no schema as fontes locais com nome, categoria e valor CSS exato', () => {
    expect(VISUAL_PATCH_SCHEMA.fontCatalog.titleFonts).toHaveLength(2);
    expect(VISUAL_PATCH_SCHEMA.fontCatalog.bodyFonts).toHaveLength(2);
    expect(VISUAL_PATCH_SCHEMA.fontCatalog.titleFonts.find(font => font.name === 'Roboto'))
      .toMatchObject({ val: '"Moont Library Roboto", sans-serif', cat: 'sans', local: true });
  });

  it('altera geometria, fonte, marca e CTA sem tocar texto, mídia, IDs ou campos não relacionados', () => {
    const before = sampleEntry();
    const frozen = JSON.stringify(before);
    const result = applyVisualPatchToEntry(before, {
      titleSize: 112,
      textFonts: { title: 'Bodoni Moda' },
      elementOffsets: { title: { x: 2, y: -3 } },
      canvas: { zones: { title: { x: 10, y: 15, w: 72, h: 22 } } },
      overlayStyles: { cta1: { bg: '#6B5344', x: 55 } },
      brand: { titleColor: '#3A322C' },
    }, ['s1'], { brandScope: 'project' });
    expect(JSON.stringify(before)).toBe(frozen);
    expect(result.entry.doc.slides[1]).toBe(before.doc.slides[1]);
    const after = result.entry.doc.slides[0];
    for (const key of ['id', 'title', 'subtitle', 'bodyAfterImage', 'bgImage', 'bgImageAssetId',
      'refImageId', 'logoImageId']) expect(after[key]).toEqual(before.doc.slides[0][key]);
    expect(after.overlays[0].text).toBe(before.doc.slides[0].overlays[0].text);
    expect(after.canvas.media).toBe(DATA_URL);
    expect(after.canvas.zones.title).toEqual({ x: 10, y: 15, w: 72, h: 22 });
    expect(after.textFonts.subtitle).toBe('Inter');
    expect(after.elementOffsets.photo).toEqual({ x: 4, y: 2 });
    expect(result.entry.doc.brand.logo).toBe(DATA_URL);
    expect(result.entry.caption).toBe('Legenda preservada');
    expect(result.changes).toHaveLength(1);
    expect(result.brandChanges).toEqual(['titleColor']);
  });

  it('não modifica o documento quando o patch já está aplicado', () => {
    const before = sampleEntry();
    const result = applyVisualPatchToEntry(before, { titleSize: 100, textFonts: { title: 'Inter' } }, ['s1']);
    expect(result.entry).toBe(before);
    expect(result.changes).toEqual([]);
  });

  it('copia somente o CTA existente para os cards escolhidos, sem alterar o card de origem, os textos ou a mídia', () => {
    const before = sampleEntry();
    before.doc.slides[0].elementOffsets.ov_cta1 = { x: 4, y: 17 };
    before.doc.slides[0].overlays[0] = {
      id: 'cta1', type: 'cta', text: 'Agende sua avaliação', variant: 'outline',
      x: 50, y: 78, bg: 'transparent', fg: '#5D4B42', border: '#5D4B42',
      uppercase: false, blur: false, arrow: true,
    };
    const frozen = JSON.stringify(before);
    const patch = { copyCtaFrom: { slideId: 's1', overlayId: 'cta1' } };
    const result = applyVisualPatchToEntry(before, patch, ['s1', 's2']);
    expect(JSON.stringify(before)).toBe(frozen);
    expect(result.entry.doc.slides[0]).toBe(before.doc.slides[0]);
    const target = result.entry.doc.slides[1];
    expect(target).toMatchObject({
      title: 'Outro título', subtitle: 'Outro subtítulo', bgImageAssetId: 'asset-photo-2',
      elementsUnlocked: true,
    });
    expect(target.overlays).toHaveLength(1);
    expect(target.overlays[0]).toMatchObject({
      type: 'cta', text: 'Agende sua avaliação', variant: 'outline',
      x: 50, y: 78, bg: 'transparent', fg: '#5D4B42', border: '#5D4B42',
      uppercase: false, blur: false, arrow: true,
    });
    expect(target.overlays[0].id).toMatch(/^cta_[a-f0-9]{20}$/);
    expect(target.elementOffsets).toBeUndefined();
    expect(result.changes).toEqual([{ slideId: 's2', index: 1, fields: ['copyCtaFrom'] }]);
    expect(VISUAL_PATCH_SCHEMA.copyCtaFrom).toBeTruthy();

    const repeated = applyVisualPatchToEntry(result.entry, patch, ['s2']);
    expect(repeated.entry).toBe(result.entry);
    expect(repeated.changes).toEqual([]);
    expect(repeated.entry.doc.slides[1].overlays).toHaveLength(1);
  });

  it('respeita um CTA já criado, sem duplicar nem sobrescrever o botão personalizado', () => {
    const before = sampleEntry();
    before.doc.slides[1].overlays = [{ id: 'custom', type: 'cta', text: 'Agende sua avaliação',
      variant: 'filled', bg: '#123456', x: 20, y: 80 }];
    const result = applyVisualPatchToEntry(before, { copyCtaFrom: { slideId: 's1', overlayId: 'cta1' } }, ['s2']);
    expect(result.entry).toBe(before);
    expect(result.entry.doc.slides[1].overlays).toEqual(before.doc.slides[1].overlays);
  });

  it('posiciona e colore a cópia do CTA em um único lote sem mudar o botão de origem', () => {
    const before = sampleEntry();
    const patch = { copyCtaFrom: {
      slideId: 's1', overlayId: 'cta1',
      style: { x: 28, y: 72, bg: 'transparent', fg: '#5D4B42',
        border: '#5D4B42', variant: 'outline', uppercase: false,
        blur: false, arrow: true, fontFamily: 'Inter, sans-serif' },
    } };
    const result = applyVisualPatchToEntry(before, patch, ['s1', 's2']);
    expect(result.entry.doc.slides[0]).toBe(before.doc.slides[0]);
    expect(result.entry.doc.slides[1].overlays[0]).toMatchObject({
      text: 'Agende sua avaliação', x: 28, y: 72, bg: 'transparent',
      fg: '#5D4B42', border: '#5D4B42', variant: 'outline',
      uppercase: false, blur: false, arrow: true, fontFamily: 'Inter, sans-serif',
    });
    const rerun = applyVisualPatchToEntry(result.entry, patch, ['s2']);
    expect(rerun.entry).toBe(result.entry);
    expect(rerun.changes).toEqual([]);
    for (const style of [{ x: 101 }, { text: 'Trocado' }, { bg: 'url(https://example.com)' }]) {
      expect(() => validateVisualPatch({ copyCtaFrom: { slideId: 's1', overlayId: 'cta1', style } })).toThrow();
    }
  });

  it('rejeita origem inválida, não CTA e limite de áreas para impedir cópias parciais', () => {
    const before = sampleEntry();
    for (const copyCtaFrom of [
      { slideId: 'missing', overlayId: 'cta1' },
      { slideId: 's1', overlayId: 'missing' },
    ]) expect(() => applyVisualPatchToEntry(before, { copyCtaFrom }, ['s2'])).toThrow(/origem/);
    before.doc.slides[0].overlays[0].type = 'text';
    expect(() => applyVisualPatchToEntry(before, {
      copyCtaFrom: { slideId: 's1', overlayId: 'cta1' },
    }, ['s2'])).toThrow(/origem/);
    before.doc.slides[0].overlays[0].type = 'cta';
    before.doc.slides[1].overlays = Array.from({ length: 12 }, (_, i) => ({ id: `text${i}`, type: 'text', text: String(i) }));
    expect(() => applyVisualPatchToEntry(before, {
      copyCtaFrom: { slideId: 's1', overlayId: 'cta1' },
    }, ['s2'])).toThrow(/limite/);
    for (const copyCtaFrom of [
      { slideId: '../s1', overlayId: 'cta1' },
      { slideId: 's1', overlayId: 'cta1', text: 'Troca' },
      { slideId: 's1', overlayId: '__proto__' },
    ]) expect(() => validateVisualPatch({ copyCtaFrom })).toThrow();
  });

  it('muda as cores de apenas um card sem alterar a paleta da marca ou outros cards', () => {
    const before = sampleEntry();
    const result = applyVisualPatchToEntry(before, {
      titleColor: '#49382D', subtitleColor: '#665447', logoTone: 'dark',
    }, ['s1']);
    expect(result.entry.doc.slides[0]).toMatchObject({
      titleColor: '#49382D', subtitleColor: '#665447', logoTone: 'dark',
      title: 'Texto final', subtitle: 'Subtítulo final', bgImageAssetId: 'asset-photo',
    });
    expect(result.entry.doc.slides[1]).toBe(before.doc.slides[1]);
    expect(result.entry.doc.brand).toBe(before.doc.brand);
    expect(result.changes).toEqual([{ slideId: 's1', index: 0, fields: ['titleColor', 'subtitleColor', 'logoTone'] }]);
    expect(projectDesignView({ id: 'janine', version: 1, entry: result.entry }).slides[0].visual)
      .toMatchObject({ titleColor: '#49382D', subtitleColor: '#665447', logoTone: 'dark' });
  });

  it('limita a largura do bloco principal apenas no card escolhido', () => {
    const before = sampleEntry();
    const result = applyVisualPatchToEntry(before, { textBlockWidth: 56 }, ['s1']);
    expect(result.entry.doc.slides[0].textBlockWidth).toBe(56);
    expect(result.entry.doc.slides[1]).toBe(before.doc.slides[1]);
    expect(result.entry.doc.brand).toBe(before.doc.brand);
    expect(result.changes).toEqual([{ slideId: 's1', index: 0, fields: ['textBlockWidth'] }]);
    expect(projectDesignView({ id: 'janine', version: 1, entry: result.entry }).slides[0].visual.textBlockWidth).toBe(56);
    for (const width of [0, 19.9, 90.1, '56', null, Infinity]) {
      expect(() => validateVisualPatch({ textBlockWidth: width })).toThrow();
    }
  });

  it('aceita só posições de logo renderizadas, inclusive o centro c', () => {
    const supported = ['tl', 'tr', 'c', 'bl', 'br'];
    for (const position of supported) {
      const result = applyVisualPatchToEntry(sampleEntry(), {
        logoPosition: position,
        brand: { logoPosition: position },
      }, ['s1'], { brandScope: 'project' });
      expect(result.entry.doc.slides[0].logoPosition).toBe(position);
      expect(result.entry.doc.brand.logoPosition).toBe(position);
    }
    for (const position of ['tc', 'ml', 'mc', 'mr', 'bc']) {
      expect(() => validateVisualPatch({ logoPosition: position })).toThrow();
      expect(() => validateVisualPatch({ brand: { logoPosition: position } },
        { brandScope: 'project' })).toThrow();
    }
  });

  it('rejeita texto, mídia, objetos perigosos, cores e offsets inválidos', () => {
    const before = sampleEntry();
    for (const patch of [
      { title: 'Texto modificado' }, { bgImage: DATA_URL }, { logoImageId: 'outro' },
      { brand: { logo: DATA_URL } }, { canvas: { media: DATA_URL } },
      { overlayStyles: { cta1: { text: 'Reescrito' } } },
      { textFonts: { title: 'Bad; background:url(data:image)' } },
      { titleColor: 'url(https://example.com)' },
      { subtitleColor: '#12' },
      { logoTone: 'invert(1)' },
      { elementOffsets: { title: { x: 999, y: 0 } } },
      JSON.parse('{"__proto__":{"polluted":true}}'),
    ]) expect(() => applyVisualPatchToEntry(before, patch)).toThrow();
    expect({}.polluted).toBeUndefined();
    expect(() => validateVisualPatch({ brand: { titleColor: '#222222' } })).toThrow();
  });

  it('não devolve bytes de fotos/logos no detalhe de design', () => {
    const project = { id: 'janine', version: 7, entry: sampleEntry() };
    const view = projectDesignView(project);
    expect(view).toMatchObject({ id: 'janine', version: 7, slideCount: 2 });
    expect(JSON.stringify(view)).not.toContain(DATA_URL);
    expect(view.slides[0].hasPhoto).toBe(true);
    expect(view.slides[0].title).toBeUndefined();
    expect(view.slides[0].overlays[0].text).toBeUndefined();
    const withText = projectDesignView(project, { includeText: true });
    expect(withText.slides[0].overlays[0].text).toBe('Agende sua avaliação');
  });

  it('expõe o link oficial de compartilhamento quando o projeto possui shareCode', () => {
    const entry = sampleEntry();
    entry.doc.shareCode = 'f5m3cgpb';
    expect(projectDesignView({ id: 'gisr5t9', version: 23, entry }, { includeText: true }))
      .toMatchObject({
        id: 'gisr5t9',
        shareCode: 'F5M3CGPB',
        shareUrl: 'https://moont.ai/?share=F5M3CGPB&app=1',
      });
  });

  it('não expõe código de compartilhamento inválido', () => {
    const entry = sampleEntry();
    entry.doc.shareCode = 'inválido';
    const view = projectDesignView({ id: 'gisr5t9', version: 23, entry });
    expect(view.shareCode).toBeUndefined();
    expect(view.shareUrl).toBeUndefined();
  });

  it('não aceita áreas extras ausentes em cards selecionados', () => {
    expect(() => applyVisualPatchToEntry(sampleEntry(), {
      overlayStyles: { cta1: { x: 55 } },
    }, null)).toThrow(/Área adicional não encontrada/);
  });
});
