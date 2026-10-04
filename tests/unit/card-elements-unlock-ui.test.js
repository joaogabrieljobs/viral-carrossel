import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { SlideCardInner, overflowDosElementosSeparados } from '../../src/components/card/SlideCardInner.jsx';
import {
  PASSO_TECLADO_PX,
  PASSO_TECLADO_SHIFT_PX,
  deltaMovimentoTeclado,
  isolarToqueDoElemento,
} from '../../src/components/card/useElementDrag.js';
import { DEFAULT_BRAND, ensureDocShape, mkSlide } from '../../src/utils/doc-schema.js';
import { unlockGroupedElementsPatch } from '../../src/utils/card-elements.js';

const source = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

function cultureSandwichSlide(patch = {}) {
  return {
    ...mkSlide(2, DEFAULT_BRAND),
    title: 'DIREÇÃO.',
    subtitle: 'Uma ideia precisa de critério antes de ganhar forma.',
    bodyAfterImage: 'A ferramenta amplia uma decisão que já foi tomada.',
    imageQuery: 'cadeira de direção em estúdio',
    useCultureLayout: true,
    ...patch,
  };
}

describe('desbloqueio individual de elementos do card Cultura', () => {
  it('oferece o CTA no painel e aplica o patch somente ao card selecionado', () => {
    const sidebar = source('src/components/SidebarContent.jsx');

    expect(sidebar).toContain('Separar elementos deste card');
    expect(sidebar).toMatch(/updateSlide\(unlockGroupedElementsPatch\(slide\)\)/);
    expect(sidebar).toMatch(/tab==='narrativa' && narrativaPanel==='card'/);

    const slides = [
      cultureSandwichSlide({ id: 'card-1', elementsUnlocked: false }),
      cultureSandwichSlide({ id: 'card-2', elementsUnlocked: false }),
    ];
    const activeIndex = 1;
    const next = slides.map((slide, index) => (
      index === activeIndex ? { ...slide, ...unlockGroupedElementsPatch(slide) } : slide
    ));

    expect(next[0]).toBe(slides[0]);
    expect(next[0].elementsUnlocked).not.toBe(true);
    expect(next[1]).not.toBe(slides[1]);
    expect(next[1].elementsUnlocked).toBe(true);
  });

  it('abre projetos antigos e cria cards novos já com edição individual', () => {
    expect(mkSlide(1, DEFAULT_BRAND).elementsUnlocked).toBe(true);
    const legacy = cultureSandwichSlide({
      canvas: { enabled: true, variant: 'sandwich' },
      elementOffsets: { subtitle: { x: 3, y: 6 } },
    });
    delete legacy.elementsUnlocked;
    const hydrated = ensureDocShape({
      brand: DEFAULT_BRAND,
      creativePreset: 'tendencia_cultura',
      slides: [legacy],
    });
    expect(hydrated.slides[0].elementsUnlocked).toBe(true);
    expect(hydrated.slides[0].elementOffsets.subtitle).toBeUndefined();
    expect(hydrated.slides[0].elementOffsets.bodyAfterImage).toEqual({ x: 3, y: 6 });
  });

  it('não remapeia o subtítulo de uma capa Cultura que nunca teve zona inferior', () => {
    const legacyCover = cultureSandwichSlide({
      bodyAfterImage: '',
      canvas: null,
      elementOffsets: { subtitle: { x: 2, y: 4 } },
    });
    delete legacyCover.elementsUnlocked;
    const hydrated = ensureDocShape({
      brand: DEFAULT_BRAND,
      creativePreset: 'tendencia_cultura',
      slides: [legacyCover],
    });
    expect(hydrated.slides[0].elementOffsets.subtitle).toEqual({ x: 2, y: 4 });
    expect(hydrated.slides[0].elementOffsets.bodyAfterImage).toBeUndefined();
  });

  it('expõe título, subtítulo, foto e texto final como alvos separados após desbloquear', () => {
    const slide = cultureSandwichSlide({ elementsUnlocked: true });
    const html = renderToStaticMarkup(React.createElement(SlideCardInner, {
      slide,
      fmt: 'carrossel',
      brand: DEFAULT_BRAND,
      num: 2,
      total: 3,
      creativePreset: 'tendencia_cultura',
      movableElements: true,
      onElementOffsetChange: vi.fn(),
    }));

    for (const key of ['title', 'subtitle', 'photo', 'bodyAfterImage']) {
      expect(html, `faltou alvo independente para ${key}`)
        .toContain(`data-vc-movable="${key}"`);
    }
    expect(html).not.toContain('data-vc-movable="text"');
    expect(html).toContain('tabindex="0"');
    expect(html).toContain('aria-label="Título: DIREÇÃO. Elemento móvel. Use as setas para mover; segure Shift para mover mais rápido."');
    expect(html).toContain('aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight Shift+ArrowUp Shift+ArrowDown Shift+ArrowLeft Shift+ArrowRight"');
  });

  it('mantém a composição agrupada antes do desbloqueio', () => {
    const slide = cultureSandwichSlide({ elementsUnlocked: false });
    const html = renderToStaticMarkup(React.createElement(SlideCardInner, {
      slide,
      fmt: 'carrossel',
      brand: DEFAULT_BRAND,
      num: 2,
      total: 3,
      creativePreset: 'tendencia_cultura',
      movableElements: true,
      onElementOffsetChange: vi.fn(),
    }));

    expect(html).toContain('data-vc-movable="text"');
    for (const key of ['title', 'bodyAfterImage']) {
      expect(html).not.toContain(`data-vc-movable="${key}"`);
    }
  });

  it('isola o toque do swipe do carrossel em todas as fases do gesto', () => {
    const stopPropagation = vi.fn();
    isolarToqueDoElemento({ stopPropagation });
    expect(stopPropagation).toHaveBeenCalledOnce();

    const dragSource = source('src/components/card/useElementDrag.js');
    for (const fase of ['onTouchStart', 'onTouchMove', 'onTouchEnd', 'onTouchCancel']) {
      expect(dragSource).toContain(`${fase}:`);
    }
  });

  it('move por setas com ajuste fino e Shift para passo maior', () => {
    expect(deltaMovimentoTeclado({ key: 'ArrowLeft' })).toEqual({ dx: -PASSO_TECLADO_PX, dy: 0 });
    expect(deltaMovimentoTeclado({ key: 'ArrowDown' })).toEqual({ dx: 0, dy: PASSO_TECLADO_PX });
    expect(deltaMovimentoTeclado({ key: 'ArrowRight', shiftKey: true }))
      .toEqual({ dx: PASSO_TECLADO_SHIFT_PX, dy: 0 });
    expect(deltaMovimentoTeclado({ key: 'Enter' })).toBeNull();
  });

  it('mantém o recorte no grupo e libera a antiga zona depois de separar', () => {
    expect(overflowDosElementosSeparados(false, true)).toBe('hidden');
    expect(overflowDosElementosSeparados(true, false)).toBe('hidden');
    expect(overflowDosElementosSeparados(true, true)).toBe('visible');
  });
});
