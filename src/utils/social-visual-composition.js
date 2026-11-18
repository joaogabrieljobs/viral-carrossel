import { footerChromeReservePct } from './card-chrome.js';
import { resolvePresetChrome } from './preset-tokens.js';
import { visibleSocialText } from './social-generation.js';

const box = (x, y, w, h) => ({ x, y, w, h });
const PHOTO_ESSAY = new Set(['editorial_magazine', 'mood_sepia', 'reflexivo_cream', 'cinematic_hybrid']);

/** Versão das regras abaixo; projetos antigos não têm o campo e não são recompostos. */
export const SOCIAL_COMPOSITION_VERSION = 2;

/** Deslocamento máximo, em pontos percentuais, para abrir espaço ao rodapé. */
const MAX_FOOTER_SHIFT = 8;
/**
 * Na coluna estreita ao lado da foto, texto de apoio longo centralizado fica
 * com as margens irregulares. Acima deste total o card volta para a esquerda,
 * mesmo em preset centralizado. Ponto de partida, calibrável na galeria.
 */
export const PORTRAIT_CENTER_MAX_SUPPORT_CHARS = 120;

const meio = (valor) => Math.round(valor * 2) / 2;

/** Hierarquia tipográfica de cada composição. Fonte única: gerar e restaurar usam a mesma tabela. */
export const SOCIAL_COMPOSITION_TYPOGRAPHY = Object.freeze({
  'cover-photo': Object.freeze({ titleSize: 88, subSize: 108, bodyAfterSize: 140, titleLeading: 110, subLeading: 138 }),
  'portrait-editorial': Object.freeze({ titleSize: 66, subSize: 100, bodyAfterSize: 140, titleLeading: 110, subLeading: 138 }),
  'photo-story': Object.freeze({ titleSize: 76, subSize: 108, bodyAfterSize: 140, titleLeading: 110, subLeading: 138 }),
  typographic: Object.freeze({ titleSize: 76, subSize: 108, bodyAfterSize: 140, titleLeading: 110, subLeading: 138 }),
});

/**
 * Assinatura do achatamento da R2: card de composição social com os três
 * tamanhos em 100. A composição nunca produz esse trio (o apoio é sempre 140),
 * então o sinal é específico de quem passou pela antiga sincronização
 * "marca → todos os slides".
 */
export function isFlattenedSocialSlide(slide) {
  return slide?.canvas?.source === 'social-preset'
    && !!SOCIAL_COMPOSITION_TYPOGRAPHY[slide.socialComposition]
    && slide.titleSize === 100 && slide.subSize === 100 && slide.bodyAfterSize === 100;
}

/**
 * Ação explícita "Restaurar hierarquia do estilo": devolve aos cards achatados
 * os tamanhos e entrelinhas da composição. Não mexe em zonas, texto ou foto, e
 * não toca cards que não tenham a assinatura. Mesmo array quando nada muda.
 */
export function restoreSocialCompositionTypography(slides) {
  if (!Array.isArray(slides) || !slides.some(isFlattenedSocialSlide)) return slides;
  return slides.map((slide) => (isFlattenedSocialSlide(slide)
    ? { ...slide, ...SOCIAL_COMPOSITION_TYPOGRAPHY[slide.socialComposition] }
    : slide));
}

function supportChars(slide) {
  return [slide?.subtitle, slide?.bodyAfterImage]
    .map((texto) => Array.from(visibleSocialText(texto)).length)
    .reduce((soma, n) => soma + n, 0);
}

/**
 * Composições editáveis para presets sociais; nunca reescreve conteúdo.
 *
 * `brand` é a marca efetiva do projeto (já com o preset mesclado) e `formato`
 * a chave de `FORMATS`. Com os dois, as zonas nascem acima da faixa do selo ou
 * da barra do rodapé: o conjunto título + apoio sobe, em vez de o texto ser
 * espremido ou ficar por baixo do ornamento. Sem ornamento visível (por
 * exemplo, preset cuja assinatura depende de uma marca ainda não cadastrada)
 * a geometria é a original.
 *
 * O alinhamento horizontal vem do preset (`slideDefaults.align`); a âncora
 * vertical continua sendo da composição — capa embaixo, miolo em cima.
 */
export function applySocialVisualComposition(slides, { preset, photoRegion = 'full', brand = null, formato = 'carrossel' } = {}) {
  if (!preset || preset.isCustom || preset.productKind === 'apresentacao' || photoRegion !== 'full') return slides;
  const editorial = PHOTO_ESSAY.has(preset.id);
  const chrome = resolvePresetChrome(brand || preset.brand || {});
  const base = 100 - footerChromeReservePct(chrome, formato);
  const shift = (limite) => Math.min(MAX_FOOTER_SHIFT, Math.max(0, meio(limite - base)));
  const presetCentered = preset.slideDefaults?.align === 'center';

  return slides.map((slide, index) => {
    const photo = !!(slide.imageQuery || slide.bgImage || slide.bgImageId || slide.bgImageAssetId);
    const cover = index === 0;
    const close = index === slides.length - 1 && !cover;
    const fullBleed = photo && (cover || (close && !editorial));
    const portrait = photo && !fullBleed && editorial;
    let zones;
    if (fullBleed) {
      const s = shift(91);
      zones = { photo: box(0, 0, 100, 100), title: box(7, 47 - s, 86, 28), subtitle: box(7, 77 - s, 86, 14) };
    } else if (portrait) {
      const s = shift(89);
      zones = { photo: box(0, 0, 46, 100), title: box(51, 17, 43, 32), subtitle: box(51, 53, 43, 36 - s) };
    } else if (photo) {
      // A foto cede a altura do rodapé; título e apoio conservam o tamanho.
      const s = shift(90);
      zones = { photo: box(0, 0, 100, 49 - s), title: box(7, 53 - s, 86, 20), subtitle: box(7, 76 - s, 86, 14) };
    } else {
      const s = shift(89);
      zones = { photo: box(96, 94, 1, 1), title: box(8, cover ? 24 : 20, 84, 30), subtitle: box(8, 55, 84, 34 - s) };
    }
    const composition = fullBleed ? 'cover-photo' : portrait ? 'portrait-editorial' : photo ? 'photo-story' : 'typographic';
    const centered = presetCentered && !(portrait && supportChars(slide) > PORTRAIT_CENTER_MAX_SUPPORT_CHARS);
    return {
      ...slide,
      useCultureLayout: false,
      layout: `${fullBleed ? 'b' : 't'}${centered ? 'c' : 'l'}`,
      align: centered ? 'center' : 'left',
      photoRegion: 'full', photoFraming: 'auto', bgFit: 'cover', overlay: fullBleed ? 62 : 0,
      textInset: 0, textShadow: fullBleed,
      ...SOCIAL_COMPOSITION_TYPOGRAPHY[composition],
      socialVisualPresetId: preset.id,
      socialComposition: composition,
      socialCompositionVersion: SOCIAL_COMPOSITION_VERSION,
      canvas: { enabled: false, applied: true, variant: 'classic', source: 'social-preset', preserveZones: true, zones },
    };
  });
}
