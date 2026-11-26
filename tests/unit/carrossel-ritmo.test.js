// Etapa 2, melhoria 2 do plano do carrossel (26/11/2026): ritmo de layout.
// Nunca 3 cards seguidos com o mesmo arquétipo ou a mesma geometria, com a
// lógica da apresentação (presentation-composition.js, rhythmKind): o card
// que fecharia a trinca passa para outra variante ou outra função que a
// família já desenha, sem arquétipo novo. Capa e fecho ficam; card com estilo
// próprio ou zonas editadas não muda; o texto nunca muda.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { VISUAL_PRESETS, applyVisualPreset } from '../../src/styles/visual-presets.jsx';
import { applySocialVisualComposition, socialRhythmKey } from '../../src/utils/social-visual-composition.js';
import { SOCIAL_FAMILY_KEYS } from '../../src/utils/social-families.js';
import { VIRAL_STYLE_KEYS } from '../../src/utils/social-viral-styles.js';
import { slideForFormatDisplay } from '../../src/utils/format-view.js';

const deck = JSON.parse(readFileSync(new URL('../fixtures/carrossel-linha-de-base.json', import.meta.url), 'utf8'));
const FORMATOS = ['carrossel', 'quadrado', 'stories'];
const ESTILOS = [...SOCIAL_FAMILY_KEYS, ...VIRAL_STYLE_KEYS];
const presetDe = (e) => VISUAL_PRESETS.find((p) => (SOCIAL_FAMILY_KEYS.includes(e) ? p.socialFamily === e : p.id === e));
const cards = () => deck.cards.map(({ papel: _p, ...c }) => ({ ...c }));
function compor(estilo, formato = 'carrossel', slides = cards()) {
  const preset = presetDe(estilo);
  const brand = applyVisualPreset({ ...deck.marca }, preset.id);
  return applySocialVisualComposition(slides, { preset, brand, formato, narrative: 'editorial' });
}
const trincas = (slides, formato) => {
  const keys = slides.map((s) => socialRhythmKey(s, formato));
  const out = [];
  for (let i = 2; i < keys.length; i += 1) if (keys[i] && keys[i] === keys[i - 1] && keys[i] === keys[i - 2]) out.push(i);
  return out;
};

describe('ritmo do carrossel: nunca 3 layouts iguais seguidos', () => {
  const casos = ESTILOS.flatMap((e) => FORMATOS.map((f) => [e, f]));

  it.each(casos)('%s · %s: sem trinca ao compor', (estilo, formato) => {
    expect(trincas(compor(estilo, formato), formato)).toEqual([]);
  });

  it.each(casos)('%s · %s: a vista do formato (projeto composto no Feed) também não tem trinca', (estilo, formato) => {
    const vista = compor(estilo, 'carrossel').map((s) => slideForFormatDisplay(s, formato, {}, 'livre'));
    expect(trincas(vista, formato)).toEqual([]);
  });

  it.each(ESTILOS)('%s: texto, foto e ordem nunca mudam; capa e fecho ficam', (estilo) => {
    const antes = cards();
    const depois = compor(estilo);
    expect(depois.map((s) => [s.id, s.title, s.subtitle, s.bodyAfterImage, s.imageQuery])).toEqual(antes.map((s) => [s.id, s.title, s.subtitle, s.bodyAfterImage, s.imageQuery]));
    expect(depois[0].socialFunction).toBe('cover');
    expect(depois.at(-1).socialFunction).toBe('closing');
    // Card com foto continua com área de foto.
    for (const s of depois) if (s.imageQuery) expect(s.canvas.zones.photo.w).toBeGreaterThan(2);
    // A alternativa nunca deixa o texto pedindo revisão.
    expect(depois.filter((s) => s.socialArt.density === 'over').map((s) => s.id)).toEqual([]);
    // Nunca duas afirmações seguidas.
    for (let i = 1; i < depois.length; i += 1) expect(depois[i].socialFunction === 'statement' && depois[i - 1].socialFunction === 'statement', `${estilo} ${i}`).toBe(false);
  });

  it('a capa e o fecho não trocam de função para quebrar a trinca', () => {
    // Deck de 3 cards de miolo idênticos entre capa e fecho.
    const meio = (id) => ({ id, title: 'Um passo do processo', subtitle: 'O trabalho aparece para quem passa na calçada e muda a conversa com o cliente.', bodyAfterImage: '', imageQuery: '' });
    const slides = compor('mood_sepia', 'carrossel', [cards()[0], meio('a'), meio('b'), meio('c'), cards()[7]]);
    expect(slides[0].socialFunction).toBe('cover');
    expect(slides.at(-1).socialFunction).toBe('closing');
    expect(trincas(slides, 'carrossel')).toEqual([]);
  });

  it('card com zonas editadas pela pessoa não troca de layout para quebrar a trinca', () => {
    const slides = cards();
    const zonas = { photo: { x: 96, y: 94, w: 1, h: 1 }, title: { x: 10, y: 20, w: 80, h: 20 }, subtitle: { x: 10, y: 45, w: 80, h: 30 } };
    slides[3] = { ...slides[3], canvas: { userEdited: true, zones: zonas } };
    const depois = compor('mood_sepia', 'carrossel', slides);
    expect(depois[3].socialFunction).toBe('development');
    expect(depois[3].canvas.zones).toEqual(zonas);
  });

  it('card com estilo próprio volta como estava', () => {
    const slides = cards();
    slides[3] = { ...slides[3], visualPresetId: 'outro_estilo' };
    const depois = compor('mood_sepia', 'carrossel', slides);
    expect(depois[3]).toBe(slides[3]);
  });
});
