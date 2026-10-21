import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { auditPresentationLayout, auditRenderedPresentationLayout, buildPresentationBlocksPrompt, normalizePresentationBlocks, repairPresentationLayouts } from '../../src/utils/presentation-quality.js';
import PresentationBlocks from '../../src/components/PresentationBlocks.jsx';
import { SlideCardInner } from '../../src/components/card/SlideCardInner.jsx';
import { DEFAULT_BRAND, mkSlide } from '../../src/utils/doc-schema.js';
import { assertPresentationExportQuality } from '../../src/hooks/useExport.js';
import { presentationForSocialFormat } from '../../src/utils/presentation-format.js';

const comparison = [{ type: 'comparison', headers: ['Oferta', 'Condição'], rows: [['Assinatura', 'US$ 365/ano · primeiro ano'], ['Teste', 'Preço em estudo']] }];
const slide = (patch = {}) => ({
  id: 'native-slide', title: 'A assinatura sustenta a relação', subtitle: 'O custo de cada entrega define a margem.',
  presentationCompositionId: 'presentation_data', presentationQualityVersion: 1,
  presentationBlocks: comparison, presentationSuppressPhoto: true,
  canvas: { source: 'presentation-preset', variant: 'classic', applied: true, zones: {
    photo: { x: 96, y: 94, w: 1, h: 1 }, title: { x: 6, y: 25, w: 88, h: 14 },
    subtitle: { x: 6, y: 42, w: 88, h: 12 }, evidence: { x: 6, y: 57, w: 88, h: 35 },
  } }, ...patch,
});

describe('native presentation evidence contract', () => {
  it('preserves digits, caveats, accents and exact row order', () => {
    expect(normalizePresentationBlocks(comparison)).toEqual(comparison);
    expect(comparison[0].rows[0][1]).toBe('US$ 365/ano · primeiro ano');
  });
  it.each([
    { type: 'metrics', items: [{ label: 'Base ativa', value: '1.200', detail: 'Projeção, não realizado' }] },
    { type: 'steps', items: [{ title: 'Validar', body: 'Oferta inicial' }, { title: 'Acompanhar' }] },
  ])('allows the %s primitive with optional plain text', (block) => {
    expect(normalizePresentationBlocks([block])).toHaveLength(1);
  });
  it.each([
    [{ type: 'iframe', url: 'https://example.com' }],
    [{ ...comparison[0], rows: [['a']] }],
    [{ ...comparison[0], rows: [...comparison[0].rows, ...comparison[0].rows, ...comparison[0].rows] }],
    [{ type: 'metrics', items: [{ label: 'Receita', value: 0 }] }],
    [{ type: 'steps', items: [{ title: 'Etapa única' }] }],
    [{ ...comparison[0], rows: [['a'.repeat(241), 'b']] }],
    [comparison[0], comparison[0]],
  ])('rejects invalid evidence as a whole without slicing rows or text', (raw) => {
    const before = JSON.stringify(raw);
    expect(normalizePresentationBlocks(raw)).toEqual([]);
    expect(JSON.stringify(raw)).toBe(before);
  });
  it('instructs the model to preserve absence, units and editable data', () => {
    const prompt = buildPresentationBlocksPrompt();
    expect(prompt).toContain('Não transforme informação ausente em zero');
    expect(prompt).toContain('presentationBlocks');
    expect(prompt).toContain('Não peça à imagem que desenhe tabela');
  });
});

describe('presentation geometry audit and bounded repairs', () => {
  it('accepts the separated title, contextual text and evidence', () => {
    expect(auditPresentationLayout(slide())).toEqual({ ok: true, issues: [] });
  });
  it('reports missing evidence geometry, malformed blocks and overlapping content', () => {
    const missing = slide(); delete missing.canvas.zones.evidence;
    expect(auditPresentationLayout(missing).issues[0].code).toBe('invalid-zone');
    const overlapping = slide(); overlapping.canvas.zones.evidence.y = 45;
    expect(auditPresentationLayout(overlapping).issues.some((issue) => issue.code === 'overlapping-content')).toBe(true);
    expect(auditPresentationLayout(slide({ presentationBlocks: [{ type: 'svg' }] })).issues[0].code).toBe('invalid-block');
  });
  it('only repairs a small generated-box displacement; all copy and type stay intact', () => {
    const original = slide(); original.canvas.zones.title.x = -1;
    const before = JSON.stringify(original);
    const result = repairPresentationLayouts([original]);
    expect(result.repairs).toHaveLength(1);
    expect(result.slides[0].canvas.zones.title.x).toBe(0);
    expect(result.slides[0].title).toBe(original.title);
    expect(result.slides[0].presentationBlocks).toEqual(original.presentationBlocks);
    expect(JSON.stringify(original)).toBe(before);
    expect(repairPresentationLayouts(result.slides).repairs).toEqual([]);
  });
  it('leaves a large mistake for correction and leaves manual or legacy slides untouched', () => {
    const broken = slide(); broken.canvas.zones.evidence.y = 90;
    const result = repairPresentationLayouts([broken]);
    expect(result.repairs).toEqual([]); expect(result.ok).toBe(false);
    const manual = slide(); manual.canvas.source = 'manual'; manual.canvas.zones.title.x = -1;
    expect(repairPresentationLayouts([manual]).slides[0]).toBe(manual);
    expect(auditPresentationLayout({ title: 'Legacy', subtitle: 'Sem zonas' }).ok).toBe(true);
  });
  it('does not apply the new export gate to legacy free-positioned slides', () => {
    expect(() => assertPresentationExportQuality({ slides: [slide({ presentationQualityVersion: undefined, presentationBlocks: [] })], roots: [] })).not.toThrow();
    const broken = slide(); broken.canvas.zones.evidence.y = 90;
    expect(() => assertPresentationExportQuality({ slides: [broken], roots: [] })).toThrow('Revise o slide 1');
  });
  it.each(['stories', 'quadrado', 'carrossel'])('keeps native evidence visible and separate when adapted to %s', (fmt) => {
    const adapted = presentationForSocialFormat(slide(), fmt);
    expect(adapted.presentationBlocks).toEqual(comparison);
    expect(adapted.presentationSuppressPhoto).toBe(true);
    expect(adapted.canvas.zones.evidence.y).toBeGreaterThanOrEqual(adapted.canvas.zones.subtitle.y + adapted.canvas.zones.subtitle.h);
    expect(auditPresentationLayout(adapted, { fmt }).ok).toBe(true);
  });
});

function measuredRoot({ overflow = false, overlap = false, contrast = true } = {}) {
  const box = (left, top, width, height) => ({ left, top, width, height, right: left + width, bottom: top + height });
  const zone = (rect) => ({ textContent: 'Texto', getBoundingClientRect: () => rect, clientHeight: rect.height, clientWidth: rect.width,
    scrollHeight: rect.height, scrollWidth: rect.width, contains: () => false });
  const title = zone(box(60, 250, 880, 140));
  const evidence = zone(box(60, overlap ? 300 : 570, 880, 350));
  if (overflow) evidence.scrollHeight = 500;
  const ink = { textContent: '365', color: contrast ? 'rgb(255, 255, 255)' : 'rgb(80, 80, 80)' };
  const panel = { backgroundColor: 'rgb(60, 60, 60)', querySelectorAll: () => [ink] };
  const root = { matches: () => true, getAttribute: () => 'native-slide', getBoundingClientRect: () => box(0, 0, 1000, 1000),
    querySelectorAll: (selector) => selector === '[data-vc-quality-zone]' ? [title, evidence] : [panel] };
  return { root, getStyle: (node) => node };
}

describe('measured export quality', () => {
  it('checks actual geometry after render', () => {
    const env = measuredRoot(); expect(auditRenderedPresentationLayout([env.root], env).ok).toBe(true);
    const overflow = measuredRoot({ overflow: true });
    expect(auditRenderedPresentationLayout([overflow.root], overflow).issues[0].code).toBe('render-overflow');
    const overlap = measuredRoot({ overlap: true });
    expect(auditRenderedPresentationLayout([overlap.root], overlap).issues.some((issue) => issue.code === 'render-overlap')).toBe(true);
  });
  it('checks contrast only on declared opaque native evidence surfaces', () => {
    const low = measuredRoot({ contrast: false });
    expect(auditRenderedPresentationLayout([low.root], low).issues[0].code).toBe('evidence-contrast');
    expect(auditRenderedPresentationLayout([{}]).ok).toBe(true);
  });
});

describe('same editable native primitives in preview and export', () => {
  it.each([
    [{ type: 'metrics', items: [{ label: 'Receita planejada', value: 'US$ 100', detail: 'Hipótese · mês 1' }] }, 'Receita planejada'],
    [{ type: 'steps', items: [{ title: 'Validar a oferta', body: 'Testar disposição a pagar' }, { title: 'Medir renovação', body: 'Observar a primeira coorte' }] }, 'Medir renovação'],
  ])('renders a native %s primitive as selectable text', (block, expected) => {
    const html = renderToStaticMarkup(React.createElement(PresentationBlocks, {
      blocks: [block], rect: { x: 6, y: 58, w: 88, h: 35 }, frame: { w: 1920, h: 1080 }, forExport: true,
    }));
    expect(html).toContain(`data-vc-presentation-block="${block.type}"`);
    expect(html).toContain(expected);
    expect(html).not.toContain('<img');
  });
  it('uses a semantic table, escapes HTML and exposes editing only in preview', () => {
    const blocks = [{ type: 'comparison', headers: ['Canal', 'Condição'], rows: [['<script>alert(1)</script>', 'US$ 365/ano']] }];
    const props = { blocks, rect: { x: 6, y: 57, w: 88, h: 35 }, frame: { w: 1920, h: 1080 }, ink: '#ffffff', background: '#111111', onChange: () => {} };
    const preview = renderToStaticMarkup(React.createElement(PresentationBlocks, props));
    const exported = renderToStaticMarkup(React.createElement(PresentationBlocks, { ...props, forExport: true }));
    expect(preview).toContain('<table'); expect(preview).toContain('scope="col"');
    expect(preview).toContain('&lt;script&gt;'); expect(preview).not.toContain('<script>');
    expect(preview).toContain('Editar linha 1, coluna 1');
    expect(exported).not.toContain('Editar linha'); expect(exported).toContain('US$ 365/ano');
  });
  it.each([false, true])('integrates evidence into the actual card (forExport=%s) without photos posing as data', (forExport) => {
    const rendered = renderToStaticMarkup(React.createElement(SlideCardInner, {
      slide: { ...mkSlide(1, DEFAULT_BRAND), ...slide(), bgImage: 'https://example.com/data.jpg', layout: 'tl', align: 'left' },
      brand: { ...DEFAULT_BRAND, bg: '#111111', textColor: '#ffffff' }, fmt: 'apresentacao', num: 1, total: 1, forExport,
    }));
    expect(rendered).toContain('data-vc-presentation-block="comparison"');
    expect(rendered).toContain('US$ 365/ano');
    expect(rendered).toContain('O custo de cada entrega');
    expect(rendered).not.toContain('data-vc-photo-zone');
  });
});
