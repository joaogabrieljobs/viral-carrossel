/**
 * Paleta da imagem de referência do kit, extraída pelo código (Teste 6, item 1).
 *
 * A IA do roteiro (texto) não vê a referência. No Teste 6 da Apoteose ela
 * inventou #1A0B2E / #F5C842 / #E94560 em vez das cores do flyer (índigo
 * escuro, laranja/âmbar, magenta, ciano, verde ácido). Aqui as cores saem da
 * própria imagem, no navegador, sem IA e sem rede:
 *
 * 1. amostragem em grade (determinística), sem pixels transparentes nem as
 *    áreas quase brancas de texto e logo;
 * 2. histograma em 4 bits por canal, convertido para Lab;
 * 3. k-means em Lab com início determinístico (o mais frequente primeiro e
 *    depois o mais distante, ponderado pela frequência);
 * 4. tons próximos agrupados (ΔE < 14) e cores com menos de 1% descartadas,
 *    menos um acento pequeno, saturado e distinto (o verde dos pontos);
 * 5. até 6 cores distintas, cada uma com o seu peso (fração dos pixels
 *    considerados).
 *
 * O roteiro recebe a lista como "cores da referência" obrigatórias; a IA só
 * distribui os papéis e o código troca qualquer hex fora dela pelo mais
 * próximo (snapToPalette). A paleta fica no kit do projeto, presa às
 * referências de onde saiu, para refazer uma imagem depois.
 */

export const REFERENCE_PALETTE_MAX = 6;
export const REFERENCE_PALETTE_MIN_WEIGHT = 0.01;
/** Acento pequeno que ainda conta: 0,3% da imagem, saturado e distinto. */
const REFERENCE_ACCENT_MIN_WEIGHT = 0.003;
const REFERENCE_ACCENT_CHROMA = 45;
const REFERENCE_ACCENT_DELTA_E = 30;
const REFERENCE_TONE_DELTA_E = 20;
const MAX_SAMPLES = 16000;
const CLUSTERS = 12;
const ITERATIONS = 12;
const MERGE_DELTA_E = 14;
/** Lado máximo da miniatura desenhada no canvas do navegador. */
export const REFERENCE_PALETTE_THUMB = 128;

const HEX6 = /^#[0-9A-F]{6}$/;
const toHex = ([r, g, b]) => `#${[r, g, b].map(c => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
const fromHex = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));

/* sRGB → Lab (D65) --------------------------------------------------------- */
const lin = c => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const f = t => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
export function rgbToLab([r, g, b]) {
  const R = lin(r); const G = lin(g); const B = lin(b);
  const x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  const y = R * 0.2126 + G * 0.7152 + B * 0.0722;
  const z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const fx = f(x); const fy = f(y); const fz = f(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
const d2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
/** Distância perceptual (ΔE76) entre dois hex. */
export function hexDeltaE(a, b) { return Math.sqrt(d2(rgbToLab(fromHex(a)), rgbToLab(fromHex(b)))); }

/** Quase branco: texto e logo do flyer, que não são a paleta. */
function nearWhite(r, g, b) {
  const max = Math.max(r, g, b); const min = Math.min(r, g, b);
  return min >= 190 && max - min <= 48;
}

/**
 * Cores dominantes de um buffer RGBA (ImageData.data). Pura e determinística.
 * @returns {{hex:string, weight:number}[]} até `max` cores, da mais pesada à mais leve.
 */
export function extractPaletteFromPixels(data, { width, height, max = REFERENCE_PALETTE_MAX } = {}) {
  const w = Number(width) || 0; const h = Number(height) || 0;
  if (!data || w < 1 || h < 1 || data.length < w * h * 4) return [];
  const step = Math.max(1, Math.ceil(Math.sqrt((w * h) / MAX_SAMPLES)));
  // Histograma em 4 bits por canal: soma de RGB e contagem por caixa.
  const bins = new Map();
  let total = 0;
  for (let y = Math.floor(step / 2); y < h; y += step) {
    for (let x = Math.floor(step / 2); x < w; x += step) {
      const i = (y * w + x) * 4;
      const r = data[i]; const g = data[i + 1]; const b = data[i + 2];
      if (data[i + 3] < 128 || nearWhite(r, g, b)) continue;
      const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
      const bin = bins.get(key) || { key, r: 0, g: 0, b: 0, n: 0 };
      bin.r += r; bin.g += g; bin.b += b; bin.n += 1;
      bins.set(key, bin);
      total += 1;
    }
  }
  if (!total) return [];
  const points = [...bins.values()].sort((a, b) => a.key - b.key).map(bin => {
    const rgb = [bin.r / bin.n, bin.g / bin.n, bin.b / bin.n];
    return { rgb, lab: rgbToLab(rgb), n: bin.n };
  });
  // Início determinístico: a caixa mais cheia, depois a mais distante das
  // escolhidas, ponderada pela raiz da frequência (acentos pequenos e
  // saturados, como o verde do flyer, ganham um centro próprio).
  const k = Math.min(CLUSTERS, points.length);
  const centers = [points.reduce((best, p) => (p.n > best.n ? p : best), points[0]).lab.slice()];
  while (centers.length < k) {
    let best = null; let bestScore = -1;
    for (const p of points) {
      const near = Math.min(...centers.map(c => d2(c, p.lab)));
      const score = near * Math.sqrt(p.n);
      if (score > bestScore) { bestScore = score; best = p; }
    }
    if (!best || bestScore <= 0) break;
    centers.push(best.lab.slice());
  }
  let assign = new Array(points.length).fill(0);
  for (let it = 0; it < ITERATIONS; it += 1) {
    assign = points.map(p => centers.reduce((bi, c, ci) => (d2(c, p.lab) < d2(centers[bi], p.lab) ? ci : bi), 0));
    const sums = centers.map(() => [0, 0, 0, 0]);
    points.forEach((p, i) => { const s = sums[assign[i]]; s[0] += p.lab[0] * p.n; s[1] += p.lab[1] * p.n; s[2] += p.lab[2] * p.n; s[3] += p.n; });
    sums.forEach((s, ci) => { if (s[3]) centers[ci] = [s[0] / s[3], s[1] / s[3], s[2] / s[3]]; });
  }
  // Grupos com a cor média em RGB (o hex é uma cor que existe na imagem).
  let groups = centers.map(() => ({ r: 0, g: 0, b: 0, n: 0 }));
  points.forEach((p, i) => { const g = groups[assign[i]]; g.r += p.rgb[0] * p.n; g.g += p.rgb[1] * p.n; g.b += p.rgb[2] * p.n; g.n += p.n; });
  groups = groups.filter(g => g.n).map(g => ({ rgb: [g.r / g.n, g.g / g.n, g.b / g.n], n: g.n }));
  // Tons próximos viram um só (o mais pesado absorve o mais leve).
  groups.sort((a, b) => b.n - a.n);
  const merged = [];
  for (const g of groups) {
    const lab = rgbToLab(g.rgb);
    const host = merged.find(m => d2(rgbToLab(m.rgb), lab) < MERGE_DELTA_E ** 2);
    if (host) {
      const n = host.n + g.n;
      host.rgb = host.rgb.map((c, i) => (c * host.n + g.rgb[i] * g.n) / n);
      host.n = n;
    } else merged.push({ ...g, rgb: g.rgb.slice() });
  }
  const limit = Math.max(1, Math.min(REFERENCE_PALETTE_MAX, Number(max) || REFERENCE_PALETTE_MAX));
  const candidates = merged
    .map(g => ({ hex: toHex(g.rgb), lab: rgbToLab(g.rgb), weight: Math.round((g.n / total) * 1000) / 1000 }))
    .filter(c => c.weight >= REFERENCE_ACCENT_MIN_WEIGHT)
    .sort((a, b) => b.weight - a.weight || a.hex.localeCompare(b.hex));
  return selectDistinct(candidates, limit).map(({ hex, weight }) => ({ hex, weight }));
}

const chroma = lab => Math.hypot(lab[1], lab[2]);
const deltaE = (a, b) => Math.sqrt(d2(a.lab, b.lab));
/**
 * Escolha das cores: pela ordem de peso, pulando variações de tom de uma cor
 * já escolhida (ΔE < 20). Um único acento pequeno, saturado e distinto de tudo (o
 * verde ácido dos pontos do flyer, < 1% da imagem) entra no lugar da cor
 * escolhida mais redundante, para não sumir só por ser pequeno.
 */
function selectDistinct(candidates, limit) {
  const main = candidates.filter(c => c.weight >= REFERENCE_PALETTE_MIN_WEIGHT);
  const picked = [];
  for (const c of main) {
    if (picked.length >= limit) break;
    if (picked.every(p => deltaE(p, c) >= REFERENCE_TONE_DELTA_E)) picked.push(c);
  }
  for (const c of main) if (picked.length < limit && !picked.includes(c)) picked.push(c);
  const accents = candidates.filter(c => !picked.includes(c) && chroma(c.lab) >= REFERENCE_ACCENT_CHROMA
    && picked.every(p => deltaE(p, c) >= REFERENCE_ACCENT_DELTA_E));
  // Um acento só (o mais pesado), para não trocar as cores principais.
  const accent = accents[0];
  if (accent && picked.length < limit) picked.push(accent);
  else if (accent) {
    // A mais redundante: menor distância média às duas escolhidas mais
    // próximas (a cor que fica entre duas outras); empate, a mais leve.
    const redundancy = (p) => {
      const near = picked.filter(q => q !== p).map(q => deltaE(p, q)).sort((a, b) => a - b).slice(0, 2);
      return near.reduce((sum, v) => sum + v, 0) / near.length;
    };
    const drop = picked.slice(1).reduce((worst, p) => (redundancy(p) < redundancy(worst)
      || (redundancy(p) === redundancy(worst) && p.weight < worst.weight) ? p : worst), picked[1]);
    if (drop && Math.min(...picked.filter(q => q !== drop).map(q => deltaE(drop, q))) < REFERENCE_ACCENT_DELTA_E) picked.splice(picked.indexOf(drop), 1, accent);
  }
  return picked.sort((a, b) => b.weight - a.weight || a.hex.localeCompare(b.hex));
}

/** Lista { hex, weight } válida (hex #RRGGBB maiúsculo, peso 0–1), sem repetição. */
export function normalizeReferencePalette(raw) {
  const seen = new Set();
  return (Array.isArray(raw) ? raw : []).map(item => ({
    hex: String(item?.hex || '').toUpperCase(),
    weight: Math.max(0, Math.min(1, Number(item?.weight) || 0)),
  })).filter(item => HEX6.test(item.hex) && !seen.has(item.hex) && seen.add(item.hex)).slice(0, REFERENCE_PALETTE_MAX);
}

/** Hex da lista mais próximo de `hex` (ΔE76); fora do formato, o próprio valor. */
export function nearestPaletteHex(hex, allowed = []) {
  const value = String(hex || '').toUpperCase();
  const pool = (Array.isArray(allowed) ? allowed : []).map(c => String(c?.hex || c || '').toUpperCase()).filter(c => HEX6.test(c));
  if (!HEX6.test(value) || !pool.length) return value;
  const lab = rgbToLab(fromHex(value));
  return pool.reduce((best, c) => (d2(rgbToLab(fromHex(c)), lab) < d2(rgbToLab(fromHex(best)), lab) ? c : best), pool[0]);
}

/* Kit: a paleta guardada vale enquanto as referências forem as mesmas -------- */

const refKey = ref => String(ref?.assetId || ref?.imageId || ref?.id || '');
export function referencePaletteRefIds(kit) {
  return (Array.isArray(kit?.refImages) ? kit.refImages : []).map(refKey).filter(Boolean);
}

/** Paleta extraída guardada no kit, se ainda corresponde às referências atuais. */
export function kitReferencePalette(kit) {
  const stored = kit?.referencePalette;
  const ids = referencePaletteRefIds(kit);
  if (!stored || !ids.length || !Array.isArray(stored.refIds)) return [];
  if (stored.refIds.length !== ids.length || stored.refIds.some((id, i) => id !== ids[i])) return [];
  return normalizeReferencePalette(stored.colors);
}

/** Campo do kit para guardar a paleta extraída das referências atuais. */
export function referencePaletteKitField(kit, colors) {
  const list = normalizeReferencePalette(colors);
  const refIds = referencePaletteRefIds(kit);
  return list.length && refIds.length ? { refIds, colors: list } : null;
}

/* Navegador ---------------------------------------------------------------- */

/**
 * Desenha cada referência (data URL ou URL do mesmo site) numa miniatura e
 * junta as amostras. Falha de leitura de uma referência não impede as outras;
 * sem nenhuma, devolve [] (o roteiro segue como antes).
 */
export async function extractReferencePaletteFromSources(sources = [], { doc = globalThis.document } = {}) {
  if (!doc?.createElement) return [];
  const frames = [];
  for (const src of (Array.isArray(sources) ? sources : []).filter(s => typeof s === 'string' && s)) {
    try {
      const img = await new Promise((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error('referência ilegível'));
        el.src = src;
      });
      const scale = Math.min(1, REFERENCE_PALETTE_THUMB / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
      const width = Math.max(1, Math.round((img.naturalWidth || 1) * scale));
      const height = Math.max(1, Math.round((img.naturalHeight || 1) * scale));
      const canvas = doc.createElement('canvas');
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, width, height);
      frames.push({ width, height, data: ctx.getImageData(0, 0, width, height).data });
    } catch { /* referência que não abre fica de fora */ }
  }
  if (!frames.length) return [];
  // Várias referências: empilhadas numa faixa só, cada uma na sua largura.
  const width = Math.max(...frames.map(fr => fr.width));
  const height = frames.reduce((sum, fr) => sum + fr.height, 0);
  const data = new globalThis.Uint8ClampedArray(width * height * 4);
  let row = 0;
  for (const fr of frames) {
    for (let y = 0; y < fr.height; y += 1) data.set(fr.data.subarray(y * fr.width * 4, (y + 1) * fr.width * 4), ((row + y) * width) * 4);
    row += fr.height;
  }
  return extractPaletteFromPixels(data, { width, height });
}
