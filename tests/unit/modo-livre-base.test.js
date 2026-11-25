// Modo livre de apresentação, fase 1 (docs/product/modo-livre-apresentacao.md).
// Deck Apoteose (estrutura de 10 slides da QA 24/11) com palavras neutras do
// mesmo tamanho do texto do cliente.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  PRESENTATION_VISUAL_PRESETS,
  getPresentationCompositionOverrides,
  resolvePresentationVisualPresetDefinition,
} from '../../src/styles/presentation-presets.jsx';
import {
  applyPresentationVisualPresetToDoc,
  applyPresentationVisualPresetToSlides,
} from '../../src/utils/presentation-state.js';
import {
  DEFAULT_DECK_DESIGN,
  FREE_BLOCKS,
  FREE_GROUNDS,
  FREE_ICONS,
  FREE_PHOTO_SIZES,
  FREE_PRESENTATION_PRESET_ID,
  deckDesignFromBrand,
  freeDeckViolations,
  freeSlideGeometry,
  normalizeDeckDesign,
  normalizeSlideDesign,
  slideSkipsImageGeneration,
} from '../../src/utils/free-design.js';
import { FAMILY_KEYS, brandPaletteOverrides, familyEvidenceStyle, slidePaletteOverrides } from '../../src/utils/presentation-families.js';
import { chromeElements } from '../../src/utils/presentation-chrome.js';
import { PRESENTATION_LIBRARY_FONTS } from '../../src/utils/presentation-font-manifest.js';
import { wcagContrast } from '../../src/utils/wcag.js';
import { ensureDocShape } from '../../src/utils/doc-schema.js';
import { slideForFormatDisplay } from '../../src/utils/format-view.js';

const apoteose = JSON.parse(readFileSync(new URL('../fixtures/apoteose-estrutura.json', import.meta.url), 'utf8'));
const FOTO = 'data:image/png;base64,iVBORw0KGgo=';
const palavras = (n) => {
  const base = 'festa cidade ritmo encontro noite cultura';
  let out = '';
  while (out.length < n) out += (out ? ' ' : '') + base;
  return out.slice(0, n).trim();
};
const deck = ({ fotoPronta = true } = {}) => apoteose.slides.map((s, i) => ({
  id: `apoteose-${i + 1}`,
  title: palavras(s.titulo),
  subtitle: palavras(s.apoio),
  bodyAfterImage: palavras(s.final),
  ...(s.foto ? { ...(fotoPronta ? { bgImage: FOTO } : {}), imageQuery: 'editorial photo' } : {}),
  presentationBlocks: s.bloco ? [{ type: 'metrics', items: [1, 2, 3].map(n => ({ label: `Rótulo ${n}`, value: `${n * 12}%`, detail: palavras(55) })) }] : [],
  presentationPlan: { visualRole: s.visualRole, purpose: s.purpose, question: 'Por quê?', keyMessage: 'Mensagem.' },
}));
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 16);

// Medido antes da fase 1 (commit 3501c0a): composição dos 10 padrões na
// Apoteose, ao aplicar o estilo nos slides e no documento.
const BASELINE = {
  "presentation_executive_minimal": {"sequencia":"cover,content,content,content,content,content,demo,content,data,closing","slides":"f41260853aa60b04","doc":"d4484ad4bd9384c6"},
  "presentation_editorial_magazine": {"sequencia":"cover,content,content,content,content,content,demo,content,data,closing","slides":"d1f39ca16724bae2","doc":"12378acae456de4a"},
  "presentation_data_first": {"sequencia":"cover,content,content,content,content,content,demo,content,data,closing","slides":"71b7995a0f8f7751","doc":"ee36b4c6a69405e6"},
  "presentation_swiss_grid": {"sequencia":"cover,content,content,content,content,content,demo,content,data,closing","slides":"ab8d3d4dd7c5b9c3","doc":"b74dfddf7a212296"},
  "presentation_cinematic": {"sequencia":"cover,content,content,content,content,content,demo,content,data,closing","slides":"0d186a4391fcf00a","doc":"7dafb5fe71bd2d5c"},
  "presentation_typographic_bold": {"sequencia":"cover,content,demo,content,content,demo,content,content,data,closing","slides":"10719236b13bfe6d","doc":"7f83b23b3bf2d50d"},
  "presentation_modular_cards": {"sequencia":"cover,content,content,content,content,content,demo,content,data,closing","slides":"06fdb078f0818d9c","doc":"7ee85a225e7b60f7"},
  "presentation_photo_essay": {"sequencia":"cover,content,content,content,content,content,demo,content,data,closing","slides":"2e42802cb0529780","doc":"84851086c1c45d89"},
  "presentation_technical_blueprint": {"sequencia":"cover,content,content,content,content,content,demo,content,data,closing","slides":"9e9af0b874924859","doc":"9927f7ac0046759f"},
  "presentation_premium_dark": {"sequencia":"cover,content,content,content,content,content,demo,content,data,closing","slides":"b1deafc38ee18c17","doc":"3b0af25911439eee"},
};

describe('modo livre, fase 1: os 10 padrões não mudam', () => {
  it('são 10 padrões no seletor', () => {
    expect(PRESENTATION_VISUAL_PRESETS).toHaveLength(10);
  });

  it.each(PRESENTATION_VISUAL_PRESETS.map(p => [p.id]))('%s: sequência e composição idênticas às de antes', (id) => {
    const slides = applyPresentationVisualPresetToSlides(deck(), id, 'auto');
    const doc = applyPresentationVisualPresetToDoc({ brand: { accent: '#B4235A', bg: '#101010', titleColor: '#FAFAFA' }, presentationPath: 'auto', slides: deck({ fotoPronta: false }) }, id);
    const got = {
      sequencia: slides.map(s => s.presentationComposition).join(','),
      slides: hash(slides),
      doc: hash(doc),
    };
    if (!BASELINE[id]) console.log(`BASELINE ${JSON.stringify(id)}: ${JSON.stringify(got)},`);
    expect(got).toEqual(BASELINE[id]);
  });
});

const LIVRE = FREE_PRESENTATION_PRESET_ID;
const livre = (slides = deck(), options = {}) => applyPresentationVisualPresetToSlides(slides, LIVRE, 'auto', undefined, options);
/** Fundo real atrás do texto: a cor gravada no slide, ou o véu escuro quando o texto fica sobre a foto. */
const fundoDoTexto = slide => (slide.presentationFreeDesign.ground === 'photo' ? '#111111' : slide.customBg);

describe('modo livre, fase 1: preset virtual', () => {
  it('presentation_free existe no catálogo, marcado como livre, fora do seletor', () => {
    const preset = resolvePresentationVisualPresetDefinition(LIVRE);
    expect(preset).toMatchObject({ id: 'presentation_free', isFree: true, productKind: 'apresentacao' });
    expect(PRESENTATION_VISUAL_PRESETS.map(p => p.id)).not.toContain(LIVRE);
  });

  it('a composição reconhece o preset e devolve o design da página', () => {
    const out = getPresentationCompositionOverrides(LIVRE, { slide: deck()[1], stage: {}, index: 1, count: 10 });
    expect(out.presentationPresetId).toBe(LIVRE);
    expect(FAMILY_KEYS).toContain(out.presentationFreeDesign.family);
    expect(out.presentationDesignFamily).toBe(out.presentationFreeDesign.family);
  });
});

describe('modo livre, fase 1: modelo e normalizador (sem IA)', () => {
  it('deckDesign: hex inválido, fonte fora da biblioteca e campos ausentes viram o valor permitido mais próximo', () => {
    const d = normalizeDeckDesign({
      palette: { bg: '#fff', ink: 'azul', accent: '#12AB3', muted: '#777777' },
      fonts: { display: 'Playfair Display', text: 'inter' },
      mood: '  luz de fim de tarde  ',
    });
    for (const key of ['bg', 'surface', 'ink', 'muted', 'accent', 'accent2', 'inverse', 'inverseInk']) expect(d.palette[key]).toMatch(/^#[0-9A-F]{6}$/);
    expect(d.palette.bg).toBe('#FFFFFF');
    expect(d.palette.accent).toBe(DEFAULT_DECK_DESIGN.palette.accent);
    const fontes = PRESENTATION_LIBRARY_FONTS.map(f => f.family);
    expect(fontes).toContain(d.fonts.display);
    expect(d.fonts.display).toBe('Fraunces');
    expect(d.fonts.text).toBe('Inter');
    expect(d.mood).toBe('luz de fim de tarde');
    // Texto lê no fundo, no fundo de superfície e no fundo invertido.
    expect(wcagContrast(d.palette.ink, d.palette.bg)).toBeGreaterThanOrEqual(4.5);
    expect(wcagContrast(d.palette.muted, d.palette.bg)).toBeGreaterThanOrEqual(4.5);
    expect(wcagContrast(d.palette.ink, d.palette.surface)).toBeGreaterThanOrEqual(4.5);
    expect(wcagContrast(d.palette.inverseInk, d.palette.inverse)).toBeGreaterThanOrEqual(4.5);
    expect(normalizeDeckDesign(null)).toEqual(DEFAULT_DECK_DESIGN);
  });

  it('design por slide: valor fora do enum é corrigido para o mais próximo permitido', () => {
    const slide = { title: 'Ritmo da festa', subtitle: 'A cidade inteira em 12 noites de encontro', presentationBlocks: [] };
    const d = normalizeSlideDesign({ family: 'premium', ground: 'dark', photo: 'large', block: 'table', emphasis: ['12 noites', 'não existe', 'cidade', 'Ritmo', 'extra'], icons: ['star'] }, slide);
    expect(d.family).toBe('luxury');
    expect(d.ground).toBe('inverse');
    expect(d.photo).toBe('half');
    // Tabela sem evidência no roteiro cai para nenhum bloco; ícones só valem com o bloco de ícones.
    expect(d.block).toBe('none');
    expect(d.icons).toEqual([]);
    expect(d.emphasis).toEqual(['12 noites', 'cidade', 'Ritmo']);
    expect(normalizeSlideDesign({ family: '???', ground: 7, photo: null, block: 'bignumber' }, { title: 'Sem número' }))
      .toMatchObject({ family: 'executive', ground: 'bg', photo: 'none', block: 'none' });
    expect(normalizeSlideDesign({ block: 'bignumber' }, { title: 'Público de 40 mil' }).block).toBe('bignumber');
    expect(normalizeSlideDesign({ block: 'icons', icons: ['star', 'foguete', 'users', 'heart', 'globe', 'zap'] }, {}).icons).toEqual(['star', 'users', 'heart', 'globe']);
    expect(normalizeSlideDesign({ block: 'metrics' }, deck()[8]).block).toBe('metrics');
    expect(FREE_GROUNDS).toEqual(['bg', 'surface', 'inverse', 'accent', 'photo']);
    expect(FREE_PHOTO_SIZES).toEqual(['none', 'small', 'half', 'full']);
    expect(FREE_BLOCKS).toEqual(['none', 'comparison', 'metrics', 'steps', 'quote', 'bignumber', 'icons']);
    expect(FREE_ICONS.length).toBeGreaterThan(10);
  });
});

describe('modo livre, fase 1: diretor de arte determinístico na Apoteose', () => {
  it('mesma entrada, mesma saída', () => {
    expect(hash(livre())).toBe(hash(livre()));
  });

  it('cumpre as regras de ritmo, fundos e fotos da spec', () => {
    const slides = livre();
    expect(freeDeckViolations(slides)).toEqual([]);
    const geo = slides.map(freeSlideGeometry);
    geo.forEach((g, i) => { if (i >= 2) expect(g === geo[i - 1] && g === geo[i - 2], `slide ${i + 1}`).toBe(false); });
    slides.forEach((s, i) => {
      if (!i) return;
      const a = slides[i - 1];
      expect(a.presentationFreeDesign.family === s.presentationFreeDesign.family && a.presentationComposition === s.presentationComposition, `slides ${i} e ${i + 1}`).toBe(false);
    });
    expect(new Set(slides.map(s => s.presentationFreeDesign.ground)).size).toBeGreaterThanOrEqual(3);
    expect(new Set(slides.map(s => s.presentationFreeDesign.photo)).size).toBeGreaterThanOrEqual(3);
  });

  it('capa e fecho com papel; bloco sem dado cai para nenhum', () => {
    const slides = livre();
    expect(slides[0].presentationComposition).toBe('cover');
    expect(slides[9].presentationComposition).toBe('closing');
    expect(slides[8].presentationComposition).toBe('data');
    expect(slides.map(s => s.presentationFreeDesign.block)).toEqual(['none', 'none', 'none', 'none', 'none', 'none', 'none', 'none', 'metrics', 'none']);
  });

  it('página com bloco nativo fica em fundo claro ou de superfície; chrome e números com as fontes do deck', () => {
    const slides = livre();
    expect(['bg', 'surface']).toContain(slides[8].presentationFreeDesign.ground);
    slides.forEach((s) => {
      expect(s.presentationChrome.fonts.display.family).toBe('Fraunces');
      expect(s.presentationChrome.fonts.text.family).toBe('Inter');
      expect(s.presentationNumericTypography.fontFamily).toMatch(/^"Fraunces"/);
    });
  });

  it('contraste de 4,5:1 entre texto e fundo em cada slide', () => {
    livre().forEach((s, i) => {
      const fundo = fundoDoTexto(s);
      for (const cor of [s.titleColor, s.subtitleColor, s.textColor]) {
        expect(wcagContrast(cor, fundo), `slide ${i + 1}: ${cor} sobre ${fundo}`).toBeGreaterThanOrEqual(4.5);
      }
    });
  });

  it('fundo, tinta e destaque vêm da paleta do deck, não do destaque da marca', () => {
    const slides = livre();
    const p = DEFAULT_DECK_DESIGN.palette;
    slides.forEach((s) => {
      expect(s.presentationPaletteOverrides).toMatchObject({ bg: p.bg, accent: p.accent, inverse: p.inverse });
      expect(slidePaletteOverrides(s, s.presentationDesignFamily, { accent: '#00FF00', bg: '#000000' }).accent).toBe(p.accent);
      const g = s.presentationFreeDesign.ground;
      if (g === 'bg') expect(s.customBg).toBe(p.bg);
      if (g === 'surface') expect(s.customBg).toBe(p.surface);
      if (g === 'inverse') expect(s.customBg).toBe(p.inverse);
      if (g === 'accent') expect(s.customBg).toBe(p.accent);
    });
  });

  it('as fontes do deck valem em todas as páginas', () => {
    livre().forEach((s) => {
      const t = s.presentationTypographyByComposition[s.presentationComposition];
      expect(t.title.fontFamily).toMatch(/^"Fraunces"/);
      expect(t.subtitle.fontFamily).toMatch(/^"Inter"/);
    });
  });

  it('foto sem tamanho não gera imagem; os outros slides com foto pedida geram', () => {
    const slides = livre(deck({ fotoPronta: false }));
    slides.forEach((s, i) => {
      const semFoto = s.presentationFreeDesign.photo === 'none';
      expect(slideSkipsImageGeneration(s), `slide ${i + 1}`).toBe(semFoto);
      expect(s.presentationSuppressPhoto, `slide ${i + 1}`).toBe(semFoto);
    });
    // Preset comum: nada muda.
    expect(applyPresentationVisualPresetToSlides(deck(), 'presentation_cinematic', 'auto').some(slideSkipsImageGeneration)).toBe(false);
  });

  it('kit com cores sobrepõe a paleta do deck', () => {
    const doc = applyPresentationVisualPresetToDoc({
      presentationPath: 'auto', brand: {}, slides: deck({ fotoPronta: false }),
      styleKit: { contextMd: 'Fundo: #0D1B2A\\nDestaque: #E0A458\\nTítulo: #F4F1DE' },
    }, LIVRE);
    expect(doc.visualPreset).toBe(LIVRE);
    expect(doc.presentationDeckDesign.palette).toMatchObject({ bg: '#0D1B2A', accent: '#E0A458', ink: '#F4F1DE' });
    expect(doc.brand).toMatchObject({ bg: '#0D1B2A', accent: '#E0A458' });
    doc.slides.forEach((s, i) => {
      expect(s.presentationPaletteOverrides.accent).toBe('#E0A458');
      if (s.presentationFreeDesign.ground === 'bg') expect(s.customBg).toBe('#0D1B2A');
      for (const cor of [s.titleColor, s.subtitleColor, s.textColor]) expect(wcagContrast(cor, fundoDoTexto(s)), `slide ${i + 1}`).toBeGreaterThanOrEqual(4.5);
    });
    expect(freeDeckViolations(doc.slides)).toEqual([]);
    expect(deckDesignFromBrand({ accent: '#E0A458', bg: '#0D1B2A' }).palette).toMatchObject({ accent: '#E0A458', bg: '#0D1B2A' });
  });

  it('a geração (slide a slide, com as composições anteriores) chega ao mesmo deck que aplicar o estilo', () => {
    const slides = deck();
    const previous = [];
    slides.forEach((slide, index) => {
      previous.push(getPresentationCompositionOverrides(LIVRE, { slide, stage: {}, index, count: slides.length, previous, deckDesign: DEFAULT_DECK_DESIGN }));
    });
    expect(previous.map(s => s.presentationFreeDesign)).toEqual(livre().map(s => s.presentationFreeDesign));
  });

  it('voltar para um preset comum recompõe como hoje', () => {
    const exec = applyPresentationVisualPresetToSlides(deck(), 'presentation_executive_minimal', 'auto');
    const idaEVolta = applyPresentationVisualPresetToSlides(livre(), 'presentation_executive_minimal', 'auto');
    expect(idaEVolta).toEqual(exec);
  });

  it('projeto salvo no modo livre não é recomposto ao abrir', () => {
    const salvo = livre();
    const doc = ensureDocShape(JSON.parse(JSON.stringify({ fmt: 'apresentacao', productKind: 'apresentacao', creativePreset: 'apresentacao', visualPreset: LIVRE, slides: salvo })));
    doc.slides.forEach((slide, i) => {
      const vista = slideForFormatDisplay(slide, 'apresentacao', doc.formatViews, doc.creativePreset);
      expect(vista.presentationFreeDesign).toEqual(salvo[i].presentationFreeDesign);
      expect(vista.canvas.zones).toEqual(salvo[i].canvas.zones);
      expect(vista.customBg).toBe(salvo[i].customBg);
      expect(vista.titleColor).toBe(salvo[i].titleColor);
    });
  });
});

describe('modo livre, fase 1: renderização por slide', () => {
  it('slide comum continua com o destaque da marca; o livre usa a paleta gravada', () => {
    const marca = { accent: '#B4235A', bg: '#101010' };
    expect(slidePaletteOverrides({}, 'executive', marca)).toEqual(brandPaletteOverrides('executive', marca));
    const s = livre()[1];
    expect(slidePaletteOverrides(s, 'executive', marca)).toBe(s.presentationPaletteOverrides);
  });

  it('chrome usa as fontes do deck quando a página as traz', () => {
    const s = livre().find(item => item.presentationFreeDesign.family !== 'editorial');
    const layout = { ...s.presentationChrome, chrome: [{ t: 'text', x: 5, y: 5, w: 20, text: '{index}', role: 'numeric', size: 40, color: 'accent' }] };
    const el = chromeElements(layout, { frame: { w: 1920, h: 1080 }, tokens: { index: '01' }, overrides: s.presentationPaletteOverrides }).find(item => item.text);
    expect(el.style.fontFamily).toMatch(/^"Fraunces"/);
    const comum = chromeElements({ ...layout, fonts: undefined }, { frame: { w: 1920, h: 1080 }, tokens: { index: '01' } }).find(item => item.text);
    expect(comum.style.fontFamily).not.toMatch(/^"Fraunces"/);
  });

  it('evidência segue a tinta da paleta do deck só no modo livre', () => {
    const p = livre()[8].presentationPaletteOverrides;
    expect(familyEvidenceStyle('editorial', p)).toMatchObject({ ink: p.ink, muted: p.muted, ruleColor: p.rule });
    expect(familyEvidenceStyle('editorial', { accent: '#B4235A', inverse: '#101010' })).toEqual(familyEvidenceStyle('editorial'));
  });
});
