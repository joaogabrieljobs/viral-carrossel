import { describe, expect, it, vi } from 'vitest';
import { vcExportImageGeometry, vcFixHtml2CanvasImages, vcFixHtml2CanvasBackgroundImages } from '../../src/utils/export-helpers.js';

describe('enquadramento das imagens no PNG', () => {
  it('calcula cover e posição percentual no espaço restante, incluindo crop negativo', () => {
    expect(vcExportImageGeometry(4000, 2000, 1000, 1000, 'cover', '25% 75%'))
      .toEqual({ x: -250, y: 0, width: 2000, height: 1000 });
  });

  it('calcula contain sem esticar a proporção e posiciona a faixa vazia', () => {
    expect(vcExportImageGeometry(4000, 2000, 1000, 1000, 'contain', '50% 75%'))
      .toEqual({ x: 0, y: 375, width: 1000, height: 500 });
  });

  it('mantém background-size percentual customizado com altura auto', () => {
    expect(vcExportImageGeometry(4000, 2000, 1000, 1000, '150%', 'right bottom'))
      .toEqual({ x: -500, y: 250, width: 1500, height: 750 });
  });

  it('preserva fill, tamanhos px e object-fit none/scale-down', () => {
    expect(vcExportImageGeometry(4000, 2000, 1000, 1000, 'fill'))
      .toEqual({ x: 0, y: 0, width: 1000, height: 1000 });
    expect(vcExportImageGeometry(4000, 2000, 1000, 1000, '500px auto', '10px 20px'))
      .toEqual({ x: 10, y: 20, width: 500, height: 250 });
    expect(vcExportImageGeometry(200, 100, 1000, 1000, 'scale-down'))
      .toEqual({ x: 400, y: 450, width: 200, height: 100 });
    expect(vcExportImageGeometry(200, 100, 1000, 1000, 'none'))
      .toEqual({ x: 400, y: 450, width: 200, height: 100 });
  });

  it('deixa sintaxes não suportadas para o renderizador em vez de alterar o recorte', () => {
    expect(vcExportImageGeometry(100, 100, 0, 100)).toBeNull();
    expect(vcExportImageGeometry(100, 100, 200, 200, 'calc(100% - 20px) auto')).toBeNull();
    expect(vcExportImageGeometry(100, 100, 200, 200, 'cover', 'right 20px bottom 10px')).toBeNull();
  });
});

function environment(styles = {}) {
  const node = (tag, style = {}) => ({
    tagName: tag.toUpperCase(), style, children: [], textContent: '',
    setAttribute: vi.fn(), getAttribute: function (key) { return this[key]; },
    appendChild(child) { this.children.push(child); child.parentElement = this; },
  });
  const source = node('div', styles);
  const root = node('div');
  root.children = [source];
  root.querySelectorAll = vi.fn(selector => selector === 'img' ? [] : [source]);
  const Image = vi.fn(function () {
    this.naturalWidth = 4000; this.naturalHeight = 2000;
    Object.defineProperty(this, 'src', { set: () => queueMicrotask(() => this.onload?.()) });
  });
  const doc = { defaultView: { Image, getComputedStyle: item => item.style }, createElement: vi.fn(tag => node(tag)) };
  return { doc, root, source, node, Image };
}

describe('clone usa pixels originais, sem o resize CSS de html2canvas', () => {
  it('substitui background isolado por img explícita preservando posição, zoom e espelho', async () => {
    const { doc, root, source } = environment({
      backgroundImage: 'url("blob:original")', backgroundSize: 'cover', backgroundPosition: '25% 75%',
      backgroundRepeat: 'no-repeat', width: '1000px', height: '1000px', position: 'absolute',
      transform: 'matrix(-2, 0, 0, 2, 0, 0)', transformOrigin: '250px 750px', opacity: '0.75', borderRadius: '12px',
    });
    await vcFixHtml2CanvasBackgroundImages(doc, root);
    expect(source.style).toMatchObject({ backgroundImage: 'none', transform: 'matrix(-2, 0, 0, 2, 0, 0)',
      transformOrigin: '250px 750px', opacity: '0.75', borderRadius: '12px', overflow: 'hidden' });
    expect(source.children[0]).toMatchObject({ src: 'blob:original', style: {
      left: '-250px', top: '0px', width: '2000px', height: '1000px', objectFit: 'fill',
    } });
    expect(doc.createElement).toHaveBeenCalledExactlyOnceWith('img');
  });

  it.each([
    ['linear-gradient(#000, #fff)', 'no-repeat'],
    ['linear-gradient(#000, transparent), url("blob:original")', 'no-repeat'],
    ['url("blob:a"), url("blob:b")', 'no-repeat'],
    ['url("blob:pattern")', 'repeat'],
  ])('mantém intacto fundo composto/gradiente/textura %s', async (backgroundImage, backgroundRepeat) => {
    const { doc, root, source, Image } = environment({ backgroundImage, backgroundRepeat });
    await vcFixHtml2CanvasBackgroundImages(doc, root);
    expect(source.style.backgroundImage).toBe(backgroundImage);
    expect(source.children).toEqual([]);
    expect(Image).not.toHaveBeenCalled();
  });

  it('resolve object-fit da logo ou foto sem recomprimir, mantendo o transform do elemento', async () => {
    const { doc, root, node } = environment();
    const image = node('img', { width: '1000px', height: '1000px', objectFit: 'contain', objectPosition: '50% 75%',
      position: 'absolute', display: 'block', transform: 'matrix(-1, 0, 0, 1, 0, 0)', transformOrigin: '500px 750px' });
    image.src = 'blob:logo-original';
    const parent = { replaceChild: vi.fn() };
    image.parentElement = parent;
    root.querySelectorAll = () => [image];
    await vcFixHtml2CanvasImages(doc, root);
    const [wrapper, replaced] = parent.replaceChild.mock.calls[0];
    expect(replaced).toBe(image);
    expect(wrapper.style).toMatchObject({ transform: 'matrix(-1, 0, 0, 1, 0, 0)',
      transformOrigin: '500px 750px', overflow: 'hidden' });
    expect(wrapper.children[0]).toMatchObject({ src: 'blob:logo-original', style: {
      width: '1000px', height: '500px', top: '375px', left: '0px',
    } });
    expect(doc.createElement.mock.calls.map(([tag]) => tag)).toEqual(['div', 'img']);
  });
});
