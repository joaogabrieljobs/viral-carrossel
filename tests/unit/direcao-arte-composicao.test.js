// Direção de arte das imagens (docs/product/direcao-de-arte-imagens.md), parte 3:
// a imagem conhece o layout. A partir da composição final do slide (zonas de
// título, apoio e evidência × zona da foto) o código escreve o bloco
// COMPOSITION do pedido de imagem; e a foto em tela cheia com texto sobre o
// espaço reservado ganha proteção lateral com contraste ≥ 4,5:1 garantido.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  composeCompositionBlock, mirrorTextZones, photoTextGeometry, sideScrim, sideScrimGradient,
} from '../../src/utils/image-composition.js';
import { getPresentationCompositionOverrides } from '../../src/styles/presentation-presets.jsx';
import { applyPresentationVisualPresetToDoc } from '../../src/utils/presentation-state.js';
import { freeDeckViolations, mixHex } from '../../src/utils/free-design.js';
import { wcagContrast } from '../../src/utils/wcag.js';

const APOTEOSE_VISUAL_DIRECTION = Object.freeze(JSON.parse(readFileSync(new URL('../fixtures/apoteose-direcao-arte.json', import.meta.url), 'utf8')).visualDirection);
const photoSlide = (role, extra = {}) => ({
  title: 'Brasil na pista', subtitle: 'A música brasileira conduz a noite, do começo ao fim.',
  imageQuery: 'DJ at a club', bgImage: 'data:image/png;base64,AAAA',
  presentationPlan: { visualRole: role, purpose: role === 'cover' ? 'introduction' : 'context', question: 'Por quê?', keyMessage: 'Mensagem.', visualDirection: APOTEOSE_VISUAL_DIRECTION },
  ...extra,
});
const compose = (preset, role, index, count = 6, extra = {}) => ({
  ...photoSlide(role, extra), ...getPresentationCompositionOverrides(preset, { slide: photoSlide(role, extra), stage: {}, index, count }),
});
const manual = zones => ({ presentationCompositionVersion: 3, canvas: { zones }, titleColor: '#FFFFFF' });
const FULL = { x: 0, y: 0, w: 100, h: 100 };

describe('geometria texto × foto', () => {
  it('sem foto (zona inativa ou foto suprimida): nada a reservar e nenhum bloco', () => {
    expect(photoTextGeometry({ presentationCompositionVersion: 3, presentationSuppressPhoto: true, canvas: { zones: { photo: FULL, title: { x: 6, y: 20, w: 40, h: 30 } } } })).toBeNull();
    expect(photoTextGeometry(manual({ photo: { x: 96, y: 94, w: 1, h: 1 }, title: { x: 6, y: 20, w: 40, h: 30 } }))).toBeNull();
    expect(composeCompositionBlock(manual({ photo: { x: 96, y: 94, w: 1, h: 1 }, title: { x: 6, y: 20, w: 40, h: 30 } }))).toBe('');
    // Slide sem composição versionada (deck antigo, carrossel): sem bloco.
    expect(composeCompositionBlock({ canvas: { zones: { photo: FULL, title: { x: 6, y: 20, w: 40, h: 30 } } } })).toBe('');
  });

  it('painel lateral sem texto por cima: preencher o painel com o assunto, respeitando o recorte', () => {
    const slide = manual({ photo: { x: 62, y: 15, w: 33, h: 70 }, title: { x: 5, y: 15, w: 52, h: 28 }, subtitle: { x: 5, y: 47, w: 44, h: 43 } });
    expect(photoTextGeometry(slide)).toEqual({ mode: 'panel', panelSide: 'right', width: 33, height: 70, fullBleed: false });
    expect(composeCompositionBlock(slide, { shot: 'medium' })).toBe('COMPOSITION (layout of this slide): Shot: medium. This image fills a panel on the right of the slide (about 33% of its width, 70% of its height); the text sits beside it, not over it. Fill the frame with the subject and the scene, with no empty area for type; keep faces and key details clear of the edges so the crop keeps them. Let the subject face or open toward the left, where the text is.');
  });

  it('tela cheia com texto à esquerda: fração reservada, cor da base sob tinta clara, assunto à direita e grafismos na borda direita', () => {
    const slide = manual({ photo: FULL, title: { x: 6, y: 18, w: 44, h: 36 }, subtitle: { x: 6, y: 58, w: 40, h: 26 } });
    expect(photoTextGeometry(slide)).toEqual({ mode: 'overlay', side: 'left', reserve: 50, vertical: '', fullBleed: true });
    expect(composeCompositionBlock(slide, { visualDirection: APOTEOSE_VISUAL_DIRECTION, shot: 'close-up' })).toBe('COMPOSITION (space for the slide text): Shot: close-up. Type is laid over the left 50% of the frame. Keep that area dark and quiet in #171344, with low detail and no faces, hands or key details in it. Place the subject within the right 50%. Let graphics sit near the right edge, away from the type.');
  });

  it('tela cheia com texto à direita (lado espelhado)', () => {
    const zones = mirrorTextZones({ photo: FULL, title: { x: 6, y: 46, w: 44, h: 30 }, subtitle: { x: 6, y: 77, w: 40, h: 11 } });
    expect(zones.title).toEqual({ x: 50, y: 46, w: 44, h: 30 });
    // O bloco se move inteiro: título e apoio seguem alinhados pela esquerda.
    expect(zones.subtitle).toEqual({ x: 50, y: 77, w: 40, h: 11 });
    expect(zones.photo).toEqual(FULL);
    const slide = manual(zones);
    expect(photoTextGeometry(slide)).toMatchObject({ mode: 'overlay', side: 'right', reserve: 50, vertical: 'lower' });
    const block = composeCompositionBlock(slide, { visualDirection: APOTEOSE_VISUAL_DIRECTION });
    expect(block).toContain('Type is laid over the right 50% of the frame, mostly in its lower half.');
    expect(block).toContain('Place the subject within the left 50%.');
    expect(block).toContain('Let graphics sit near the left edge, away from the type.');
  });

  it('sem direção visual e sem grafismos: tom pela tinta, sem cor e sem frase de grafismo', () => {
    const slide = { ...manual({ photo: FULL, title: { x: 6, y: 18, w: 44, h: 36 } }), titleColor: '#111111' };
    const block = composeCompositionBlock(slide);
    expect(block).toContain('Keep that area light and quiet, with low detail');
    expect(block).not.toContain('graphics');
  });
});

describe('proteção lateral do texto sobre a foto (contraste garantido)', () => {
  it('tinta clara: a pior foto possível (branca) sob a proteção ainda dá ≥ 4,5:1', () => {
    const zones = { photo: FULL, title: { x: 6, y: 18, w: 44, h: 36 }, subtitle: { x: 6, y: 58, w: 40, h: 26 } };
    const scrim = sideScrim({ zones, inks: ['#FFFFFF', '#D9D4F2'], colours: ['#171344'] });
    expect(scrim).toMatchObject({ overlayMode: 'side', overlaySide: 'left', overlayColor: '#171344', overlayReach: 52 });
    const worst = mixHex('#171344', '#FFFFFF', scrim.overlay / 100);
    expect(scrim.surface).toBe(worst);
    for (const ink of ['#FFFFFF', '#D9D4F2']) expect(wcagContrast(ink, worst)).toBeGreaterThanOrEqual(4.5);
    // Proteção leve: o mínimo que garante a leitura, não um véu cheio.
    expect(scrim.overlay).toBeLessThan(80);
  });

  it('cor da paleta sem contraste com a tinta cai para preto; texto fora da lateral não usa a proteção lateral', () => {
    expect(sideScrim({ zones: { photo: FULL, title: { x: 6, y: 18, w: 44, h: 36 } }, inks: ['#FFFFFF'], colours: ['#FF6A1A'] }).overlayColor).toBe('#000000');
    expect(sideScrim({ zones: { photo: FULL, title: { x: 6, y: 60, w: 88, h: 30 } }, inks: ['#FFFFFF'], colours: ['#171344'] })).toBeNull();
    expect(sideScrim({ zones: { photo: { x: 62, y: 15, w: 33, h: 70 }, title: { x: 5, y: 15, w: 52, h: 28 } }, inks: ['#FFFFFF'] })).toBeNull();
  });

  it('famílias com foto cheia (Cinemático e Fotográfico) usam a proteção lateral na capa, com a cor da base', () => {
    for (const preset of ['presentation_cinematic', 'presentation_photo_essay']) {
      const cover = compose(preset, 'cover', 0);
      expect(cover.canvas.zones.photo).toEqual(FULL);
      expect(cover, preset).toMatchObject({ overlayMode: 'side', overlaySide: 'left', overlayColor: '#171344' });
      const worst = mixHex(cover.overlayColor, '#FFFFFF', cover.overlay / 100);
      for (const key of ['titleColor', 'subtitleColor', 'textColor']) expect(wcagContrast(cover[key], worst), `${preset} ${key}`).toBeGreaterThanOrEqual(4.5);
      expect(composeCompositionBlock(cover, { visualDirection: APOTEOSE_VISUAL_DIRECTION })).toContain('Keep that area dark and quiet in #171344');
    }
  });

  it('família com foto em painel (Editorial) não ganha proteção e o bloco é o do painel', () => {
    const content = compose('presentation_editorial_magazine', 'content', 2);
    expect(content.overlayMode).not.toBe('side');
    expect(composeCompositionBlock(content)).toContain('This image fills a panel on the right of the slide');
  });

  it('o renderer desenha a proteção lateral do lado do texto, na cor gravada', () => {
    const cover = compose('presentation_cinematic', 'cover', 0);
    expect(sideScrimGradient({ ...cover, overlaySide: 'left' })).toMatch(new RegExp(`^linear-gradient\\(to right, rgba\\(23, 19, 68, ${cover.overlay / 100}\\) 0%, rgba\\(23, 19, 68, ${cover.overlay / 100}\\) ${cover.overlayReach}%, rgba\\(23, 19, 68, 0\\) ${cover.overlayReach + 18}%\\)$`));
    expect(sideScrimGradient({ ...cover, overlaySide: 'right' })).toMatch(/^linear-gradient\(to left, /);
    // A prévia e a exportação (html2canvas da mesma árvore) usam o mesmo gradiente.
    const source = readFileSync(new URL('../../src/components/card/SlideCardInner.jsx', import.meta.url), 'utf8');
    expect(source.match(/slide\.overlayMode === 'side'\s*\? sideScrimGradient\(slide\)/g)).toHaveLength(2);
  });
});

describe('modo livre: ground photo usa a foto cheia com texto no lado reservado, alternando o lado', () => {
  const deckDesign = {
    palette: { bg: '#171344', surface: '#241E5C', ink: '#F5F2EC', muted: '#C9C4E8', accent: '#FF6A1A', accent2: '#27DDE5', inverse: '#F5F2EC', inverseInk: '#171344' },
    fonts: { display: 'Fraunces', text: 'Inter' }, mood: 'Night party, orange light on faces.',
  };
  const design = (family, ground, photo) => ({ family, ground, photo, block: 'none', emphasis: [], icons: [] });
  const DESIGNS = [design('cinematic', 'photo', 'full'), design('editorial', 'bg', 'half'), design('cinematic', 'photo', 'full'), design('typographic', 'inverse', 'none'), design('photo', 'photo', 'full'), design('executive', 'accent', 'half')];
  const doc = () => applyPresentationVisualPresetToDoc({
    presentationPath: 'auto', brand: { showHandle: false }, presentationDeckDesign: deckDesign,
    slides: DESIGNS.map((d, i) => ({
      id: `s${i}`, num: i + 1, title: `Título ${i + 1}`, subtitle: 'Apoio curto do slide.', bodyAfterImage: '',
      ...(d.photo !== 'none' ? { bgImage: 'data:image/png;base64,AAAA', imageQuery: 'photo' } : {}),
      presentationPlan: { schemaVersion: 3, promptVersion: 'presentation-plan-v3', visualRole: i === 0 ? 'cover' : i === 5 ? 'closing' : 'content', purpose: 'context', question: 'Q?', keyMessage: 'M.', design: d },
    })),
  }, 'presentation_free', undefined, { initialize: true });

  it('páginas com texto sobre a foto alternam esquerda e direita e passam na conferência do modo livre', () => {
    const slides = doc().slides;
    const onPhoto = slides.filter(s => s.presentationFreeDesign.ground === 'photo');
    expect(onPhoto.length).toBeGreaterThanOrEqual(2);
    expect(onPhoto.map(s => s.overlaySide)).toEqual(onPhoto.map((_, i) => (i % 2 ? 'right' : 'left')));
    for (const s of onPhoto) {
      expect(s.overlayMode).toBe('side');
      expect(photoTextGeometry(s)).toMatchObject({ mode: 'overlay', side: s.overlaySide });
      for (const key of ['titleColor', 'subtitleColor', 'textColor']) expect(wcagContrast(s[key], s.presentationFreeTextSurfaces.title)).toBeGreaterThanOrEqual(4.5);
    }
    expect(freeDeckViolations(slides).filter(v => v.code === 'free_contrast')).toEqual([]);
  });

  it('o pedido de imagem da página à direita reserva a direita, na cor escura do deck', () => {
    const right = doc().slides.find(s => s.overlaySide === 'right');
    const block = composeCompositionBlock(right);
    expect(block).toMatch(/Type is laid over the right \d+% of the frame/);
    expect(block).toContain(`in ${right.overlayColor}`);
  });
});
