// Spec 1.1 (PDF): o PDF da Apoteose saiu com 44 MB. Toda página ia como PNG
// e foto em PNG não comprime. Página com foto vai em JPEG de alta qualidade;
// página só de texto (mesmo com logo) continua PNG. O PNG por card não muda.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { jsPDF } from 'jspdf';
import { encode as encodePng } from 'fast-png';
import { PDF_PHOTO_JPEG_QUALITY, pdfPageImage, pdfPageImageFormat } from '../../src/hooks/useExport.js';

describe('formato de cada página do PDF', () => {
  it.each([
    ['foto carregada', { bgImage: 'blob:foto' }],
    ['foto guardada no aparelho', { bgImageId: 'img-1' }],
    ['foto guardada na conta', { bgImageAssetId: 'asset-1' }],
  ])('%s: JPEG de alta qualidade', (_nome, slide) => {
    expect(pdfPageImageFormat({ title: 'T', ...slide })).toEqual({ mime: 'image/jpeg', format: 'JPEG', quality: PDF_PHOTO_JPEG_QUALITY });
  });

  it.each([
    ['só texto', { title: 'T', subtitle: 'S' }],
    ['só texto com logo', { title: 'T', logoImage: 'data:image/png;base64,AA', logoImageId: 'logo-1' }],
    ['foto que falhou ao carregar', { bgImage: 'blob:foto', bgImageFailed: true }],
    ['foto suprimida pela composição', { bgImage: 'blob:foto', presentationSuppressPhoto: true }],
    ['slide vazio', {}],
  ])('%s: PNG', (_nome, slide) => {
    expect(pdfPageImageFormat(slide)).toEqual({ mime: 'image/png', format: 'PNG' });
  });

  it('a qualidade do JPEG é a medida nos recortes (0,92: a menor sem borrado em título, texto, logo e CTA)', () => {
    expect(PDF_PHOTO_JPEG_QUALITY).toBe(0.92);
  });

  it('a página é codificada no formato que pede', () => {
    const pedidos = [];
    const canvas = { toDataURL: (mime, quality) => { pedidos.push([mime, quality]); return 'data:x'; } };
    expect(pdfPageImage(canvas, { bgImage: 'blob:foto' }).format).toBe('JPEG');
    expect(pdfPageImage(canvas, { title: 'Só texto' }).format).toBe('PNG');
    expect(pedidos).toEqual([['image/jpeg', PDF_PHOTO_JPEG_QUALITY], ['image/png', undefined]]);
  });
});

// ---------------------------------------------------------------------------
// Tamanho do PDF de um deck como a Apoteose: 10 páginas, 9 com foto.
//
// Sem navegador não há canvas; as páginas são pixels sintéticos com textura de
// foto (gradiente, manchas e granulação) e uma faixa de texto. O PNG sai do
// mesmo codificador que o jsPDF usa (fast-png); o JPEG, do codificador do
// próprio jsPDF na qualidade escolhida. Páginas a 960 × 540 (1/30 da área do
// arquivo real de 5318 × 2991) para o teste caber em segundos.
// ---------------------------------------------------------------------------
const W = 960;
const H = 540;

function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

function pagina({ foto, seed }) {
  const r = rng(seed);
  const data = new Uint8ClampedArray(W * H * 4);
  const blobs = Array.from({ length: 6 }, () => [r() * W, r() * H, 60 + r() * 160, r() * 255, r() * 255, r() * 255]);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    let c;
    if (foto) {
      c = [40 + 180 * x / W, 30 + 120 * y / H, 90 + 80 * (1 - x / W)];
      for (const [bx, by, br, R, G, B] of blobs) {
        const d = Math.hypot(x - bx, y - by) / br;
        if (d < 1) { const t = (1 - d) * 0.7; c = [c[0] * (1 - t) + R * t, c[1] * (1 - t) + G * t, c[2] * (1 - t) + B * t]; }
      }
      const g = (r() + r() + r() - 1.5) * 20; // granulação de sensor
      c = c.map((v) => v + g);
    } else c = [11, 11, 12];
    // Faixa de texto: blocos claros sobre a página, como linhas de título e apoio.
    if (x > 80 && x < 520 && ((y > 90 && y < 130) || (y > 150 && y < 190) || (y > 260 && y < 272 && x % 9 < 6))) c = [242, 239, 233];
    data[i] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2]; data[i + 3] = 255;
  }
  return data;
}

/**
 * Codificador JPEG do próprio jsPDF (tabelas de quantização do IJG, as mesmas
 * da libjpeg do navegador, sem subamostragem de cor: arquivo maior que o do
 * Chrome na mesma qualidade). O jsPDF não o exporta; o teste o lê do pacote.
 */
const JPEGEncoder = (() => {
  const fonte = readFileSync(createRequire(import.meta.url).resolve('jspdf/dist/jspdf.node.js'), 'utf8');
  const ini = fonte.indexOf('function JPEGEncoder(quality) {');
  const fim = fonte.indexOf('\n}\n', ini) + 2;
  return new Function(`${fonte.slice(ini, fim)}; return JPEGEncoder;`)();
})();

const base64 = (bytes) => Buffer.from(bytes).toString('base64');

/** Canvas de teste: devolve a página nos bytes que o formato pedido teria. */
function canvasDe(rgba) {
  return {
    toDataURL(mime, quality) {
      if (mime === 'image/jpeg') {
        const q = Math.round(quality * 100);
        return `data:image/jpeg;base64,${base64(new JPEGEncoder(q).encode({ data: rgba, width: W, height: H }, q))}`;
      }
      return `data:image/png;base64,${Buffer.from(encodePng({ width: W, height: H, data: rgba, channels: 4 })).toString('base64')}`;
    },
  };
}

/** `comoAntes`: toda página em PNG, como o export fazia até 25/11. */
function pdfDoDeck(slides, { comoAntes = false } = {}) {
  const pdf = new jsPDF({ unit: 'px', format: [1920, 1080], orientation: 'landscape', compress: true });
  slides.forEach((slide, i) => {
    const canvas = canvasDe(pagina({ foto: !!slide.bgImage, seed: i + 1 }));
    const page = comoAntes ? { dataUrl: canvas.toDataURL('image/png'), format: 'PNG' } : pdfPageImage(canvas, slide);
    if (i > 0) pdf.addPage([1920, 1080], 'landscape');
    pdf.addImage(page.dataUrl, page.format, 0, 0, 1920, 1080);
  });
  return pdf.output('arraybuffer').byteLength;
}

describe('tamanho do PDF de um deck com fotos', () => {
  it('Apoteose (9 de 10 páginas com foto) fica abaixo de 40% do PDF todo em PNG', () => {
    const deck = Array.from({ length: 10 }, (_, i) => (i === 8 ? { title: 'Página de dados' } : { title: `Slide ${i + 1}`, bgImage: `blob:foto-${i}` }));
    const antes = pdfDoDeck(deck, { comoAntes: true });
    const depois = pdfDoDeck(deck);
    // Teto de 40%: o codificador do jsPDF não subamostra a cor, então gera
    // JPEG maior que o do Chrome na mesma qualidade; no navegador a Apoteose
    // cai bem mais (medido em qa-harness-local/pdf). Acima de 40% a troca não
    // estaria resolvendo o PDF de 44 MB.
    expect(depois / antes, `${(depois / 1048576).toFixed(2)} MB de ${(antes / 1048576).toFixed(2)} MB`).toBeLessThan(0.4);
    // E a página sem foto continua idêntica ao que era (PNG).
    expect(pdfDoDeck([deck[8]])).toBe(pdfDoDeck([deck[8]], { comoAntes: true }));
  }, 60_000);
});
