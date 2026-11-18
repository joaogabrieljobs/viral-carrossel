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

/** Altura em px que o rodapé precisa reservar, já com respiro. `brand` deve vir
 *  com os textos de assinatura resolvidos (ver `resolvePresetChrome`). */
export function footerChromeReservePx(brand, f) {
  if (!brand || !f) return 0;
  let reserva = 0;
  if (String(brand.footerPillText || '').trim()) {
    // A seta circular (f.w*0.05) é MAIS ALTA que a linha de texto do selo
    // (f.w*0.026). Medir só pelo texto subdimensionava a faixa em ~19px e o
    // título encostava 10px dentro do selo — exatamente nos três padrões que
    // usam seta, e em nenhum dos que a desligam.
    const comSeta = brand.footerPillArrow !== false;
    const alturaConteudo = Math.max(f.w * 0.026 * 1.25, comSeta ? f.w * 0.05 : 0);
    const alturaPill = f.h * 0.024 + alturaConteudo;
    reserva = Math.max(reserva, f.h * 0.058 + alturaPill);
  }
  const colunas = [brand.footerBarLeft, brand.footerBarCenter, brand.footerBarRight];
  if (colunas.some((c) => String(c || '').trim())) {
    // `label|valor` renderiza duas linhas; só label, uma.
    const temValor = colunas.some((c) => String(c || '').includes('|'));
    const alturaBar = f.w * 0.020 * 1.3 + (temValor ? f.h * 0.004 + f.w * 0.022 * 1.3 : 0);
    reserva = Math.max(reserva, f.h * 0.038 + alturaBar);
  }
  return reserva > 0 ? reserva + f.h * 0.018 : 0;
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
