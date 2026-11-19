// html2canvas não implementa filter: https://html2canvas.hertzen.com/features/
// Matrizes: https://www.w3.org/TR/filter-effects-1/#FilterPrimitiveRepresentation
const clamp = n => Math.max(0, Math.min(255, n));

export function parseExportPhotoFilter(value) {
  const input = String(value || '').trim();
  if (!input || input === 'none') return null;
  const re = /(grayscale|sepia|saturate|contrast|brightness|hue-rotate)\(\s*(-?(?:\d+\.?\d*|\.\d+))(deg|rad|turn|%)?\s*\)/g;
  const matches = [...input.matchAll(re)];
  if (!matches.length || input.replace(re, '').trim()) return null;
  const steps = matches.map(([, type, raw, unit]) => {
    let amount = Number(raw);
    if (type === 'hue-rotate') amount *= unit === 'rad' ? 1 : unit === 'turn' ? 2 * Math.PI : Math.PI / 180;
    else if (unit === '%') amount /= 100;
    else if (unit) return null;
    if (type !== 'hue-rotate' && amount < 0) return null;
    if (['grayscale', 'sepia'].includes(type)) amount = Math.min(1, amount);
    return { type, amount };
  });
  return steps.every(Boolean) ? steps : null;
}

/** Fallback para webviews sem Canvas2D.filter. Preserva alfa e ordem CSS. */
export function applyExportPhotoFilterPixels(data, steps) {
  for (const { type, amount: a } of steps) {
    const cos = Math.cos(a), sin = Math.sin(a);
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      let rgb;
      if (type === 'brightness') rgb = [r * a, g * a, b * a];
      else if (type === 'contrast') rgb = [r, g, b].map(v => (v - 127.5) * a + 127.5);
      else if (type === 'grayscale' || type === 'saturate') {
        const gray = r * .2126 + g * .7152 + b * .0722;
        const saturation = type === 'grayscale' ? 1 - a : a;
        rgb = [r, g, b].map(v => gray + (v - gray) * saturation);
      } else if (type === 'sepia') rgb = [
        r * (1 - .607 * a) + g * .769 * a + b * .189 * a,
        r * .349 * a + g * (1 - .314 * a) + b * .168 * a,
        r * .272 * a + g * .534 * a + b * (1 - .869 * a),
      ];
      else rgb = [
        r * (.213 + .787 * cos - .213 * sin) + g * (.715 - .715 * cos - .715 * sin) + b * (.072 - .072 * cos + .928 * sin),
        r * (.213 - .213 * cos + .143 * sin) + g * (.715 + .285 * cos + .140 * sin) + b * (.072 - .072 * cos - .283 * sin),
        r * (.213 - .213 * cos - .787 * sin) + g * (.715 - .715 * cos + .715 * sin) + b * (.072 + .928 * cos + .072 * sin),
      ];
      data[i] = clamp(rgb[0]); data[i + 1] = clamp(rgb[1]); data[i + 2] = clamp(rgb[2]);
    }
  }
}

/** Usa pixels nativos da imagem, somente no clone de exportação. */
export function exportFilteredPhotoSource(doc, source, filter) {
  const steps = parseExportPhotoFilter(filter);
  if (!steps) return null;
  const canvas = doc.createElement('canvas');
  canvas.width = source.naturalWidth; canvas.height = source.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Não foi possível preparar o tratamento da foto para exportar.');
  try {
    if ('filter' in ctx) { ctx.filter = filter; ctx.drawImage(source, 0, 0); }
    else {
      ctx.drawImage(source, 0, 0);
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
      applyExportPhotoFilterPixels(pixels.data, steps);
      ctx.putImageData(pixels, 0, 0);
    }
    return canvas.toDataURL('image/png');
  } catch { throw new Error('Não foi possível preservar o tratamento da foto no arquivo. Verifique o acesso à imagem e tente novamente.'); }
}
