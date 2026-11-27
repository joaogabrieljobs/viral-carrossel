// Modo livre de apresentação, fase 2: cartão "Livre: o Moont decide" como
// primeiro cartão do seletor de estilo da apresentação.
import React from 'react';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import VisualStylePicker from '../../src/components/VisualStylePicker.jsx';
import {
  FREE_PRESENTATION_VISUAL_PRESET, PRESENTATION_VISUAL_PRESETS, PRESENTATION_VISUAL_PRESET_CATALOG,
} from '../../src/styles/presentation-presets.jsx';
import { SOCIAL_VISUAL_PRESET_CATALOG, VISUAL_PRESETS } from '../../src/styles/visual-presets.jsx';

const render = props => renderToStaticMarkup(React.createElement(VisualStylePicker, { onChange: () => {}, ...props }));
const rotulos = html => [...html.matchAll(/<button[^>]*aria-label="([^"]+)"/g)].map(m => m[1]);
const deck = PRESENTATION_VISUAL_PRESET_CATALOG.filter(p => p.productKind === 'apresentacao');

describe('modo livre, fase 2: cartão Livre no seletor', () => {
  it('é o primeiro cartão do seletor de apresentação, antes dos 10 padrões', () => {
    const labels = rotulos(render({ presets: deck, value: null, aspectRatio: '16 / 9' }));
    expect(labels[0]).toBe(`Livre: o Moont decide. ${FREE_PRESENTATION_VISUAL_PRESET.desc}`);
    expect(labels).toHaveLength(11);
    expect(labels.slice(1).map(l => l.split('. ')[0])).toEqual(PRESENTATION_VISUAL_PRESETS.map(p => p.label));
  });

  it('miniatura com o símbolo do Moont sobre as cores da marca e descrição de uma linha', () => {
    const html = render({ presets: deck, value: null, aspectRatio: '16 / 9' });
    const card = html.slice(html.indexOf('<button'), html.indexOf('</button>') + 9);
    expect(card).toContain('data-vc-free-preview');
    expect(card).toMatch(/data-vc-free-preview="" role="img" aria-label="Símbolo do Moont: o Moont decide a composição de cada página"/);
    // O símbolo é o mesmo componente do cabeçalho (três molduras em sequência).
    expect(card).toMatch(/<svg[^>]*data-vc-free-mark=""[^>]*viewBox="0 0 64 64"/);
    expect((card.match(/<rect /g) || []).length).toBe(3);
    expect(card).toContain('#5B53E8');
    expect(card).toContain('#D7FF5A');
    expect(card).not.toContain('data-vc-free-mini');
    expect(card).toContain('data-vc-free-desc');
    expect(card).toContain(FREE_PRESENTATION_VISUAL_PRESET.desc);
    expect(FREE_PRESENTATION_VISUAL_PRESET.desc.length).toBeLessThanOrEqual(80);
  });

  it('carrossel: o Livre social usa a mesma miniatura', () => {
    const social = SOCIAL_VISUAL_PRESET_CATALOG.filter(p => p.productKind !== 'apresentacao');
    const pick = h => { const c = h.slice(h.indexOf('<button'), h.indexOf('</button>') + 9); return c.slice(c.indexOf('<div data-vc-free-preview'), c.indexOf('data-vc-free-caption')); };
    const html = render({ presets: social, value: null, aspectRatio: '4 / 5', allowGenerationOnly: true });
    expect(rotulos(html)[0]).toMatch(/^Livre: o Moont decide\./);
    expect(pick(html)).toBe(pick(render({ presets: deck, value: null, aspectRatio: '16 / 9' })));
  });

  it('escolhido, o resumo mostra o nome do Livre, não "padrão legado"', () => {
    const html = render({ presets: deck, value: 'presentation_free', aspectRatio: '16 / 9' });
    expect(html).toContain('aria-pressed="true" aria-label="Livre: o Moont decide.');
    expect(html).not.toContain('Padrão legado em uso · Livre');
  });

  it('sem o preset livre na lista, o seletor fica como antes; carrossel não tem Livre', () => {
    expect(rotulos(render({ presets: PRESENTATION_VISUAL_PRESETS, value: null }))[0].split('. ')[0]).toBe(PRESENTATION_VISUAL_PRESETS[0].label);
    expect(rotulos(render({ presets: VISUAL_PRESETS, value: null })).some(l => l.startsWith('Livre: o Moont decide'))).toBe(false);
  });

  it('assistente de criação: Livre é o primeiro dos estilos para começar da apresentação', () => {
    const source = readFileSync(new URL('../../src/components/CreateProjectFlow.jsx', import.meta.url), 'utf8');
    // O catálogo já está filtrado pelo produto; cada Livre abre sua lista.
    expect(source).toContain("isPresentation ? p.productKind === 'apresentacao' : p.productKind !== 'apresentacao'");
    expect(source).toMatch(/const recommendedPresets = \[\s*\.\.\.presets\.filter\(p => p\.isFree\)/);
  });

  it('escolher o Livre não grava as cores padrão do Livre como escolha da pessoa (a paleta é do roteiro)', () => {
    const source = readFileSync(new URL('../../src/components/CreateProjectFlow.jsx', import.meta.url), 'utf8');
    expect(source).toMatch(/\.\.\.\(preset && !preset\.isFree \? sanitizeCustomVisualPresetBrand\(preset\.brand\) : \{\}\)/);
  });
});
