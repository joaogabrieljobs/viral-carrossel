import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/utils/video-store.js', async (importOriginal) => ({
  ...(await importOriginal()),
  getVideoUrl: (id) => (id ? `blob:video-${id}` : null),
}));

import { SlideCardInner } from '../../src/components/card/SlideCardInner.jsx';
import { DEFAULT_BRAND, mkSlide } from '../../src/utils/doc-schema.js';
import { DEFAULT_CANVAS_ZONES_CLASSIC } from '../../src/utils/canvas-zones.js';

afterEach(() => vi.restoreAllMocks());

const FOTO = 'data:image/png;base64,AAAA';
const brandBase = { ...DEFAULT_BRAND, subtitleVisible: true, showHandle: false };
const comArroba = { ...brandBase, showHandle: true, handle: '@padaria', handleAvatar: '' };
const base = (extra = {}) => ({
  ...mkSlide(1, brandBase), title: 'Título do card', subtitle: 'Apoio do card.', canvas: null,
  useCultureLayout: false, photoRegion: 'full', showHandle: true, ...extra,
});
const sanduiche = (extra = {}) => base({ useCultureLayout: true, bodyAfterImage: 'Texto depois da foto.', ...extra });

const render = (slide, brand, forExport) => renderToStaticMarkup(React.createElement(SlideCardInner, {
  slide, brand, fmt: 'carrossel', num: 2, total: 5, forExport, creativePreset: 'livre',
}));

/**
 * O card só desenha a foto depois de o navegador carregá-la (estado interno).
 * Aqui o primeiro estado booleano do card (foto pronta) já começa ligado.
 */
function comFotoCarregada(fn) {
  const real = React.useState;
  let feito = false;
  const spy = vi.spyOn(React, 'useState').mockImplementation((inicial) => {
    if (!feito && inicial === false) { feito = true; return [true, () => {}]; }
    return real(inicial);
  });
  try { return fn(); } finally { spy.mockRestore(); }
}

describe('GA-04: o anel do @ sem foto de perfil não leva o emoji de convite para o arquivo', () => {
  const casos = [
    ['fundo inteiro', base()],
    ['foto em faixa', base({ photoRegion: 'inset_h_top' })],
    ['composição com zonas', base({ canvas: { enabled: false, applied: true, variant: 'classic', zones: { ...DEFAULT_CANVAS_ZONES_CLASSIC } } })],
    ['texto + foto + texto', sanduiche({ imageQuery: 'padaria' })],
  ];

  it.each(casos)('%s', (_nome, slide) => {
    const editor = render(slide, comArroba, false);
    expect(editor).toContain('📷');
    expect(editor).toContain('@padaria');
    const arquivo = render(slide, comArroba, true);
    expect(arquivo).not.toContain('📷');
    // O @ continua no arquivo; só o convite some.
    expect(arquivo).toContain('@padaria');
  });

  it('com foto de perfil, o arquivo leva a foto', () => {
    const arquivo = render(base(), { ...comArroba, handleAvatar: FOTO }, true);
    expect(arquivo).not.toContain('📷');
    expect(arquivo).toMatch(/<img[^>]*src="data:image\/png;base64,AAAA"/);
  });
});

describe('GA-04: texto + foto + texto não leva moldura nem selos de interface para o arquivo', () => {
  it('sem foto: o editor mostra a moldura tracejada com o convite; o arquivo não tem moldura', () => {
    const slide = sanduiche({ imageQuery: 'padaria' });
    const editor = render(slide, brandBase, false);
    expect(editor).toContain('dashed');
    expect(editor).toContain('Toque para inserir foto');
    const arquivo = render(slide, brandBase, true);
    expect(arquivo).not.toContain('dashed');
    expect(arquivo).not.toContain('data-vc-photo-zone');
    expect(arquivo).not.toContain('Toque para inserir foto');
    // O texto dos dois lados continua.
    expect(arquivo).toContain('Apoio do card.');
    expect(arquivo).toContain('Texto depois da foto.');
  });

  it('imagem gerada por IA: selo só no editor; a foto vai para o arquivo', () => {
    const slide = sanduiche({ bgImage: FOTO, bgImageSource: 'ai' });
    const editor = comFotoCarregada(() => render(slide, brandBase, false));
    expect(editor).toContain('✨ IA');
    const arquivo = comFotoCarregada(() => render(slide, brandBase, true));
    expect(arquivo).toMatch(/<img[^>]*src="data:image\/png;base64,AAAA"/);
    expect(arquivo).not.toContain('IA</span>');
    expect(arquivo).not.toContain('Imagem gerada por IA');
  });

  it('vídeo importado: selo só no editor', () => {
    const slide = sanduiche({ videoId: 'v1' });
    const editor = render(slide, brandBase, false);
    expect(editor).toContain('VÍDEO');
    const arquivo = render(slide, brandBase, true);
    expect(arquivo).toContain('<video');
    expect(arquivo).not.toContain('VÍDEO');
    expect(arquivo).not.toContain('Vídeo importado');
  });
});

describe('GA-04: foto em faixa sem foto não desenha a faixa vazia no arquivo', () => {
  const SOMBRA = 'box-shadow:var(--shadow-product)';

  it.each(['inset_h_top', 'inset_h_middle', 'inset_h_bottom', 'inset_h_narrow_mid'])('%s: sombra da faixa só no editor; o texto fica no mesmo lugar', (photoRegion) => {
    const slide = base({ photoRegion });
    const editor = render(slide, brandBase, false);
    expect(editor).toContain(SOMBRA);
    const arquivo = render(slide, brandBase, true);
    expect(arquivo).not.toContain(SOMBRA);
    // A faixa continua ocupando o espaço: tirando a pintura dela, o card é o mesmo.
    const semPintura = (html) => html.replace(/data-vc-card-surface="[^"]*"/, '').replace(/background:[^;"]+;z-index:2(;box-shadow:[^;"]+)?/, 'z-index:2');
    expect(semPintura(arquivo)).toBe(semPintura(editor));
  });

  it('com foto carregada, a faixa vai inteira para o arquivo', () => {
    const slide = base({ photoRegion: 'inset_h_top', bgImage: FOTO });
    const arquivo = comFotoCarregada(() => render(slide, brandBase, true));
    expect(arquivo).toContain(SOMBRA);
    expect(arquivo).toContain('background-image:url(data:image/png;base64,AAAA)');
  });
});
