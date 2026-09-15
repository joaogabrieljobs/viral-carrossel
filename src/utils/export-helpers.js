import { canvasToPngBlob } from './image-storage.js';
// Extraído de ViralCarrossel.jsx pelo extrator AST (scripts/extract-module.mjs).

/**
 * html2canvas 1.4.x rasteriza mal `<img>` com `object-fit` + `transform` (sanduíche Cultura) — faixa achatada/larga.
 * Substituir por `div` com `background-*` replica o enquadramento sem distorcer no PNG/PDF.
 */
function vcFixHtml2CanvasImages(clonedDoc, clonedSlideRoot) {
  if (!clonedSlideRoot?.querySelectorAll) return;
  const view = clonedDoc.defaultView;
  if (!view?.getComputedStyle) return;
  const list = Array.from(clonedSlideRoot.querySelectorAll('img'));
  list.forEach((img) => {
    const src = img.getAttribute('src');
    if (!src) return;
    const parent = img.parentElement;
    if (!parent) return;

    const computed = view.getComputedStyle(img);
    const fit = (computed.objectFit || 'fill').trim();
    const pos = computed.objectPosition || '50% 50%';
    let bgSize = '100% 100%';
    if (fit === 'cover') bgSize = 'cover';
    else if (fit === 'contain') bgSize = 'contain';

    const stub = clonedDoc.createElement('div');
    stub.setAttribute('data-vc-html2canvas-img', '');
    const cssUrl = `url("${src.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}")`;
    stub.style.position = computed.position === 'static' ? 'absolute' : computed.position;
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
    stub.style.display = 'block';
    stub.style.transform = 'none';
    stub.style.filter = computed.filter;
    stub.style.opacity = computed.opacity;
    stub.style.borderRadius = computed.borderRadius;
    stub.style.pointerEvents = 'none';
    stub.style.backgroundImage = cssUrl;
    stub.style.backgroundRepeat = 'no-repeat';
    stub.style.backgroundSize = bgSize;
    stub.style.backgroundPosition = pos;

    parent.replaceChild(stub, img);
  });
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

function vcPrepareHtml2CanvasClone(clonedDoc, clonedSlideRoot) {
  vcFixHtml2CanvasImages(clonedDoc, clonedSlideRoot);
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
