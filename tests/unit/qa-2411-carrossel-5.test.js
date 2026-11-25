import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/utils/video-store.js', async (importOriginal) => ({
  ...(await importOriginal()),
  getVideoUrl: (id) => (id ? `blob:video-${id}` : null),
}));

import { SlideCardInner } from '../../src/components/card/SlideCardInner.jsx';
import { DEFAULT_BRAND, mkSlide } from '../../src/utils/doc-schema.js';
import { cardPhotoZoneHasMedia } from '../../src/utils/card-photo-zone.js';

afterEach(() => vi.restoreAllMocks());

const FOTO = 'data:image/png;base64,AAAA';
const SOMBRA_DA_FAIXA = 'box-shadow:var(--shadow-product)';
const brand = { ...DEFAULT_BRAND, subtitleVisible: true, showHandle: false };
const base = (extra = {}) => ({
  ...mkSlide(1, brand), title: 'Título do card', subtitle: 'Apoio do card.', canvas: null,
  useCultureLayout: false, photoRegion: 'full', ...extra,
});
const sanduiche = (extra = {}) => base({ useCultureLayout: true, bodyAfterImage: 'Texto depois da foto.', ...extra });
const render = (slide, forExport) => renderToStaticMarkup(React.createElement(SlideCardInner, {
  slide, brand, fmt: 'carrossel', num: 2, total: 5, forExport, creativePreset: 'livre',
}));
/** O arquivo e o editor só podem diferir na marca que identifica a superfície. */
const mesmoDesenho = (html) => html.replace(/ data-vc-card-surface="[^"]*"/, '');
const zonasDeTexto = (html) => html.match(/data-vc-fit-zone="column"/g)?.length || 0;

/** O primeiro estado booleano do card (foto pronta) já começa ligado. */
function comFotoCarregada(fn) {
  const real = React.useState;
  let feito = false;
  const spy = vi.spyOn(React, 'useState').mockImplementation((inicial) => {
    if (!feito && inicial === false) { feito = true; return [true, () => {}]; }
    return real(inicial);
  });
  try { return fn(); } finally { spy.mockRestore(); }
}

describe('QA-2411 carrossel 5: a zona de foto só existe quando há mídia para ela', () => {
  it('sem foto não há zona, nem com pedido de foto pendente', () => {
    expect(cardPhotoZoneHasMedia({})).toBe(false);
    expect(cardPhotoZoneHasMedia({ imageQuery: 'padaria' })).toBe(false);
    expect(cardPhotoZoneHasMedia({ bgImageFailed: true })).toBe(false);
  });

  it('foto presente mantém a zona; foto que falhou ao carregar, não', () => {
    expect(cardPhotoZoneHasMedia({ bgImage: FOTO })).toBe(true);
    expect(cardPhotoZoneHasMedia({ bgImage: FOTO }, { loadFailed: true })).toBe(false);
  });

  it('foto a caminho (lendo do aparelho ou sendo gerada) mantém a zona', () => {
    expect(cardPhotoZoneHasMedia({ bgImageId: 'img-1' }, { arriving: true })).toBe(true);
    expect(cardPhotoZoneHasMedia({ bgImageId: 'img-1' })).toBe(false);
  });

  it('vídeo só conta no layout que desenha vídeo', () => {
    expect(cardPhotoZoneHasMedia({ videoId: 'v1' }, { video: true })).toBe(true);
    expect(cardPhotoZoneHasMedia({ videoId: 'v1' })).toBe(false);
  });
});

describe('QA-2411 carrossel 5: foto em faixa sem foto vira card só de texto', () => {
  const REGIOES = ['inset_h_top', 'inset_h_middle', 'inset_h_bottom', 'inset_h_narrow_mid'];

  it.each(REGIOES)('%s: sem faixa, sem convite, título e apoio num bloco só, no editor e no arquivo', (photoRegion) => {
    for (const extra of [{}, { imageQuery: 'padaria com cozinha aberta' }]) {
      const slide = base({ photoRegion, ...extra });
      const editor = render(slide, false);
      const arquivo = render(slide, true);
      expect(editor).not.toContain(SOMBRA_DA_FAIXA);
      expect(editor).not.toContain('Toque para inserir foto');
      expect(zonasDeTexto(editor)).toBe(1);
      expect(editor).toContain('justify-content:safe center');
      expect(editor).toContain('Título do card');
      expect(editor).toContain('Apoio do card.');
      expect(mesmoDesenho(arquivo)).toBe(mesmoDesenho(editor));
    }
  });

  it.each(REGIOES)('%s com foto: a faixa continua, no editor e no arquivo', (photoRegion) => {
    const slide = base({ photoRegion, bgImage: FOTO });
    for (const forExport of [false, true]) {
      const html = comFotoCarregada(() => render(slide, forExport));
      expect(html).toContain(SOMBRA_DA_FAIXA);
      expect(html).toContain('background-image:url(data:image/png;base64,AAAA)');
      expect(html).not.toContain('justify-content:safe center');
    }
    // No meio, título e apoio continuam um de cada lado da faixa.
    expect(zonasDeTexto(render(slide, false))).toBe(photoRegion === 'inset_h_top' || photoRegion === 'inset_h_bottom' ? 1 : 2);
  });
});

describe('QA-2411 carrossel 5: texto + foto + texto sem foto vira card só de texto', () => {
  it('sem moldura nem convite; o bloco fica no centro do card; editor e arquivo iguais', () => {
    const slide = sanduiche({ imageQuery: 'padaria' });
    const editor = render(slide, false);
    const arquivo = render(slide, true);
    expect(editor).not.toContain('dashed');
    expect(editor).not.toContain('data-vc-photo-zone');
    expect(editor).not.toContain('Toque para inserir foto');
    expect(editor).toContain('justify-content:safe center');
    for (const texto of ['Título do card', 'Apoio do card.', 'Texto depois da foto.']) expect(arquivo).toContain(texto);
    expect(mesmoDesenho(arquivo)).toBe(mesmoDesenho(editor));
  });

  it('foto que não existe mais no aparelho: também só texto', () => {
    const editor = render(sanduiche({ bgImageFailed: true }), false);
    expect(editor).not.toContain('data-vc-photo-zone');
    expect(editor).toContain('justify-content:safe center');
  });

  it('com foto: a foto fica entre os dois textos e o bloco começa do topo', () => {
    const slide = sanduiche({ bgImage: FOTO });
    for (const forExport of [false, true]) {
      const html = comFotoCarregada(() => render(slide, forExport));
      expect(html).toMatch(/<img[^>]*src="data:image\/png;base64,AAAA"/);
      expect(html).toContain('data-vc-photo-zone');
      expect(html).not.toContain('justify-content:safe center');
    }
  });

  it('com vídeo: o vídeo continua no card', () => {
    const html = render(sanduiche({ videoId: 'v1' }), true);
    expect(html).toContain('<video');
    expect(html).not.toContain('justify-content:safe center');
  });

  it('zonas da composição aplicadas e sem foto: o arquivo não leva a zona vazia', () => {
    const zones = { top: { x: 6, y: 8, w: 88, h: 28 }, photo: { x: 0, y: 30, w: 100, h: 42 }, bottom: { x: 6, y: 74, w: 88, h: 23 } };
    const slide = sanduiche({ imageQuery: 'padaria', canvas: { enabled: false, applied: true, variant: 'sandwich', zones } });
    const editor = render(slide, false);
    const arquivo = render(slide, true);
    expect(arquivo).not.toContain('data-vc-photo-zone');
    expect(arquivo).toContain('justify-content:safe center');
    expect(mesmoDesenho(arquivo)).toBe(mesmoDesenho(editor));
    // Com foto, a composição em zonas continua.
    const comFoto = comFotoCarregada(() => render({ ...slide, bgImage: FOTO }, true));
    expect(comFoto).toMatch(/<img[^>]*src="data:image\/png;base64,AAAA"/);
    expect(comFoto).not.toContain('justify-content:safe center');
  });
});
