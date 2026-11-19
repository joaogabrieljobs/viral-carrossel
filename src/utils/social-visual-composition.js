import { footerChromeReservePct } from './card-chrome.js';
import { FORMATS } from './formats.js';
import { resolvePresetChrome } from './preset-tokens.js';
import { visibleSocialText } from './social-generation.js';
import {
  SOCIAL_FAMILIES, SOCIAL_LIBRARY_VERSION, socialCardLayout, socialFamilyFor, formatFrame, socialDevices,
  toTitleSize, toSubSize, toBodySize,
} from './social-families.js';
import { assignSocialFunctions, rhythmVariants } from './social-sequence.js';
import { socialGround } from './social-chrome.js';
import { normalizePresentationBlocks } from './presentation-quality.js';

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
export function applySocialVisualComposition(slides, { preset, photoRegion = 'full', brand = null, formato = 'carrossel', narrative = 'editorial' } = {}) {
  if (!preset || preset.productKind === 'apresentacao' || photoRegion !== 'full') return slides;
  if (usesSocialLibrary(preset)) return composeSocialLibrary(slides, { preset, brand, formato, narrative });
  if (preset.isCustom) return slides;
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
      // Caixa do título com 21,5%: duas linhas de fonte larga cabem no tamanho
      // cheio, contando a margem interna da caixa. Com 16% e 18,5% o ajuste
      // automático já encolhia o título. Custo: título de uma linha deixa um
      // vão maior sob a foto.
      const s = shift(90);
      zones = { photo: box(0, 0, 100, 46 - s), title: box(7, 48.5 - s, 86, 21.5), subtitle: box(7, 71.5 - s, 86, 18.5) };
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

/** Marcas que a composição grava no card; sem as caixas elas não significam nada. */
const SOCIAL_COMPOSITION_FIELDS = ['socialComposition', 'socialCompositionVersion', 'socialVisualPresetId', 'socialZoneAnchors', 'overlayMode', 'socialArt', 'socialFunction', 'socialFamily', 'socialPhotoTreatment', 'titleItalic', 'subtitleWeight'];

/**
 * Troca de padrão num projeto já gerado.
 *
 * `overrides` é o reset do padrão novo (zera caixas, tipografia e layout). Só
 * com ele os cards voltavam ao layout clássico guardando o "sem véu e sem
 * sombra" da composição: texto direto sobre a foto. Aqui, projeto que nasceu
 * composto é recomposto com o padrão novo; se o padrão não tem composição
 * própria (personalizado), o card volta ao clássico já com véu e sombra.
 * Projeto que nunca foi composto recebe só o reset, como antes.
 */
export function restyleSocialSlides(slides, { preset, brand = null, formato = 'carrossel', overrides = {}, narrative = 'editorial' } = {}) {
  if (!Array.isArray(slides)) return slides;
  const eraComposto = slides.some((slide) => slide?.socialComposition);
  const base = slides.map((slide) => ({ ...slide, ...overrides }));
  if (!eraComposto && !(preset?.socialFamily && usesSocialLibrary(preset))) return base;
  const recomposto = applySocialVisualComposition(base, { preset, brand, formato, narrative });
  if (recomposto !== base) return recomposto;
  return base.map((slide) => {
    const limpo = { ...slide };
    for (const campo of SOCIAL_COMPOSITION_FIELDS) delete limpo[campo];
    const temFoto = !!(slide.bgImage || slide.bgImageId || slide.bgImageAssetId);
    return temFoto ? { ...limpo, overlay: Math.max(Number(slide.overlay) || 0, 60), textShadow: true } : limpo;
  });
}



/* ================================================================== */
/* Biblioteca v4 — famílias + sequência + recomposição por formato     */
/* ================================================================== */

/**
 * Quem passa pela biblioteca v4: as nove famílias e qualquer identidade
 * própria (padrão personalizado). Os doze estilos antigos continuam na v3 para
 * que projetos salvos abram como foram feitos.
 */
export function usesSocialLibrary(preset) {
  if (!preset || preset.productKind === 'apresentacao') return false;
  if (preset.socialFamily && SOCIAL_FAMILIES[preset.socialFamily]) return true;
  // Padrão personalizado com layout próprio salvo pela pessoa continua dela.
  return preset.isCustom === true && !preset.slideDefaults?.layout && !preset.slideDefaults?.canvas;
}

const hasPhoto = (s) => !!(s?.imageQuery || s?.bgImage || s?.bgImageId || s?.bgImageAssetId);
const chars = (v) => Array.from(visibleSocialText(v || '')).length;
const FOOTER_FORMATS = ['carrossel', 'quadrado', 'stories'];

/**
 * Largura média do caractere (em), medida no Chrome com as faces do app numa
 * frase de ensaio em português (espaços incluídos). Fonte desconhecida: 0,52.
 */
const CHAR_WIDTH = [
  [/syne/, 0.6], [/archivo/, 0.53], [/space grotesk|plus jakarta/, 0.52], [/inter tight/, 0.47],
  [/inter\b/, 0.5], [/ibm plex sans/, 0.49], [/fraunces/, 0.49], [/bodoni/, 0.48], [/figtree/, 0.47],
  [/oswald/, 0.48], [/anton/, 0.43], [/jost|dm sans/, 0.45], [/instrument serif/, 0.36], [/mono/, 0.6],
];
function charWidthEm(font = '', upper = false) {
  const f = String(font).toLowerCase();
  const hit = CHAR_WIDTH.find(([re]) => re.test(f));
  const w = hit ? hit[1] : 0.52;
  // Medidas de Anton e Oswald já são em caixa alta.
  return upper && !/anton|oswald/.test(f) ? w * 1.15 : w;
}

function linesFor(text, px, widthPx, cw) {
  const per = Math.max(6, Math.floor(widthPx / (px * cw)));
  return String(text || '').split('\n').map((p) => p.trim()).filter(Boolean)
    .reduce((n, p) => n + Math.max(1, Math.ceil(chars(p) / per)), 0);
}

/**
 * Ajuste de densidade: estima linhas de título e apoio no corpo planejado.
 * 1. a fronteira título/apoio anda para quem precisa (caixas empilhadas);
 * 2. o apoio desce até o piso legível (28 px em 1080) e o título até 70%;
 * Abaixo do piso nada encolhe: o card fica marcado para revisão do texto
 * (`socialArt.density = 'over'`) em vez de virar letra miúda.
 */
function fitDensity(L, slide, F, typo) {
  const W = (z) => (z.w / 100) * F.w * 0.94;
  const H = (z) => (z.h / 100) * F.h;
  const T = { ...L.title }; const S = { ...L.subtitle };
  let titlePx = L.titlePx; let bodyPx = L.bodyPx; let supportPx = L.supportPx;
  const tCw = charWidthEm(typo.titleFont, typo.titleCase === 'upper');
  const bCw = charWidthEm(typo.bodyFont);
  // + reserva de ascendentes/descendentes que o renderer acrescenta (0,22 em cima e embaixo).
  const needTitle = () => linesFor(slide.title, titlePx, W(T), tCw) * titlePx * (typo.titleLeading / 100) + titlePx * 0.44 + 16;
  const needBody = () => linesFor(slide.subtitle, bodyPx, W(S), bCw) * bodyPx * 1.4
    + (slide.bodyAfterImage ? linesFor(slide.bodyAfterImage, supportPx, W(S), bCw) * supportPx * 1.45 + F.h * 0.012 : 0) + 10;
  // Empilhadas: apoio inteiro abaixo do título (mesma coluna ou recuado).
  const stacked = T.y + T.h <= S.y + 0.01 && S.x >= T.x - 0.5 && S.x < T.x + T.w;
  const toPct = (px) => (px / F.h) * 100;
  if (stacked) {
    const slackT = H(T) - needTitle(); const slackS = H(S) - needBody();
    if (slackS < 0 && slackT > 0) {
      const give = Math.min(slackT, -slackS); const g = toPct(give);
      T.h -= g; S.y -= g; S.h += g;
    } else if (slackT < 0 && slackS > 0) {
      const give = Math.min(slackS - 8, -slackT); const g = toPct(Math.max(0, give));
      T.h += g; S.y += g; S.h -= g;
    }
  }
  // Texto além do previsto num card com foto acima do texto: a foto cede
  // altura (até 28% do card) antes de o apoio encolher no render.
  let P = L.photo ? { ...L.photo } : null;
  if (P && !L.onPhoto && P.y + P.h <= T.y + 0.5 && P.x <= S.x + 0.5 && needBody() > H(S)) {
    const deficit = Math.min(toPct(needBody() - H(S)) + 1, P.h - 28);
    if (deficit > 0) { P.h -= deficit; T.y -= deficit; S.y -= deficit; S.h += deficit; }
  }
  // Palavra inteira na linha: a mais longa do título cabe na largura da
  // caixa (sem isso o navegador parte a palavra no meio).
  const longest = (txt) => String(txt || '').split(/\s+/).reduce((m, w) => Math.max(m, chars(w)), 0);
  // Letras de uma palavra são mais largas que a média com espaços: +18%.
  const wordFit = (txt, cw) => (longest(txt) ? W(T) / (longest(txt) * cw * 1.18) : Infinity);
  titlePx = Math.min(titlePx, Math.max(Math.round(L.titlePx * 0.45), Math.floor(wordFit(slide.title, tCw))));
  for (let i = 0; i < 12 && needTitle() > H(T) && titlePx > L.titlePx * 0.65; i += 1) titlePx = Math.round(titlePx * 0.95);
  for (let i = 0; i < 12 && needBody() > H(S) && bodyPx > 30; i += 1) { bodyPx = Math.max(30, bodyPx - 2); supportPx = Math.max(28, supportPx - 2); }
  // Bloco agrupado: com título ancorado em cima, o apoio sobe para logo
  // abaixo das linhas reais do título (sem o vão fixo entre caixas).
  if (stacked && (L.anchors?.title || 'start') === 'start') {
    const bottom = S.y + S.h;
    // Título e apoio dividem a mesma altura: se o apoio não couber, o título
    // cede corpo (até 65% do planejado) antes de o apoio ficar espremido.
    for (let i = 0; i < 12 && titlePx > L.titlePx * 0.65
      && bottom - (T.y + Math.min(T.h, toPct(needTitle()) + 1)) - 0.8 < toPct(needBody()); i += 1) titlePx = Math.round(titlePx * 0.95);
    const tPct = Math.min(T.h, toPct(needTitle()) + 1);
    const gap = Math.max(0.8, Math.min(Math.max(2.2, toPct(bodyPx * 0.9)), bottom - (T.y + tPct) - toPct(needBody())));
    T.h = tPct; S.y = T.y + tPct + gap; S.h = bottom - S.y;
    // Nunca sobe para dentro da foto: abaixo dela quando dividem a coluna.
    const P = L.photo;
    if (P && P.w > 2 && S.x < P.x + P.w && P.x < S.x + S.w && S.y < P.y + P.h && P.y < S.y + S.h) {
      const y = Math.min(bottom - 8, P.y + P.h + gap);
      if (y > S.y) { S.y = y; S.h = bottom - y; }
    }
  }
  // Card só de texto com pouco conteúdo: o bloco desce até o centro óptico
  // (≈46%) em vez de deixar a metade de baixo vazia.
  if (stacked && L.center && (L.anchors?.title || 'start') === 'start') {
    const used = (S.y - T.y) + toPct(needBody());
    const area = (S.y + S.h) - T.y;
    const shift = Math.max(0, Math.min(area - used, (46 - used / 2) - T.y));
    if (shift > 1 && used < area * 0.7) { T.y += shift; S.y += shift; S.h -= shift; }
  }
  const over = needBody() > H(S) * 1.02 || needTitle() > H(T) * 1.15;
  const r = (z) => ({ x: round2(z.x), y: round2(z.y), w: round2(z.w), h: round2(z.h) });
  return { title: r(T), subtitle: r(S), photo: P ? r(P) : null, titlePx, bodyPx, supportPx, over, subUsed: round2(Math.min(S.h, toPct(needBody()))) };
}
const round2 = (v) => Math.round(v * 100) / 100;

/** Texto e dispositivos acima do rodapé (selo/barra) e longe do canto da logo. */
function guardChrome(L, F, { footerPct = 0, logoCorner = null }) {
  const base = 100 - footerPct;
  const T = { ...L.title }; const S = { ...L.subtitle };
  const over = Math.max(0, S.y + S.h - base);
  if (over > 0) {
    if (S.h - over >= 10) S.h -= over;
    else { const up = over - Math.max(0, S.h - 10); S.h = Math.max(10, S.h - over); S.y -= up; T.y -= up; }
  }
  let chrome = L.chrome;
  if (logoCorner && logoCorner.startsWith('t')) {
    const right = logoCorner.endsWith('r');
    chrome = chrome.flatMap((d) => {
      if (d.t !== 'text' || d.y > F.t) return [d];
      const x0 = d.x; const x1 = d.x + (d.w ?? 30);
      const hits = right ? x1 > 66 : x0 < 34;
      if (!hits) return [d];
      // Leva o rótulo para o lado livre; se não couber, some (a logo já marca o topo).
      const moved = right ? { ...d, x: F.e, align: 'left' } : { ...d, x: 100 - F.e - (d.w ?? 30), align: 'right' };
      const hitsAgain = right ? moved.x + (moved.w ?? 30) > 66 : moved.x < 34;
      return hitsAgain ? [] : [moved];
    });
  }
  if (footerPct > 0) chrome = chrome.filter((d) => !(d.t === 'text' && d.y > base - 3));
  return { title: T, subtitle: S, chrome };
}

/**
 * Campos de layout de um card v4 num formato. Fonte única para composição e
 * para a vista Quadrado/Stories (format-view.js). Nunca toca em texto ou foto.
 */
export function socialFormatPatch(slide, formato = 'carrossel') {
  const art = slide?.socialArt;
  if (!art || !SOCIAL_FAMILIES[art.family]) return {};
  const F = { ...formatFrame(formato) };
  const photo = hasPhoto(slide);
  const L = socialCardLayout(art.family, art.fn, { formato, photo, structured: art.structured, variant: art.variant, topReserve: logoTopReserve(art.logo, F) });
  const typo = art.typo || {};
  const zoned = guardChrome(L, F, { footerPct: art.footer?.[F.key] || 0, logoCorner: null });
  const center = !L.photo && ['opener', 'development', 'list'].includes(art.fn);
  const fit = fitDensity({ ...L, center, title: zoned.title, subtitle: zoned.subtitle }, slide, F, typo);
  const hasSub = !!String(slide.subtitle || slide.bodyAfterImage || '').trim();
  // Trava final do rodapé (selo/barra): depois do ajuste de densidade nada
  // termina abaixo da faixa; se o apoio ficaria curto demais, o bloco sobe.
  const baseY = 100 - (art.footer?.[F.key] || 0);
  if (fit.subtitle.y + fit.subtitle.h > baseY) {
    const minH = Math.max(6, Math.min(fit.subUsed || 6, 14));
    fit.subtitle.h = round2(baseY - fit.subtitle.y);
    if (fit.subtitle.h < minH) {
      const up = minH - fit.subtitle.h;
      fit.subtitle.y = round2(fit.subtitle.y - up); fit.subtitle.h = round2(minH);
      if (fit.title.y + fit.title.h > fit.subtitle.y) fit.title.h = round2(Math.max(6, fit.subtitle.y - fit.title.y - 0.5));
      if (fit.title.y + fit.title.h > fit.subtitle.y) fit.title.y = round2(fit.subtitle.y - fit.title.h - 0.5);
    }
  }
  const finalL = { ...L, photo: fit.photo || L.photo, title: fit.title, subtitle: fit.subtitle, hasSub, subUsed: fit.subUsed };
  const guarded = guardChrome({ ...finalL, chrome: socialDevices(art.family, art.fn, finalL, formato, { photo: !!L.photo, topReserve: logoTopReserve(art.logo, F) }) }, F,
    { footerPct: art.footer?.[F.key] || 0, logoCorner: art.logoCorner });
  const zones = {
    photo: fit.photo || L.photo || box(96, 94, 1, 1),
    title: fit.title,
    subtitle: fit.subtitle,
    ...(L.evidence ? { evidence: L.evidence } : {}),
  };
  const titleLeading = typo.titleLeading ?? 102;
  return {
    layout: L.align === 'center' ? 'tc' : 'tl',
    align: L.align,
    bgFit: L.photoFit === 'contain' ? 'contain' : 'cover',
    overlay: L.scrim ? L.scrim.amount : 0,
    overlayMode: L.scrim ? 'scrim' : null,
    titleSize: toTitleSize(fit.titlePx),
    subSize: toSubSize(fit.bodyPx),
    bodyAfterSize: toBodySize(fit.supportPx),
    titleLeading,
    subLeading: art.fn === 'list' ? 150 : 140,
    titleItalic: L.titleItalic && art.ownType === true,
    socialZoneAnchors: L.anchors,
    socialComposition: `v4:${L.archetype}`,
    socialArt: { ...art, ground: L.ground, chrome: guarded.chrome, archetype: L.archetype, density: fit.over ? 'over' : 'ok', formato: F.key },
    canvas: { enabled: false, applied: true, variant: 'classic', source: 'social-preset', preserveZones: true, zones },
  };
}

/**
 * Faixa do topo ocupada pela logo (em %). A proporção real da imagem só é
 * conhecida no render; a estimativa usa 60% do lado da caixa da logo, que
 * cobre logos horizontais e a maior parte das quadradas no tamanho padrão.
 */
function logoTopReserve(logo, F) {
  if (!logo || !String(logo.pos || '').startsWith('t')) return 0;
  const size = Number(logo.size) || 260;
  // Logos pequenas costumam ser marcas quadradas (lado inteiro); as grandes,
  // horizontais (cerca de 60% do lado).
  return round2(((F.w * 0.045 + size * (size <= 180 ? 1 : 0.6)) / F.h) * 100 + 1.5);
}

function logoCornerFor(brand) {
  if (!brand?.logo && !brand?.logoImageId) return null;
  const pos = brand.logoPosition || 'tr';
  return pos === 'c' ? null : pos;
}

function composeSocialLibrary(slides, { preset, brand, formato, narrative }) {
  if (!Array.isArray(slides) || !slides.length) return slides;
  const base = brand || preset.brand || {};
  const familyKey = socialFamilyFor(preset, base);
  const family = SOCIAL_FAMILIES[familyKey];
  // Família com as próprias fontes (padrão da biblioteca) ou identidade do
  // usuário (fontes e pesos da marca, geometria e ritmo da família).
  const sameFont = (a, b) => String(a || '').split(',')[0].replace(/["']/g, '').trim().toLowerCase()
    === String(b || '').split(',')[0].replace(/["']/g, '').trim().toLowerCase();
  const ownType = !preset.isCustom && preset.socialFamily === familyKey && sameFont(base.titleFont || family.type.title, family.type.title);
  const chrome = resolvePresetChrome(base);
  const footer = Object.fromEntries(FOOTER_FORMATS.map((k) => [k, footerChromeReservePct(chrome, k)]));
  const functions = assignSocialFunctions(slides, { narrative });
  const variants = rhythmVariants(functions);
  const typo = {
    titleFont: base.titleFont || family.type.title,
    bodyFont: base.bodyFont || family.type.body,
    titleCase: ownType ? family.type.titleCase : (base.textTitleCase || 'normal'),
    titleLeading: ownType ? family.type.titleLeading : (base.textTitleLeading || 104),
  };
  return slides.map((slide, index) => {
    // Escolha feita card a card (estilo próprio do card) continua do usuário.
    if (slide.visualPresetId && slide.visualPresetId !== preset.id) return slide;
    const fn = functions[index];
    const structured = normalizePresentationBlocks(slide.presentationBlocks).length > 0;
    const art = {
      family: familyKey, fn, variant: variants[index], structured, typo, footer,
      logoCorner: logoCornerFor(base), logo: logoCornerFor(base) ? { pos: logoCornerFor(base), size: base.logoSize ?? 260 } : null, labelFont: ownType ? (family.type.label || null) : null, ownType,
    };
    const patch = socialFormatPatch({ ...slide, socialArt: art }, formato);
    const inks = socialGround(base, patch.socialArt.ground);
    const groundChanged = patch.socialArt.ground !== 'bg';
    // Cores de chão só são da composição quando ela mesma as gravou; uma cor
    // escolhida pela pessoa no card não é apagada por um card de fundo normal.
    const prevAuto = slide.socialArt?.inks === true;
    const colors = groundChanged
      ? { customBg: inks.bg, titleColor: inks.ink, subtitleColor: inks.body, textColor: inks.muted }
      : prevAuto ? { customBg: null, titleColor: undefined, subtitleColor: undefined, textColor: undefined } : {};
    const userZones = slide.canvas?.userEdited && slide.canvas?.zones;
    return {
      ...slide,
      ...patch,
      useCultureLayout: false,
      photoRegion: 'full',
      photoFraming: slide.photoFraming === 'manual' ? 'manual' : 'auto',
      textInset: 0,
      textShadow: false,
      // A seta de arraste só existe na capa em sangria da Manchete; nas
      // demais famílias ela cortava a moldura da foto da capa.
      showSwipeCue: index === 0 && familyKey === 'manchete' && patch.socialArt.archetype === 'coverBleed',
      ...(ownType ? {
        titleWeight: family.type.titleWeight,
        titleCase: family.type.titleCase,
        titleTracking: family.type.titleTracking,
        subtitleWeight: family.type.bodyWeight,
      } : {}),
      ...colors,
      socialArt: { ...patch.socialArt, inks: groundChanged },
      socialPhotoTreatment: family.photo.filter,
      socialFunction: fn,
      socialFamily: familyKey,
      socialVisualPresetId: preset.id,
      socialCompositionVersion: SOCIAL_LIBRARY_VERSION,
      ...(userZones ? { canvas: { ...patch.canvas, zones: userZones, userEdited: true } } : {}),
    };
  });
}
