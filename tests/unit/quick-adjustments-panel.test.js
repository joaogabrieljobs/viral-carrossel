import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QuickAdjustmentsPanel, quickOverlayTextPatch, quickTextEditPatch, quickVisiblePresets } from '../../src/components/panels/QuickAdjustmentsPanel.jsx';

const builtins = Array.from({ length: 9 }, (_, index) => ({ id: `style-${index}`, label: `Estilo ${index}`, brand: {} }));
const personal = { id: 'custom_user', label: 'Meu café', isCustom: true, brand: {} };

describe('Criar rápido: ajustes essenciais', () => {
  it('limits initial built-in choices while always including saved and currently applied styles', () => {
    const catalog = [...builtins, personal, { id: 'legacy', hidden: true }];
    expect(quickVisiblePresets(catalog).map((preset) => preset.id)).toEqual([...builtins.slice(0, 6).map((preset) => preset.id), personal.id]);
    expect(quickVisiblePresets(catalog, false, 'style-8')).toContain(builtins[8]);
    expect(quickVisiblePresets(catalog, true)).toHaveLength(10);
    expect(quickVisiblePresets(null)).toEqual([]);
    expect(catalog).toHaveLength(11);
  });

  it('renders existing text, personal styles and three disclosures without requiring optional actions', () => {
    const html = renderToStaticMarkup(React.createElement(QuickAdjustmentsPanel, {
      slide: { id: 'one', title: 'Título aprovado', subtitle: 'Texto existente', bodyAfterImage: 'Detalhes finais' },
      activeIdx: 1,
      cardCount: 5,
      presets: [...builtins, personal],
    }));
    expect(html).toContain('Card 2 de 5');
    expect(html).toContain('Título aprovado');
    expect(html).toContain('Texto existente');
    expect(html).toContain('Detalhes finais');
    expect(html).toContain('Meu café');
    expect(html).toContain('Ver todos os estilos (10)');
    expect(html.match(/<details\b/g)).toHaveLength(3);
    expect(html).toContain('Onde aplicar o estilo');
    expect(html).toContain('data-vc-editor-section="texto-caixa"');
    expect(html).toContain('data-vc-editor-section="imagem-ajustes"');
    expect(html).toContain('data-vc-editor-section="marca-logo"');
    expect(html).toContain('Reescrever todos os textos');
    expect(html).not.toContain('Viral Trends');
  });

  it('uses slide wording and preserves explicit nonstandard size values', () => {
    const html = renderToStaticMarkup(React.createElement(QuickAdjustmentsPanel, {
      isPresentation: true,
      slide: { id: 'deck', titleSize: 92, subSize: 103, bgImageId: 'saved-photo' },
      cardCount: 12,
    }));
    expect(html).toContain('Slide 1 de 12');
    expect(html).toContain('Organizar este slide');
    expect(html).toContain('Título deste slide');
    expect(html).toContain('Enviar imagem para este slide');
    expect(html).toContain('Foto inteira');
    expect(html).toContain('Reposicionar imagem');
    expect(html).not.toContain('Card 1');
  });

  it('identifies the style saved on a card instead of the project default', () => {
    const html = renderToStaticMarkup(React.createElement(QuickAdjustmentsPanel, {
      slide: { id: 'one', visualPresetId: personal.id },
      visualPreset: builtins[0].id,
      presets: [...builtins, personal],
    }));
    expect(html).toMatch(/aria-pressed="true" aria-label="Estilo Meu café, salvo por você"/);
    expect(html).toMatch(/aria-pressed="false" aria-label="Estilo Estilo 0"/);
  });

  it('moves surviving highlights when text is inserted and preserves other fields', () => {
    const slide = { title: 'Marca forte', destaqueSpans: { title: [[6, 11]], subtitle: [[0, 5]] } };
    const patch = quickTextEditPatch(slide, 'title', 'Sua Marca forte');
    expect(patch).toEqual({ title: 'Sua Marca forte', destaqueSpans: { title: [[10, 15]], subtitle: [[0, 5]] } });
    expect(slide.destaqueSpans.title).toEqual([[6, 11]]);
    expect(quickTextEditPatch(slide, 'title', 'Marca simples').destaqueSpans.title).toEqual([]);
  });

  it('exposes only existing auxiliary fields or the selected text', () => {
    const plain = renderToStaticMarkup(React.createElement(QuickAdjustmentsPanel, { slide: { id: 'one', title: 'Título' } }));
    expect(plain.match(/<textarea\b/g)).toHaveLength(2);
    const selected = renderToStaticMarkup(React.createElement(QuickAdjustmentsPanel, {
      slide: { id: 'one', overlays: [{ id: 'cta1', type: 'cta', text: 'Conheça' }] },
      editorFocus: { slideId: 'one', section: 'texto-caixa', key: 'ov_cta1' },
    }));
    expect(selected).toContain('Texto do botão');
    expect(selected).toContain('data-key="ov_cta1"');
    expect(selected).toContain('Conheça');
    const offer = renderToStaticMarkup(React.createElement(QuickAdjustmentsPanel, {
      slide: { id: 'one', eyebrowText: 'Minha marca', afterTitleText: 'R$99', strikethroughText: 'R$199' },
    }));
    for (const key of ['eyebrow', 'offer', 'offer-strike']) expect(offer).toContain(`data-key="${key}"`);
  });

  it('changes only the chosen free text, retaining layout, links and other overlays', () => {
    const slide = { overlays: [{ id: 'first', type: 'text', text: 'Antes', x: 14, y: 30, w: 40, color: '#f0f0f0', href: 'https://example.com' }, { id: 'second', type: 'cta', text: 'Outro' }] };
    const patch = quickOverlayTextPatch(slide, 'first', 'Depois');
    expect(patch.overlays[0]).toEqual({ ...slide.overlays[0], text: 'Depois' });
    expect(patch.overlays[1]).toBe(slide.overlays[1]);
    expect(slide.overlays[0].text).toBe('Antes');
  });
});
