import { canvasToPngBlob } from './image-storage.js';
// Extraído de ViralCarrossel.jsx pelo extrator AST (scripts/extract-module.mjs).

/** Geometria explícita: html2canvas ignora object-fit e reduz backgrounds antes do scale. */
export function vcExportImageGeometry(imageWidth, imageHeight, boxWidth, boxHeight, size = 'cover', position = '50% 50%') {
  if (![imageWidth, imageHeight, boxWidth, boxHeight].every(value => Number.isFinite(value) && value > 0)) return null;
  const length = (value, total) => /^-?[\d.]+%$/.test(value) ? parseFloat(value) * total / 100
    : /^-?[\d.]+(?:px)?$/.test(value) ? parseFloat(value) : null;
  let width;
  let height;
  if (size === 'cover' || size === 'contain' || size === 'scale-down') {
    const fit = size === 'cover' ? Math.max(boxWidth / imageWidth, boxHeight / imageHeight)
      : Math.min(boxWidth / imageWidth, boxHeight / imageHeight, size === 'scale-down' ? 1 : Infinity);
    width = imageWidth * fit; height = imageHeight * fit;
  } else {
    const parts = (size === 'fill' ? '100% 100%' : size === 'none' ? 'auto auto' : size).trim().split(/\s+/);
    if (parts.length > 2) return null;
    const [horizontal = 'auto', vertical = 'auto'] = parts;
    width = horizontal === 'auto' ? null : length(horizontal, boxWidth);
    height = vertical === 'auto' ? null : length(vertical, boxHeight);
    if ((horizontal !== 'auto' && width == null) || (vertical !== 'auto' && height == null)) return null;
    if (width == null && height == null) { width = imageWidth; height = imageHeight; }
    else if (width == null) width = height * imageWidth / imageHeight;
    else if (height == null) height = width * imageHeight / imageWidth;
  }
  const positions = position.trim().split(/\s+/);
  if (positions.length > 2) return null;
  let [horizontal, vertical = '50%'] = positions;
  if (positions.length === 1 && ['top', 'bottom'].includes(horizontal)) [horizontal, vertical] = ['50%', horizontal];
  const keywords = { left: '0%', top: '0%', center: '50%', right: '100%', bottom: '100%' };
  const x = length(keywords[horizontal] || horizontal, boxWidth - width);
  const y = length(keywords[vertical] || vertical, boxHeight - height);
  return width > 0 && height > 0 && x != null && y != null ? { x, y, width, height } : null;
}

function exportImageSource(clonedDoc, src) {
  return new Promise((resolve, reject) => {
    const image = new clonedDoc.defaultView.Image();
    const timer = setTimeout(() => finish(new Error('A imagem não carregou a tempo para exportar.')), 15000);
    const finish = (error) => {
      clearTimeout(timer);
      image.onload = null; image.onerror = null;
      if (error) reject(error); else resolve(image);
    };
    image.onload = () => finish();
    image.onerror = () => finish(new Error('Não foi possível carregar a imagem para exportar.'));
    if (/^https?:/i.test(src)) image.crossOrigin = 'anonymous';
    image.src = src;
    if (image.complete && image.naturalWidth) finish();
  });
}

function positionedExportImage(clonedDoc, src, geometry) {
  const image = clonedDoc.createElement('img');
  image.src = src;
  Object.assign(image.style, {
    position: 'absolute', left: `${geometry.x}px`, top: `${geometry.y}px`,
    width: `${geometry.width}px`, height: `${geometry.height}px`, maxWidth: 'none', maxHeight: 'none',
    margin: '0', padding: '0', border: '0', display: 'block', objectFit: 'fill', pointerEvents: 'none',
  });
  return image;
}

/** Resolve object-fit no clone sem converter logos/fotos em um background de baixa resolução. */
async function vcFixHtml2CanvasImages(clonedDoc, clonedSlideRoot) {
  if (!clonedSlideRoot?.querySelectorAll) return;
  const view = clonedDoc.defaultView;
  if (!view?.getComputedStyle) return;
  const list = Array.from(clonedSlideRoot.querySelectorAll('img'));
  await Promise.all(list.map(async (img) => {
    const src = img.getAttribute('src');
    if (!src) return;
    const parent = img.parentElement;
    if (!parent) return;

    const computed = view.getComputedStyle(img);
    const source = await exportImageSource(clonedDoc, src);
    const geometry = vcExportImageGeometry(source.naturalWidth, source.naturalHeight,
      parseFloat(computed.width), parseFloat(computed.height),
      (computed.objectFit || 'fill').trim(), computed.objectPosition || '50% 50%');
    if (!geometry) return;

    const stub = clonedDoc.createElement('div');
    stub.setAttribute('data-vc-html2canvas-img', '');
    stub.style.position = computed.position === 'static' ? 'relative' : computed.position;
    stub.style.top = computed.top;
    stub.style.left = computed.left;
    stub.style.right = computed.right;
    stub.style.bottom = computed.bottom;
    stub.style.width = computed.width;
    stub.style.height = computed.height;
    stub.style.margin = computed.margin;
    stub.style.padding = computed.padding;
    stub.style.border = computed.border;
    stub.style.boxSizing = computed.boxSizing || 'border-box';
    stub.style.display = computed.display === 'inline' ? 'inline-block' : computed.display;
    stub.style.verticalAlign = computed.verticalAlign;
    stub.style.zIndex = computed.zIndex;
    stub.style.transform = computed.transform;
    stub.style.transformOrigin = computed.transformOrigin;
    stub.style.filter = computed.filter;
    stub.style.opacity = computed.opacity;
    stub.style.borderRadius = computed.borderRadius;
    stub.style.pointerEvents = 'none';
    stub.style.overflow = 'hidden';
    stub.appendChild(positionedExportImage(clonedDoc, src, geometry));
    parent.replaceChild(stub, img);
  }));
}

/**
 * html2canvas 1.4.x faz resize do background para pixels CSS antes de ampliar
 * o resultado. Camadas de foto isoladas viram img com crop explícito: o bitmap
 * original só é reamostrado ao desenhar no canvas final (3×).
 * Gradientes, texturas repetidas e backgrounds compostos seguem intactos.
 */
async function vcFixHtml2CanvasBackgroundImages(clonedDoc, clonedSlideRoot) {
  const view = clonedDoc.defaultView;
  if (!view?.getComputedStyle || !clonedSlideRoot?.querySelectorAll) return;
  await Promise.all([clonedSlideRoot, ...clonedSlideRoot.querySelectorAll('*')].map(async (node) => {
    if (node.tagName === 'IMG' || node.children.length || node.textContent?.trim()) return;
    const computed = view.getComputedStyle(node);
    const match = String(computed.backgroundImage || '').match(/^url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*?))\s*\)$/);
    if (!match || computed.backgroundRepeat !== 'no-repeat') return;
    // As camadas de foto do renderer não têm borda nem padding. Outros fundos
    // usam a semântica nativa para não alterar background-origin/clip.
    if (['borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
      'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'].some(key => parseFloat(computed[key]) > 0)) return;
    const src = match[1] ?? match[2] ?? match[3];
    const source = await exportImageSource(clonedDoc, src);
    const geometry = vcExportImageGeometry(source.naturalWidth, source.naturalHeight,
      parseFloat(computed.width), parseFloat(computed.height), computed.backgroundSize, computed.backgroundPosition);
    if (!geometry) return;
    if (computed.position === 'static') node.style.position = 'relative';
    node.style.backgroundImage = 'none';
    node.style.overflow = 'hidden';
    node.setAttribute('data-vc-html2canvas-photo', '');
    node.appendChild(positionedExportImage(clonedDoc, src, geometry));
  }));
}

/**
 * html2canvas corta letras com `backdrop-filter`, `overflow:hidden` apertado e
 * `position:relative; top` (overshoot). No clone de export: remove blur, abre
 * overflow nas zonas de texto e troca o shift por padding real.
 */
function vcFixHtml2CanvasTextClip(clonedDoc, clonedSlideRoot) {
  if (!clonedSlideRoot?.querySelectorAll) return;
  const view = clonedDoc.defaultView;
  if (!view?.getComputedStyle) return;

  const all = Array.from(clonedSlideRoot.querySelectorAll('*'));
  all.forEach((el) => {
    const cs = view.getComputedStyle(el);
    const bf = cs.backdropFilter || cs.webkitBackdropFilter || '';
    if (bf && bf !== 'none') {
      el.style.backdropFilter = 'none';
      el.style.webkitBackdropFilter = 'none';
    }
  });

  // Zonas de texto (flex absoluto a cobrir o card): não clipar no PNG.
  all.forEach((el) => {
    const cs = view.getComputedStyle(el);
    if (cs.position !== 'absolute') return;
    if (cs.display !== 'flex' && cs.display !== 'inline-flex') return;
    if (cs.flexDirection !== 'column') return;
    // inset ~0 → zona de texto do slide
    const top = parseFloat(cs.top);
    const left = parseFloat(cs.left);
    if (!Number.isFinite(top) || !Number.isFinite(left)) return;
    if (Math.abs(top) > 2 || Math.abs(left) > 2) return;
    el.style.overflow = 'visible';
  });

  clonedSlideRoot.querySelectorAll('h1').forEach((h1) => {
    const cs = view.getComputedStyle(h1);
    const fs = parseFloat(cs.fontSize) || 48;
    const existing = parseFloat(cs.paddingTop) || 0;
    const pad = Math.max(existing, Math.round(fs * 0.14), 8);
    // Anula o `top` de overshoot (html2canvas mede mal) e garante padding de layout.
    h1.style.top = '0';
    h1.style.position = 'relative';
    h1.style.paddingTop = `${pad}px`;
    h1.style.paddingBottom = `${Math.max(parseFloat(cs.paddingBottom) || 0, Math.round(pad * 0.4))}px`;
    h1.style.overflow = 'visible';
    h1.style.lineHeight = cs.lineHeight;
  });

  // Caixas com fundo de texto: um pouco mais de padding vertical no export.
  all.forEach((el) => {
    const cs = view.getComputedStyle(el);
    if (cs.display !== 'inline-flex' && cs.display !== 'flex') return;
    const bg = cs.backgroundColor || '';
    if (!/rgba?\(/i.test(bg)) return;
    // Só caixas semi-transparentes escuras (placa de texto)
    const m = bg.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
    if (!m) return;
    const r = Number(m[1]);
    const g = Number(m[2]);
    const b = Number(m[3]);
    if (r + g + b > 80) return;
    const pt = parseFloat(cs.paddingTop) || 0;
    const pb = parseFloat(cs.paddingBottom) || 0;
    // Folga extra no PNG: display fonts + line-height apertado.
    el.style.paddingTop = `${Math.max(pt + 6, 16)}px`;
    el.style.paddingBottom = `${Math.max(pb + 6, 16)}px`;
    el.style.overflow = 'visible';
  });
}

async function vcPrepareHtml2CanvasClone(clonedDoc, clonedSlideRoot) {
  await vcFixHtml2CanvasImages(clonedDoc, clonedSlideRoot);
  await vcFixHtml2CanvasBackgroundImages(clonedDoc, clonedSlideRoot);
  vcFixHtml2CanvasTextClip(clonedDoc, clonedSlideRoot);
}

/** Telemóveis / Safari: após awaits o gesto já não abre âncoras — Web Share API (ficheiro) costuma funcionar. */
function vcPreferFileShareForDownloads() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (/iPhone|iPad|iPod|Android/i.test(ua)) return true;
  try {
    if ((navigator.maxTouchPoints ?? 0) > 0 && window.matchMedia('(max-width: 768px)').matches)
      return true;
  } catch { /* ignore */ }
  return false;
}

/** Descarga um Blob; em mobile tenta primeiro partilhar ficheiro, depois `<a download>`. */
async function downloadBlob(blob, filename) {
  const mime = blob.type || 'application/octet-stream';
  const tryShare =
    vcPreferFileShareForDownloads() &&
    typeof navigator.share === 'function' &&
    typeof File !== 'undefined' &&
    typeof navigator.canShare === 'function';

  if (tryShare) {
    try {
      const file = new File([blob], filename, { type: mime });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: filename });
        return;
      }
    } catch (e) {
      if (e?.name === 'AbortError') return;
      /* continua para âncora */
    }
  }

  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
}

export {
  vcFixHtml2CanvasImages,
  vcFixHtml2CanvasBackgroundImages,
  vcFixHtml2CanvasTextClip,
  vcPrepareHtml2CanvasClone,
  vcPreferFileShareForDownloads,
  downloadBlob,
};

/** canvas → PNG baixado (usa canvasToPngBlob + downloadBlob). */
export async function downloadCanvasPng(canvas, filename) {
  const blob = await canvasToPngBlob(canvas);
  await downloadBlob(blob, filename);
}
