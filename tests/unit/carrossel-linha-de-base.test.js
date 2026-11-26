// Linha de base da composição do carrossel (etapa 1 do plano
// docs/product/carrossel-melhorias-e-modo-livre.md, 26/11/2026).
//
// Um deck fixo de 8 cards (capa, abertura, desenvolvimento ×2, foto,
// afirmação, lista, fecho com CTA) composto nos 9 estilos de família e nos 12
// estilos virais, nos 3 formatos do carrossel. Para cada estilo × formato fica
// gravado o hash do que a composição decide por card: função, arquétipo,
// variante, zonas, tamanhos, chão, cores, véu e fontes. Qualquer mudança de
// comportamento aparece aqui com o card e o motivo; a sequência legível de
// arquétipos ajuda a ver onde mudou.
//
// Para gravar os valores atuais num arquivo: LINHA_DE_BASE_IMPRIMIR=/caminho/saida.json npx vitest run tests/unit/carrossel-linha-de-base.test.js
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { VISUAL_PRESETS, applyVisualPreset } from '../../src/styles/visual-presets.jsx';
import { applySocialVisualComposition } from '../../src/utils/social-visual-composition.js';
import { SOCIAL_FAMILY_KEYS } from '../../src/utils/social-families.js';
import { VIRAL_STYLE_KEYS } from '../../src/utils/social-viral-styles.js';

const deck = JSON.parse(readFileSync(new URL('../fixtures/carrossel-linha-de-base.json', import.meta.url), 'utf8'));
const FORMATOS = ['carrossel', 'quadrado', 'stories'];

const presetDoEstilo = (chave) => VISUAL_PRESETS.find((p) => (SOCIAL_FAMILY_KEYS.includes(chave) ? p.socialFamily === chave : p.id === chave));
const ESTILOS = [...SOCIAL_FAMILY_KEYS, ...VIRAL_STYLE_KEYS];

const zona = (z) => (z ? [z.x, z.y, z.w, z.h] : null);

/** O que a composição decide em cada card, sem o texto (que nunca muda). */
function resumoDoCard(s) {
  const art = s.socialArt || {};
  return {
    fn: s.socialFunction, arquetipo: art.archetype, variante: art.variant, chao: art.ground, densidade: art.density,
    zonas: { foto: zona(s.canvas?.zones?.photo), titulo: zona(s.canvas?.zones?.title), apoio: zona(s.canvas?.zones?.subtitle) },
    tamanhos: [s.titleSize, s.subSize, s.bodyAfterSize, s.titleLeading, s.subLeading],
    alinhamento: [s.layout, s.align],
    cores: [s.customBg ?? null, s.titleColor ?? null, s.subtitleColor ?? null, s.textColor ?? null],
    veu: [s.overlay ?? null, s.overlayMode ?? null, s.socialScrimTop ?? null, !!s.textShadow],
    fontes: [art.typo?.titleFont, art.typo?.bodyFont, art.typo?.titleCase, art.typo?.titleLeading, s.titleWeight ?? null, s.titleCase ?? null, s.subtitleWeight ?? null],
    selo: [s.hideFooterPill ?? null, !!s.showSwipeCue],
  };
}

function comporDeck(estilo, formato, cards = deck.cards) {
  const preset = presetDoEstilo(estilo);
  const brand = applyVisualPreset({ ...deck.marca }, preset.id);
  const slides = cards.map(({ papel: _papel, ...card }) => ({ ...card }));
  return applySocialVisualComposition(slides, { preset, brand, formato, narrative: deck.narrativa });
}

const hash = (valor) => createHash('sha256').update(JSON.stringify(valor)).digest('hex').slice(0, 16);

function linhaDeBase(estilo, formato) {
  const cards = comporDeck(estilo, formato).map(resumoDoCard);
  return { hash: hash(cards), sequencia: cards.map((c) => `${c.fn}:${c.arquetipo}`).join(' '), cards: cards.map(hash) };
}

const ESPERADO = JSON.parse(readFileSync(new URL('../fixtures/carrossel-linha-de-base-esperado.json', import.meta.url), 'utf8')).casos;

describe('linha de base da composição do carrossel (8 cards, 21 estilos, 3 formatos)', () => {
  it('o deck fixo tem os oito papéis na ordem', () => {
    expect(deck.cards.map((c) => c.papel)).toEqual(['capa', 'abertura', 'desenvolvimento', 'desenvolvimento', 'foto', 'afirmação', 'lista', 'fecho']);
    expect(ESTILOS).toHaveLength(21);
    for (const estilo of ESTILOS) expect(presetDoEstilo(estilo), estilo).toBeTruthy();
  });

  it('as funções saem como o deck pede em todo estilo e formato', () => {
    for (const estilo of ESTILOS) for (const formato of FORMATOS) {
      expect(comporDeck(estilo, formato).map((s) => s.socialFunction), `${estilo} · ${formato}`)
        .toEqual(['cover', 'opener', 'development', 'development', 'photo', 'statement', 'list', 'closing']);
    }
  });

  const casos = ESTILOS.flatMap((estilo) => FORMATOS.map((formato) => [estilo, formato]));
  if (process.env.LINHA_DE_BASE_IMPRIMIR) {
    it('imprime a linha de base atual', () => {
      const tudo = Object.fromEntries(casos.map(([e, f]) => [`${e}|${f}`, linhaDeBase(e, f)]));
      writeFileSync(process.env.LINHA_DE_BASE_IMPRIMIR, `${JSON.stringify(tudo, null, 1)}\n`);
    });
  }

  it.each(casos)('%s · %s', (estilo, formato) => {
    const atual = linhaDeBase(estilo, formato);
    const esperado = ESPERADO[`${estilo}|${formato}`];
    expect(esperado, `sem linha de base para ${estilo} · ${formato}`).toBeTruthy();
    expect(atual.sequencia).toBe(esperado.sequencia);
    expect(atual.cards).toEqual(esperado.cards);
    expect(atual.hash).toBe(esperado.hash);
  });
});
