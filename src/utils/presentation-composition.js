/** Composição determinística: o modelo escolhe a função, nunca CSS ou coordenadas. */
import { FORMATS } from './formats.js';
import { presentationFamily, presentationArtLayout } from './presentation-art-direction.js';
import {
  FREE_PRESENTATION_PRESET_ID, familyFont, familyPhotoFilter, familySpec, normalizeFamilyKey,
  rendererSubtitleSizePercent, rendererTitleSizePercent,
} from './presentation-families.js';
import { titleTrackingBase } from './title-tracking.js';
import { wcagContrast } from './wcag.js';
import { inkOver, sideScrim } from './image-composition.js';
import { coerceVisualDirection, reservedAreaColour } from './visual-direction.js';
const DATA_ROLES = new Set(['data', 'metric', 'result', 'matrix', 'comparison', 'priorities']);
const DEMO_ROLES = new Set(['demo', 'example', 'evidence', 'story', 'people', 'application']);
const DIVIDER_ROLES = new Set(['divider', 'agenda', 'question', 'reframe', 'contrast', 'statement', 'vision', 'objectives']);
const DATA_PURPOSES = new Set(['comparison', 'business_model', 'revenue_model', 'metrics', 'market', 'traction']);
const DEMO_PURPOSES = new Set(['journey', 'roadmap', 'workflow', 'product_demo', 'process']);
const text = value => String(value || '').trim().toLowerCase();

/**
 * Tamanho do texto de apoio (`bodyAfterImage`) no deck.
 *
 * O slide guarda tamanhos na escala do Feed; a vista 16:9 multiplica por
 * (1080/1350)×(1080/1920) = 0,45 e limita o resultado a 52–130
 * (`slideForFormatDisplay`). Título e subtítulo escapam disso pelos tokens de
 * composição; o apoio não. O valor fixo 110 que existia aqui chegava à tela
 * como 52% — 18 px num slide de 1920, ilegível em projeção (rodada R2) —
 * enquanto o sistema visual da apresentação define corpo de 24 a 28 px.
 *
 * Gravamos o valor que, depois da conversão, entrega o corpo do preset, nunca
 * abaixo do piso de leitura.
 */
const PRESENTATION_VIEW_FACTOR = (FORMATS.apresentacao.h / FORMATS.carrossel.h) * (FORMATS.carrossel.w / FORMATS.apresentacao.w);
/** Piso de leitura do apoio no deck, na escala da vista: 1920 × 0,018 × 0,70 ≈ 24 px. */
export const PRESENTATION_SUPPORT_MIN_VIEW_SIZE = 70;
const PRESENTATION_SUPPORT_DEFAULT_VIEW_SIZE = 72;

export function presentationSupportTextSize(base = {}) {
  const doPreset = Number(base.bodyAfterSize);
  const naVista = Math.max(
    PRESENTATION_SUPPORT_MIN_VIEW_SIZE,
    Number.isFinite(doPreset) && doPreset > 0 ? doPreset : PRESENTATION_SUPPORT_DEFAULT_VIEW_SIZE,
  );
  return Math.round(naVista / PRESENTATION_VIEW_FACTOR);
}

export function resolvePresentationVisualRole(slide = {}, stage = {}) {
  const plan = slide.presentationPlan;
  const planned = text(plan?.visualRole);
  const purpose = text(plan?.purpose);
  if (planned && planned !== 'content') return planned;
  if (plan && DATA_PURPOSES.has(purpose)) return 'data';
  if (plan && DEMO_PURPOSES.has(purpose)) return 'demo';
  return planned || text(stage.visualRole) || text(slide.presentationVisualRole) || text(slide.visualRole) || 'content';
}

/**
 * @param {object} options
 * @param {object[]} [options.previous] slides já compostos antes deste, na
 *   ordem do deck (saída de getPresentationCompositionOverrides). Sem eles, a
 *   escolha é a de sempre.
 * @param {string} [options.family] família visual; liga o ritmo de layout.
 * @param {{slide: object, stage?: object}} [options.next] slide seguinte (ainda
 *   não composto) e a etapa dele; o ritmo olha se ele tem outra página.
 */
export function resolvePresentationCompositionKind({ slide = {}, stage = {}, index = 0, count = 1, previous = null, family = null, next = null } = {}) {
  // Bloco nativo (tabela, métricas, etapas) só tem onde ser desenhado na página
  // de dados: é a única composição com zona de evidência. Em capa, conteúdo ou
  // fechamento o bloco ficava sem área, o slide saía com metade vazia e a
  // exportação era barrada ("A área de dados não tem dimensões válidas").
  if (hasBlocks(slide)) return 'data';
  if (index === 0) return 'cover';
  if (index >= count - 1) return 'closing';
  const role = resolvePresentationVisualRole(slide, stage);
  const kind = DATA_ROLES.has(role) ? 'data'
    : DEMO_ROLES.has(role) ? 'demo'
      : DIVIDER_ROLES.has(role) || role === 'cover' ? 'divider'
        : role === 'closing' || role === 'close' ? 'closing'
          : 'content';
  return family && Array.isArray(previous)
    ? rhythmKind(kind, slide, family, previous, next?.slide ? { ...next, index: index + 1, count } : null)
    : kind;
}

/**
 * Ritmo de layout (spec 1.1, entrega 2). Na Apoteose (QA 24/11, Cinemático)
 * seis páginas de conteúdo saíram com a mesma geometria, texto numa coluna de
 * 30% e foto em 60%, porque cada slide era composto sem olhar as vizinhas.
 *
 * Se as duas páginas anteriores têm a geometria que este slide teria, ele
 * passa para outra função de página que a família já desenha: primeiro a de
 * demonstração (no Cinemático, foto em tela cheia com scrim; no Editorial e no
 * Suíço, foto do lado oposto), depois a abertura de seção (página de frase).
 * Nenhuma geometria nova. A alternativa precisa mudar o que se vê e manter a
 * foto que o roteiro pediu; se nenhuma serve, fica a composição de sempre.
 * Ajuste manual de posição feito pela pessoa é respeitado.
 *
 * Vale só ao compor (geração e "aplicar estilo"): projeto salvo guarda a
 * composição no slide e não é recomposto ao abrir.
 */
// Cobertura (25/11): sequência de demonstrações (roteiro com demo no miolo,
// ou deck sem roteiro cujas etapas são "evidência") não tinha para onde ir,
// porque a única alternativa era ela mesma ou a página de frase sem foto. A
// página de conteúdo da família entra por último.
const RHYTHM_ALTERNATIVES = ['demo', 'divider', 'content'];

// Conferência visual (25/11, Tipográfico): o slide seguinte pode não ter
// alternativa. Leitura longa (apoio > 300) vira leitura larga em toda página
// com foto, e no Tipográfico a leitura larga tem a geometria da página de
// conteúdo (foto 70:26, texto em x = 4). Na Apoteose o slide 4 é assim: o 2 e
// o 3 saíam como conteúdo e o 4 fechava a trinca sem ter para onde ir. Quando
// o seguinte está preso à geometria que este repetiria, este alterna agora.
function rhythmKind(kind, slide, family, previous, next = null) {
  const [before, last] = previous.slice(-2);
  if (!last || manuallyPositioned(slide)) return kind;
  const own = layoutGeometry(kind, slide, family);
  if (composedGeometry(last) !== own) return kind;
  const third = !!before && composedGeometry(before) === own;
  if (!third && lockedGeometry(next, family) !== own) return kind;
  return alternativeKind(kind, slide, family, own) || kind;
}

/** Outra página que a família já desenha, com a foto pedida e geometria diferente. */
function alternativeKind(kind, slide, family, own) {
  const visual = hasVisual(slide);
  return RHYTHM_ALTERNATIVES.find((alt) => {
    if (alt === kind) return false;
    const layout = contentAwarePresentationLayout(alt, slide, family);
    return (!visual || !!layout.photo) && layoutGeometry(alt, slide, family) !== own;
  }) || null;
}

/** Geometria de que o slide não sai (sem alternativa, capa, fecho, bloco ou ajuste manual); null se pode alternar. */
function lockedGeometry(next, family) {
  if (!next?.slide) return null;
  const { slide, stage = {}, index, count } = next;
  const kind = resolvePresentationCompositionKind({ slide, stage, index, count });
  const own = layoutGeometry(kind, slide, family);
  if (index === 0 || index >= count - 1 || hasBlocks(slide) || manuallyPositioned(slide)) return own;
  return alternativeKind(kind, slide, family, own) ? null : own;
}

/** O que o olho vê como "mesma página": chão, lado e largura da foto, texto sobre a foto e coluna do texto. */
function geometryKey({ ground, photo, scrim, title, subtitle }) {
  const r = value => Math.round(Number(value) || 0);
  return [ground || 'bg', photo ? `${r(photo.x)}:${r(photo.w)}` : 'sem-foto', photo && scrim ? 'scrim' : '', r(title?.x), r(subtitle?.x)].join('|');
}

function layoutGeometry(kind, slide, family) {
  const layout = contentAwarePresentationLayout(kind, slide, family);
  return geometryKey({ ...layout, photo: hasVisual(slide) ? layout.photo : null, scrim: !!layout.scrim });
}

function composedGeometry(slide = {}) {
  const zones = slide.canvas?.zones || {};
  return geometryKey({
    ground: slide.presentationGround,
    photo: slide.presentationSuppressPhoto ? null : zones.photo,
    scrim: Number(slide.overlay) > 0,
    title: zones.title,
    subtitle: zones.subtitle,
  });
}

export const manuallyPositioned = slide => slide.canvas?.enabled === true
  || ['title', 'subtitle', 'bodyAfterImage', 'text', 'photo'].some((key) => {
    const offset = slide.elementOffsets?.[key];
    return offset && Object.values(offset).some(value => Number(value) !== 0);
  });

const rect = (x, y, w, h) => ({ x, y, w, h });
const inactivePhoto = () => rect(96, 94, 1, 1);
export const hasVisual = slide => !!(slide.bgImage || slide.bgImageId || slide.bgImageAssetId || text(slide.imageQuery));
export const hasBlocks = slide => Array.isArray(slide.presentationBlocks)
  && slide.presentationBlocks.some(block => ['comparison', 'metrics', 'steps', 'quote', 'bignumber', 'icons'].includes(block?.type));

/**
 * Perfis fechados com faixa superior reservada à marca. Fotos usam cover e
 * enquadramento automático; não se aplica deformação nem composição livre do LLM.
 * A ausência de foto expande a leitura, em vez de deixar um placeholder vazio.
 */
export function presentationDesignFamily(base = {}) {
  // Modo livre: a família é de cada página (design do slide), não do preset.
  if (base.presentationPresetId === FREE_PRESENTATION_PRESET_ID && base.presentationFreeDesign?.family) {
    return normalizeFamilyKey(base.presentationFreeDesign.family);
  }
  return presentationFamily(base.presentationPresetId || base.presentationPatternId);
}

export function contentAwarePresentationLayout(kind, slide = {}, family = 'executive', format = '16:9') {
  return presentationArtLayout(kind, slide, family, { visual: hasVisual(slide), structured: hasBlocks(slide), format });
}

export function contentAwarePresentationZones(kind, slide = {}, family = 'executive', format = '16:9') {
  const layout = contentAwarePresentationLayout(kind, slide, family, format);
  return {
    title: layout.title, subtitle: layout.subtitle, photo: layout.photo || inactivePhoto(),
    ...(layout.evidence ? { evidence: layout.evidence } : {}),
  };
}

/**
 * Campos de slide que levam a direção de arte da família ao renderer.
 * Tudo é dado (zonas, tokens, descritores de chrome), nunca CSS do modelo.
 */
export function familyPresentationFields(layout, { format = '16:9' } = {}) {
  const spec = familySpec(layout.family);
  const display = familyFont(layout.family, 'display');
  const text = familyFont(layout.family, 'text');
  const ink = layout.inks;
  const recolor = layout.ground !== 'bg' || layout.inkOnPhoto || !!layout.scrim;
  return {
    presentationArtDirectionVersion: 2,
    presentationDesignFamily: layout.family,
    presentationComposition: layout.kind,
    presentationGround: layout.ground,
    // Descritores resolvidos na composição: o chrome não se reposiciona se a
    // pessoa editar o título depois, e preview/exportação leem o mesmo dado.
    presentationChrome: { family: layout.family, format, ground: layout.ground, chrome: layout.chrome || [] },
    presentationPhotoTreatment: familyPhotoFilter(layout.family),
    presentationPhotoRadius: spec.photo.radius || 0,
    titleSize: rendererTitleSizePercent(layout.titlePx, format),
    subSize: rendererSubtitleSizePercent(layout.bodyPx, format),
    titleLeading: Math.round(spec.type.titleLeading * 100),
    subLeading: Math.round(spec.type.bodyLeading * 100),
    bodyLeading: Math.round(spec.type.bodyLeading * 100),
    align: layout.align,
    layout: `t${layout.align === 'center' ? 'c' : layout.align === 'right' ? 'r' : 'l'}`,
    socialZoneAnchors: { title: layout.anchors?.title || 'start', subtitle: layout.anchors?.subtitle || 'start' },
    overlay: layout.photo && layout.scrim ? layout.scrim.amount : 0,
    overlayMode: layout.photo && layout.scrim ? layout.scrim.mode : undefined,
    textShadow: false,
    ...(recolor ? { titleColor: ink.ink, subtitleColor: ink.ink, textColor: ink.muted } : {}),
    typography: {
      title: {
        fontFamily: display.css, weight: display.weight,
        // O renderer soma a base da fonte (condensada ou não) ao controle.
        tracking: Math.round(((display.tracking || 0) - titleTrackingBase(display.css)) * 100) / 100,
        case: display.case === 'upper' ? 'upper' : 'normal',
        italic: !!layout.titleItalic,
        leadingPercent: Math.round(spec.type.titleLeading * 100),
      },
      subtitle: {
        fontFamily: text.css, weight: Math.max(400, text.weight || 400), case: 'normal', italic: false,
        // O controle do subtítulo tem base -1; zero tipográfico é controle 1.
        tracking: 1 + (text.tracking || 0), leadingPercent: Math.round(spec.type.bodyLeading * 100),
      },
    },
  };
}

function titleLinesAt(value, width, size, fontFamily = '') {
  const condensed = /Bebas|Anton|Condensed/i.test(fontFamily);
  const capacity = Math.max(1, width / (size * (condensed ? 0.43 : 0.55)));
  return String(value || '').split('\n').reduce((total, paragraph) => {
    let lines = 1;
    let used = 0;
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const chars = [...word].length;
      if (used && used + 1 + chars > capacity) { lines += 1; used = 0; }
      if (chars > capacity) {
        lines += Math.ceil(chars / capacity) - 1;
        used = chars % Math.max(1, Math.floor(capacity));
      } else used += (used ? 1 : 0) + chars;
    }
    return total + lines;
  }, 0);
}

/** Escalas fechadas e piso legível; o texto nunca é cortado para caber. */
export function fittedTitleSize(defaultSize, value, zone, fontFamily = '') {
  if (!String(value || '').trim()) return defaultSize;
  const width = 1920 * zone.w / 100 - 24;
  const height = 1080 * zone.h / 100 - 14;
  const steps = Array.from({ length: Math.ceil((defaultSize - 32) / 4) + 1 }, (_, i) => Math.max(32, defaultSize - i * 4));
  const choices = [...new Set([...steps, 32])]
    .filter(size => size <= defaultSize).sort((a, b) => b - a);
  return choices.find(size => titleLinesAt(value, width, 1920 * 0.084 * size / 100, fontFamily)
    * (1920 * 0.084 * size / 100) * 1.1 <= height) || choices.at(-1);
}

export function plannedPresentationTextLimits(kind, slide = {}, deliveryMode = 'hybrid') {
  const live = deliveryMode === 'live';
  const cover = kind === 'cover';
  const closing = kind === 'closing';
  const visual = hasVisual(slide);
  return {
    title: { maxChars: 90, maxLines: cover || closing ? 3 : 2 },
    subtitle: {
      maxChars: cover ? (live ? 140 : 220) : closing ? (live ? 180 : 320) : live ? 180 : visual ? 320 : 360,
      maxLines: live || cover ? 5 : 9,
    },
    body: { maxChars: live ? 90 : cover ? 100 : visual ? 140 : 180, maxLines: live ? 3 : 4 },
    wordsPerSlide: live ? 70 : 110,
  };
}

/** Aplica direção por função sem alterar conteúdo, imagens, cor ou família tipográfica. */
export function contentAwarePresentationOverrides(base, slide = {}, kind = 'content', { pitch = false, deliveryMode = 'hybrid' } = {}) {
  const structured = hasBlocks(slide);
  const visual = hasVisual(slide) && !structured;
  const family = presentationDesignFamily(base);
  const layout = contentAwarePresentationLayout(kind, slide, family);
  const zones = {
    title: layout.title, subtitle: layout.subtitle, photo: layout.photo || inactivePhoto(),
    ...(layout.evidence ? { evidence: layout.evidence } : {}),
  };
  const fields = familyPresentationFields(layout);
  const previousTypography = base.presentationTypographyByComposition || {};
  const typography = previousTypography[kind] || {};
  const displaySize = fields.titleSize;
  const titleSize = fittedTitleSize(structured ? Math.min(46, displaySize) : displaySize, slide.title, zones.title, fields.typography.title.fontFamily);
  // Vale também no Pitch: a caixa cresce só com o texto já escrito; os limites
  // pedidos ao modelo continuam os do pitch.
  const support = kind === 'content' && visual ? grownSupport(layout, slide, base) : null;
  if (support) zones.subtitle = support.zone;
  const subSize = support ? rendererSubtitleSizePercent(support.px) : fields.subSize;
  const titleLeading = fields.titleLeading;
  const bodyLeading = fields.bodyLeading;
  const imagePosition = !layout.photo ? 'none' : layout.photo.x + layout.photo.w / 2 < 50 ? 'left-evidence' : 'right-evidence';
  const rawLimits = pitch ? (base.presentationTextLimits || {}) : plannedPresentationTextLimits(kind, slide, deliveryMode);
  // Limites pedidos ao modelo seguem a caixa da família, não a que cresceu.
  const narrow = layout.subtitle.w < 45 && layout.subtitle.h < 50;
  const narrowed = narrow ? {
    ...rawLimits,
    subtitle: { ...rawLimits.subtitle, maxChars: Math.min(rawLimits.subtitle?.maxChars || 180, 180), maxLines: 6 },
    body: { ...rawLimits.body, maxChars: Math.min(rawLimits.body?.maxChars || 90, 90), maxLines: 3 },
  } : rawLimits;
  // Capa e fechamento têm caixa de apoio pequena; o pedido ao modelo segue a
  // caixa. Páginas de conteúdo mantêm os limites de leitura (o ajuste
  // automático acomoda a variação), para não cortar argumento já aprovado.
  const limits = kind === 'cover' || kind === 'closing'
    ? fitLimitsToZone(narrowed, zones.subtitle, subSize, bodyLeading)
    : narrowed;
  const { typography: familyTypography, ...visualFields } = fields;
  const scrim = visual && layout.photo && layout.scrim ? photoTextScrim(zones, fields, slide) : null;
  return {
    ...base,
    ...visualFields,
    ...(scrim || {}),
    // Texto e imagem possuem superfícies independentes; a foto mantém seu tom
    // salvo quando a família pede texto sobre a fotografia (scrim).
    textBg: false,
    textInset: 0,
    bgFit: 'cover',
    bgZoom: 100,
    photoFraming: 'auto',
    presentationRequiresImage: false,
    presentationSuppressPhoto: !visual || !layout.photo,
    presentationCompositionVersion: 3,
    titleSize,
    subSize,
    titleLeading,
    subLeading: bodyLeading,
    subTracking: familyTypography.subtitle.tracking,
    bodyAfterSize: presentationSupportTextSize(base),
    bodyLeading,
    logoPosition: 'tl',
    logoSize: 80,
    titlePosition: 'top-left',
    imagePosition,
    presentationLayout: {
      ...base.presentationLayout,
      titlePosition: 'top-left',
      imagePosition,
      evidencePosition: structured ? 'family-evidence' : null,
    },
    presentationTextLimits: structured ? {
      ...limits,
      title: { ...limits.title, maxChars: Math.min(limits.title?.maxChars || 90, 90), maxLines: 2 },
      subtitle: { ...limits.subtitle, maxChars: Math.min(limits.subtitle?.maxChars || 180, 180), maxLines: 3 },
      body: { ...limits.body, maxChars: 0, maxLines: 0 },
    } : limits,
    presentationTypographyByComposition: {
      ...previousTypography,
      [kind]: {
        ...typography,
        title: { ...typography.title, ...familyTypography.title, sizePercent: titleSize, leadingPercent: titleLeading, ...(pitch ? { case: 'normal' } : {}) },
        // subtitle is an argument here, not the catalog's uppercase eyebrow.
        subtitle: { ...typography.subtitle, ...familyTypography.subtitle, sizePercent: subSize, leadingPercent: bodyLeading },
      },
    },
    canvas: { ...base.canvas, preserveZones: true, zones },
  };
}

/**
 * Foto em tela cheia com texto sobre o espaço reservado (direção de arte,
 * parte 3): no Cinemático e no Fotográfico o texto fica num lado da foto
 * cheia. A proteção passa a ser lateral, na cor da base da direção visual do
 * deck (a que mais contrasta com a tinta), com a opacidade mínima que garante
 * 4,5:1 sobre o pior pixel da foto. A tinta secundária sobe até ler.
 */
function photoTextScrim(zones, fields, slide) {
  if (!fields.titleColor) return null;
  const vd = coerceVisualDirection(slide?.presentationPlan?.visualDirection);
  const scrim = sideScrim({ zones, inks: [fields.titleColor, fields.subtitleColor], colours: [reservedAreaColour(vd, fields.titleColor)].filter(Boolean) });
  if (!scrim) return null;
  const { surface, ...stored } = scrim;
  return { ...stored, textColor: inkOver(surface, fields.textColor || fields.subtitleColor, fields.subtitleColor) };
}

/**
 * Apoio da página de conteúdo com foto ao lado (spec 1.1, entrega 4). A QA
 * mediu o apoio do Cinemático em 28 px numa coluna de 30% que deixa vazia a
 * metade de baixo do lado esquerdo. A zona desce até o fim da área de leitura
 * (90%, acima de fólio, fio de rodapé e paginação, sem passar do pé da foto) e
 * o corpo cresce em passos de 2 px enquanto o texto estimado couber, até 32 px,
 * o maior corpo de leitura que a biblioteca já usa no 16:9. Nunca diminui;
 * sem texto (limites pedidos antes da redação) a página fica como era.
 */
const SUPPORT_READING_BOTTOM = 90;
const SUPPORT_MAX_PX = 32;

function grownSupport(layout, slide, base) {
  const sub = layout.subtitle;
  const photo = layout.photo;
  const copy = String(slide.subtitle || '').replace(/\*\*/g, '').trim();
  if (!copy || !sub || !photo || layout.longReading || layout.scrim || layout.format !== '16:9') return null;
  // Só com a foto ao lado da coluna de texto, nunca acima ou abaixo dela.
  if (Math.min(sub.x + sub.w, photo.x + photo.w) - Math.max(sub.x, photo.x) > 0) return null;
  const bottom = Math.max(sub.y + sub.h, Math.min(SUPPORT_READING_BOTTOM, photo.y + photo.h));
  const zone = { ...sub, h: Math.round((bottom - sub.y) * 100) / 100 };
  const leading = familySpec(layout.family).type.bodyLeading || 1.5;
  const widthPx = 1920 * zone.w / 100 - 24;
  const heightPx = 1080 * zone.h / 100 - 14;
  // 0,55 em por caractere: estimativa folgada para as fontes de texto da biblioteca.
  const lines = (value, px) => value.split('\n').reduce((n, part) => n + Math.max(1, Math.ceil([...part].length * 0.55 * px / widthPx)), 0);
  const tail = String(slide.bodyAfterImage || '').trim();
  const tailPx = 1920 * 0.018 * presentationSupportTextSize(base) * PRESENTATION_VIEW_FACTOR / 100;
  const height = px => lines(copy, px) * px * leading + (tail ? 0.8 * px + lines(tail, tailPx) * tailPx * leading : 0);
  let px = layout.bodyPx;
  for (let next = layout.bodyPx + 2; next <= SUPPORT_MAX_PX && height(next) <= heightPx; next += 2) px = next;
  return { zone, px };
}

const SURFACE_INK_FIELDS = [['titleColor', 'ink'], ['subtitleColor', 'ink'], ['textColor', 'muted']];

/**
 * Tinta da página recomposta com foto (QA 24/11). A recomposição troca a
 * superfície atrás do texto: a capa do Executivo sai do marinho para o fundo
 * claro com a foto ao lado, e a tinta que a composição gravou para a página
 * sem foto ficava (#F7F7F5 sobre #F7F7F5). A tinta gravada é medida contra a
 * superfície nova e só dá lugar à da composição com foto se não lê (< 4,5:1);
 * sem tinta própria, o card volta à da marca. Cor marcada pela pessoa não muda.
 *
 * Texto que passa a ficar sobre a foto (Ensaio fotográfico, Cinemático) fica
 * como estava: a superfície é a foto e o escurecimento é da pessoa. A
 * composição grava sempre um número nesse campo (0 na página sem foto), então
 * 0 gravado não se distingue de 0 escolhido; a vista não aplica véu nenhum.
 */
function restoredSurfaceFields(slide, kind, family, layout) {
  const now = familyPresentationFields(layout);
  if (now.overlay > 0) return {};
  const before = contentAwarePresentationLayout(kind, { ...slide, bgImage: '', bgImageId: null, bgImageAssetId: null, imageQuery: '' }, family);
  const was = familyPresentationFields(before);
  const surface = layout.inks?.bg;
  const out = {};
  for (const [key, role] of SURFACE_INK_FIELDS) {
    if (slide[key] !== was[key] || was[key] === now[key]) continue;
    const current = slide[key] || before.inks?.[role];
    if (current && surface && wcagContrast(current, surface) >= 4.5) continue;
    out[key] = now[key];
  }
  return out;
}

/**
 * Vista derivada após importar a primeira foto num slide planejado sem imagem.
 * O documento não muda; ajustes manuais da vista são mesclados depois deste
 * helper. Geometrias livres ou já reposicionadas continuam sob controle do autor.
 */
export function restorePresentationPhotoComposition(slide) {
  if (!slide || ![2, 3].includes(slide.presentationCompositionVersion) || !slide.presentationSuppressPhoto
    || !(slide.bgImage || slide.bgImageId || slide.bgImageAssetId) || hasBlocks(slide)
    || slide.canvas?.source !== 'presentation-preset'
    || ['title', 'subtitle', 'bodyAfterImage', 'text', 'photo'].some(key => {
      const offset = slide.elementOffsets?.[key];
      return offset && Object.values(offset).some(value => Number(value) !== 0);
    })) return slide;
  const kind = rolesForRestoredPhoto.has(slide.presentationComposition) ? slide.presentationComposition : 'content';
  const layout = contentAwarePresentationLayout(kind, slide, presentationDesignFamily(slide));
  // Página que a família desenha sem foto (fecho e abertura do Tipográfico,
  // abertura do Cinemático): não há onde pôr a foto. Sem esta saída a zona
  // inativa (96, 94, 1, 1) era desenhada no tamanho mínimo de zona e a foto
  // aparecia num recorte de ~150 × 65 px no canto inferior direito.
  if (!layout.photo) return slide;
  const zones = contentAwarePresentationZones(kind, slide, presentationDesignFamily(slide));
  const previousTypography = slide.presentationTypographyByComposition || {};
  const typography = previousTypography[kind] || {};
  const titleSize = fittedTitleSize(typography.title?.sizePercent || slide.titleSize || 44, slide.title, zones.title, typography.title?.fontFamily);
  const imagePosition = layout.photo && layout.photo.x + layout.photo.w / 2 < 50 ? 'left-evidence' : 'right-evidence';
  const free = slide.presentationFreeDesign ? restoredFreeFields(slide, layout) : null;
  return {
    ...slide,
    ...(free ? free : slide.presentationArtDirectionVersion === 2 ? {
      presentationChrome: familyPresentationFields(layout).presentationChrome,
      presentationGround: layout.ground,
    } : {}),
    ...(!free && slide.presentationArtDirectionVersion === 2 ? restoredSurfaceFields(slide, kind, presentationDesignFamily(slide), layout) : {}),
    presentationSuppressPhoto: false,
    align: 'left',
    layout: 'tl',
    titleSize,
    imagePosition,
    presentationLayout: { ...slide.presentationLayout, imagePosition },
    presentationTypographyByComposition: {
      ...previousTypography,
      [kind]: { ...typography, title: { ...typography.title, sizePercent: titleSize } },
    },
    canvas: { ...slide.canvas, zones },
  };
}
const rolesForRestoredPhoto = new Set(['cover', 'content', 'divider', 'data', 'demo', 'closing']);

/** Tamanho da foto que a página desenha (área da moldura no slide), no vocabulário do modo livre. */
export function photoSizeOfLayout(layout) {
  const p = layout?.photo;
  if (!p) return 'none';
  const area = (p.w * p.h) / 100;
  if (layout.scrim || layout.inkOnPhoto || area > 75) return 'full';
  return area <= 20 ? 'small' : 'half';
}

/**
 * Modo livre: a foto entra na geometria da mesma família e o fundo, a paleta
 * e as fontes do deck ficam. Se a página passa a ter texto sobre a foto, a
 * tinta vira a clara do deck (lida sobre o véu escuro).
 */
function restoredFreeFields(slide, layout) {
  const onPhoto = !!(layout.photo && (layout.scrim || layout.inkOnPhoto));
  const palette = slide.presentationPaletteOverrides || {};
  const lightInk = [palette.inverseInk, palette.bg, '#FFFFFF'].find(c => c && wcagContrast(c, '#111111') >= 4.5) || '#FFFFFF';
  const ground = onPhoto ? 'photo' : slide.presentationFreeDesign.ground;
  const chromeGround = onPhoto ? layout.ground : slide.presentationGround;
  return {
    presentationFreeDesign: { ...slide.presentationFreeDesign, photo: photoSizeOfLayout(layout), ground },
    presentationGround: chromeGround,
    presentationChrome: { ...familyPresentationFields(layout).presentationChrome, ground: chromeGround, fonts: slide.presentationChrome?.fonts },
    ...(onPhoto ? { titleColor: lightInk, subtitleColor: lightInk, textColor: lightInk, customBg: palette.inverse || slide.customBg } : {}),
  };
}

/** Gera a foto na proporção mais próxima da moldura; cover mantém escala uniforme. */
export function presentationPhotoAspectRatio(slide) {
  const zone = slide?.canvas?.zones?.photo;
  if (!zone || ![2, 3].includes(slide?.presentationCompositionVersion) || slide.presentationSuppressPhoto
    || !['x', 'y', 'w', 'h'].every(key => Number.isFinite(zone[key]))
    || zone.w <= 0 || zone.h <= 0) return '16:9';
  const ratio = (1920 * zone.w) / (1080 * zone.h);
  const choices = ['16:9', '3:2', '1:1', '2:3', '9:16'];
  return choices.reduce((best, candidate) => {
    const value = item => {
      const [w, h] = item.split(':').map(Number);
      return Math.abs(Math.log(ratio / (w / h)));
    };
    return value(candidate) < value(best) ? candidate : best;
  }, choices[0]);
}

const validZone = zone => zone && ['x', 'y', 'w', 'h'].every(key => Number.isFinite(zone[key])) && zone.w > 0 && zone.h > 0;

/**
 * Projetos gerados antes da regra "bloco nativo → página de dados" guardaram
 * slides com tabela/métricas/etapas numa composição sem zona de evidência: o
 * bloco não aparecia e a exportação era barrada. Ao abrir, esses slides (e só
 * eles) são recompostos como página de dados da mesma família. Texto, foto,
 * bloco e cores escolhidas pela pessoa não mudam.
 */
export function repairMissingPresentationEvidence(slide) {
  if (!slide || typeof slide !== 'object' || !hasBlocks(slide)) return slide;
  const canvas = slide.canvas;
  if (!canvas?.zones || !(canvas.applied || canvas.enabled)) return slide;
  if (validZone(canvas.zones.evidence)) return slide;
  if (!slide.presentationPresetId && !slide.presentationPatternId) return slide;
  const repaired = contentAwarePresentationOverrides(slide, slide, 'data', { deliveryMode: slide.presentationDeliveryMode || 'hybrid' });
  if (!validZone(repaired.canvas?.zones?.evidence)) return slide;
  return { ...repaired, presentationComposition: 'data', presentationEvidenceRepaired: true };
}

/**
 * O limite de texto pedido ao modelo não pode ser maior que a caixa de leitura
 * da composição. Na capa do Pitch (editorial) a caixa do apoio tem 35% × 15%
 * do slide, cerca de três linhas, mas o pedido era 180 caracteres e 6 linhas:
 * o texto passava da área segura e a exportação era barrada (MF-10). Apoio e
 * texto final dividem a mesma caixa; a estimativa usa 0,5 em por caractere e
 * deixa 10% de folga para quebras.
 */
export function fitLimitsToZone(limits, zone, subSizePercent, leadingPercent = 140, format = '16:9') {
  if (!limits || !zone || !Number.isFinite(zone.w) || !Number.isFinite(zone.h)) return limits;
  const frame = FORMATS[format === '16:9' ? 'apresentacao' : format] || FORMATS.apresentacao;
  const fontPx = frame.w * 0.028 * (Number(subSizePercent) || 100) / 100;
  const lineH = fontPx * (Number(leadingPercent) || 140) / 100;
  const lines = Math.max(1, Math.floor((zone.h / 100 * frame.h) / lineH));
  const perLine = Math.max(8, Math.floor((zone.w / 100 * frame.w) / (fontPx * 0.5)));
  // 1,25×: o ajuste automático ainda reduz o corpo até ~85% antes do piso.
  const capacity = Math.floor(lines * perLine * 0.9 * 1.25);
  const sub = limits.subtitle || {};
  const body = limits.body || {};
  const bodyChars = Math.min(body.maxChars ?? 0, Math.floor(capacity * 0.3));
  const bodyLines = body.maxLines ? Math.min(body.maxLines, Math.max(1, Math.floor(lines * 0.3))) : body.maxLines;
  const subChars = Math.max(40, Math.min(sub.maxChars ?? capacity, capacity - bodyChars));
  const subLines = Math.max(1, Math.min(sub.maxLines ?? lines, lines - (bodyChars ? (bodyLines || 1) : 0)));
  return {
    ...limits,
    subtitle: { ...sub, maxChars: subChars, maxLines: subLines },
    ...(limits.body ? { body: { ...body, maxChars: bodyChars, maxLines: bodyChars ? bodyLines : 0 } } : {}),
  };
}

