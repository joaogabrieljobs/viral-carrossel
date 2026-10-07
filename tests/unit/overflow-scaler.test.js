import { describe, expect, it, vi } from 'vitest';
import {
  OVERFLOW_ABSOLUTE_MIN_SCALE,
  nextOverflowScale,
  observeOverflowInvalidations,
} from '../../src/components/card/render-primitives.jsx';

describe('OverflowScaler', () => {
  it('respeita primeiro o piso editorial e usa o piso emergencial numa segunda medição', () => {
    const firstPass = nextOverflowScale({
      currentScale: 1,
      clientHeight: 300,
      contentHeight: 700,
      minScale: 0.62,
      hardMinScale: 0.45,
    });

    expect(firstPass).toBe(0.62);

    const emergencyPass = nextOverflowScale({
      currentScale: firstPass,
      clientHeight: 300,
      contentHeight: 450,
      minScale: 0.62,
      hardMinScale: 0.45,
    });

    expect(emergencyPass).toBe(0.45);
  });

  it('usa um piso absoluto quando o corte vertical persiste no piso emergencial', () => {
    expect(nextOverflowScale({
      currentScale: 0.45,
      clientHeight: 300,
      contentHeight: 420,
      minScale: 0.62,
      hardMinScale: 0.45,
    })).toBeCloseTo(0.315, 6);

    expect(nextOverflowScale({
      currentScale: 0.45,
      clientHeight: 120,
      contentHeight: 900,
      minScale: 0.62,
      hardMinScale: 0.45,
    })).toBe(OVERFLOW_ABSOLUTE_MIN_SCALE);

    expect(nextOverflowScale({
      currentScale: OVERFLOW_ABSOLUTE_MIN_SCALE,
      clientHeight: 120,
      contentHeight: 900,
      minScale: 0.62,
      hardMinScale: 0.45,
    })).toBe(OVERFLOW_ABSOLUTE_MIN_SCALE);
  });

  it('desconta zonas de foto fixas antes de calcular o ajuste do texto', () => {
    const scale = nextOverflowScale({
      currentScale: 1,
      clientHeight: 500,
      contentHeight: 700,
      photoHeight: 200,
      minScale: 0.7,
      hardMinScale: 0.5,
    });

    expect(scale).toBe(0.7);
  });

  it('reduz pela largura quando o conteúdo cabe verticalmente', () => {
    const scale = nextOverflowScale({
      currentScale: 1,
      clientHeight: 500,
      contentHeight: 400,
      clientWidth: 400,
      contentWidth: 500,
      minScale: 0.62,
      hardMinScale: 0.45,
    });

    expect(scale).toBeCloseTo(0.784, 6);
  });

  it('usa o eixo mais restritivo sem multiplicar as duas razões', () => {
    const scale = nextOverflowScale({
      currentScale: 1,
      clientHeight: 450,
      contentHeight: 500,
      clientWidth: 400,
      contentWidth: 500,
      minScale: 0.62,
      hardMinScale: 0.45,
    });

    expect(scale).toBeCloseTo(0.784, 6);
  });

  it('preserva a escala quando o conteúdo cabe nos dois eixos', () => {
    expect(nextOverflowScale({
      currentScale: 0.73,
      clientHeight: 500,
      contentHeight: 480,
      clientWidth: 400,
      contentWidth: 390,
      minScale: 0.62,
      hardMinScale: 0.45,
    })).toBe(0.73);
  });

  it('mantém rigidamente o piso PDS de 0.85 mesmo quando o conteúdo ainda transborda', () => {
    const firstPass = nextOverflowScale({
      currentScale: 1,
      clientHeight: 200,
      contentHeight: 900,
      minScale: 0.85,
      hardMinScale: 0.45,
      absoluteMinScale: 0.28,
      strictMinScale: true,
    });

    expect(firstPass).toBe(0.85);
    expect(nextOverflowScale({
      currentScale: firstPass,
      clientHeight: 200,
      contentHeight: 900,
      minScale: 0.85,
      hardMinScale: 0.45,
      absoluteMinScale: 0.28,
      strictMinScale: true,
    })).toBe(0.85);
  });

  it('mantém rigidamente o piso PDS de 0.70 nos dois eixos', () => {
    expect(nextOverflowScale({
      currentScale: 0.7,
      clientHeight: 500,
      contentHeight: 1_200,
      clientWidth: 400,
      contentWidth: 1_000,
      minScale: 0.7,
      hardMinScale: 0.4,
      strictMinScale: true,
    })).toBe(0.7);

    // Ao ligar o modo rígido após uma escala legada menor, o cálculo também
    // normaliza imediatamente para o piso declarado pelo PDS.
    expect(nextOverflowScale({
      currentScale: 0.42,
      clientHeight: 500,
      contentHeight: 450,
      minScale: 0.7,
      hardMinScale: 0.4,
      strictMinScale: true,
    })).toBe(0.7);
  });

  it('usa apenas a largura quando ainda não há uma medição vertical válida', () => {
    const scale = nextOverflowScale({
      currentScale: 1,
      clientHeight: 0,
      contentHeight: 900,
      clientWidth: 400,
      contentWidth: 500,
      minScale: 0.62,
      hardMinScale: 0.45,
    });

    expect(scale).toBeCloseTo(0.784, 6);
  });

  it('respeita o limite global de legibilidade e não ultrapassa o piso emergencial', () => {
    expect(nextOverflowScale({
      currentScale: 0.42,
      clientHeight: 100,
      contentHeight: 900,
      minScale: 0.62,
      hardMinScale: 0.42,
      absoluteMinScale: 0.24,
    })).toBe(OVERFLOW_ABSOLUTE_MIN_SCALE);

    expect(nextOverflowScale({
      currentScale: 0.32,
      clientHeight: 100,
      contentHeight: 900,
      minScale: 0.62,
      hardMinScale: 0.32,
      absoluteMinScale: 0.5,
    })).toBe(0.32);
  });

  it('remeasure após fonts.ready mesmo quando a escala permanece em 1', async () => {
    let resolveFonts;
    const ready = new Promise((resolve) => { resolveFonts = resolve; });
    const frames = [];
    const clearTimer = vi.fn();
    const onInvalidate = vi.fn();

    const cleanup = observeOverflowInvalidations({}, onInvalidate, {
      fonts: { ready },
      ResizeObserverImpl: null,
      requestFrame: (callback) => {
        frames.push(callback);
        return frames.length;
      },
      cancelFrame: vi.fn(),
      setTimer: () => 41,
      clearTimer,
    });

    resolveFonts();
    await ready;
    expect(frames).toHaveLength(1);
    expect(onInvalidate).not.toHaveBeenCalled();

    frames.shift()();
    expect(onInvalidate).toHaveBeenCalledTimes(1);

    cleanup();
    expect(clearTimer).toHaveBeenCalledWith(41);
  });

  it('remeasure ao redimensionar, agrupa notificações e desconecta no cleanup', () => {
    let notifyResize;
    const observe = vi.fn();
    const disconnect = vi.fn();
    class FakeResizeObserver {
      constructor(callback) {
        notifyResize = callback;
      }

      observe = observe;

      disconnect = disconnect;
    }

    const element = {};
    const frames = [];
    const onInvalidate = vi.fn();
    const cleanup = observeOverflowInvalidations(element, onInvalidate, {
      fonts: null,
      ResizeObserverImpl: FakeResizeObserver,
      requestFrame: (callback) => {
        frames.push(callback);
        return frames.length;
      },
      cancelFrame: vi.fn(),
      setTimer: () => 73,
      clearTimer: vi.fn(),
    });

    expect(observe).toHaveBeenCalledWith(element);
    notifyResize();
    notifyResize();
    expect(frames).toHaveLength(1);

    frames.shift()();
    expect(onInvalidate).toHaveBeenCalledTimes(1);

    cleanup();
    expect(disconnect).toHaveBeenCalledTimes(1);
    notifyResize();
    expect(frames).toHaveLength(0);
    expect(onInvalidate).toHaveBeenCalledTimes(1);
  });
});
