import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SlideCardInner } from '../../src/components/card/SlideCardInner.jsx';
import { DEFAULT_BRAND, mkSlide } from '../../src/utils/doc-schema.js';
import { DEFAULT_CANVAS_ZONES_CLASSIC } from '../../src/utils/canvas-layout.js';

const brand = {
  ...DEFAULT_BRAND,
  titleColor: '#EDE9E3', subtitleColor: '#DDD9D1', textColor: '#CFC9BF',
  logo: 'data:image/png;base64,AAAA',
};

function render(overrides = {}, forExport = false) {
  const slide = {
    ...mkSlide(1, brand),
    title: 'TITLE_MARKER', subtitle: 'SUBTITLE_MARKER',
    bgImage: 'data:image/png;base64,AAAA',
    ...overrides,
  };
  return renderToStaticMarkup(React.createElement(SlideCardInner, {
    slide, brand, fmt: 'carrossel', num: 1, total: 2, forExport,
  }));
}

describe('cores individuais do card', () => {
  it('respeita as cores escolhidas no card com foto, acima da tinta automática, e escurece só a logo', () => {
    const html = render({ titleColor: '#49382D', subtitleColor: '#665447', logoTone: 'dark' });
    expect(html).toMatch(/<h1[^>]*style="[^"]*color:#49382D/);
    expect(html).toMatch(/<p[^>]*style="[^"]*color:#665447/);
    expect(html).toContain('filter:brightness(0)');
  });

  it('mantém a herança da marca e a aparência original da logo sem escolha no card', () => {
    const html = render();
    expect(html).not.toContain('color:#49382D');
    expect(html).not.toContain('color:#665447');
    expect(html).not.toContain('filter:brightness(0)');
  });

  it('aplica as mesmas cores quando o card usa zonas clássicas', () => {
    const html = render({
      canvas: { enabled: true, variant: 'classic', zones: DEFAULT_CANVAS_ZONES_CLASSIC },
      titleColor: '#49382D', subtitleColor: '#665447',
    });
    expect(html).toMatch(/<h1[^>]*style="[^"]*color:#49382D/);
    expect(html).toMatch(/<p[^>]*style="[^"]*color:#665447/);
  });

  it('no grafite, o título automático fica claro e o _trecho_ sai em rose sem o underscore', () => {
    const graphite = {
      ...DEFAULT_BRAND,
      bg: '#1c1c1c',
      titleColor: '#0a0a0a',
      subtitleColor: '#3a3a3a',
      textColor: '#5a5a5a',
      accent: '#c45c6a',
    };
    const slide = {
      ...mkSlide(1, graphite),
      title: 'A AGENDA QUE _esvaziou_',
      subtitle: 'Lúcia terminou a sexta.',
      canvas: { enabled: true, applied: true, variant: 'classic', zones: DEFAULT_CANVAS_ZONES_CLASSIC },
      overlay: 0,
      bgImage: null,
    };
    const html = renderToStaticMarkup(React.createElement(SlideCardInner, {
      slide, brand: graphite, fmt: 'carrossel', num: 1, total: 4,
    }));
    expect(html).toMatch(/data-vc-italic[^>]*>esvaziou</);
    expect(html).toMatch(/data-vc-italic[^>]*color:#c45c6a/i);
    expect(html).toMatch(/color:#F2EDE4/i);
    expect(html).not.toMatch(/>_esvaziou_</);
  });

  it('usa uma coluna editorial estreita na prévia e na exportação sem alterar o texto', () => {
    for (const forExport of [false, true]) {
      const html = render({ textBlockWidth: 56, align: 'left' }, forExport);
      const block = html.match(/<div data-vc-text-block="main"[^>]*>/)?.[0];
      expect(block).toContain('width:56%');
      expect(html).toContain('TITLE_MARKER');
      expect(html).toContain('SUBTITLE_MARKER');
    }
    const defaultBlock = render().match(/<div data-vc-text-block="main"[^>]*>/)?.[0];
    expect(defaultBlock).not.toContain(';width:');
  });
});
