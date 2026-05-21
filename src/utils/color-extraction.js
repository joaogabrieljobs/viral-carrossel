/** Extração de cor dominante de imagem via canvas — sem deps externas.
 *  Algoritmo: amostra ~1 em cada 2 pixels (downscale a 96px), filtra cinzas
 *  (saturação < 0.22) e extremos (luminância < 0.08 ou > 0.92), agrupa em
 *  12 buckets de matiz (30° cada), pega o bucket de maior peso (peso = soma
 *  saturação ponderada pela luminância média), devolve a média RGB.
 *  Async. Resolve `null` se a imagem não puder ser lida ou for muito uniforme. */
export async function extractDominantColor(imgSrc) {
  if (!imgSrc) return null;
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const MAX = 96;
        const scale = Math.min(1, MAX / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
        const w = Math.max(8, Math.round((img.naturalWidth || 1) * scale));
        const h = Math.max(8, Math.round((img.naturalHeight || 1) * scale));
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        const ctx = c.getContext('2d');
        if (!ctx) return resolve(null);
        ctx.drawImage(img, 0, 0, w, h);
        const data = ctx.getImageData(0, 0, w, h).data;
        const buckets = new Map();
        for (let i = 0; i < data.length; i += 4 * 2) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];
          if (a < 200) continue;
          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const l = (max + min) / 510;
          if (l < 0.08 || l > 0.92) continue; // descarta preto/branco puro
          const sat = max === min ? 0 : (max - min) / (l < 0.5 ? max + min : 510 - max - min);
          if (sat < 0.22) continue; // descarta cinzas
          let hue;
          if (max === min) hue = 0;
          else if (max === r) hue = ((g - b) / (max - min)) % 6;
          else if (max === g) hue = (b - r) / (max - min) + 2;
          else hue = (r - g) / (max - min) + 4;
          hue = (hue * 60 + 360) % 360;
          const bucket = Math.floor(hue / 30); // 12 buckets de 30°
          const entry = buckets.get(bucket) || { r: 0, g: 0, b: 0, n: 0, weight: 0 };
          const wPixel = sat * (l < 0.3 || l > 0.7 ? 0.7 : 1);
          entry.r += r * wPixel;
          entry.g += g * wPixel;
          entry.b += b * wPixel;
          entry.n += 1;
          entry.weight += wPixel;
          buckets.set(bucket, entry);
        }
        if (buckets.size === 0) return resolve(null);
        let best = null;
        let bestWeight = 0;
        for (const e of buckets.values()) {
          if (e.weight > bestWeight) {
            bestWeight = e.weight;
            best = e;
          }
        }
        if (!best || best.weight === 0) return resolve(null);
        const r = Math.round(best.r / best.weight);
        const g = Math.round(best.g / best.weight);
        const b = Math.round(best.b / best.weight);
        const hex =
          '#' +
          [r, g, b]
            .map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0'))
            .join('');
        resolve(hex);
      } catch (err) {
        console.warn('[extractDominantColor]', err.message);
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = imgSrc;
  });
}
