import { footerChromeReservePct } from './card-chrome.js';
import { FORMATS } from './formats.js';
import { resolvePresetChrome } from './preset-tokens.js';
import { visibleSocialText } from './social-generation.js';

const box = (x, y, w, h) => ({ x, y, w, h });
const PHOTO_ESSAY = new Set(['editorial_magazine', 'mood_sepia', 'reflexivo_cream', 'cinematic_hybrid']);

/**
 * Versão das regras abaixo; projetos antigos não têm o campo e não são recompostos.
 * v3 (18/11/2026): título e apoio formam um bloco só, escala tipográfica maior,
 * capa com degradê atrás do texto no lugar do véu sobre a foto inteira.
 */
export const SOCIAL_COMPOSITION_VERSION = 3;

/**
 * Deslocamento máximo, em pontos percentuais, para abrir espaço ao rodapé.
 * Selo ou barra sozinhos pedem até 6; os dois juntos empilham (selo acima da
 * barra) e pedem até 12,5 no formato quadrado.
 */
const MAX_FOOTER_SHIFT = 13;
/**
 * Na coluna estreita ao lado da foto, texto de apoio longo centralizado fica
 * com as margens irregulares. Acima deste total o card volta para a esquerda,
 * mesmo em preset centralizado. Ponto de partida, calibrável na galeria.
 */
export const PORTRAIT_CENTER_MAX_SUPPORT_CHARS = 120;

const meio = (valor) => Math.round(valor * 2) / 2;

/**
 * Hierarquia tipográfica de cada composição. Fonte única: gerar e restaurar usam a mesma tabela.
 *
 * O título renderiza a `largura × 0,084 × titleSize%` e o apoio a
 * `largura × 0,028 × subSize%`. Com 76/108 o título saía a 69 px num card de
 * 1080, só 2,1× o apoio: sem contraste de escala o card parece um formulário.
 * Agora o título passa de 2,8× o apoio (2× na coluna estreita ao lado da
 * foto, onde linhas curtas pedem corpo menor) e a entrelinha fecha para
 * display. Título longo continua cabendo: o ajuste automático reduz até caber.
 */
export const SOCIAL_COMPOSITION_TYPOGRAPHY = Object.freeze({
  'cover-photo': Object.freeze({ titleSize: 128, subSize: 112, bodyAfterSize: 140, titleLeading: 102, subLeading: 136 }),
  'portrait-editorial': Object.freeze({ titleSize: 76, subSize: 104, bodyAfterSize: 140, titleLeading: 104, subLeading: 138 }),
  'photo-story': Object.freeze({ titleSize: 108, subSize: 112, bodyAfterSize: 140, titleLeading: 104, subLeading: 136 }),
  typographic: Object.freeze({ titleSize: 116, subSize: 112, bodyAfterSize: 140, titleLeading: 104, subLeading: 136 }),
});

/**
 * Âncora vertical de cada caixa. Título embaixo da sua caixa e apoio em cima
 * da dele: os dois se encostam na divisa e crescem para lados opostos. Antes
 * as duas caixas seguiam a mesma âncora do layout e sobrava um vão fixo entre
 * título e apoio, qualquer que fosse o número de linhas.
 */
const ZONE_ANCHORS = Object.freeze({ title: 'end', subtitle: 'start' });

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

/**
 * Altura, em % do card, que o apoio da capa deve ocupar. A caixa do apoio fica
 * colada na base; com a altura estimada pelo texto, o bloco título + apoio
 * desce junto e não sobra uma faixa vazia embaixo de um apoio de uma linha.
 * Estimativa folgada: se errar para menos, o ajuste automático reduz o texto.
 */
function coverSupportHeightPct(slide, formato) {
  const f = FORMATS[formato] || FORMATS.carrossel;
  const tipo = SOCIAL_COMPOSITION_TYPOGRAPHY['cover-photo'];
  const largura = f.w * 0.86;
  const linhas = (texto, corpoPx, larguraMedia) => {
    const total = Array.from(visibleSocialText(texto)).length;
    return total ? Math.ceil(total / Math.max(12, Math.floor(largura / (corpoPx * larguraMedia)))) : 0;
  };
  const apoioPx = f.w * 0.028 * tipo.subSize / 100;
  const corpoPx = f.w * 0.018 * tipo.bodyAfterSize / 100;
  const linhasApoio = linhas(slide?.subtitle, apoioPx, 0.6);
  const linhasCorpo = linhas(slide?.bodyAfterImage, corpoPx, 0.56);
  const px = linhasApoio * apoioPx * tipo.subLeading / 100
    + (linhasCorpo ? linhasCorpo * corpoPx * 1.5 + f.h * 0.012 : 0)
    + f.h * 0.014;
  return Math.min(14, Math.max(5.5, meio(Math.ceil((px / f.h) * 100 * 2) / 2)));
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

  const temCabecalho = [chrome.cultureHeaderLeft, chrome.cultureHeaderCenter, chrome.cultureHeaderYear]
    .some((texto) => String(texto || '').trim()) || chrome.showPageBadge === true;

  return slides.map((slide, index) => {
    const photo = !!(slide.imageQuery || slide.bgImage || slide.bgImageId || slide.bgImageAssetId);
    const cover = index === 0;
    const close = index === slides.length - 1 && !cover;
    const fullBleed = photo && (cover || (close && !editorial));
    const portrait = photo && !fullBleed && editorial;
    let zones;
    if (fullBleed) {
      // Bloco colado na base: o apoio ocupa só a altura do seu texto e o
      // título sobe a partir dele.
      const s = shift(91);
      const h = coverSupportHeightPct(slide, formato);
      const apoioY = 91 - s - h;
      zones = { photo: box(0, 0, 100, 100), title: box(7, apoioY - 1.5 - 38, 86, 38), subtitle: box(7, apoioY, 86, h) };
    } else if (portrait) {
      const s = shift(89);
      zones = { photo: box(0, 0, 46, 100), title: box(51, 10, 43, 39), subtitle: box(51, 50.5, 43, 38.5 - s) };
    } else if (photo) {
      // A foto cede a altura do rodapé; título e apoio conservam o tamanho.
      // Caixa do título para duas linhas: com uma linha sobra pouco vão sob a
      // foto, e um título de três linhas reduz um pouco em vez de a foto encolher.
      const s = shift(90);
      zones = { photo: box(0, 0, 100, 51.5 - s), title: box(7, 54 - s, 86, 16), subtitle: box(7, 71.5 - s, 86, 18.5) };
    } else {
      const s = shift(89);
      zones = { photo: box(96, 94, 1, 1), title: box(8, 12, 84, 36), subtitle: box(8, 49.5, 84, 39.5 - s) };
    }
    const composition = fullBleed ? 'cover-photo' : portrait ? 'portrait-editorial' : photo ? 'photo-story' : 'typographic';
    const centered = presetCentered && !(portrait && supportChars(slide) > PORTRAIT_CENTER_MAX_SUPPORT_CHARS);
    // Capa: degradê atrás do texto, foto limpa no resto, sem sombra dura.
    // Foto no topo: só a faixa do cabeçalho escurece, e só se houver cabeçalho.
    const overlay = fullBleed ? { overlay: 62, overlayMode: 'scrim' }
      : (composition === 'photo-story' && temCabecalho) ? { overlay: 48, overlayMode: 'top' }
        : { overlay: 0, overlayMode: null };
    return {
      ...slide,
      useCultureLayout: false,
      layout: `${fullBleed ? 'b' : 't'}${centered ? 'c' : 'l'}`,
      align: centered ? 'center' : 'left',
      photoRegion: 'full', photoFraming: 'auto', bgFit: 'cover', ...overlay,
      textInset: 0, textShadow: false,
      // A seta "arraste" é convite da capa; repetida em todo card vira ruído.
      showSwipeCue: cover,
      ...SOCIAL_COMPOSITION_TYPOGRAPHY[composition],
      socialVisualPresetId: preset.id,
      socialComposition: composition,
      socialCompositionVersion: SOCIAL_COMPOSITION_VERSION,
      socialZoneAnchors: ZONE_ANCHORS,
      canvas: { enabled: false, applied: true, variant: 'classic', source: 'social-preset', preserveZones: true, zones },
    };
  });
}
