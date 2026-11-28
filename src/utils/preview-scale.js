/**
 * Como o card é reduzido na tela.
 *
 * `zoom` (Chromium/WebKit) mantém logos e PNG nítidos na miniatura; `transform:
 * scale` reamostra bitmaps. Mas no iPhone e no iPad (Safari e Chrome, ambos
 * WebKit do iOS) o `zoom` faz o iOS aumentar sozinho a letra do texto corrido:
 * o subtítulo e a tabela apareciam maiores e cortados, diferentes do arquivo, e
 * a célula da tabela crescia de novo ao entrar em edição (28/11, Apoteose 10).
 * Lá o card usa `transform`, que mantém o tamanho do arquivo.
 */
export function isAppleTouchDevice({ userAgent = '', maxTouchPoints = 0 } = {}) {
  if (/iPhone|iPad|iPod/.test(userAgent)) return true;
  // iPad em modo computador se apresenta como Mac, mas tem toque.
  return /Macintosh/.test(userAgent) && maxTouchPoints > 1;
}

export function previewScaleUsesZoom({ supportsZoom, userAgent, maxTouchPoints }) {
  if (!supportsZoom) return false;
  return !isAppleTouchDevice({ userAgent, maxTouchPoints });
}

/** Leitura do navegador atual (fora do navegador: sem zoom). */
export function currentPreviewScaleUsesZoom() {
  const supportsZoom = typeof CSS !== 'undefined'
    && typeof CSS.supports === 'function'
    && CSS.supports('zoom', '1');
  const nav = typeof navigator !== 'undefined' ? navigator : {};
  return previewScaleUsesZoom({ supportsZoom, userAgent: nav.userAgent || '', maxTouchPoints: nav.maxTouchPoints || 0 });
}
