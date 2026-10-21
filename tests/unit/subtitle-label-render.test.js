import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SlideCardInner } from '../../src/components/card/SlideCardInner.jsx';
import { DEFAULT_BRAND, mkSlide } from '../../src/utils/doc-schema.js';

const brand = {
  ...DEFAULT_BRAND,
  subtitleVisible: true,
  showHandle: false,
};

function render(subtitle, { title = 'Saúde, rotina e planejamento.', forExport = false, emphasis = true } = {}) {
  const slide = {
    ...mkSlide(1, brand),
    title,
    subtitle,
    photoRegion: 'full',
    canvas: null,
    useCultureLayout: false,
    subSize: 110,
    procedureLabelEmphasis: emphasis,
  };
  return renderToStaticMarkup(React.createElement(SlideCardInner, {
    slide, brand, fmt: 'stories', num: 1, total: 1, forExport,
  }));
}

describe('procedure label hierarchy in full-bleed cards', () => {
  it.each([false, true])('shows the procedure and supporting sentence separately, export=%s', (forExport) => {
    const html = render('EMAGRECIMENTO Acompanhamento médico individualizado.', { forExport });
    expect(html).toMatch(/<span data-vc-subtitle-label[^>]*>EMAGRECIMENTO<\/span>/);
    expect(html).toMatch(/<span data-vc-subtitle-support[^>]*>Acompanhamento médico individualizado\.<\/span>/);
    expect(html).toContain('data-vc-inline-editable="true"');
  });

  it('promotes a procedure when the card has no title', () => {
    const html = render('TRANSPLANTE CAPILAR', { title: '' });
    expect(html).toMatch(/data-vc-subtitle-label="true" style="[^"]*font-size:1\.7em/);
    expect(html).not.toContain('data-vc-subtitle-support');
  });

  it('does not split ordinary copy', () => {
    const html = render('Cuidado médico individualizado.');
    expect(html).not.toContain('data-vc-subtitle-label');
    expect(html).toContain('Cuidado médico individualizado.');
  });

  it('does not change another card unless emphasis is enabled for that card', () => {
    const html = render('EMAGRECIMENTO Acompanhamento médico individualizado.', { emphasis: false });
    expect(html).not.toContain('data-vc-subtitle-label');
    expect(html).toContain('EMAGRECIMENTO Acompanhamento médico individualizado.');
  });

  it.each([false, true])('renders emphasis inside the automatic supporting sentence, export=%s', forExport => {
    const html = render('SUA MARCA Uma *porta de entrada de verdade*, com _continuidade_ e **clareza**.', { forExport });
    expect(html).toContain('data-vc-subtitle-label');
    expect(html).toContain('data-vc-subtitle-support');
    expect(html).toContain('data-vc-italic="true"');
    expect(html).toContain('data-vc-destaque="true"');
    expect(html).toContain('>porta de entrada de verdade</span>');
    expect(html).not.toContain('*porta de entrada de verdade*');
    expect(html).not.toContain('_continuidade_');
    expect(html).not.toContain('**clareza**');
  });
});
