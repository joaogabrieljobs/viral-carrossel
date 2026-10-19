import { describe, expect, it } from 'vitest';
import {
  ELEMENT_CATALOG,
  MAX_CARD_OVERLAYS,
  addOverlayToSlide,
  makeTextOverlay,
  normalizeOverlay,
  normalizeOverlays,
  overlayMoveKey,
  removeOverlayFromSlide,
  updateOverlayOnSlide,
} from '../../src/utils/card-overlays.js';
import { DEFAULT_BRAND, ensureDocShape, mkSlide } from '../../src/utils/doc-schema.js';

describe('card-overlays', () => {
  it('catálogo tem CTAs variados + linhas (sem bloco de texto solto)', () => {
    const ids = ELEMENT_CATALOG.map((e) => e.id);
    expect(ids).toContain('cta_filled');
    expect(ids).toContain('cta_outline');
    expect(ids).toContain('cta_glass');
    expect(ids).toContain('cta_gold_edge');
    expect(ids).toContain('rule_thin');
    expect(ids).toContain('rule_medium');
    expect(ids).toContain('rule_long');
    expect(ids).toContain('rule_bold');
    expect(ids).not.toContain('text_soft');
    expect(ELEMENT_CATALOG.every((e) => e.group !== 'Texto')).toBe(true);
    for (const item of ELEMENT_CATALOG) {
      const ov = item.factory();
      expect(normalizeOverlay(ov)).toBeTruthy();
    }
  });

  it('aceita traços maiores e mantém os finos já salvos', () => {
    const bold = ELEMENT_CATALOG.find((e) => e.id === 'rule_bold').factory();
    const long = ELEMENT_CATALOG.find((e) => e.id === 'rule_long').factory();
    expect(normalizeOverlay(bold).thickness).toBe(22);
    expect(normalizeOverlay(long).w).toBe(84);
    expect(normalizeOverlay({ type: 'rule', thickness: 1.5, w: 28 }).thickness).toBe(1.5);
    expect(normalizeOverlay({ type: 'rule', thickness: 80, w: 120 })).toMatchObject({
      thickness: 48,
      w: 90,
    });
  });

  it('normalizeOverlay rejeita tipos inválidos e limita lista', () => {
    expect(normalizeOverlay({ type: 'bomb' })).toBeNull();
    const many = Array.from({ length: 20 }, () => ({ type: 'rule', x: 10, y: 10, w: 20 }));
    expect(MAX_CARD_OVERLAYS).toBe(12);
    expect(normalizeOverlays(many)).toHaveLength(MAX_CARD_OVERLAYS);
  });

  it('cria texto livre pronto para editar com IDs independentes', () => {
    const first = makeTextOverlay();
    const second = makeTextOverlay();
    expect(first).toMatchObject({
      type: 'text', text: 'Digite seu texto', x: 26, y: 45, w: 48,
      color: '#3A322C', size: 3.4, weight: 500, align: 'left',
    });
    expect(first.id).toBeTruthy();
    expect(first.id).not.toBe(second.id);
  });

  it('mantém a caixa criada perto das bordas dentro do card', () => {
    const edge = makeTextOverlay({ x: 99, y: 102, color: '#ffffff' });
    expect(edge).toMatchObject({ x: 90, y: 90, w: 8, color: '#ffffff' });
    expect(normalizeOverlays([edge])[0].x + normalizeOverlays([edge])[0].w).toBe(98);
    expect(makeTextOverlay({ x: 70, y: 40 })).toMatchObject({ x: 70, y: 40, w: 28 });
    expect(makeTextOverlay({ x: -20, y: -10 })).toMatchObject({ x: 0, y: 0, w: 48 });
    expect(makeTextOverlay({ x: NaN, y: Infinity })).toMatchObject({ x: 26, y: 45, w: 48 });
  });

  it('preserva texto completo, quebras de linha e estilo ao salvar e reabrir o projeto', () => {
    const content = `Primeira linha\n${'Conteúdo que precisa continuar salvo. '.repeat(15)}\nÚltima linha`;
    const overlay = makeTextOverlay();
    const created = addOverlayToSlide(mkSlide(1, DEFAULT_BRAND), overlay);
    const edited = updateOverlayOnSlide(created, overlay.id, {
      text: content, align: 'right', size: 5.2, weight: 600, color: '#123456',
    });
    const saved = JSON.parse(JSON.stringify({ brand: DEFAULT_BRAND, slides: [edited] }));
    const restored = ensureDocShape(saved).slides[0].overlays[0];
    expect(restored).toMatchObject({
      text: content, align: 'right', size: 5.2, weight: 600, color: '#123456',
    });
    expect(updateOverlayOnSlide(edited, overlay.id, { text: '' }).overlays[0].text).toBe('');
  });

  it('preserva a geometria e a tipografia de textos livres legados', () => {
    const legacy = {
      id: 'old-text', type: 'text', text: 'Texto antigo\nSegunda linha',
      x: 14, y: 36, w: 52, color: '#aabbcc', align: 'center',
      size: 4.2, weight: 700, tracking: 0.03, leading: 1.4,
    };
    expect(normalizeOverlay(legacy)).toEqual(legacy);
  });

  it.each(['text', 'cta'])('preserva a fonte individual do overlay %s ao salvar e reabrir', (type) => {
    const fontFamily = '"Minha fonte importada", sans-serif';
    const overlay = normalizeOverlay({ id: `font-${type}`, type, text: 'Texto com fonte própria', fontFamily });
    const slide = addOverlayToSlide(mkSlide(1, DEFAULT_BRAND), overlay);
    const saved = JSON.parse(JSON.stringify({ brand: DEFAULT_BRAND, slides: [slide] }));
    const restored = ensureDocShape(saved).slides[0].overlays[0];
    expect(restored.fontFamily).toBe(fontFamily);
    expect(restored.text).toBe('Texto com fonte própria');
  });

  it('altera só a fonte do texto escolhido e permite voltar a herdar o estilo', () => {
    const first = normalizeOverlay({ id: 'first', type: 'text', text: 'Primeiro', fontFamily: 'Georgia, serif' });
    const second = normalizeOverlay({ id: 'second', type: 'text', text: 'Segundo', fontFamily: 'Arial, sans-serif' });
    const original = { id: 'slide-fonts', overlays: [first, second] };
    const edited = updateOverlayOnSlide(original, first.id, { fontFamily: '"Playfair Display", serif' });
    expect(edited.overlays[0].fontFamily).toBe('"Playfair Display", serif');
    expect(edited.overlays[1]).toEqual(second);
    expect(original.overlays[0].fontFamily).toBe('Georgia, serif');
    const inherited = updateOverlayOnSlide(edited, first.id, { fontFamily: '' });
    expect(inherited.overlays[0]).not.toHaveProperty('fontFamily');
    expect(inherited.overlays[1].fontFamily).toBe('Arial, sans-serif');
  });

  it.each([undefined, null, '', '   ', 42, {}])('não adiciona uma fonte inválida nem muda a herança: %s', (fontFamily) => {
    for (const type of ['text', 'cta']) {
      expect(normalizeOverlay({ id: 'inherited', type, fontFamily })).not.toHaveProperty('fontFamily');
    }
  });

  it('add/remove/update no slide', () => {
    const base = { id: 's1', overlays: [], elementsUnlocked: false };
    const cta = ELEMENT_CATALOG.find((e) => e.id === 'cta_filled').factory();
    const withCta = addOverlayToSlide(base, cta);
    expect(withCta.overlays).toHaveLength(1);
    expect(withCta.elementsUnlocked).toBe(true);
    expect(overlayMoveKey(withCta.overlays[0].id)).toMatch(/^ov_/);

    const patched = updateOverlayOnSlide(withCta, withCta.overlays[0].id, { text: 'NOVO CTA', size: 180 });
    expect(patched.overlays[0].text).toBe('NOVO CTA');
    expect(patched.overlays[0].size).toBe(180);
    expect(normalizeOverlay({ id: 'cta-velho', type: 'cta', text: 'Agende' }).size).toBe(100);

    const cleared = removeOverlayFromSlide(patched, patched.overlays[0].id);
    expect(cleared.overlays).toHaveLength(0);
  });
});
