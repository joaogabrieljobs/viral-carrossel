import { describe, expect, it, vi } from 'vitest';
import {
  extractCssBackgroundUrls,
  slideImageUrls,
  waitForExportAssets,
  waitForExportReadiness,
} from '../../src/hooks/useExport.js';

describe('espera de imagens antes da exportação', () => {
  it('extrai URLs de múltiplas camadas CSS sem confundir gradientes', () => {
    const css = 'linear-gradient(#0008, #0008), url("blob:foto-1"), url(\'https://cdn.exemplo/foto-2.webp\')';
    expect(extractCssBackgroundUrls(css)).toEqual([
      'blob:foto-1',
      'https://cdn.exemplo/foto-2.webp',
    ]);
  });

  it('aguarda e deduplica imagens usadas como background-image', async () => {
    const childA = {};
    const childB = {};
    const root = {
      querySelectorAll: vi.fn((selector) => selector === 'img' ? [] : [childA, childB]),
    };
    const getStyle = vi.fn((node) => ({
      backgroundImage: node === childA
        ? 'url("blob:imagem-gerada")'
        : node === childB
          ? 'linear-gradient(#000, #111), url("blob:imagem-gerada"), url("https://cdn.exemplo/apoio.png")'
          : 'none',
    }));

    const instances = [];
    class ManualImage {
      constructor() {
        this.complete = false;
        instances.push(this);
      }
      set src(value) { this.currentSrc = value; }
    }

    let settled = false;
    const pending = waitForExportAssets([root], {
      ImageCtor: ManualImage,
      getStyle,
      timeoutMs: 1000,
    }).then(() => { settled = true; });

    await Promise.resolve();
    expect(settled).toBe(false);
    expect(instances.map((img) => img.currentSrc).sort()).toEqual([
      'blob:imagem-gerada',
      'https://cdn.exemplo/apoio.png',
    ]);

    instances.forEach((img) => img.onload());
    await pending;
    expect(settled).toBe(true);
  });

  it('também aguarda tags img ainda em carregamento', async () => {
    let loadListener;
    const domImage = {
      complete: false,
      addEventListener: vi.fn((type, callback) => {
        if (type === 'load') loadListener = callback;
      }),
      removeEventListener: vi.fn(),
    };
    const root = {
      querySelectorAll: vi.fn((selector) => selector === 'img' ? [domImage] : []),
    };

    const pending = waitForExportAssets([root], { ImageCtor: null, getStyle: null, timeoutMs: 1000 });
    expect(loadListener).toBeTypeOf('function');
    loadListener();
    await pending;
    expect(domImage.removeEventListener).toHaveBeenCalledWith('load', expect.any(Function));
  });

  it('aguarda URLs dos slides mesmo quando o background ainda não existe no DOM', async () => {
    const instances = [];
    class ManualImage {
      constructor() {
        this.complete = false;
        instances.push(this);
      }
      set src(value) { this.currentSrc = value; }
    }

    const pending = waitForExportAssets([], {
      imageUrls: ['blob:slide-a', '', 'blob:slide-a', 'https://cdn.exemplo/slide-b.webp'],
      ImageCtor: ManualImage,
      getStyle: null,
      timeoutMs: 1000,
    });

    await Promise.resolve();
    expect(instances.map((img) => img.currentSrc).sort()).toEqual([
      'blob:slide-a',
      'https://cdn.exemplo/slide-b.webp',
    ]);

    instances.forEach((img) => img.onload());
    await pending;
  });

  it('faz preload direto antes dos frames e repete a espera no DOM renderizado', async () => {
    const root = { querySelectorAll: vi.fn(() => []) };
    const steps = [];
    let finishDirectPreload;
    const waitForAssets = vi.fn((roots, options) => {
      if (roots.length === 0) {
        steps.push(['direto', options.imageUrls]);
        return new Promise((resolve) => { finishDirectPreload = resolve; });
      }
      steps.push(['dom', roots, options.imageUrls]);
      return Promise.resolve();
    });
    const waitForFrames = vi.fn(async () => { steps.push(['frames']); });

    const pending = waitForExportReadiness({
      slides: [
        { bgImage: 'blob:slide-principal' },
        { bgImage: 'blob:slide-principal' },
        { bgImage: null },
      ],
      roots: [null, root],
      fontsReady: null,
      waitForFrames,
      waitForAssets,
    });

    await Promise.resolve();
    expect(steps).toEqual([['direto', ['blob:slide-principal']]]);
    expect(waitForFrames).not.toHaveBeenCalled();

    finishDirectPreload();
    await pending;

    expect(steps).toEqual([
      ['direto', ['blob:slide-principal']],
      ['frames'],
      ['dom', [root], ['blob:slide-principal']],
    ]);
  });

  it('normaliza e deduplica somente URLs de imagem presentes nos slides', () => {
    expect(slideImageUrls([
      { bgImage: ' blob:a ' },
      { bgImage: 'blob:a' },
      { bgImage: '' },
      null,
      { bgImage: 'https://cdn.exemplo/b.jpg' },
    ])).toEqual(['blob:a', 'https://cdn.exemplo/b.jpg']);
  });
});
