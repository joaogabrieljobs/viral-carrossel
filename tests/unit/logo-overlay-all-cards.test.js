import { describe, expect, it } from 'vitest';
import { ensureDocShape, DEFAULT_BRAND, mkSlide } from '../../src/utils/doc-schema.js';
import { ownPhotoOverlay, LOGO_SIZE_IMPORT } from '../../src/utils/slide-logo.js';
import { applyFormatEditToAll } from '../../src/utils/format-view.js';

// Reteste 22/11 (WebExpresso, marca própria): logo entrava enorme e só se
// ajustava card a card; duplicar voltava a logo a 260; o escurecimento 58 era
// forte demais com foto própria e também só por card.
describe('logo e escurecimento', () => {
  it('ajuste pequeno da logo sobrevive ao duplicar/reabrir (ensureDocShape)', () => {
    const doc = ensureDocShape({ brand: { ...DEFAULT_BRAND, logoSize: 100, logoSizeChosen: true }, slides: [{ ...mkSlide(1, DEFAULT_BRAND), logoSize: 90, logoSizeChosen: true }] });
    expect(doc.brand.logoSize).toBe(100);
    expect(doc.slides[0].logoSize).toBe(90);
    // Logo legada pequena (sem escolha no controle) segue a regra antiga.
    expect(ensureDocShape({ slides: [{ ...mkSlide(1, DEFAULT_BRAND), logoSize: 80 }] }).slides[0].logoSize).toBe(260);
  });
  it('valor fora do controle ainda volta ao padrão', () => {
    const doc = ensureDocShape({ brand: { ...DEFAULT_BRAND, logoSize: 10 }, slides: [] });
    expect(doc.brand.logoSize).toBeGreaterThanOrEqual(48);
  });
  it('logo importada entra num tamanho que não cobre o card', () => {
    expect(LOGO_SIZE_IMPORT).toBeLessThanOrEqual(200);
  });
  it('"usar em todos os cards" copia o ajuste para os outros cards', () => {
    // Auditoria 23/11 (FE-03): o ajuste vai pela proporção aberta; no Feed, grava no card.
    const doc = { fmt: 'carrossel', slides: [{ id: 'a', logoSize: 300, overlay: 58 }, { id: 'b', logoSize: 120 }, { id: 'c' }] };
    expect(applyFormatEditToAll(doc, { logoSize: 140, logoOpacity: 80 }).slides).toEqual([
      { id: 'a', logoSize: 140, logoOpacity: 80, overlay: 58 }, { id: 'b', logoSize: 140, logoOpacity: 80 }, { id: 'c', logoSize: 140, logoOpacity: 80 },
    ]);
    expect(applyFormatEditToAll(doc, { overlay: 30 }).slides.map(slide => slide.overlay)).toEqual([30, 30, 30]);
  });
  it('foto própria entra com escurecimento mais leve', () => {
    expect(ownPhotoOverlay(58)).toBe(40);
    expect(ownPhotoOverlay(60)).toBe(40);
    expect(ownPhotoOverlay(25)).toBe(25);
    expect(ownPhotoOverlay(undefined)).toBe(40);
  });
});
