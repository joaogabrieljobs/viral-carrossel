import { describe, it, expect } from 'vitest';
import {
  normalizeStyleKit,
  styleKitHasContent,
  buildProjectContextBlock,
  buildStyleKitTextHint,
  composeImgExtraPrompt,
  resolveImageRef,
  addStyleKitRefImage,
  removeStyleKitRefImage,
  clearStyleKit,
  MAX_REF_IMAGES,
} from '../../src/utils/style-kit.js';
import { ensureDocShape, DEFAULT_DOC } from '../../src/utils/doc-schema.js';

describe('style-kit', () => {
  it('normaliza shape vazio e filtra refs inválidas', () => {
    expect(normalizeStyleKit(null)).toEqual({
      stylePrompt: '',
      contextMd: '',
      refImages: [],
      logoOnGenerate: true,
    });
    const dirty = normalizeStyleKit({
      stylePrompt: '  luz suave  ',
      contextMd: '# Brief',
      refImages: [
        { id: 'a', name: 'ok', dataUrl: 'data:image/png;base64,xxx' },
        { id: 'b', name: 'bad', dataUrl: 'https://example.com/x.png' },
        null,
      ],
    });
    expect(dirty.stylePrompt).toBe('  luz suave  ');
    expect(dirty.contextMd).toBe('# Brief');
    expect(dirty.refImages).toHaveLength(1);
    expect(dirty.refImages[0].id).toBe('a');
  });

  it('detecta conteúdo e limpa', () => {
    expect(styleKitHasContent({})).toBe(false);
    expect(styleKitHasContent({ stylePrompt: 'x' })).toBe(true);
    expect(clearStyleKit()).toEqual({ stylePrompt: '', contextMd: '', refImages: [], logoOnGenerate: true });
  });

  it('monta blocos de texto e imagem', () => {
    const kit = {
      stylePrompt: 'editorial bege, Outfit Bold',
      contextMd: '# Produto\nSérum X com retinol.',
      refImages: [],
    };
    expect(buildProjectContextBlock(kit)).toContain('BRIEF DO PROJETO');
    expect(buildProjectContextBlock(kit)).toContain('Sérum X');
    expect(buildStyleKitTextHint(kit)).toContain('ESTILO VISUAL');
    expect(composeImgExtraPrompt(kit, 'garrafa centrada')).toContain('PROJECT VISUAL STYLE BIBLE');
    expect(composeImgExtraPrompt(kit, 'garrafa centrada')).toContain('THIS SLIDE DIRECTION');
    expect(composeImgExtraPrompt({}, '')).toBe('');
  });

  it('resolve referência: slide > projeto', () => {
    const kit = {
      refImages: [{ id: '1', name: 'mood', dataUrl: 'data:image/png;base64,proj' }],
    };
    expect(resolveImageRef(kit, null)).toBe('data:image/png;base64,proj');
    expect(resolveImageRef(kit, 'data:image/png;base64,slide')).toBe('data:image/png;base64,slide');
    expect(resolveImageRef({}, null)).toBe(null);
  });

  it('adiciona e remove refs com limite', () => {
    let kit = clearStyleKit();
    for (let i = 0; i < MAX_REF_IMAGES; i++) {
      kit = addStyleKitRefImage(kit, {
        dataUrl: `data:image/png;base64,${i}`,
        name: `r${i}`,
      });
    }
    expect(kit.refImages).toHaveLength(MAX_REF_IMAGES);
    expect(() =>
      addStyleKitRefImage(kit, { dataUrl: 'data:image/png;base64,x', name: 'extra' }),
    ).toThrow(/Máximo/);
    const id = kit.refImages[0].id;
    kit = removeStyleKitRefImage(kit, id);
    expect(kit.refImages).toHaveLength(MAX_REF_IMAGES - 1);
  });
});

describe('doc-schema styleKit', () => {
  it('ensureDocShape hidrata styleKit em docs antigos', () => {
    const shaped = ensureDocShape({ ...DEFAULT_DOC, styleKit: undefined });
    expect(shaped.styleKit).toEqual({ stylePrompt: '', contextMd: '', refImages: [], logoOnGenerate: true });
    const withKit = ensureDocShape({
      brand: {},
      slides: [],
      styleKit: { stylePrompt: 'noir', contextMd: '# X', refImages: [] },
    });
    expect(withKit.styleKit.stylePrompt).toBe('noir');
    expect(withKit.styleKit.contextMd).toBe('# X');
  });
});

import { resolveQuickGenerationRequest, buildGenerationTaskBlock, CONTEXT_MD_MAX } from '../../src/utils/style-kit.js';
import { projectDesignBrandPatch, needsLightPhotoText } from '../../src/utils/style-kit-design.js';

describe('regressão MUSA: pedido, brief e identidade', () => {
  it('3 cards explícitos prevalecem sobre os seis anteriores', () => {
    expect(resolveQuickGenerationRequest('CRIE 3 CARDS ANUNCIANDO LANÇAMENTO DO MUSA', 6)).toEqual({ count: 3, announcement: true });
    expect(resolveQuickGenerationRequest('Crie três cards sobre imagem e áudio', 6).count).toBe(3);
    expect(resolveQuickGenerationRequest('Explique 3 erros de lançamento', 6).count).toBe(6);
    expect(() => resolveQuickGenerationRequest('Crie 20 cards')).toThrow(/1 e 12/);
  });
  it('não corta um brief de 26 mil caracteres, inclusive a regra final', () => {
    const md = '# Produto\n' + 'contexto '.repeat(3000) + '\nREGRA FINAL: imagem, vídeo e áudio.';
    expect(md.length).toBeLessThan(CONTEXT_MD_MAX);
    expect(buildProjectContextBlock(normalizeStyleKit({ contextMd: md }))).toContain(md);
    expect(buildGenerationTaskBlock('Anuncie MUSA', true)).toContain('Não ensine a fazer lançamentos');
  });
  it('normaliza metadados sem manter outra cópia pesada das imagens', () => {
    const kit = normalizeStyleKit({ refImages: [{ id: 'r', name: 'ref', imageId: 'img_r', dataUrl: 'data:image/png;base64,AAA' }] });
    expect(kit.refImages).toEqual([{ id: 'r', name: 'ref', imageId: 'img_r' }]);
  });
  it('aplica apenas fontes e cores que o editor suporta, sem CSS nem logo inventado', () => {
    expect(projectDesignBrandPatch({ titleFont: 'Anton', bodyFont: 'Inter', titleWeight: 800, titleCase: 'upper', accent: '#FF5C00', logo: 'libfile_fake', bg: 'url(javascript:x)' })).toEqual({
      titleFont: '"Anton", sans-serif', customTitleFont: null, bodyFont: '"Inter", sans-serif', textTitleWeight: 400, textTitleCase: 'upper', accent: '#FF5C00',
    });
    expect(projectDesignBrandPatch({ titleFont: 'Fonte inexistente', accent: 'red' })).toEqual({});
  });
  it('clareia texto apenas sobre foto inteira escurecida, mantendo texto de cards sem foto e com foto inset', () => {
    const photo = { bgImage: 'blob:foto', overlay: 70, photoRegion: 'full' };
    expect(needsLightPhotoText(photo)).toBe(true);
    expect(needsLightPhotoText({ ...photo, bgImage: null })).toBe(false);
    expect(needsLightPhotoText({ ...photo, canvas: { zones: { photo: { w: 90, h: 40 } } } })).toBe(false);
    expect(needsLightPhotoText({ ...photo, useCultureLayout: true })).toBe(false);
  });
});
