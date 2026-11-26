// Direção de arte das imagens (docs/product/direcao-de-arte-imagens.md), parte 4:
// arte de fundo reaproveitada no modo livre. Uma imagem abstrata da identidade,
// sem pessoas, gerada uma vez por deck (1 crédito) e usada como fundo de até 3
// páginas sem foto (`ground: 'art'`), com o texto no lado liso e 4,5:1 garantido.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  FREE_ART_GRAPHIC_FROM, FREE_ART_MAX_SLIDES, FREE_ART_TEXT_MAX, FREE_GROUNDS, freeDeckViolations, mixHex,
  normalizeProposedDesign, normalizeSlideDesign, slideSkipsImageGeneration,
} from '../../src/utils/free-design.js';
import { applyPresentationVisualPresetToDoc } from '../../src/utils/presentation-state.js';
import {
  DECK_ART_SCENE, applyDeckArt, composeDeckArtImageDirection, deckArtLayer, deckArtSlides, deckImageCredits,
  deckNeedsArt, slideShowsDeckArt,
} from '../../src/utils/deck-art.js';
import { buildImagePrompt } from '../../shared/image-prompt.js';
import { buildPresentationPlanPrompt } from '../../src/utils/presentation-plan.js';
import { pdfPageImageFormat } from '../../src/hooks/useExport.js';
import { idsDeImagemEmUso, semImagensDeRuntime } from '../../src/utils/image-store.js';
import { wcagContrast } from '../../src/utils/wcag.js';
import { auditPresentationLayout } from '../../src/utils/presentation-quality.js';

const ARTE = JSON.parse(readFileSync(new URL('../fixtures/apoteose-direcao-arte.json', import.meta.url), 'utf8'));
const DECK = {
  palette: { bg: '#171344', surface: '#231D5A', ink: '#F7F3EE', muted: '#CFC9EC', accent: '#FF6A1A', accent2: '#27DDE5', inverse: '#F7F3EE', inverseInk: '#171344' },
  fonts: { display: 'Inter Tight', text: 'Inter' }, mood: 'Night party, orange light on faces, magenta shadows, analogue grain.',
};
const PAGINAS = [
  ['cover', 'introduction', true], ['content', 'context', true], ['content', 'vision', true], ['content', 'other', false],
  ['content', 'vision', false], ['content', 'context', true], ['content', 'solution', true], ['content', 'other', false],
  ['content', 'summary', false], ['closing', 'decision', false],
];
const slide = ([visualRole, purpose, foto], i, design = null) => ({
  id: `s${i + 1}`, title: `Título ${i + 1}`, subtitle: 'Uma frase de apoio curta, com uma informação concreta do material.', bodyAfterImage: '',
  ...(foto ? { imageQuery: 'photo', bgImage: 'data:image/png;base64,AAAA' } : {}),
  presentationPlan: { schemaVersion: 3, promptVersion: 'presentation-plan-v3', visualRole, purpose, question: 'Por quê?', keyMessage: 'Mensagem.',
    visualDirection: ARTE.visualDirection, ...(foto ? { scene: ARTE.scenes[i] } : { scene: null }), ...(design ? { design } : {}) },
});
const livre = (slides, styleKit = undefined) => applyPresentationVisualPresetToDoc(
  { presentationPath: 'auto', brand: { showHandle: false }, presentationDeckDesign: DECK, slides, ...(styleKit ? { styleKit } : {}) },
  'presentation_free', undefined, { initialize: true },
);
const proposta = ground => ({ family: 'executive', ground, photo: 'none', block: 'none', emphasis: [], icons: [] });
const TEXT = ['title', 'subtitle', 'evidence'];

describe('contrato: ground art', () => {
  it('enum fechado do v3 e normalizadores aceitam art (e os apelidos)', () => {
    expect(FREE_GROUNDS).toEqual(['bg', 'surface', 'inverse', 'accent', 'photo', 'art']);
    expect(normalizeProposedDesign({ ground: 'art' }).ground).toBe('art');
    expect(normalizeProposedDesign({ ground: 'arte' }).ground).toBe('art');
    expect(normalizeSlideDesign({ ground: 'artwork' }).ground).toBe('art');
    expect(normalizeSlideDesign({ ground: 'qualquer' }).ground).toBe('bg');
    expect(FREE_ART_MAX_SLIDES).toBe(3);
    expect(FREE_ART_TEXT_MAX).toBeLessThan(FREE_ART_GRAPHIC_FROM);
  });

  it('o roteiro v3 oferece art ao diretor de arte da IA; o v2 dos presets comuns não', () => {
    const v3 = buildPresentationPlanPrompt({ brief: 'Festa', count: 10, freeDesign: true });
    expect(v3).toMatch(/ground: bg, surface, inverse, accent, photo, art\./);
    expect(v3).toMatch(/ground art: o fundo abstrato da identidade do deck .* até 3 páginas sem foto/);
    expect(v3).toMatch(/ground accent sem foto: texto em cor cheia com título grande/);
    expect(buildPresentationPlanPrompt({ brief: 'Festa', count: 10 })).not.toMatch(/ground art/);
  });
});

describe('diretor de arte: fundo de arte nas páginas sem foto', () => {
  const doc = livre(PAGINAS.map((p, i) => slide(p, i)));
  const arte = doc.slides.filter(s => s.presentationFreeDesign.ground === 'art');

  it('sem proposta, escolhe art em até 3 páginas sem foto (posicionamento, síntese e fecho)', () => {
    expect(arte.length).toBeGreaterThanOrEqual(1);
    expect(arte.length).toBeLessThanOrEqual(FREE_ART_MAX_SLIDES);
    for (const s of arte) {
      expect(s.presentationFreeDesign.photo).toBe('none');
      expect(s.bgImage).toBeFalsy();
      expect(['vision', 'summary', 'decision', 'other']).toContain(s.presentationPlan.purpose);
      expect(slideSkipsImageGeneration(s)).toBe(true);
    }
    // Página com foto nunca vira fundo de arte.
    for (const s of doc.slides.filter(item => item.bgImage)) expect(s.presentationFreeDesign.ground).not.toBe('art');
    expect(freeDeckViolations(doc.slides)).toEqual([]);
  });

  it('o texto fica no lado liso: nenhuma zona de texto passa de 72% da largura', () => {
    for (const s of arte) {
      for (const key of TEXT) {
        const z = s.canvas.zones[key];
        if (z && z.w > 1) expect(z.x + z.w).toBeLessThanOrEqual(FREE_ART_TEXT_MAX + 0.01);
      }
    }
  });

  it('contraste ≥ 4,5:1 garantido pelo código sobre o pior pixel do lado liso', () => {
    for (const s of arte) {
      const scrim = s.presentationArtScrim;
      expect(scrim).toMatchObject({ side: 'left', color: DECK.palette.bg });
      expect(scrim.reach).toBeGreaterThanOrEqual(FREE_ART_TEXT_MAX);
      for (const worst of ['#FFFFFF', '#000000']) {
        const surface = mixHex(scrim.color, worst, scrim.opacity / 100);
        for (const key of ['titleColor', 'subtitleColor', 'textColor']) expect(wcagContrast(s[key], surface)).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('proposta art da IA vale; mais de 3 propostas ficam em 3', () => {
    const propostos = livre(PAGINAS.map((p, i) => slide(p, i, p[2] ? null : proposta('art'))));
    const art = propostos.slides.filter(s => s.presentationFreeDesign.ground === 'art');
    expect(art).toHaveLength(FREE_ART_MAX_SLIDES);
    expect(freeDeckViolations(propostos.slides).map(v => v.code)).not.toContain('free_art_limit');
  });

  it('fios e blocos da família param no lado liso (nada cruza o grafismo)', () => {
    for (const s of arte) {
      for (const d of s.presentationChrome.chrome.filter(item => ['rule', 'block'].includes(item.t))) expect(d.x + d.w).toBeLessThanOrEqual(FREE_ART_TEXT_MAX + 0.01);
    }
  });

  it('personalidade em duas colunas sobre a arte: a tabela mantém 50% da largura; com apoio escrito, sem arte', () => {
    const tabela = { type: 'comparison', headers: ['Traço', 'Sem ser'], rows: [['Brasileira', 'sem ser caricata.'], ['Sensual', 'sem ser vulgar.']] };
    const pagina = (subtitle) => ({ ...slide(['data', 'other', false], 7, { family: 'editorial', ground: 'art', photo: 'none', block: 'comparison', emphasis: [], icons: [] }), subtitle, presentationBlocks: [tabela] });
    const sem = livre(PAGINAS.map((p, i) => (i === 7 ? pagina('') : slide(p, i)))).slides[7];
    expect(sem.presentationFreeDesign).toMatchObject({ ground: 'art', block: 'comparison' });
    expect(sem.canvas.zones.evidence.w).toBeGreaterThanOrEqual(50);
    expect(sem.canvas.zones.evidence.x + sem.canvas.zones.evidence.w).toBeLessThanOrEqual(FREE_ART_TEXT_MAX + 0.01);
    expect(auditPresentationLayout(sem, { index: 7 }).issues).toEqual([]);
    const com = livre(PAGINAS.map((p, i) => (i === 7 ? pagina('Um apoio escrito.') : slide(p, i)))).slides[7];
    expect(com.presentationFreeDesign.ground).not.toBe('art');
  });

  it('o validador acusa mais de 3 fundos de arte', () => {
    const art = doc.slides.find(s => s.presentationFreeDesign.ground === 'art');
    const forced = doc.slides.map((s, i) => (i < 4 ? { ...art, id: `x${i}` } : s));
    expect(freeDeckViolations(forced).map(v => v.code)).toContain('free_art_limit');
  });

  it('projeto antigo (sem art) compõe igual e não pede arte', () => {
    const antigo = livre(PAGINAS.map((p, i) => slide([p[0], 'context', true], i)));
    expect(antigo.slides.some(s => s.presentationFreeDesign.ground === 'art')).toBe(false);
    expect(deckNeedsArt(antigo.slides)).toBe(false);
  });
});

describe('a imagem de arte: um pedido, um crédito, guardada para o deck', () => {
  const doc = livre(PAGINAS.map((p, i) => slide(p, i)));

  it('conta 1 crédito para o deck inteiro, além das fotos', () => {
    const credits = deckImageCredits(doc.slides);
    const fotos = doc.slides.filter(s => s.presentationFreeDesign.photo !== 'none').length;
    expect(credits).toEqual({ photos: fotos, art: 1, total: fotos + 1 });
    // Nunca passa do número de slides (o aviso "até N créditos" continua certo).
    expect(credits.total).toBeLessThanOrEqual(doc.slides.length);
    // Com a arte já guardada, nenhum crédito a mais.
    const comArte = applyDeckArt(doc.slides, { presentationArtImageId: 'img_arte', presentationArtImage: 'blob:arte' });
    expect(deckNeedsArt(comArte)).toBe(false);
    expect(deckImageCredits(comArte).art).toBe(0);
  });

  it('a arte vai para todas as páginas art e só para elas (uma imagem, mesmo id)', () => {
    const comArte = applyDeckArt(doc.slides, { presentationArtImageId: 'img_arte', presentationArtImage: 'blob:arte' });
    const art = deckArtSlides(comArte);
    expect(art.length).toBeGreaterThan(0);
    for (const s of comArte) {
      if (s.presentationFreeDesign.ground === 'art') expect(s).toMatchObject({ presentationArtImageId: 'img_arte', presentationArtImage: 'blob:arte' });
      else expect(s.presentationArtImageId).toBeUndefined();
    }
    expect(new Set(art.map(s => s.presentationArtImageId)).size).toBe(1);
  });

  it('sem imagem (sem crédito, chave indisponível, falha ou projeto antigo): cai para a cor base', () => {
    const art = doc.slides.find(s => s.presentationFreeDesign.ground === 'art');
    expect(deckArtLayer(art)).toBeNull();
    expect(slideShowsDeckArt(art)).toBe(false);
    expect(art.customBg).toBe(DECK.palette.bg);
    expect(pdfPageImageFormat(art).format).toBe('PNG');
    const comArte = applyDeckArt([art], { presentationArtImageId: 'img_arte', presentationArtImage: 'blob:arte' })[0];
    const layer = deckArtLayer(comArte);
    expect(layer.image).toBe('blob:arte');
    expect(layer.gradient).toContain('linear-gradient(to right');
    // PDF: página com essa arte é "com foto" (JPEG).
    expect(pdfPageImageFormat(comArte).format).toBe('JPEG');
    // Arte só aparece em página art.
    expect(deckArtLayer({ ...comArte, presentationFreeDesign: { ...comArte.presentationFreeDesign, ground: 'bg' } })).toBeNull();
  });

  it('o pedido de imagem: direção visual, sem pessoas, grafismo num lado e COMPOSITION reservando o lado do texto', () => {
    const direction = composeDeckArtImageDirection({ slides: doc.slides, styleKit: null, baseReferenceCount: 0 });
    const { prompt, dropped } = buildImagePrompt({ scene: DECK_ART_SCENE, framing: '', ...direction }, { route: 'sjinn' });
    expect(dropped).toEqual([]);
    expect(prompt.length).toBeLessThanOrEqual(4000);
    expect(prompt).toContain('VISUAL DIRECTION');
    expect(prompt).toContain('base colour, the dominant field #171344');
    expect(prompt).toMatch(/Finish: Realistic editorial photography/);
    expect(prompt).toMatch(/No people, faces, hands or bodies/);
    expect(prompt).toContain(`from about ${FREE_ART_GRAPHIC_FROM}% of the frame width`);
    expect(prompt).toMatch(/COMPOSITION \(space for the slide text\): Type is laid over the left \d+% of the frame/);
    expect(prompt).toContain('#27DDE5');
    expect(prompt).toContain(ARTE.visualDirection.finish);
    expect(prompt).not.toContain('OTHER SLIDES');
    // A ordem do método: direção visual → assunto → composição → … → restrições.
    expect(prompt.indexOf('VISUAL DIRECTION')).toBeLessThan(prompt.indexOf('SUBJECT AND CASTING'));
    expect(prompt.indexOf('SUBJECT AND CASTING')).toBeLessThan(prompt.indexOf('COMPOSITION'));
  });

  it('com a referência do kit, o pedido usa só o visual dela', () => {
    const direction = composeDeckArtImageDirection({ slides: doc.slides, styleKit: { refImages: [{ id: 'r1', dataUrl: 'data:image/png;base64,AAAA' }] }, baseReferenceCount: 1 });
    expect(direction).toMatchObject({ format: 'presentation', referenceCount: 1, styleMoodboard: true, styleReferenceLook: true, presentationPanel: false });
    const { prompt } = buildImagePrompt({ scene: DECK_ART_SCENE, framing: '', ...direction }, { route: 'sjinn' });
    expect(prompt).toContain('Use moodboard images only for the look');
    expect(prompt).toContain('never for people, objects, framing or composition');
    expect(prompt).toContain('1: moodboard');
  });
});

describe('guardada como imagem do projeto (IndexedDB e limpeza)', () => {
  it('o id da arte está em uso; a URL de runtime não vai para o armazenamento local', () => {
    const library = [{ id: 'p', doc: { slides: [{ id: 'a', presentationArtImageId: 'img_arte', presentationArtImage: 'blob:x' }] } }];
    expect(idsDeImagemEmUso(library)).toContain('img_arte');
    const saved = semImagensDeRuntime(library)[0].doc.slides[0];
    expect(saved.presentationArtImageId).toBe('img_arte');
    expect(saved).not.toHaveProperty('presentationArtImage');
  });
});
