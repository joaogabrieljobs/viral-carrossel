// Modo livre de apresentação, fase 2 (docs/product/modo-livre-apresentacao.md):
// a IA propõe o design da página no roteiro v3; o diretor determinístico da
// fase 1 corrige o que quebra as regras da spec e decide o que vier ausente.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FREE_PRESENTATION_VISUAL_PRESET, buildPresentationDesignSystemPromptBlock, getPresentationCompositionOverrides } from '../../src/styles/presentation-presets.jsx';
import { presentationPlanEntryImageQuery } from '../../src/utils/presentation-plan.js';
import { applyPresentationVisualPresetToSlides } from '../../src/utils/presentation-state.js';
import {
  DEFAULT_DECK_DESIGN, FREE_PRESENTATION_PRESET_ID, applyFreeEmphasis, applyPlanEmphasisToDraft,
  freeDeckViolations, freePhotoDirectionEnglish,
} from '../../src/utils/free-design.js';
import { familyDirectionEnglish } from '../../src/utils/visual-bible.js';
import { composeImageDirection } from '../../src/utils/image-direction.js';
import { buildImagePrompt, imageRouteCapabilities } from '../../shared/image-prompt.js';
import { markdownBoldAccentIntervalsUtf16 } from '../../src/utils/text-spans.js';
import { wcagContrast } from '../../src/utils/wcag.js';

const apoteose = JSON.parse(readFileSync(new URL('../fixtures/apoteose-estrutura.json', import.meta.url), 'utf8'));
const FOTO = 'data:image/png;base64,iVBORw0KGgo=';
const palavras = (n) => {
  const base = 'festa cidade ritmo encontro noite cultura';
  let out = '';
  while (out.length < n) out += (out ? ' ' : '') + base;
  return out.slice(0, n).trim();
};
const deck = (designOf = () => undefined) => apoteose.slides.map((s, i) => ({
  id: `apoteose-${i + 1}`,
  title: palavras(s.titulo),
  subtitle: palavras(s.apoio),
  bodyAfterImage: palavras(s.final),
  ...(s.foto ? { bgImage: FOTO, imageQuery: 'editorial photo' } : {}),
  presentationBlocks: s.bloco ? [{ type: 'metrics', items: [1, 2, 3].map(n => ({ label: `Rótulo ${n}`, value: `${n * 12}%`, detail: palavras(55) })) }] : [],
  presentationPlan: {
    schemaVersion: 3, promptVersion: 'presentation-plan-v3', visualRole: s.visualRole, purpose: s.purpose, question: 'Por quê?', keyMessage: 'Mensagem.',
    ...(designOf(i) !== undefined ? { design: designOf(i) } : {}),
  },
}));
const LIVRE = FREE_PRESENTATION_PRESET_ID;
const livre = slides => applyPresentationVisualPresetToSlides(slides, LIVRE, 'auto');
const campos = s => ({ family: s.presentationFreeDesign.family, ground: s.presentationFreeDesign.ground, photo: s.presentationFreeDesign.photo });

// Proposta de um diretor de arte para a Apoteose: variada e dentro do que as famílias desenham.
const PROPOSTA = [
  { family: 'cinematic', ground: 'photo', photo: 'full', block: 'none', emphasis: [] },
  { family: 'editorial', ground: 'bg', photo: 'half', block: 'none', emphasis: [] },
  { family: 'typographic', ground: 'bg', photo: 'small', block: 'none', emphasis: [] },
  { family: 'executive', ground: 'surface', photo: 'half', block: 'none', emphasis: [] },
  { family: 'modular', ground: 'bg', photo: 'half', block: 'none', emphasis: [] },
  { family: 'editorial', ground: 'inverse', photo: 'half', block: 'none', emphasis: [] },
  { family: 'photo', ground: 'bg', photo: 'half', block: 'none', emphasis: [] },
  { family: 'typographic', ground: 'inverse', photo: 'small', block: 'none', emphasis: [] },
  { family: 'swiss', ground: 'surface', photo: 'none', block: 'metrics', emphasis: [] },
  { family: 'executive', ground: 'inverse', photo: 'half', block: 'none', emphasis: [] },
];

describe('modo livre, fase 2: o diretor corrige a proposta da IA', () => {
  it('sem design no roteiro, o diretor determinístico decide como na fase 1', () => {
    const semDesign = livre(deck());
    const designNulo = livre(deck(() => null));
    expect(designNulo.map(s => s.presentationFreeDesign)).toEqual(semDesign.map(s => s.presentationFreeDesign));
  });

  it('proposta variada e possível: as páginas seguem a IA', () => {
    const slides = livre(deck(i => PROPOSTA[i]));
    const iguais = slides.filter((s, i) => {
      const c = campos(s);
      return c.family === PROPOSTA[i].family && c.ground === PROPOSTA[i].ground && c.photo === PROPOSTA[i].photo;
    }).length;
    // O código ainda garante o lado da foto (nunca 3 seguidas do mesmo lado)
    // e o teto de 6 famílias: 2 ou 3 páginas trocam de geometria por isso.
    expect(iguais).toBeGreaterThanOrEqual(7);
    expect(slides.filter((s, i) => s.presentationFreeDesign.family === PROPOSTA[i].family).length).toBeGreaterThanOrEqual(9);
    expect(freeDeckViolations(slides)).toEqual([]);
  });

  it('proposta monótona (tudo igual): o código garante ritmo, 3 fundos, 3 tamanhos de foto e contraste', () => {
    const slides = livre(deck(() => ({ family: 'executive', ground: 'bg', photo: 'half', block: 'none', emphasis: [] })));
    expect(freeDeckViolations(slides)).toEqual([]);
    expect(new Set(slides.map(s => s.presentationFreeDesign.ground)).size).toBeGreaterThanOrEqual(3);
    expect(new Set(slides.map(s => s.presentationFreeDesign.photo)).size).toBeGreaterThanOrEqual(3);
    slides.forEach((s, i) => {
      if (i) expect(s.presentationFreeDesign.family === slides[i - 1].presentationFreeDesign.family && s.presentationComposition === slides[i - 1].presentationComposition).toBe(false);
    });
  });

  it('foto lateral troca de lado quando a família proposta desenha os dois lados (nunca 3 seguidas do mesmo lado)', () => {
    // Famílias com foto à direita no conteúdo e à esquerda na demonstração; a IA pede tudo "half" em fundo claro.
    const familias = ['editorial', 'cultural', 'technical', 'photo', 'modular'];
    const lados = livre(deck(i => (i === 0 || i === 8 || i === 9 ? PROPOSTA[i] : { family: familias[i % familias.length], ground: 'bg', photo: 'half', block: 'none', emphasis: [] }))).filter(s => !s.presentationSuppressPhoto && ['small', 'half'].includes(s.presentationFreeDesign.photo))
      .map(s => (s.canvas.zones.photo.x + s.canvas.zones.photo.w / 2 < 50 ? 'E' : 'D'));
    expect(lados).toContain('E');
    lados.forEach((l, i) => { if (i >= 2) expect(lados.slice(i - 2, i + 1).every(x => x === l), lados.join('')).toBe(false); });
  });

  it('proposta que a família não desenha cai para uma geometria que as famílias já desenham, sem perder a foto', () => {
    // Foto cheia no Tipográfico não existe; fundo de destaque só em capa, divisor e fecho.
    const slides = livre(deck(i => (i === 3 ? { family: 'typographic', ground: 'accent', photo: 'full', block: 'none', emphasis: [] } : PROPOSTA[i])));
    const s = slides[3];
    expect(['content', 'demo', 'divider']).toContain(s.presentationComposition);
    if (s.presentationFreeDesign.ground === 'accent') expect(s.presentationComposition).toBe('divider');
    expect(s.presentationSuppressPhoto).toBe(false);
    expect(s.presentationFreeDesign.photo).not.toBe('none');
    expect(freeDeckViolations(slides)).toEqual([]);
  });

  it('a geração (slide a slide) chega ao mesmo deck que aplicar o estilo, também com a proposta', () => {
    const source = deck(i => PROPOSTA[i]);
    const previous = [];
    source.forEach((slide, index) => {
      previous.push(getPresentationCompositionOverrides(LIVRE, { slide, stage: {}, index, count: source.length, previous, deckDesign: DEFAULT_DECK_DESIGN }));
    });
    expect(previous.map(s => s.presentationFreeDesign)).toEqual(livre(source).map(s => s.presentationFreeDesign));
  });

  it('bloco proposto fica só quando o texto sustenta; bloco nativo manda', () => {
    const slides = deck(i => (i === 2 ? { ...PROPOSTA[i], block: 'bignumber' } : i === 3 ? { ...PROPOSTA[i], block: 'quote' } : i === 8 ? { ...PROPOSTA[i], block: 'steps' } : PROPOSTA[i]));
    slides[2] = { ...slides[2], title: 'A cidade recebe 40 mil pessoas' };
    const out = livre(slides);
    expect(out[2].presentationFreeDesign.block).toBe('bignumber');
    expect(out[3].presentationFreeDesign.block).toBe('none');
    expect(out[8].presentationFreeDesign.block).toBe('metrics');
  });
});

describe('modo livre, fase 2: negrito (emphasis)', () => {
  it('aplica **…** no trecho, sem diferença de caixa e sem duplicar', () => {
    expect(applyFreeEmphasis('A cidade recebe 40 mil pessoas', ['40 MIL'])).toBe('A cidade recebe **40 mil** pessoas');
    expect(applyFreeEmphasis('A cidade recebe **40 mil** pessoas', ['40 mil'])).toBe('A cidade recebe **40 mil** pessoas');
    expect(applyFreeEmphasis('Um **ritmo novo** na noite', ['ritmo'])).toBe('Um **ritmo novo** na noite');
    expect(applyFreeEmphasis('Sem o trecho', ['ausente'])).toBe('Sem o trecho');
    const out = applyFreeEmphasis('festa, cidade e festa', ['festa']);
    expect(out).toBe('**festa**, cidade e festa');
    expect(markdownBoldAccentIntervalsUtf16(out)).toEqual([[2, 7]]);
  });

  it('cada trecho do roteiro sai uma vez no slide; o design gravado guarda o trecho', () => {
    const draft = { slides: deck(i => (i === 1 ? { ...PROPOSTA[1], emphasis: ['Ritmo encontro', 'noite cultura', 'nada disso'] } : PROPOSTA[i])) };
    draft.slides[1] = { ...draft.slides[1], title: 'Festa cidade ritmo encontro', subtitle: 'Noite cultura e festa cidade' };
    const out = applyPlanEmphasisToDraft(draft);
    expect(out.slides[1].title).toBe('Festa cidade **ritmo encontro**');
    expect(out.slides[1].subtitle).toBe('**Noite cultura** e festa cidade');
    expect(out.slides[0]).toBe(draft.slides[0]);
    const composed = livre(out.slides);
    expect(composed[1].presentationFreeDesign.emphasis).toEqual(['ritmo encontro', 'Noite cultura']);
    // Aplicar de novo não duplica.
    expect(applyPlanEmphasisToDraft(out).slides[1].title).toBe('Festa cidade **ritmo encontro**');
  });
});

describe('modo livre, fase 2: limites de texto seguem o design do roteiro', () => {
  it('a caixa pedida à IA é a da composição final (família, foto e bloco do design)', () => {
    const pagina = family => ({
      title: '', subtitle: '', bodyAfterImage: '', imageQuery: 'crowd, wide',
      presentationPlan: { schemaVersion: 3, visualRole: 'content', purpose: 'context', design: { family, ground: 'bg', photo: 'half', block: 'none', emphasis: [], icons: [] } },
    });
    const limites = family => getPresentationCompositionOverrides(LIVRE, { slide: pagina(family), stage: {}, index: 2, count: 10, previous: [] });
    expect(limites('executive').presentationFreeDesign.family).toBe('executive');
    expect(limites('luxury').presentationFreeDesign.family).toBe('luxury');
    expect(limites('executive').presentationTextLimits.subtitle.maxChars).toBeGreaterThan(limites('luxury').presentationTextLimits.subtitle.maxChars);
  });

  it('posição v3 com photo none não pede imagem já no cálculo dos limites', () => {
    expect(presentationPlanEntryImageQuery({ scene: { subject: 'crowd', action: '', setting: '', shot: 'wide' }, design: { photo: 'none' } })).toBe('');
    expect(presentationPlanEntryImageQuery({ scene: { subject: 'crowd', action: '', setting: '', shot: 'wide' }, design: { photo: 'half' } })).toBe('crowd, wide');
  });

  it('ViralCarrossel: os limites do roteiro passam o deck do modo livre', () => {
    const source = readFileSync(new URL('../../ViralCarrossel.jsx', import.meta.url), 'utf8');
    const at = source.indexOf('presentationLimitsForPlan: (plan, draftedSlides = []) => {');
    expect(at).toBeGreaterThan(-1);
    expect(source.slice(at, at + 1400)).toMatch(/deckDesign: freeDeckDesignFor\(plan\)/);
    expect(source).toMatch(/freeDesign: !!effectiveVisualPresetDef\?\.isFree/);
    expect(source).toMatch(/const freeDeckDesign = effectiveVisualPresetDef\?\.isFree\s*\?\s*freeDeckDesignFor\(generationPlan\)/);
    expect(source).toMatch(/applyPlanEmphasisToDraft\(/);
  });
});

describe('modo livre, fase 2: redação recebe o padrão visual do modo livre', () => {
  it('o bloco de padrão visual da redação existe para o preset livre', () => {
    const block = buildPresentationDesignSystemPromptBlock(FREE_PRESENTATION_VISUAL_PRESET, 'auto', { planned: true });
    expect(block).toMatch(/LIVRE: O MOONT DECIDE/);
  });
});

describe('modo livre, fase 2: direção de foto do deck (mood e paleta)', () => {
  const slide = livre(deck(i => PROPOSTA[i]))[1];

  it('no modo livre a foto segue o clima e a paleta do deck, não a luz de uma família', () => {
    const dir = freePhotoDirectionEnglish(slide.presentationDeckDesign);
    expect(dir).toContain(DEFAULT_DECK_DESIGN.mood);
    expect(dir).toContain(DEFAULT_DECK_DESIGN.palette.accent);
    expect(familyDirectionEnglish({ slide, fmt: 'apresentacao', presentationFamily: LIVRE })).toBe(dir);
    expect(familyDirectionEnglish({ slide, fmt: 'apresentacao' })).toBe(dir);
    // Preset comum: luz da família, como antes.
    expect(familyDirectionEnglish({ slide: {}, fmt: 'apresentacao', presentationFamily: 'presentation_cinematic' })).toMatch(/cinematic depth/);
  });

  it('o pedido de imagem continua dentro do orçamento', () => {
    const longo = { ...slide.presentationDeckDesign, mood: 'x'.repeat(240) };
    expect(freePhotoDirectionEnglish(longo).length).toBeLessThanOrEqual(420);
    const direction = composeImageDirection({ slide: { ...slide, presentationDeckDesign: longo }, fmt: 'apresentacao', presentationFamily: LIVRE });
    for (const route of ['openai', 'sjinn']) {
      const built = buildImagePrompt({ ...direction, scene: 'crowd dancing in the street, wide' }, { route });
      expect(built.chars).toBeLessThanOrEqual(imageRouteCapabilities(route).promptLimit);
      expect(built.dropped).not.toContain('treatment');
      expect(built.prompt).toContain('VISUAL TREATMENT');
    }
  });
});

describe('modo livre, fase 2: página photo:none não gera imagem (mantido)', () => {
  it('design none com cena: nenhuma imagem; contraste ok', () => {
    const slides = livre(deck(i => (i === 4 ? { ...PROPOSTA[4], photo: 'none' } : PROPOSTA[i])).map((s, i) => (i === 4 ? { ...s, bgImage: undefined, imageQuery: '' } : s)));
    expect(slides[4].presentationFreeDesign.photo).toBe('none');
    expect(slides[4].presentationSuppressPhoto).toBe(true);
    expect(wcagContrast(slides[4].titleColor, slides[4].presentationFreeTextSurfaces.title)).toBeGreaterThanOrEqual(4.5);
  });
});
