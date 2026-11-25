import { describe, expect, it } from 'vitest';
import { mkSlide } from '../../src/utils/doc-schema.js';
import { VISUAL_PRESETS, SOCIAL_FAMILY_PRESETS, applyVisualPreset } from '../../src/styles/visual-presets.jsx';
import {
  COLUMN_TITLE_MAX_LINES, applySocialVisualComposition, columnTitleLines, socialFormatPatch,
} from '../../src/utils/social-visual-composition.js';

const PRESETS = [...VISUAL_PRESETS, ...SOCIAL_FAMILY_PRESETS];
const APOIO = 'O pão chegava pronto à vitrine e ninguém via o trabalho. Hoje a massa descansa à vista e a fila começa antes de o forno acender.';
const TITULOS = {
  2: 'Cozinha aberta',
  4: 'Cozinha aberta virou vitrine',
  5: 'Cozinha aberta virou vitrine nova',
  7: 'Cozinha aberta virou vitrine nova da padaria antiga',
};

/** Carrossel em que o card pedido cai na geometria de coluna (variante 1 da função). */
function compor(presetId, { titulo, foto = false, formato = 'carrossel' }) {
  const preset = PRESETS.find((p) => p.id === presetId);
  const brand = applyVisualPreset({ name: 'Padaria', handle: '' }, preset.id);
  const midia = foto ? { imageQuery: 'cena', bgImage: 'data:image/png;base64,AAAA' } : { imageQuery: '' };
  const cards = [
    { title: 'A padaria que abriu a cozinha', subtitle: 'Um ensaio sobre processo.', imageQuery: 'cena', bgImage: 'data:image/png;base64,AAAA' },
    { title: 'O que mudou quando o balcão saiu da frente', subtitle: APOIO, imageQuery: '' },
    { title: 'Durante anos, o balcão escondia o trabalho', subtitle: foto ? 'A janela virou parte da loja.' : APOIO, ...midia },
    { title: titulo, subtitle: foto ? 'A janela virou parte da loja.' : APOIO, ...midia },
    { title: 'Uma cozinha aberta é vitrine', subtitle: 'Salve para depois.', imageQuery: '' },
  ].map((c, i) => ({ ...mkSlide(i + 1, brand), ...c }));
  return applySocialVisualComposition(cards, { preset, brand, formato })[3];
}
const arquetipo = (slide) => slide.socialArt.archetype;
const larguraDoTitulo = (slide) => slide.canvas.zones.title.w;

describe('QA-2411 carrossel 7: o título é medido antes de a coluna estreita ser escolhida', () => {
  it('conta linhas por palavra inteira, na largura da coluna e no corpo planejado', () => {
    // Revista, desenvolvimento: 92 px de Fraunces numa coluna de 38% do card.
    const medir = (titulo) => columnTitleLines(titulo, { titlePx: 92, widthPct: 38, frameWidth: 1080, titleFont: '"Fraunces", serif', upper: false });
    expect(medir(TITULOS[2])).toBe(2);
    expect(medir(TITULOS[4])).toBe(4);
    expect(medir(TITULOS[5])).toBe(5);
    expect(medir(TITULOS[7])).toBe(7);
    expect(COLUMN_TITLE_MAX_LINES).toBe(4);
  });

  it.each([2, 4])('Revista, texto em duas colunas: título de %i linhas fica na coluna', (linhas) => {
    const slide = compor('social_revista', { titulo: TITULOS[linhas] });
    expect(arquetipo(slide)).toBe('devColumn');
    expect(larguraDoTitulo(slide)).toBeLessThan(45);
  });

  it.each([5, 7])('Revista, texto em duas colunas: título de %i linhas volta para o layout empilhado', (linhas) => {
    const slide = compor('social_revista', { titulo: TITULOS[linhas] });
    expect(arquetipo(slide)).toBe('devRule');
    expect(larguraDoTitulo(slide)).toBeGreaterThanOrEqual(80);
    // Empilhado: o apoio começa abaixo do título, na mesma coluna.
    const { title, subtitle } = slide.canvas.zones;
    expect(subtitle.y).toBeGreaterThanOrEqual(title.y + title.h - 0.01);
    expect(slide.socialArt.density).toBe('ok');
  });

  it.each([2, 4])('Revista, foto em coluna: título de %i linhas fica ao lado da foto', (linhas) => {
    const slide = compor('social_revista', { titulo: TITULOS[linhas], foto: true });
    expect(arquetipo(slide)).toBe('photoColumn');
    expect(larguraDoTitulo(slide)).toBeLessThan(45);
  });

  it.each([5, 7])('Revista, foto em coluna: título de %i linhas vira foto em faixa com o texto na largura toda', (linhas) => {
    const slide = compor('social_revista', { titulo: TITULOS[linhas], foto: true });
    expect(arquetipo(slide)).toBe('wideStack');
    expect(larguraDoTitulo(slide)).toBeGreaterThanOrEqual(80);
    const { photo, title } = slide.canvas.zones;
    expect(photo.y + photo.h).toBeLessThanOrEqual(title.y + 0.01);
  });

  it.each(['mood_sepia', 'editorial_magazine'])('%s, foto em coluna: título longo também volta para o empilhado', (presetId) => {
    // Nestes estilos a coluna é a variante 0 da função foto: o card 3 do carrossel.
    const preset = PRESETS.find((p) => p.id === presetId);
    const brand = applyVisualPreset({ name: 'Padaria', handle: '' }, preset.id);
    const cards = [
      { title: 'A padaria que abriu a cozinha', subtitle: 'Um ensaio.', imageQuery: 'cena', bgImage: 'data:image/png;base64,AAAA' },
      { title: 'O que mudou quando o balcão saiu da frente', subtitle: APOIO, imageQuery: '' },
      { title: 'A cozinha aberta virou a melhor vitrine que a padaria do bairro já teve em anos', subtitle: 'A janela virou parte da loja.', imageQuery: 'cena', bgImage: 'data:image/png;base64,AAAA' },
      { title: 'Uma cozinha aberta é vitrine', subtitle: 'Salve para depois.', imageQuery: '' },
    ].map((c, i) => ({ ...mkSlide(i + 1, brand), ...c }));
    const slide = applySocialVisualComposition(cards, { preset, brand })[2];
    expect(arquetipo(slide)).not.toBe('vPhotoColumn');
    expect(larguraDoTitulo(slide)).toBeGreaterThanOrEqual(80);
  });

  it('a vista Quadrado segue a mesma regra', () => {
    const feed = compor('social_revista', { titulo: TITULOS[7] });
    const quadrado = { ...feed, ...socialFormatPatch(feed, 'quadrado') };
    expect(larguraDoTitulo(quadrado)).toBeGreaterThanOrEqual(80);
  });

  it('card que já era empilhado não muda', () => {
    const preset = PRESETS.find((p) => p.id === 'social_documental');
    const brand = applyVisualPreset({ name: 'Padaria', handle: '' }, preset.id);
    const cards = [
      { title: 'Capa', subtitle: 'Um ensaio.', imageQuery: '' },
      { title: 'O que mudou quando o balcão saiu da frente', subtitle: APOIO, imageQuery: '' },
      { title: TITULOS[7], subtitle: APOIO, imageQuery: '' },
      { title: 'Fecho', subtitle: 'Salve.', imageQuery: '' },
    ].map((c, i) => ({ ...mkSlide(i + 1, brand), ...c }));
    expect(arquetipo(applySocialVisualComposition(cards, { preset, brand })[2])).toBe('devRule');
  });
});
