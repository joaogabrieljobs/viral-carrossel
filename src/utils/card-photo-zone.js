/**
 * Zona de foto dos layouts de carrossel que reservam lugar para a imagem
 * (foto em faixa e texto + foto + texto).
 *
 * Card sem foto num desses layouts é desenhado como card só de texto, igual no
 * editor e no arquivo: a zona vazia não guarda espaço. É o mesmo princípio das
 * apresentações (presentation-composition.js): a ausência de foto expande a
 * leitura, em vez de deixar um placeholder vazio.
 *
 * Há mídia para a zona quando:
 *  - a foto existe e não falhou ao carregar;
 *  - a foto está a caminho (`arriving`: lendo do aparelho ou sendo gerada),
 *    para o card não trocar de composição duas vezes enquanto ela chega;
 *  - há vídeo, só no layout que desenha vídeo (`video`).
 * Pedido de foto pendente (`imageQuery`) não é mídia.
 */
export function cardPhotoZoneHasMedia(slide, { loadFailed = false, arriving = false, video = false } = {}) {
  if (video && slide?.videoId) return true;
  if (slide?.bgImage) return !loadFailed;
  return !!arriving;
}
