// Direção de arte das imagens (docs/product/direcao-de-arte-imagens.md), parte 5:
// texto editorial. Título curto e de autor, rótulo opcional acima do título
// (`eyebrow`, 1–3 palavras em caixa alta) desenhado pelas famílias que já têm
// rótulo de cabeçalho e pelo modo livre, slide de texto em cor cheia no ritmo do
// diretor e o par "traço / sem ser…" em duas colunas no bloco comparison.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PRESENTATION_EYEBROW_MAX_WORDS, normalizePresentationEyebrow } from '../../src/utils/presentation-eyebrow.js';
import { buildPresentationFieldRules } from '../../src/utils/presentation.js';
import {
  applyEditorialReview, buildEditorialReviewPrompt, moveGapNotesOutOfSlides, repeatedTitleIndexes,
  supportEchoesTitleIndexes, validateCarouselDraft,
} from '../../src/utils/editorial-review.js';
import { chromeElements, chromeTokensForSlide } from '../../src/utils/presentation-chrome.js';
import { FAMILY_KEYS, familyLayout } from '../../src/utils/presentation-families.js';
import { applyPresentationVisualPresetToDoc } from '../../src/utils/presentation-state.js';
import { comparisonVariant, normalizePresentationBlocks } from '../../src/utils/presentation-quality.js';
import { wcagContrast } from '../../src/utils/wcag.js';

const ARTE = JSON.parse(readFileSync(new URL('../fixtures/apoteose-direcao-arte.json', import.meta.url), 'utf8'));
const FRAME = { w: 1920, h: 1080 };

describe('redação: título de autor e rótulo acima do título', () => {
  it('as regras de campo pedem título curto (≤ 6 palavras), sem repetir o apoio, e o eyebrow de 1–3 palavras', () => {
    for (const path of ['auto', 'pitch', 'aula_workshop', 'proposta_comercial', 'relatorio_executivo', 'keynote_manifesto']) {
      const rules = buildPresentationFieldRules(path);
      expect(rules).toMatch(/até 6 palavras quando possível/);
      expect(rules).toMatch(/não repete o subtitle/);
      expect(rules).toMatch(/eyebrow/);
      expect(rules).toMatch(/1 a 3 palavras/);
      expect(rules).toMatch(/CAIXA ALTA/);
    }
  });

  it('normaliza o eyebrow: caixa alta, até 3 palavras e 32 caracteres; o resto sai', () => {
    expect(PRESENTATION_EYEBROW_MAX_WORDS).toBe(3);
    expect(normalizePresentationEyebrow('a festa')).toBe('A FESTA');
    expect(normalizePresentationEyebrow('  **O   posicionamento** ')).toBe('O POSICIONAMENTO');
    expect(normalizePresentationEyebrow('— A música:')).toBe('A MÚSICA');
    expect(normalizePresentationEyebrow('um rótulo longo demais aqui')).toBe('');
    expect(normalizePresentationEyebrow('Supercalifragilisticexpialidocious-extra')).toBe('');
    expect(normalizePresentationEyebrow(42)).toBe('');
    expect(normalizePresentationEyebrow(null)).toBe('');
  });

  const plan = { slides: [{ index: 1, visualRole: 'cover', purpose: 'introduction', question: 'Q', keyMessage: 'K' }, { index: 2, visualRole: 'content', purpose: 'context', question: 'Q2', keyMessage: 'K2' }] };
  const draft = () => ({
    presentationPlan: plan,
    slides: [
      { title: 'Apoteose', subtitle: 'Pré-Carnaval em São Paulo.', bodyAfterImage: '', imageQuery: '', eyebrow: 'pré-carnaval', presentationBlocks: [], speakerNotes: '' },
      { title: 'Brasil na pista', subtitle: 'A música brasileira conduz a noite.', bodyAfterImage: '', imageQuery: '', eyebrow: 'a música brasileira da noite', presentationBlocks: [], speakerNotes: '' },
    ],
    caption: '',
  });

  it('o rascunho guarda o eyebrow normalizado no slide (apresentação) e o carrossel não o recebe', () => {
    const out = validateCarouselDraft(draft(), { count: 2, presetId: 'apresentacao', presentationPath: 'auto' });
    expect(out.slides[0].eyebrow).toBe('PRÉ-CARNAVAL');
    expect(out.slides[1].eyebrow).toBe('');
    const social = validateCarouselDraft({ slides: [{ title: 'A', subtitle: 'B', imageQuery: '', eyebrow: 'x' }], caption: '' }, { count: 1, presetId: 'livre' });
    expect(social.slides[0]).not.toHaveProperty('eyebrow');
  });

  it('entra na revisão (idioma e metacomentário) como campo editável, sem contar como repetição do título', () => {
    const d = validateCarouselDraft(draft(), { count: 2, presetId: 'apresentacao', presentationPath: 'auto' });
    const prompt = buildEditorialReviewPrompt('Briefing.', d, { presetId: 'apresentacao', presentationPlan: plan, count: 2 });
    expect(prompt).toContain('"eyebrow":"PRÉ-CARNAVAL"');
    expect(prompt).toMatch(/title, eyebrow, subtitle, bodyAfterImage, speakerNotes ou presentationBlocks/);
    const reviewed = applyEditorialReview(d, { edits: [{ slideIndex: 1, reason: 'rótulo em inglês', eyebrow: 'a pista' }] }, { presetId: 'apresentacao', presentationPlan: plan, count: 2, presentationPath: 'auto' }, { deferQualityChecks: true });
    expect(reviewed.slides[1].eyebrow).toBe('A PISTA');
    // Metacomentário no rótulo sai como no título e no apoio.
    const moved = moveGapNotesOutOfSlides({ slides: [{ title: 'Investimento', subtitle: 'Texto.', eyebrow: 'Investimento não informado' }] });
    expect(moved.draft.slides[0].eyebrow).toBe('');
    expect(moved.emptiedTitles).toEqual([]);
    // O mesmo rótulo em dois slides e o rótulo igual ao título não são repetição.
    const slides = [{ title: 'A festa começa cedo', subtitle: 'Um encontro para convidados.', eyebrow: 'A FESTA' }, { title: 'O público certo', subtitle: 'Gente que chega junto.', eyebrow: 'A FESTA' }, { title: 'A festa', subtitle: 'Outro apoio.', eyebrow: 'A FESTA COMEÇA CEDO' }];
    expect(repeatedTitleIndexes(slides)).toEqual([]);
    expect(supportEchoesTitleIndexes(slides)).toEqual([]);
  });
});

describe('render do eyebrow', () => {
  it('o token do rótulo vem do slide', () => {
    expect(chromeTokensForSlide({ eyebrow: 'A FESTA' }).kicker).toBe('A FESTA');
    expect(chromeTokensForSlide({}).kicker).toBe('');
  });

  it('famílias com rótulo de cabeçalho desenham o eyebrow em caixa alta, no piso de leitura (≥ 24 px)', () => {
    const layout = familyLayout('editorial', 'cover', { photo: true });
    const withEyebrow = chromeElements(layout, { frame: FRAME, tokens: chromeTokensForSlide({ eyebrow: 'O posicionamento' }) });
    const label = withEyebrow.find(item => item.text === 'O posicionamento');
    expect(label.style.textTransform).toBe('uppercase');
    expect(label.style.fontSize).toBeGreaterThanOrEqual(24);
    // Sem eyebrow, o rótulo não aparece (nada é inventado).
    const without = chromeElements(layout, { frame: FRAME, tokens: chromeTokensForSlide({}) });
    expect(without.some(item => item.text === 'O posicionamento')).toBe(false);
  });

  it('mapa de onde o eyebrow aparece em cada família (16:9): só onde já existe rótulo; nenhum layout novo', () => {
    const kinds = ['cover', 'content', 'divider', 'demo', 'data', 'closing'];
    const coverage = Object.fromEntries(FAMILY_KEYS.map(family => [family, kinds.filter(kind => [false, true].some(photo =>
      (familyLayout(family, kind, { photo }).chrome || []).some(d => String(d.text || '').includes('{kicker'))))]));
    expect(coverage.editorial.length).toBeGreaterThan(0);
    expect(coverage.technical.length).toBeGreaterThan(0);
    expect(coverage.modular.length).toBeGreaterThan(0);
    for (const family of ['executive', 'swiss', 'cinematic', 'typographic', 'cultural', 'photo']) expect(coverage[family]).toEqual([]);
  });

  it('modo livre: toda página tem lugar para o eyebrow acima do título, com 4,5:1 sobre o que fica atrás', () => {
    const DECK = {
      palette: { bg: '#171344', surface: '#231D5A', ink: '#F7F3EE', muted: '#CFC9EC', accent: '#FF6A1A', accent2: '#27DDE5', inverse: '#F7F3EE', inverseInk: '#171344' },
      fonts: { display: 'Inter Tight', text: 'Inter' }, mood: 'Night party.',
    };
    const slides = ['cover', 'content', 'content', 'content', 'closing'].map((visualRole, i) => ({
      id: `e${i}`, title: `Título ${i}`, subtitle: 'Apoio curto do slide.', bodyAfterImage: '', eyebrow: 'A FESTA',
      ...(i % 2 === 0 ? { imageQuery: 'photo', bgImage: 'data:image/png;base64,AAAA' } : {}),
      presentationPlan: { visualRole, purpose: 'context', question: 'Q', keyMessage: 'K', visualDirection: ARTE.visualDirection, scene: i % 2 === 0 ? ARTE.scenes[i] : null },
    }));
    const doc = applyPresentationVisualPresetToDoc({ presentationPath: 'auto', presentationDeckDesign: DECK, slides }, 'presentation_free', undefined, { initialize: true });
    for (const s of doc.slides) {
      const devices = s.presentationChrome.chrome.filter(d => String(d.text || '').includes('{kicker'));
      expect(devices.length, s.id).toBeGreaterThan(0);
      const els = chromeElements({ ...s.presentationChrome, family: s.presentationChrome.family }, { frame: FRAME, tokens: chromeTokensForSlide(s), overrides: s.presentationPaletteOverrides });
      const label = els.find(item => item.text === 'A FESTA');
      expect(label, s.id).toBeTruthy();
      expect(label.style.fontSize).toBeGreaterThanOrEqual(24);
      const surface = s.presentationFreeTextSurfaces.title;
      expect(wcagContrast(label.style.color, surface), s.id).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('modo livre: texto em cor cheia e personalidade em duas colunas', () => {
  const DECK = {
    palette: { bg: '#171344', surface: '#231D5A', ink: '#F7F3EE', muted: '#CFC9EC', accent: '#FF6A1A', accent2: '#27DDE5', inverse: '#F7F3EE', inverseInk: '#171344' },
    fonts: { display: 'Inter Tight', text: 'Inter' }, mood: 'Night party.',
  };
  const pages = [['cover', 'introduction', true], ['content', 'context', true], ['content', 'vision', true], ['content', 'other', false], ['content', 'context', true], ['content', 'solution', true], ['closing', 'decision', true]];
  const doc = applyPresentationVisualPresetToDoc({ presentationPath: 'auto', presentationDeckDesign: DECK, slides: pages.map(([visualRole, purpose, foto], i) => ({
    id: `c${i}`, title: foto ? `Título ${i}` : 'Mal termina o Réveillon', subtitle: foto ? 'Apoio do slide com uma informação.' : 'E ainda inventamos o esquenta.', bodyAfterImage: '',
    ...(foto ? { imageQuery: 'photo', bgImage: 'data:image/png;base64,AAAA' } : {}),
    presentationPlan: { visualRole, purpose, question: 'Q', keyMessage: 'K', visualDirection: ARTE.visualDirection, scene: foto ? ARTE.scenes[i] : null },
  })) }, 'presentation_free', undefined, { initialize: true });

  it('página de frase ou comportamento sem foto entra como texto em cor cheia com título grande', () => {
    const frase = doc.slides[3];
    expect(frase.presentationFreeDesign).toMatchObject({ ground: 'accent', photo: 'none' });
    expect(frase.presentationComposition).toBe('divider');
    expect(frase.customBg).toBe(DECK.palette.accent);
    expect(wcagContrast(frase.titleColor, frase.customBg)).toBeGreaterThanOrEqual(4.5);
    // Título grande: maior que o título das páginas de conteúdo.
    const content = doc.slides.filter(s => s.presentationComposition === 'content').map(s => s.titleSize);
    expect(frase.titleSize).toBeGreaterThan(Math.max(...content));
  });

  it('comparison aceita "traço / sem ser…" em duas colunas e é reconhecido como par', () => {
    const block = { type: 'comparison', headers: ['Traço', 'Sem ser'], rows: [['Brasileira', 'sem ser caricata.'], ['Sofisticada', 'sem ser pretensiosa.'], ['Exclusiva', 'sem ser arrogante.'], ['Sensual', 'sem ser vulgar.'], ['Irreverente', 'sem ser infantil.']] };
    const [normalized] = normalizePresentationBlocks([block]);
    expect(normalized.headers).toHaveLength(2);
    expect(normalized.rows).toHaveLength(5);
    expect(comparisonVariant(normalized)).toBe('pairs');
    expect(comparisonVariant({ ...normalized, rows: normalized.rows.map(([a, b]) => [a, b.replace(/^sem ser /, '')]) })).toBe('table');
    expect(comparisonVariant({ type: 'comparison', headers: ['A', 'B', 'C'], rows: [['1', 'sem 2', 'sem 3']] })).toBe('table');
  });
});
