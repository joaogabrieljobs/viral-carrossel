import { describe, expect, it } from 'vitest';
import { photoPlaceholderRect } from '../../src/utils/photo-placeholder.js';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SlideCardInner } from '../../src/components/card/SlideCardInner.jsx';
import { DEFAULT_BRAND, mkSlide } from '../../src/utils/doc-schema.js';

const full = { x: 0, y: 0, w: 100, h: 100 };
const overlaps = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
describe('convite da foto separado do conteúdo', () => {
  it('mantém uma foto de fundo inteira, mas tira o convite do título central', () => {
    const occupied = [{ x: 6, y: 40, w: 88, h: 25 }, { x: 6, y: 68, w: 88, h: 15 }];
    const before = structuredClone(occupied);
    const region = photoPlaceholderRect(full, occupied);
    expect(region).not.toBeNull();
    for (const rect of occupied) expect(overlaps(region, rect)).toBe(false);
    expect(occupied).toEqual(before);
    expect(full).toEqual({ x: 0, y: 0, w: 100, h: 100 });
  });
  it('mantém o convite na zona de foto quando ela já está separada', () => {
    const photo = { x: 10, y: 10, w: 80, h: 30 };
    expect(photoPlaceholderRect(photo, [{ x: 6, y: 50, w: 88, h: 30 }])).toEqual(photo);
  });
  it('não desenha aviso em cima do texto quando não existe espaço legível', () => {
    expect(photoPlaceholderRect(full, [full])).toBeNull();
  });
  it('o renderer usa a região livre e conserva o upload e o título no fechamento', () => {
    const slide = { ...mkSlide(5, DEFAULT_BRAND), title: 'Rosto e mãos: o enquadramento escolhido', subtitle: 'Um retrato com intenção.', imageQuery: 'portrait',
      canvas: { enabled: true, variant: 'classic', zones: { photo: full, title: { x: 6, y: 40, w: 88, h: 25 }, subtitle: { x: 6, y: 68, w: 88, h: 15 } } } };
    const render = forExport => renderToStaticMarkup(React.createElement(SlideCardInner, { slide, fmt: 'carrossel', brand: DEFAULT_BRAND, creativePreset: 'livre', num: 5, total: 5, forExport, onPhotoZoneClick: () => {}, onPhotoZoneFileChange: () => {} }));
    const preview = render(false);
    expect(preview).toContain('data-vc-photo-placeholder="1"');
    expect(preview).toContain('top:0%');
    expect(preview).toContain('Toque para inserir foto');
    expect(preview).toContain('role="button"');
    expect(preview).toContain(slide.title);
    expect(render(true)).not.toContain('data-vc-photo-placeholder');
  });
});
