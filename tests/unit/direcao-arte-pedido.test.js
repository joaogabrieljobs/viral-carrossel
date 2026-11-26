// Direção de arte das imagens (docs/product/direcao-de-arte-imagens.md):
// pedido de imagem completo da Apoteose (10 slides, família Cinemático, kit
// com estilo escrito e 1 referência sem papel, rota do plano) a partir de um
// roteiro simulado com visualDirection e cenas inspiradas nos prompts reais
// do ChatGPT (docs/product/referencia-prompts-chatgpt-apoteose.md).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  PRESENTATION_PLAN_PROMPT_VERSION, PRESENTATION_PLAN_SCHEMA_VERSION, attachPresentationPlan, validatePresentationPlan,
} from '../../src/utils/presentation-plan.js';
import { applyPresentationVisualPresetToSlides } from '../../src/utils/presentation-state.js';
import { composeImageDirection } from '../../src/utils/image-direction.js';
import { IMAGE_PROMPT_TEXT, SJINN_PROMPT_LIMIT, buildImagePrompt } from '../../shared/image-prompt.js';

const estrutura = JSON.parse(readFileSync(new URL('../fixtures/apoteose-estrutura.json', import.meta.url), 'utf8'));
const apoteose = JSON.parse(readFileSync(new URL('../fixtures/apoteose.json', import.meta.url), 'utf8'));
const arte = JSON.parse(readFileSync(new URL('../fixtures/apoteose-direcao-arte.json', import.meta.url), 'utf8'));
const KIT = { ...apoteose.styleKit, refImages: [{ id: 'img_ref', name: 'referencia.jpeg', dataUrl: 'data:image/png;base64,AAAA' }] };
const FOTO = 'data:image/png;base64,iVBORw0KGgo=';
const SRC = [{ id: 's1', title: 'Material', text: 'A Apoteose é uma festa que nasce com a proposta de ocupar um espaço relevante no calendário pré-Carnaval de São Paulo.' }];
const palavras = (n) => { const base = 'festa cidade ritmo encontro noite cultura'; let out = ''; while (out.length < n) out += (out ? ' ' : '') + base; return out.slice(0, n).trim(); };

const plano = (withVisualDirection = true) => ({
  schemaVersion: PRESENTATION_PLAN_SCHEMA_VERSION, promptVersion: PRESENTATION_PLAN_PROMPT_VERSION,
  objective: 'Apresentar a Apoteose', audience: 'Convidados', thesis: 'A Apoteose é o esquenta do Carnaval de São Paulo',
  rules: [{ id: 'r1', level: 'avoid', target: 'image', instruction: 'Não usar clichês visuais do Carnaval como fantasias, plumas e confetes' }],
  evidence: [], gaps: [], signature: '',
  ...(withVisualDirection ? { visualDirection: structuredClone(arte.visualDirection) } : {}),
  slides: estrutura.slides.map((s, i) => ({
    index: i + 1, visualRole: s.visualRole, purpose: s.purpose, question: 'Por quê?', keyMessage: 'Mensagem do slide.', evidenceIds: [],
    scene: arte.scenes[i] ? structuredClone(arte.scenes[i]) : null, avoid: '',
  })),
});

/** Deck composto na família da Apoteose, com fotos de teste e o roteiro anexado. */
function apoteoseDeck({ withVisualDirection = true } = {}) {
  const { plan, errors } = validatePresentationPlan(plano(withVisualDirection), { count: 10, sources: SRC });
  expect(errors).toEqual([]);
  const draft = attachPresentationPlan({
    slides: estrutura.slides.map((s, i) => ({
      id: `apoteose-${i + 1}`, title: palavras(s.titulo), subtitle: palavras(s.apoio), bodyAfterImage: palavras(s.final),
      presentationBlocks: s.bloco ? [{ type: 'metrics', items: [1, 2, 3].map(n => ({ label: `Rótulo ${n}`, value: `${n * 12}%`, detail: palavras(55) })) }] : [],
    })),
  }, plan);
  const slides = draft.slides.map(slide => (slide.imageQuery ? { ...slide, bgImage: FOTO } : slide));
  return applyPresentationVisualPresetToSlides(slides, estrutura.familia, 'auto');
}

function apoteosePrompt(deck, index) {
  const direction = composeImageDirection({
    styleKit: KIT, slide: deck[index], fmt: 'apresentacao', baseReferenceCount: 1, presentationPanel: true,
    presentationFamily: estrutura.familia, deckSlides: deck, slideIndex: index,
  });
  return { direction, ...buildImagePrompt({ scene: deck[index].imageQuery, ...direction }, { route: 'sjinn' }) };
}

const header = block => block.split('\n')[0].split(':')[0];

describe('pedido de imagem da Apoteose com direção de arte', () => {
  const deck = apoteoseDeck();
  const withImage = deck.map((slide, index) => index).filter(index => deck[index].imageQuery);

  it('9 dos 10 slides pedem imagem (o de métricas não)', () => {
    expect(withImage).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 9]);
  });

  it('todo pedido cabe na rota do plano (4.000) e nunca perde a direção visual nem COMPOSITION', () => {
    for (const index of withImage) {
      const result = apoteosePrompt(deck, index);
      expect(result.chars, `slide ${index + 1}`).toBeLessThanOrEqual(SJINN_PROMPT_LIMIT);
      expect(result.dropped).not.toContain('visualDirection');
      expect(result.dropped).not.toContain('composition');
      expect(result.prompt, `slide ${index + 1}`).toContain('Palette: base colour, the dominant field #171344; light on the subject #FF6A1A; shadows #B41275; graphic interventions #27DDE5; small accents #60EC2E.');
      expect(result.prompt).toMatch(/COMPOSITION \((space for the slide text|layout of this slide)\)/);
    }
  });

  it('ordem do método do ChatGPT: direção visual → assunto → ação → espaço do texto → luz e grafismos → … → formato e restrições', () => {
    for (const index of withImage) {
      const blocks = apoteosePrompt(deck, index).prompt.split('\n\n').map(header);
      const at = key => blocks.indexOf(key);
      expect(at('VISUAL DIRECTION (shared by every image of this deck)'), `slide ${index + 1}`).toBe(0);
      expect(at('SUBJECT AND CASTING')).toBe(1);
      expect(at('COMPOSITION (space for the slide text)') + at('COMPOSITION (layout of this slide)') + 1).toBeGreaterThan(at('ACTION AND EXPRESSION'));
      expect(at('LIGHT, TEXTURE AND GRAPHICS OF THIS SLIDE')).toBeGreaterThan(Math.max(at('COMPOSITION (space for the slide text)'), at('COMPOSITION (layout of this slide)')));
      expect(blocks.at(-1)).toBe('FORMAT AND RESTRICTIONS');
      expect(blocks).toContain('STYLE REFERENCE (moodboard)');
      expect(blocks).toContain('AVOID (from the brief and this slide plan; keep these out of the image)');
      // A luz da família e a direção de arte padrão (dessaturada) não disputam com a paleta.
      expect(blocks).not.toContain('VISUAL TREATMENT');
      expect(blocks).not.toContain('DEFAULT ART DIRECTION');
    }
  });

  it('capa: foto cheia, texto sobre os 66% à esquerda na base #171344, assunto à direita e grafismos na borda direita', () => {
    const { prompt } = apoteosePrompt(deck, 0);
    expect(deck[0]).toMatchObject({ overlayMode: 'side', overlaySide: 'left', overlayColor: '#171344' });
    expect(prompt).toContain('COMPOSITION (space for the slide text): Shot: close-up. Type is laid over the left 66% of the frame, mostly in its lower half. Keep that area dark and quiet in #171344, with low detail and no faces, hands or key details in it. Place the subject within the right 34%. Let graphics sit near the right edge, away from the type.');
    expect(prompt).toContain('SUBJECT AND CASTING: adult Afro-Brazilian woman in her thirties, editorial fashion close-up, large translucent sculptural glasses. Wardrobe: translucent amber glasses, small gold hoops. Setting: dark studio backdrop.');
    expect(prompt).toContain('ACTION AND EXPRESSION: turns her gaze to the left of the frame; expression: presence and confidence.');
    expect(prompt).not.toContain('Type overlays the lower half of this image');
  });

  it('conteúdo com foto em painel: o bloco pede para preencher o painel e o assunto se volta para o texto', () => {
    const { prompt } = apoteosePrompt(deck, 3);
    expect(deck[3].overlayMode).not.toBe('side');
    expect(prompt).toMatch(/COMPOSITION \(layout of this slide\): Shot: medium close-up\. This image fills a panel on the right of the slide \(about \d+% of its width(, \d+% of its height)?\); the text sits beside it, not over it\./);
  });

  it('o que corta primeiro: as cenas dos outros slides perdem linhas antes de qualquer outro bloco, e ficam no pedido', () => {
    const results = withImage.map(index => apoteosePrompt(deck, index));
    const cuts = results.flatMap(result => [...result.trimmed, ...result.dropped]);
    expect(cuts.filter(key => !['otherScenes'].includes(key))).toEqual([]);
    expect(results.every(result => result.prompt.includes(IMAGE_PROMPT_TEXT.otherScenesHeader))).toBe(true);
  });

  it('roteiro sem visualDirection: o pedido não ganha os blocos novos de direção (só COMPOSITION, porque o slide está composto)', () => {
    const plain = apoteoseDeck({ withVisualDirection: false });
    const { prompt } = apoteosePrompt(plain, 0);
    expect(prompt.startsWith('SCENE: ')).toBe(true);
    expect(prompt).not.toContain('VISUAL DIRECTION');
    expect(prompt).not.toContain(IMAGE_PROMPT_TEXT.restrictionsVisual);
    expect(prompt).toContain('COMPOSITION (space for the slide text): Type is laid over the left 66% of the frame');
  });
});
