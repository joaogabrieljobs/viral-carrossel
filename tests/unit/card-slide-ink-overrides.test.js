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

function render(overrides = {}) {
  const slide = {
    ...mkSlide(1, brand),
    title: 'TITLE_MARKER', subtitle: 'SUBTITLE_MARKER',
    bgImage: 'data:image/png;base64,AAAA',
    ...overrides,
  };
  return renderToStaticMarkup(React.createElement(SlideCardInner, {
    slide, brand, fmt: 'carrossel', num: 1, total: 2,
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
});
