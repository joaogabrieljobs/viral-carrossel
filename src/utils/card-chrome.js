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

const temTexto = (valor) => !!String(valor || '').trim();

/**
 * Stories da composição v4: selo e barra sobem 13% da altura para ficar acima
 * da faixa da interface do app (respostas, barra de mensagem). A composição
 * reserva a mesma altura a mais para o texto.
 */
export const STORIES_FOOTER_LIFT = 0.13;

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
