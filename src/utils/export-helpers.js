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
  vcPreferFileShareForDownloads,
  downloadBlob,
};
