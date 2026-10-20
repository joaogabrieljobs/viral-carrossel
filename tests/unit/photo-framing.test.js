import { describe, expect, it } from 'vitest';
import { cropToBackgroundPosition, photoFramingRequest, waitForPhotoFraming } from '../../src/utils/photo-framing.js';
import { applyFormatEdit, slideForFormatDisplay } from '../../src/utils/format-view.js';
import { slideAutoAdjustPatch } from '../../src/utils/canvas-zones.js';

describe('enquadramento por conteúdo', () => {
  it('converte recorte da direita/esquerda para a sobra correta do CSS', () => {
    expect(cropToBackgroundPosition({ x: 700, y: 0, width: 900, height: 900 }, 1600, 900)).toEqual({ bgX: 100, bgY: 50 });
    expect(cropToBackgroundPosition({ x: 0, y: 0, width: 900, height: 900 }, 1600, 900)).toEqual({ bgX: 0, bgY: 50 });
    expect(cropToBackgroundPosition({ x: 0, y: 350, width: 900, height: 900 }, 900, 1600)).toEqual({ bgX: 50, bgY: 50 });
    expect(cropToBackgroundPosition({ x: 0, y: 0, width: 900, height: 900 }, 900, 1600)).toEqual({ bgX: 50, bgY: 0 });
  });

  it('usa a zona real da foto e não analisa contain nem recorte manual', () => {
    const slide = { bgImage: 'blob:photo', photoFraming: 'auto', bgFit: 'cover' };
    const whole = photoFramingRequest(slide, 'quadrado');
    expect(whole.width / whole.height).toBe(1);
    const zone = photoFramingRequest({ ...slide, canvas: {
      applied: true, zones: { photo: { w: 50, h: 100 } },
    } }, 'quadrado');
    expect(zone.width / zone.height).toBe(0.5);
    expect(zone.key).not.toBe(whole.key);
    expect(photoFramingRequest({ ...slide, photoFraming: 'manual' }, 'stories')).toBeNull();
    expect(photoFramingRequest({ ...slide, bgFit: 'contain' }, 'stories')).toBeNull();
    expect(photoFramingRequest({ ...slide, bgImage: null }, 'stories')).toBeNull();
  });

  const slide = { id: 's1', bgImage: 'blob:photo', bgFit: 'cover', bgX: 50, bgY: 50, title: 'Título', subtitle: 'Detalhe' };
  const doc = { fmt: 'quadrado', creativePreset: 'apresentacao', slides: [slide] };

  it('arrastar ou usar controles preserva o recorte manual sem alterar a foto original', () => {
    const edited = applyFormatEdit(doc, 0, { bgX: 83, bgY: 30 });
    const display = slideForFormatDisplay(slide, 'quadrado', edited.formatViews, 'apresentacao');
    expect(display).toMatchObject({ bgX: 83, bgY: 30, photoFraming: 'manual' });
    expect(edited.slides[0]).toBe(slide);
    const dragged = applyFormatEdit(doc, 0, { elementOffsets: { photo: { x: -20, y: 0 } } });
    expect(dragged.formatViews.quadrado.slides.s1.photoFraming).toBe('manual');
  });

  it('respeita recorte antigo e permite voltar ao automático explicitamente', () => {
    const formatViews = { quadrado: { slides: { s1: { bgX: 22 } } } };
    expect(slideForFormatDisplay(slide, 'quadrado', formatViews, 'apresentacao').photoFraming).toBe('manual');
    const reset = applyFormatEdit({ ...doc, formatViews }, 0, { photoFraming: 'auto', bgX: 50, bgY: 50 });
    expect(slideForFormatDisplay(slide, 'quadrado', reset.formatViews, 'apresentacao').photoFraming).toBe('auto');
    expect(slideForFormatDisplay(slide, 'stories', reset.formatViews, 'apresentacao').photoFraming).toBe('auto');
  });

  it('autoajuste tipográfico não volta a centralizar o assunto', () => {
    for (const mode of ['manual', 'auto']) {
      const patch = slideAutoAdjustPatch({ ...slide, bgX: 85, bgY: 20, photoFraming: mode }, { creativePreset: 'apresentacao', fmt: 'quadrado' });
      expect(patch.bgX).toBeUndefined();
      expect(patch.bgY).toBeUndefined();
    }
  });

  it('export espera o enquadramento chegar ao DOM e informa timeout', async () => {
    let pending = true;
    const root = { getAttribute: () => pending ? 'true' : null };
    setTimeout(() => { pending = false; }, 20);
    await expect(waitForPhotoFraming([root])).resolves.toBeUndefined();
    await expect(waitForPhotoFraming([{ getAttribute: () => 'true' }], { timeoutMs: 1 })).rejects.toThrow('enquadramento');
  });

  it('aguarda também quando a referência de exportação fica dentro do card', async () => {
    let pending = true;
    const root = { closest: () => pending ? {} : null };
    setTimeout(() => { pending = false; }, 20);
    await expect(waitForPhotoFraming([root])).resolves.toBeUndefined();
    await expect(waitForPhotoFraming([{ closest: () => ({}) }], { timeoutMs: 1 })).rejects.toThrow('enquadramento');
  });
});
