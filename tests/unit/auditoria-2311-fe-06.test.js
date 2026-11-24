// FE-06 (auditoria de 23/11): "Remover imagem" num card já salvo na conta
// passava por `updateSlide`/`updateSlideAt`, que usam `applyFormatEdit` e não
// soltavam o asset da conta. O pacote enviado levava o asset antigo e a foto
// voltava sozinha na abertura seguinte.
import { describe, expect, it } from 'vitest';
import { applyFormatEdit } from '../../src/utils/format-view.js';

const doc = (fmt = 'carrossel') => ({
  fmt,
  slides: [
    { id: 'a', title: 'Capa', bgImageAssetId: 'asset1', bgImageId: 'img-a', bgImage: 'blob:a',
      logoImageAssetId: 'logo1', logoImageId: 'logo-a', logoImage: 'blob:logo' },
    { id: 'b', title: 'Outro', bgImageAssetId: 'asset2', bgImageId: 'img-b', bgImage: 'blob:b' },
  ],
});

describe('FE-06: remover foto de card sincronizado solta o asset da conta', () => {
  it('o patch de "Remover imagem" zera bgImageAssetId do card editado e só dele', () => {
    const next = applyFormatEdit(doc(), 0, { bgImage: null, bgImageId: null });
    expect(next.slides[0]).toMatchObject({ bgImage: null, bgImageId: null, bgImageAssetId: null });
    expect(next.slides[0].logoImageAssetId).toBe('logo1');
    expect(next.slides[1].bgImageAssetId).toBe('asset2');
  });

  it('vale também na vista de Stories e ao voltar à logo da marca neste card', () => {
    const next = applyFormatEdit(doc('stories'), 0, { logoImage: null, logoImageId: null });
    expect(next.slides[0].logoImageAssetId).toBeNull();
    expect(next.slides[0].bgImageAssetId).toBe('asset1');
  });

  it('trocar a foto solta o asset antigo; edição de texto e falha de carregamento não', () => {
    const swapped = applyFormatEdit(doc(), 1, { bgImage: 'blob:nova', bgImageId: 'img-nova' });
    expect(swapped.slides[1].bgImageAssetId).toBeNull();
    const texto = applyFormatEdit(doc(), 0, { title: 'Novo título' });
    expect(texto.slides[0].bgImageAssetId).toBe('asset1');
    const falha = applyFormatEdit(doc(), 0, {
      bgImage: null, bgImageId: null, bgImageFailed: true, bgImageError: 'stored_image_missing',
    });
    expect(falha.slides[0].bgImageAssetId).toBe('asset1');
  });
});
