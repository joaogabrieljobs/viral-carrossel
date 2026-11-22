/**
 * Proporção e enquadramento da imagem gerada, a partir do painel onde ela
 * será exibida — fonte única para o editor, o assistente e os templates.
 *
 * Rodada R2 (15–16/11/2026): toda imagem era pedida na proporção do FORMATO
 * (4:5 no carrossel, 16:9 no deck), mesmo quando o painel da foto era uma
 * faixa horizontal ou uma coluna estreita. Um retrato 2:3 numa faixa 100×49
 * mostra cerca de 40% da altura: o rosto do personagem saiu cortado.
 *
 * Agora pedimos o formato suportado mais próximo do painel. Quando nenhum
 * chega perto (a coluna 46×100 do Feed tem razão 0,37; o mais próximo, 9:16,
 * tem 0,56), o corte é inevitável e a instrução de enquadramento pede o
 * assunto na parte que vai sobrar.
 */

/** Proporções aceitas por todos os provedores de imagem. O SJinn não aceita 4:5. */
export const SUPPORTED_IMAGE_RATIOS = Object.freeze(['16:9', '3:2', '1:1', '2:3', '9:16']);

export const IMAGE_FRAMES = Object.freeze({
  carrossel: Object.freeze({ w: 1080, h: 1350 }),
  quadrado: Object.freeze({ w: 1080, h: 1080 }),
  stories: Object.freeze({ w: 1080, h: 1920 }),
  apresentacao: Object.freeze({ w: 1920, h: 1080 }),
});

const FORMAT_RATIO = Object.freeze({ carrossel: '4:5', quadrado: '1:1', stories: '9:16', apresentacao: '16:9' });

/** Acima disto (erro logarítmico) o corte deixa de ser marginal. */
export const PANEL_MISMATCH_THRESHOLD = 0.2;

const valor = (proporcao) => {
  const [w, h] = String(proporcao).split(':').map(Number);
  return w / h;
};
const erro = (a, b) => Math.abs(Math.log(a / b));

/** Proporção pedida quando a imagem ocupa o card inteiro ou não há painel conhecido. */
export function formatImageAspectRatio(fmt) {
  return FORMAT_RATIO[fmt] || '4:5';
}

/** Formato suportado mais próximo de uma razão largura/altura. Empate: o mais largo. */
export function nearestSupportedRatio(ratio) {
  if (!(ratio > 0)) return SUPPORTED_IMAGE_RATIOS[0];
  return SUPPORTED_IMAGE_RATIOS.reduce((melhor, candidato) => (
    erro(ratio, valor(candidato)) < erro(ratio, valor(melhor)) ? candidato : melhor
  ), SUPPORTED_IMAGE_RATIOS[0]);
}

function activePhotoZone(slide) {
  const canvas = slide?.canvas;
  if (!canvas || !(canvas.enabled || canvas.applied)) return null;
  const zone = canvas.zones?.photo;
  if (!zone || !['x', 'y', 'w', 'h'].every((k) => Number.isFinite(zone[k]))) return null;
  // Zona 1×1 é o marcador de "sem foto" das composições.
  if (zone.w < 10 || zone.h < 10) return null;
  return zone;
}

/**
 * Painel da foto deste slide, ou `null` quando não há zona conhecida.
 * `mismatch` é o erro logarítmico entre o painel e o formato pedido.
 */
export function photoPanelAspect(slide, fmt) {
  const frame = IMAGE_FRAMES[fmt] || IMAGE_FRAMES.carrossel;
  const zone = activePhotoZone(slide);
  if (!zone) return null;
  const zoneRatio = (frame.w * zone.w) / (frame.h * zone.h);
  const fullBleed = zone.w >= 92 && zone.h >= 89;
  const aspectRatio = fullBleed ? formatImageAspectRatio(fmt) : nearestSupportedRatio(zoneRatio);
  // 4:5 não existe nos provedores; para medir o corte vale o que será gerado.
  const gerado = aspectRatio === '4:5' ? 2 / 3 : valor(aspectRatio);
  return { zone, zoneRatio, aspectRatio, fullBleed, mismatch: erro(zoneRatio, gerado), generatedRatio: gerado };
}

/** Proporção a pedir ao gerador para a imagem deste slide. */
export function imageAspectRatioForSlide(slide, fmt) {
  const base = formatImageAspectRatio(fmt);
  // Deck: só a composição versionada tem painel confiável; foto suprimida não tem painel.
  if (fmt === 'apresentacao' && (![2, 3].includes(slide?.presentationCompositionVersion) || slide?.presentationSuppressPhoto)) return base;
  const panel = photoPanelAspect(slide, fmt);
  return panel ? panel.aspectRatio : base;
}

/**
 * Instrução de enquadramento, em inglês, para o gerador de imagem (catálogo
 * final, I27–I30). A regra-base entra uma vez; as variantes acrescentam onde o
 * essencial precisa ficar quando o painel corta a imagem ou há texto sobre a
 * foto. Quem monta o pedido prefixa "FRAMING: ".
 */
export function imageFramingDirection(slide, fmt) {
  const linhas = ['Compose for the final visible image panel. Keep its identifying features and the essential action readable after cropping. Allow deliberate detail shots. Protect faces, hands and key product features when they carry the meaning.'];
  const panel = photoPanelAspect(slide, fmt);
  if (panel && !panel.fullBleed && panel.mismatch > PANEL_MISMATCH_THRESHOLD) {
    linhas.push(panel.zoneRatio < panel.generatedRatio
      ? 'The panel is a tall, narrow column. Keep the essential action and identifying features in the central vertical third; both sides may be cropped.'
      : 'The panel is a wide, shallow band. Keep the essential action in the central horizontal band; the top and bottom may be cropped.');
  }
  const titulo = slide?.canvas?.zones?.title;
  if (panel?.fullBleed && titulo && Number.isFinite(titulo.y) && titulo.y >= 35) {
    linhas.push('Type overlays the lower half of this image. Keep the key face, action and product detail above that zone and leave the entire lower half visually quiet. Do not draw the type.');
  }
  return linhas.join(' ');
}
