/**
 * Geometria dos ornamentos de assinatura do card (selo e barra do rodapé).
 *
 * Os dois são `position:absolute` com `zIndex:25`, então não empurram nada: o
 * bloco de texto ancorado embaixo encosta a base no padding e passa por baixo
 * do ornamento. Estas funções devolvem a faixa que o texto precisa deixar livre.
 *
 * Fonte única: o renderer legado, as zonas do canvas e a composição social
 * usam os mesmos números. Mudar um coeficiente aqui muda os três.
 */
import { FORMATS } from './formats.js';
import { wcagContrast } from './wcag.js';
import { getElementOffset } from './card-elements.js';

const temTexto = (valor) => !!String(valor || '').trim();

/**
 * Stories da composição v4: selo e barra sobem 13% da altura para ficar acima
 * da faixa da interface do app (respostas, barra de mensagem). A composição
 * reserva a mesma altura a mais para o texto.
 */
export const STORIES_FOOTER_LIFT = 0.13;

/** Posição e reserva do chrome exclusivamente no Livre social. As fontes e
 * as escalas são as mesmas do renderer; o catálogo antigo não usa esta régua. */
export function socialFreeChromeGeometry(brand = {}, f, formato = 'carrossel', slide = {}) {
  const safe = { carrossel: [0.085, 0.085], quadrado: [0.09, 0.09], stories: [0.14, 0.18] }[formato] || [0.085, 0.085];
  const frame = f || FORMATS[formato] || FORMATS.carrossel;
  const { w, h } = frame, unit = w / 1080, gap = 24 * unit;
  const scale = value => Math.min(2, Math.max(0.5, (Number(value) || 100) / 100));
  const font = px => Math.max(28 * unit, px);
  const topSafePx = h * safe[0], bottomSafePx = h * safe[1];
  const barScale = scale(brand.footerBarScale), pillScale = scale(brand.footerPillScale);
  const barColumns = [brand.footerBarLeft, brand.footerBarCenter, brand.footerBarRight];
  const hasBar = barColumns.some(temTexto);
  const hasPill = temTexto(brand.footerPillText) && slide.hideFooterPill !== true;
  const barHeight = hasBar ? font(w * 0.020 * barScale) * 1.3
    + (barColumns.some(value => String(value || '').includes('|')) ? h * 0.004 + font(w * 0.022 * barScale) * 1.3 : 0) : 0;
  const pillHeight = hasPill ? h * 0.024 * pillScale
    + Math.max(font(w * 0.026 * pillScale) * 1.25, brand.footerPillArrow !== false ? w * 0.05 * pillScale : 0) : 0;
  const lift = formato === 'stories' ? h * STORIES_FOOTER_LIFT : 0;
  const barBottomPx = Math.max(bottomSafePx, h * 0.038 + lift);
  const pillBottomPx = hasBar ? barBottomPx + barHeight + h * 0.022 : Math.max(bottomSafePx, h * 0.058 + lift);
  const footerReservePx = hasPill ? pillBottomPx + pillHeight + h * 0.018 : hasBar ? barBottomPx + barHeight + h * 0.018 : 0;

  const hasHeader = temTexto(brand.cultureHeaderLeft) || temTexto(brand.cultureHeaderYear);
  const hasBadge = !!brand.showPageBadge;
  const hasHandle = !!brand.showHandle && !!slide.showHandle && temTexto(brand.handle);
  const hasLogo = !slide.logoHidden && !!(slide.logoImage || slide.logoImageId || brand.logo || brand.logoImageId);
  let logoPos = slide.logoPosition || brand.logoPosition || 'tr';
  if (logoPos === 'c' && !slide.elementOffsets?.logo && `${slide.title || ''} ${slide.subtitle || ''} ${slide.bodyAfterImage || ''}`.trim().length > 24) logoPos = 'tr';
  const logoSize = Math.round((Number(slide.logoSize ?? brand.logoSize) || 260) * unit);
  const margin = w * 0.045;
  const headerScale = scale(brand.cultureHeaderScale), badgeScale = scale(brand.pageBadgeScale);
  const rowHeight = Math.max(hasHeader ? font(w * 0.020 * headerScale) * 1.3 : 0,
    hasBadge ? font(w * 0.024 * badgeScale) * 1.3 + h * 0.012 * badgeScale : 0);
  const left = hasLogo && logoPos === 'tl' ? margin + logoSize + gap : w * 0.05;
  const right = hasLogo && logoPos === 'tr' ? margin + logoSize + gap : w * 0.05;
  const headerRightPx = right + (hasBadge ? w * 0.16 * badgeScale + gap : 0);
  const handleTopPx = Math.max(topSafePx, h * (Number(brand.handleBadgeY) || 4) / 100) + (rowHeight ? rowHeight + gap : 0);
  const handleHeight = Math.max(w * 0.034, font(w * 0.022) * 1.3) + h * 0.02 + 2 * unit;
  const logoBottomPx = Math.max(bottomSafePx, footerReservePx ? footerReservePx + gap : 0);
  const textChromeBottomPx = Math.max(topSafePx, rowHeight ? topSafePx + rowHeight + gap : 0,
    hasHandle ? handleTopPx + handleHeight + gap : 0);
  const topReservePx = Math.max(textChromeBottomPx, hasLogo && logoPos.startsWith('t') ? topSafePx + logoSize + gap : 0);
  // A marca ocupa um retângulo, não toda a largura. Esta área pode receber
  // uma foto ou um título quando a composição abaixo do logo ficaria densa.
  const lead = hasLogo && /^t[lr]$/.test(logoPos) && textChromeBottomPx < topSafePx + logoSize
    ? { x: left, y: textChromeBottomPx, w: w - left - right, h: topSafePx + logoSize - textChromeBottomPx } : null;
  const bottomReservePx = Math.max(bottomSafePx, footerReservePx,
    hasLogo && logoPos.startsWith('b') ? logoBottomPx + logoSize + gap : 0);
  return { topSafePx, bottomSafePx, topReservePx, bottomReservePx, footerReservePx,
    barBottomPx, pillBottomPx, barHeight, pillHeight,
    headerTopPx: topSafePx, headerLeftPx: left, headerRightPx, headerHeightPx: font(w * 0.020 * headerScale) * 1.3,
    badgeTopPx: topSafePx, badgeRightPx: right,
    handleTopPx, handleLeftPx: Math.max(left, w * (Number(brand.handleBadgeX) || 5) / 100), handleRightPx: right,
    logoTopPx: topSafePx, logoBottomPx, logoSize, logoPos, lead };
}

/** Altura em px da barra de três colunas; 0 quando nenhuma coluna tem texto. */
export function footerBarHeightPx(brand, f, escala = 1) {
  const colunas = [brand?.footerBarLeft, brand?.footerBarCenter, brand?.footerBarRight];
  if (!f || !colunas.some(temTexto)) return 0;
  // `label|valor` renderiza duas linhas; só label, uma.
  const temValor = colunas.some((c) => String(c || '').includes('|'));
  return f.w * 0.020 * 1.3 * escala + (temValor ? f.h * 0.004 + f.w * 0.022 * 1.3 * escala : 0);
}

/** Altura em px do selo; 0 quando não há texto. */
export function footerPillHeightPx(brand, f, escala = 1) {
  if (!f || !temTexto(brand?.footerPillText)) return 0;
  // A seta circular (f.w*0.05) é MAIS ALTA que a linha de texto do selo
  // (f.w*0.026). Medir só pelo texto subdimensionava a faixa em ~19px e o
  // título encostava 10px dentro do selo — exatamente nos três padrões que
  // usam seta, e em nenhum dos que a desligam.
  const comSeta = brand.footerPillArrow !== false;
  const alturaConteudo = Math.max(f.w * 0.026 * 1.25, comSeta ? f.w * 0.05 : 0);
  return (f.h * 0.024 + alturaConteudo) * escala;
}

/**
 * Distância da base do card até a base do selo. Com a barra de três colunas
 * presente, o selo empilha acima dela: os dois dividiam a mesma faixa e o selo
 * cobria o rótulo da coluna central.
 */
export function footerPillBottomPx(brand, f, escalaBarra = 1) {
  if (!f) return 0;
  const barra = footerBarHeightPx(brand, f, escalaBarra);
  return barra > 0 ? f.h * 0.038 + barra + f.h * 0.022 : f.h * 0.058;
}

/** Altura em px que o rodapé precisa reservar, já com respiro. `brand` deve vir
 *  com os textos de assinatura resolvidos (ver `resolvePresetChrome`). */
export function footerChromeReservePx(brand, f) {
  if (!brand || !f) return 0;
  const barra = footerBarHeightPx(brand, f);
  const selo = footerPillHeightPx(brand, f);
  let reserva = barra > 0 ? f.h * 0.038 + barra : 0;
  if (selo > 0) reserva = Math.max(reserva, footerPillBottomPx(brand, f) + selo);
  return reserva > 0 ? reserva + f.h * 0.018 : 0;
}

/** `#rgb`, `#rrggbb` ou `rgb()/rgba()` → { r, g, b, a }; null se não reconhecer. */
function lerCor(valor) {
  const texto = String(valor || '').trim();
  const hex = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(texto);
  if (hex) {
    const h = hex[1].length === 3 ? hex[1].split('').map((c) => c + c).join('') : hex[1];
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: 1 };
  }
  const rgb = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)$/i.exec(texto);
  if (!rgb) return null;
  const alfa = rgb[4] == null ? 1 : rgb[4].endsWith('%') ? parseFloat(rgb[4]) / 100 : parseFloat(rgb[4]);
  return { r: +rgb[1], g: +rgb[2], b: +rgb[3], a: Math.max(0, Math.min(1, Number.isFinite(alfa) ? alfa : 1)) };
}

const TINTA_ESCURA = '#0a0a0a';
const TINTA_CLARA = '#ffffff';
/** Atrás de um selo translúcido está a foto, normalmente escurecida pelo véu do card. */
const FUNDO_ATRAS_DO_SELO = { r: 40, g: 40, b: 40 };

/**
 * Cores do selo do rodapé. Sem cor de texto definida, o texto é o que mais
 * contrasta com o fundo — o texto escuro fixo ficava preto sobre preto em
 * padrões de destaque escuro (Minimal Clean). Cor escolhida é respeitada.
 */
export function footerPillColors(brand) {
  const bg = brand?.footerPillBg || brand?.accent || TINTA_ESCURA;
  const cor = lerCor(bg);
  // A seta fica num círculo da cor do texto. Com fundo translúcido, desenhá-la
  // na cor do fundo a deixava invisível (branco a 12% sobre creme).
  const seta = (fg) => {
    if (cor && cor.a >= 1) return bg;
    return wcagContrast(TINTA_ESCURA, fg) >= wcagContrast(TINTA_CLARA, fg) ? TINTA_ESCURA : TINTA_CLARA;
  };
  if (brand?.footerPillFg) return { bg, fg: brand.footerPillFg, arrow: seta(brand.footerPillFg) };
  if (!cor) return { bg, fg: TINTA_CLARA, arrow: seta(TINTA_CLARA) };
  const canal = (frente, tras) => Math.round(frente * cor.a + tras * (1 - cor.a));
  const visto = `#${[canal(cor.r, FUNDO_ATRAS_DO_SELO.r), canal(cor.g, FUNDO_ATRAS_DO_SELO.g), canal(cor.b, FUNDO_ATRAS_DO_SELO.b)]
    .map((n) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0')).join('')}`;
  const fg = wcagContrast(TINTA_ESCURA, visto) >= wcagContrast(TINTA_CLARA, visto) ? TINTA_ESCURA : TINTA_CLARA;
  return { bg, fg, arrow: seta(fg) };
}

/**
 * A foto está de fato atrás da barra editorial e do contador (topo do card)?
 * Mesmo critério do rodapé, olhando o topo: com a foto numa moldura, numa
 * faixa mais abaixo ou em coluna lateral, ou quando ela não carregou, os dois
 * ficam sobre o papel do card e branco some em padrão claro (GA-08). A barra
 * começa a 2,8% do topo e vai de 5% a 95% da largura.
 */
export function photoBehindHeaderChrome(slide, { imgErr = false } = {}) {
  if (!slide?.bgImage || imgErr) return false;
  const zona = (slide.canvas?.applied || slide.canvas?.enabled) ? slide.canvas?.zones?.photo : null;
  return !zona || (zona.y <= 3 && zona.y + zona.h >= 6 && zona.x <= 5 && zona.x + zona.w >= 95);
}

/** Caixa percentual efetiva do chrome Livre, incluindo deslocamentos manuais.
 * A detecção antiga continua medindo sua faixa fixa para os estilos legados. */
export function photoBehindChromeRect(slide, rect, { imgErr = false, element = '' } = {}) {
  if (!slide?.bgImage || imgErr || !rect || !(rect.w > 0 && rect.h > 0)) return false;
  const zone = (slide.canvas?.applied || slide.canvas?.enabled) ? slide.canvas?.zones?.photo : null;
  if (!zone) return true;
  const photoOffset = getElementOffset(slide, 'photo');
  const chromeOffset = getElementOffset(slide, element);
  const photo = { ...zone, x: zone.x + photoOffset.x, y: zone.y + photoOffset.y };
  const chrome = { ...rect, x: rect.x + chromeOffset.x, y: rect.y + chromeOffset.y };
  return Math.min(photo.x + photo.w, chrome.x + chrome.w) > Math.max(photo.x, chrome.x)
    && Math.min(photo.y + photo.h, chrome.y + chrome.h) > Math.max(photo.y, chrome.y);
}

/**
 * Tintas da barra editorial e do contador no desenho do Cultura (sem
 * composição, composição com zonas e foto em faixa). Fora da foto eram escuras
 * fixas e sumiam em marca de fundo escuro (GA-10): aí valem as tintas claras
 * de quando há foto. Fundo em que o escuro lê melhor continua como era.
 */
export function cultureHeaderInks(onPhoto, surface) {
  const claras = { bar: 'rgba(255,255,255,0.62)', badgeBg: 'rgba(0,0,0,0.32)', badgeFg: '#fff' };
  if (onPhoto) return claras;
  const cor = lerCor(surface);
  const hex = cor ? `#${[cor.r, cor.g, cor.b].map((n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')).join('')}` : '';
  if (hex && wcagContrast('#1d1d1f', hex) < wcagContrast(TINTA_CLARA, hex)) return claras;
  return { bar: 'rgba(29,29,31,0.45)', badgeBg: 'rgba(0,0,0,0.07)', badgeFg: '#1d1d1f' };
}

/**
 * Mesma reserva em % da altura, arredondada para cima em passos de 0,5.
 * As zonas do canvas são percentuais; arredondar para cima nunca deixa o
 * texto entrar na faixa do ornamento.
 */
export function footerChromeReservePct(brand, formato = 'carrossel') {
  const f = typeof formato === 'string' ? (FORMATS[formato] || FORMATS.carrossel) : formato;
  const px = footerChromeReservePx(brand, f);
  if (!(px > 0) || !(f?.h > 0)) return 0;
  // Tolerância: 189/1350 vira 14,000000000000002 em ponto flutuante e subiria meio ponto à toa.
  return Math.ceil((px / f.h) * 100 * 2 - 1e-6) / 2;
}

/** Zonas baixas sobem em bloco; zonas altas só encurtam (pontos percentuais). */
const MIN_ALTURA_PARA_ENCURTAR = 20;

/**
 * Proteção de render: devolve as zonas de título e apoio acima de `basePct`.
 *
 * A composição nova já nasce acima do rodapé. Isto cobre o que ela não vê:
 * projeto gerado antes da reserva existir, ou selo/barra que a pessoa
 * acrescentou depois de as zonas terem sido gravadas. Só age quando há
 * sobreposição real; sem ela devolve as mesmas zonas.
 *
 * - Zona de apoio alta (texto ancorado em cima): encurta.
 * - Zona de apoio baixa (capa, texto ancorado embaixo): sobe, e leva o
 *   título junto para conservar o intervalo entre os dois.
 */
export function textZonesAboveFooter({ title, subtitle }, basePct) {
  if (!title || !subtitle || !(basePct < 100)) return { title, subtitle };
  const excesso = (z) => Math.max(0, z.y + z.h - basePct);
  let t = title;
  let s = subtitle;
  const dSub = excesso(s);
  if (dSub > 0) {
    if (s.h - dSub >= MIN_ALTURA_PARA_ENCURTAR) {
      s = { ...s, h: s.h - dSub };
    } else {
      s = { ...s, y: Math.max(0, s.y - dSub) };
      const mesmaColuna = t.x < subtitle.x + subtitle.w && subtitle.x < t.x + t.w;
      const intervalo = Math.max(0, subtitle.y - (title.y + title.h));
      const invasao = t.y + t.h + intervalo - s.y;
      if (mesmaColuna && invasao > 0) t = { ...t, y: Math.max(0, t.y - invasao) };
    }
  }
  const dTit = excesso(t);
  if (dTit > 0) t = { ...t, h: Math.max(4, t.h - dTit) };
  return { title: t, subtitle: s };
}

/**
 * A proteção vale para a composição social gerada que a pessoa não mexeu:
 * zona editada à mão ou elemento arrastado ficam exatamente onde ela deixou.
 */
export function footerGuardApplies(slide, hasOffset = () => false) {
  const canvas = slide?.canvas;
  if (!canvas || canvas.source !== 'social-preset') return false;
  if (canvas.userEdited || canvas.enabled) return false;
  return !hasOffset(slide, 'title') && !hasOffset(slide, 'subtitle');
}
