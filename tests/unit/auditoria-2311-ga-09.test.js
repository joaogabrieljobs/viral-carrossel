import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import PresentationBlocks, * as blocosModule from '../../src/components/PresentationBlocks.jsx';
import { FAMILY_KEYS, brandPaletteOverrides, familyEvidenceStyle, familySpec } from '../../src/utils/presentation-families.js';
import { wcagContrast } from '../../src/utils/wcag.js';

const DESTAQUES = ['#fde047', '#ffffff', '#0c1220'];
const ETAPAS = [{ type: 'steps', items: [{ title: 'Escolha', body: 'Modelo.' }, { title: 'Pague', body: 'Em três parcelas.' }, { title: 'Publique', body: 'No mesmo dia.' }] }];
const METRICAS = [{ type: 'metrics', items: [{ value: '38%', label: 'Receita' }, { value: '12', label: 'Clientes' }] }];

function bloco(family, blocks, { accent, background } = {}) {
  const p = familySpec(family).palette;
  const fundo = background || p.bg;
  const html = renderToStaticMarkup(React.createElement(PresentationBlocks, {
    blocks, rect: { x: 6, y: 40, w: 88, h: 50 }, frame: { w: 1920, h: 1080 }, family, ink: p.ink, background: fundo,
    fontFamily: 'Inter', accent, forExport: true,
    paletteOverrides: accent ? brandPaletteOverrides(family, { accent }) : {},
  }));
  return { html, fundo };
}

const estilo = (tag) => Object.fromEntries((tag.match(/style="([^"]*)"/)?.[1] || '').split(';').filter(Boolean).map((par) => {
  const i = par.indexOf(':');
  return [par.slice(0, i), par.slice(i + 1)];
}));

/** Marcadores das etapas: cor do numeral, ou fundo e texto da pílula. */
const marcadores = (html) => [...html.matchAll(/<span aria-hidden="true"[^>]*>/g)].map((m) => estilo(m[0]));
/** Fios acima de cada item (etapa ou métrica). */
const fios = (html) => [...html.matchAll(/border-top:[0-9.]+px solid ([^;"]+)/g)].map((m) => m[1]);

describe('GA-09: destaque da marca nos blocos de apresentação lê no fundo onde aparece', () => {
  const casos = FAMILY_KEYS.flatMap((family) => DESTAQUES.map((accent) => [family, accent]));

  it.each(casos)('%s com destaque %s: numeral, pílula e fio', (family, accent) => {
    const st = familyEvidenceStyle(family);
    const etapas = bloco(family, ETAPAS, { accent });
    // Com painel (Modular, Cultural) o marcador fica sobre o painel da família.
    const superficie = st.panel ? st.panelColor : etapas.fundo;
    const marcas = marcadores(etapas.html);
    expect(marcas).toHaveLength(3);
    for (const marca of marcas) {
      if (st.stepMarker === 'pill') {
        expect(wcagContrast(marca['background-color'], superficie), `pílula ${marca['background-color']} sobre ${superficie}`).toBeGreaterThanOrEqual(3);
        expect(wcagContrast(marca.color, marca['background-color']), `texto ${marca.color} na pílula ${marca['background-color']}`).toBeGreaterThanOrEqual(4.5);
      } else {
        expect(wcagContrast(marca.color, superficie), `numeral ${marca.color} sobre ${superficie}`).toBeGreaterThanOrEqual(3);
      }
    }
    // O fio só leva o destaque nas famílias em que ele é da cor de destaque;
    // nas outras (tinta do texto, segunda cor do Cultural) continua o da família.
    for (const html of [etapas.html, bloco(family, METRICAS, { accent }).html]) {
      for (const fio of fios(html)) {
        if (st.metricRuleColor === st.accent) expect(wcagContrast(fio, superficie), `fio ${fio} sobre ${superficie}`).toBeGreaterThanOrEqual(3);
        else expect(fio).toBe(st.metricRuleColor);
      }
    }
  });

  it('marca escura com destaque claro (fundo do slide é o da marca): o mesmo cálculo vale no fundo real', () => {
    for (const [accent, background] of [['#1e1b4b', '#0E1217'], ['#fde047', '#fffbea'], ['#d9a3b6', '#121318']]) {
      const { html } = bloco('executive', ETAPAS, { accent, background });
      for (const marca of marcadores(html)) expect(wcagContrast(marca.color, background)).toBeGreaterThanOrEqual(3);
      for (const fio of fios(html)) expect(wcagContrast(fio, background)).toBeGreaterThanOrEqual(3);
    }
  });

  it('destaque que já lê vai como a marca definiu', () => {
    const { html } = bloco('executive', ETAPAS, { accent: '#d9a3b6', background: '#121318' });
    expect(marcadores(html).every((marca) => marca.color === '#d9a3b6')).toBe(true);
    expect(fios(html).every((fio) => fio === '#d9a3b6')).toBe(true);
  });

  it.each(FAMILY_KEYS)('%s sem marca própria: cores da família como estavam', (family) => {
    const st = familyEvidenceStyle(family);
    const { html } = bloco(family, ETAPAS);
    for (const marca of marcadores(html)) {
      if (st.stepMarker === 'pill') {
        expect(marca['background-color']).toBe(st.accent);
        expect(wcagContrast(marca.color, '#ffffff')).toBe(1);
      } else expect(marca.color).toBe(st.accent);
    }
    if (st.metricRule) expect(fios(html).every((fio) => fio === st.metricRuleColor)).toBe(true);
    expect(fios(bloco(family, METRICAS).html).every((fio) => fio === st.metricRuleColor)).toBe(true);
  });

  it('a regra é uma função pura do estilo da família, do destaque e do fundo', () => {
    const { evidenceStyleForBrand } = blocosModule;
    expect(typeof evidenceStyleForBrand).toBe('function');
    const exec = familyEvidenceStyle('executive');
    // Valores do relato: 1,23:1 no Executivo e 1,18:1 no Técnico, antes da correção.
    expect(wcagContrast('#fde047', '#F7F7F5')).toBeLessThan(1.3);
    expect(wcagContrast(evidenceStyleForBrand(exec, '#fde047', '#F7F7F5').accent, '#F7F7F5')).toBeGreaterThanOrEqual(3);
    const tec = evidenceStyleForBrand(familyEvidenceStyle('technical'), '#1e1b4b', '#0E1217');
    expect(wcagContrast(tec.accent, '#0E1217')).toBeGreaterThanOrEqual(3);
    expect(wcagContrast(tec.metricRuleColor, '#0E1217')).toBeGreaterThanOrEqual(3);
    // Modular: 1,32:1 de branco sobre a pílula amarela, antes.
    const mod = evidenceStyleForBrand(familyEvidenceStyle('modular'), '#fde047', '#FFFFFF');
    expect(wcagContrast(mod.pillInk, mod.accent)).toBeGreaterThanOrEqual(4.5);
    // Sem destaque de marca, nada muda além da tinta da pílula (branca, como era).
    expect(evidenceStyleForBrand(exec, '', '#F7F7F5')).toEqual({ ...exec, pillInk: '#ffffff' });
    expect(evidenceStyleForBrand(familyEvidenceStyle('modular'), '', '#FFFFFF').pillInk).toBe('#ffffff');
  });
});
