import { describe, expect, it } from 'vitest';
import { ensureDocShape, DEFAULT_BRAND, mkSlide } from '../../src/utils/doc-schema.js';
import { applyLogoLayoutToSlides } from '../../src/utils/slide-logo.js';

// Auditoria 23/11 (FE-04): "Aplicar em todos" e "Só nos selecionados" copiavam
// o tamanho da logo sem a marca de tamanho escolhido. Ao reabrir ou duplicar o
// projeto, a logo pequena dos outros cards voltava a 260.
const deck = () => ['a', 'b', 'c'].map((id, i) => ({ ...mkSlide(i + 1, DEFAULT_BRAND), id }));

describe('auditoria 23/11 FE-04: tamanho da logo copiado para os outros cards', () => {
  it('"Aplicar em todos" mantém a logo pequena depois de reabrir o projeto', () => {
    const slides = deck();
    slides[0] = { ...slides[0], logoSize: 100, logoSizeChosen: true };
    const applied = applyLogoLayoutToSlides(slides, { sourceSlide: slides[0], brand: DEFAULT_BRAND });
    const reopened = ensureDocShape({ brand: DEFAULT_BRAND, slides: applied });
    expect(reopened.slides.map(slide => slide.logoSize)).toEqual([100, 100, 100]);
  });

  it('"Só nos selecionados" mantém a logo pequena nos cards escolhidos', () => {
    const slides = deck();
    slides[0] = { ...slides[0], logoSize: 90, logoSizeChosen: true };
    const applied = applyLogoLayoutToSlides(slides, { sourceSlide: slides[0], brand: DEFAULT_BRAND, ids: ['b'] });
    const reopened = ensureDocShape({ brand: DEFAULT_BRAND, slides: applied });
    expect(reopened.slides[1].logoSize).toBe(90);
    // Card fora da seleção não ganha tamanho nem marca.
    expect(applied[2].logoSize).toBeUndefined();
    expect(applied[2].logoSizeChosen).toBeUndefined();
  });

  it('logo pequena antiga, sem escolha no controle, segue voltando ao padrão', () => {
    const reopened = ensureDocShape({ brand: DEFAULT_BRAND, slides: [{ ...deck()[0], logoSize: 100 }] });
    expect(reopened.slides[0].logoSize).toBe(260);
  });
});
