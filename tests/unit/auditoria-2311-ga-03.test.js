import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SlideCardInner } from '../../src/components/card/SlideCardInner.jsx';
import { DEFAULT_BRAND, mkSlide } from '../../src/utils/doc-schema.js';
import { VISUAL_PRESETS, SOCIAL_FAMILY_PRESETS, applyVisualPreset } from '../../src/styles/visual-presets.jsx';
import { applySocialVisualComposition } from '../../src/utils/social-visual-composition.js';
import { applyPresentationVisualPreset, getPresentationCompositionOverrides } from '../../src/styles/presentation-presets.jsx';
import { slideForFormatDisplay } from '../../src/utils/format-view.js';
import { signatureTextSupport } from '../../src/utils/card-signature-texts.js';
import { SignatureTextFields } from '../../src/components/panels/SignatureTextFields.jsx';
import { QuickAdjustmentsPanel } from '../../src/components/panels/QuickAdjustmentsPanel.jsx';

const SOBRELINHA = 'Chapéu da pessoa';
const RISCADO = 'De R$ 199';
const OFERTA = 'por R$ 99 hoje';
const preenchido = (slide) => ({ ...slide, eyebrowText: SOBRELINHA, strikethroughText: RISCADO, afterTitleText: OFERTA });

function desenhado(slide, brand, { num = 1, total = 7, forExport = false, creativePreset = 'livre', fmt = 'carrossel' } = {}) {
  const html = renderToStaticMarkup(React.createElement(SlideCardInner, {
    slide, brand, fmt, num, total, forExport, creativePreset,
  }));
  return {
    eyebrow: html.includes(SOBRELINHA),
    offer: html.includes('por R$ 99 hoje'),
    strikeText: html.includes(RISCADO),
    strikeLine: /text-decoration:line-through[^>]*>De R\$ 199</.test(html),
  };
}

const brandBase = { ...DEFAULT_BRAND, subtitleVisible: true, showHandle: false };
const legado = () => preenchido({ ...mkSlide(1, brandBase), title: 'Título', subtitle: 'Apoio', photoRegion: 'full', canvas: null, useCultureLayout: false });

function carrosselGerado(presetId) {
  const preset = [...VISUAL_PRESETS, ...SOCIAL_FAMILY_PRESETS].find((p) => p.id === presetId || p.socialFamily === presetId);
  const brand = applyVisualPreset({ name: 'Padaria', handle: '' }, preset.id);
  const cards = [
    { id: 'c1', title: 'A padaria que abriu a cozinha', subtitle: 'Um ensaio sobre processo.', imageQuery: 'cena' },
    { id: 'c2', title: 'Durante anos, o balcão escondia', subtitle: 'O pão chegava pronto à vitrine.', imageQuery: '' },
    { id: 'c3', title: 'A massa descansa à vista', subtitle: 'A janela virou parte da loja.', imageQuery: 'cena' },
    { id: 'c4', title: 'Uma cozinha aberta é vitrine', subtitle: 'Salve para depois.', imageQuery: '' },
  ].map((c) => ({ ...mkSlide(1, brand), ...c }));
  const slides = applySocialVisualComposition(cards, { preset, brand }).map(preenchido);
  return { brand, slides };
}

/** O que o painel oferece tem de ser o que o card desenha, no editor e no arquivo. */
function confere(slide, brand, opts) {
  const apoio = signatureTextSupport(slide, { creativePreset: opts?.creativePreset });
  for (const forExport of [false, true]) {
    const visto = desenhado(slide, brand, { ...opts, forExport });
    expect({ eyebrow: apoio.eyebrow, offer: apoio.offer }).toEqual({ eyebrow: visto.eyebrow, offer: visto.offer });
    expect(apoio.strike).toBe(visto.strikeLine ? 'line' : visto.strikeText ? 'plain' : 'none');
  }
  return apoio;
}

describe('GA-03: o painel só oferece o texto de assinatura que o card desenha', () => {
  it('card com foto de fundo ou cor inteira desenha os três, com o riscado traçado', () => {
    expect(confere(legado(), brandBase)).toEqual({ eyebrow: true, offer: true, strike: 'line' });
  });

  it.each(['inset_h_top', 'inset_h_middle', 'inset_h_bottom', 'inset_h_narrow_mid'])('foto em faixa (%s) não desenha nenhum', (photoRegion) => {
    expect(confere({ ...legado(), photoRegion }, brandBase)).toEqual({ eyebrow: false, offer: false, strike: 'none' });
  });

  it('layout de texto + foto + texto não desenha nenhum', () => {
    const slide = { ...legado(), useCultureLayout: true, bodyAfterImage: 'Texto depois da foto.', bgImage: 'data:image/png;base64,AAAA' };
    expect(confere(slide, brandBase)).toEqual({ eyebrow: false, offer: false, strike: 'none' });
  });

  it('Bold Promo gerado: oferta só na capa e no fecho, sem traço; sobrelinha em nenhum', () => {
    const { brand, slides } = carrosselGerado('bold_promo_rosa');
    const apoios = slides.map((slide, i) => confere(slide, brand, { num: i + 1, total: slides.length }));
    expect(apoios[0]).toEqual({ eyebrow: false, offer: true, strike: 'plain' });
    expect(apoios.at(-1)).toEqual({ eyebrow: false, offer: true, strike: 'plain' });
    expect(apoios.slice(1, -1).every((a) => !a.eyebrow && !a.offer && a.strike === 'none')).toBe(true);
  });

  it('Case Study gerado: sobrelinha só na capa; oferta em nenhum', () => {
    const { brand, slides } = carrosselGerado('case_study_neon');
    const apoios = slides.map((slide, i) => confere(slide, brand, { num: i + 1, total: slides.length }));
    expect(apoios[0]).toEqual({ eyebrow: true, offer: false, strike: 'none' });
    expect(apoios.slice(1).every((a) => !a.eyebrow && !a.offer)).toBe(true);
  });

  it.each(['carrossel', 'quadrado', 'stories'])('Bold Promo e Case Study no formato %s: o painel continua de acordo com o card', (fmt) => {
    for (const id of ['bold_promo_rosa', 'case_study_neon']) {
      const { brand, slides } = carrosselGerado(id);
      slides.forEach((slide, i) => {
        const naTela = slideForFormatDisplay(slide, fmt);
        const apoio = confere(naTela, brand, { num: i + 1, total: slides.length, fmt });
        // O painel recebe o card como está salvo; a tela mostra a versão do formato.
        expect(signatureTextSupport(slide)).toEqual(apoio);
      });
    }
  });

  it('slide de apresentação composto não desenha nenhum; o de fundo inteiro desenha os três', () => {
    const brand = applyPresentationVisualPreset(DEFAULT_BRAND, 'presentation_data');
    const composto = preenchido({
      ...mkSlide(4, DEFAULT_BRAND),
      ...getPresentationCompositionOverrides('presentation_data', { slide: { presentationVisualRole: 'data' }, stage: { visualRole: 'data' }, index: 3, count: 8 }),
      title: 'Receita recorrente cresceu 38%',
      subtitle: 'A expansão veio da base ativa.',
    });
    const opts = { fmt: 'apresentacao', creativePreset: 'apresentacao', num: 4, total: 8 };
    expect(confere(composto, brand, opts)).toEqual({ eyebrow: false, offer: false, strike: 'none' });
    expect(confere(legado(), brandBase, opts)).toEqual({ eyebrow: true, offer: true, strike: 'line' });
  });

  it.each(['sports_editorial', 'minimal_clean', 'manchete'])('estilo %s gerado: nenhum dos três em nenhum card', (id) => {
    const { brand, slides } = carrosselGerado(id);
    slides.forEach((slide, i) => {
      expect(confere(slide, brand, { num: i + 1, total: slides.length })).toEqual({ eyebrow: false, offer: false, strike: 'none' });
    });
  });
});

describe('GA-03: painel de textos de assinatura', () => {
  const painel = (slide, props = {}) => renderToStaticMarkup(React.createElement(SignatureTextFields, {
    slide, creativePreset: 'livre', itemLabel: 'card', updateSlide: () => {}, ...props,
  }));
  const campos = (html) => [...html.matchAll(/<input[^>]*>/g)].map((m) => ({
    desligado: /\sdisabled=""/.test(m[0]),
    valor: (m[0].match(/\svalue="([^"]*)"/) || [])[1],
  }));

  it('card que desenha os três: campos ligados e nenhum aviso', () => {
    const html = painel(legado());
    expect(campos(html).map((c) => c.desligado)).toEqual([false, false, false]);
    expect(html).not.toContain('data-vc-signature-notice');
  });

  it('foto em faixa: os três campos ficam desligados, com o texto guardado à vista e o motivo escrito', () => {
    const html = painel({ ...legado(), photoRegion: 'inset_h_top' });
    expect(campos(html)).toEqual([
      { desligado: true, valor: SOBRELINHA },
      { desligado: true, valor: RISCADO },
      { desligado: true, valor: OFERTA },
    ]);
    expect(html).toContain('data-vc-signature-notice');
    expect(html).toMatch(/layout atual deste card não mostra estes textos/i);
  });

  it('capa do Bold Promo: sobrelinha desligada; aviso diz que o riscado sai sem o traço', () => {
    const { slides } = carrosselGerado('bold_promo_rosa');
    const html = painel(slides[0]);
    expect(campos(html).map((c) => c.desligado)).toEqual([true, false, false]);
    expect(html).toMatch(/não mostra: Sobrelinha\./);
    expect(html).toMatch(/sem o traço/i);
  });

  it('em apresentação o aviso fala em slide', () => {
    expect(painel({ ...legado(), photoRegion: 'inset_h_top' }, { itemLabel: 'slide' })).toMatch(/deste slide não mostra/i);
  });

  it('o painel completo usa estes campos', () => {
    const fonte = readFileSync(new URL('../../src/components/SidebarContent.jsx', import.meta.url), 'utf8');
    expect(fonte.includes('<SignatureTextFields'), 'SidebarContent usa SignatureTextFields').toBe(true);
    expect(fonte.includes('creativePreset={creativePreset}'), 'repassa a narrativa do projeto').toBe(true);
  });

  it('ajustes rápidos: campo preenchido que o card não desenha não é oferecido', () => {
    const ajustes = (slide) => renderToStaticMarkup(React.createElement(QuickAdjustmentsPanel, { slide, activeIdx: 0, cardCount: 4, presets: [] }));
    const comFaixa = ajustes({ ...legado(), id: 'faixa', photoRegion: 'inset_h_top' });
    for (const key of ['eyebrow', 'offer', 'offer-strike']) expect(comFaixa).not.toContain(`data-key="${key}"`);
    const { slides } = carrosselGerado('bold_promo_rosa');
    const capa = ajustes(slides[0]);
    expect(capa).not.toContain('data-key="eyebrow"');
    expect(capa).toContain('data-key="offer"');
    expect(capa).toMatch(/Texto riscado \(sai sem o traço\)/);
    const inteiro = ajustes({ ...legado(), id: 'inteiro' });
    for (const key of ['eyebrow', 'offer', 'offer-strike']) expect(inteiro).toContain(`data-key="${key}"`);
  });
});
