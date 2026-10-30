import { TITLE_FONTS } from './design-data.js';
import { BODY_FONTS } from './brand-visuals.js';
import { LOCAL_FONT_FAMILIES } from './font-library.generated.js';

const firstFamily = (value) => String(value || '').split(',')[0].trim().replace(/^['"]|['"]$/g, '');
const WEB_FAMILIES = new Set(
  [...TITLE_FONTS, ...BODY_FONTS]
    .map(({ val }) => firstFamily(val))
    .filter((family) => !LOCAL_FONT_FAMILIES.has(family)),
);

function fontError(family) {
  const label = family.startsWith('VCBrand') ? 'a fonte da marca' : `a fonte “${family}”`;
  return new Error(`Não foi possível carregar ${label}. Verifique sua conexão e tente novamente, ou escolha outra fonte antes de exportar.`);
}

async function withinTimeout(promise, timeoutMs, error) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => { timer = setTimeout(() => reject(error), timeoutMs); }),
    ]);
  } finally { clearTimeout(timer); }
}

/**
 * fonts.ready também resolve quando uma fonte falha, ou antes de uma folha CSS
 * tardia registrar @font-face. Carrega e verifica as faces realmente usadas no
 * card para não exportar silenciosamente outra tipografia.
 */
export async function waitForExportFonts(roots, {
  doc = typeof document !== 'undefined' ? document : null,
  timeoutMs = 15000,
} = {}) {
  if (!doc?.fonts?.load || !doc.defaultView?.getComputedStyle) return;
  const requests = new Map();
  for (const root of (Array.isArray(roots) ? roots : []).filter(Boolean)) {
    for (const node of [root, ...root.querySelectorAll('*')]) {
      const text = Array.from(node.childNodes || [])
        .filter((child) => child.nodeType === 3).map((child) => child.textContent || '').join('');
      if (!text.trim()) continue;
      const style = doc.defaultView.getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.fontSize) <= 0) continue;
      const family = firstFamily(style.fontFamily);
      if (!family) continue;
      const font = `${style.fontStyle || 'normal'} ${style.fontWeight || '400'} ${style.fontSize || '16px'} ${JSON.stringify(family)}`;
      const previous = requests.get(font);
      requests.set(font, { family, font, text: (previous?.text || '') + text });
    }
  }

  const googleSheet = doc.getElementById?.('vc-google-fonts');
  const needsGoogleSheet = [...requests.values()].some(({ family }) => WEB_FAMILIES.has(family));
  if (needsGoogleSheet && googleSheet && !googleSheet.sheet) {
    const family = [...requests.values()].find((item) => WEB_FAMILIES.has(item.family)).family;
    let loaded;
    let failed;
    try {
      await withinTimeout(new Promise((resolve, reject) => {
        loaded = resolve;
        failed = () => reject(fontError(family));
        googleSheet.addEventListener('load', loaded, { once: true });
        googleSheet.addEventListener('error', failed, { once: true });
        if (googleSheet.sheet) resolve();
      }), timeoutMs, fontError(family));
    } finally {
      googleSheet.removeEventListener('load', loaded);
      googleSheet.removeEventListener('error', failed);
    }
  }

  const declaredFamilies = new Set(Array.from(doc.fonts).map((face) => firstFamily(face.family)));
  await Promise.all([...requests.values()].map(async ({ family, font, text }) => {
    const mustLoadFace = WEB_FAMILIES.has(family) || family.startsWith('VCBrand') || declaredFamilies.has(family);
    try {
      // A prova latina confirma a família mesmo em nós só com setas/emoji,
      // cujos glifos podem vir legitimamente de uma fonte de fallback.
      const faces = await withinTimeout(doc.fonts.load(font, `${text}A`), timeoutMs, fontError(family));
      // FontFaceSet.load() retorna [] para famílias desconhecidas e fontes do
      // sistema; só exigimos uma face nas fontes web/importadas do documento.
      if (mustLoadFace && (!faces.length || faces.some((face) => face.status !== 'loaded'))) throw fontError(family);
    } catch { throw fontError(family); }
  }));
}
