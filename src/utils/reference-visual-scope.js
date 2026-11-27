/**
 * Onde a leitura multimodal da referência entra. Apresentação Livre e Livre
 * social novos, com anexo. Remix, estilos fixos e Criar rápido não leem.
 */
import { SOCIAL_FREE_FORMATS, normalizeSocialFreeFormat } from './social-free-prompt.js';

export function readsReferenceVisuals({ presentation = false, presentationFree = false, socialFree = false, remix = false, referenceCount = 0 } = {}) {
  if (remix || !(Number(referenceCount) > 0)) return false;
  return presentation ? presentationFree === true : socialFree === true;
}

/** A aplicação faz parte do contexto do cache: outro formato pede nova leitura. */
export function referenceVisualApplication({ presentation = false, formato = 'carrossel' } = {}) {
  if (presentation) return 'Apresentação horizontal 16:9, com texto em camadas editáveis.';
  const frame = SOCIAL_FREE_FORMATS[normalizeSocialFreeFormat(formato)];
  return `Carrossel social ${frame.ratio}, ${frame.w} × ${frame.h}, com texto, CTA e marca em camadas editáveis.`;
}

/** O plano salvo que carrega a leitura do produto efetivo. */
export function savedReferenceVisualPlan(doc, fmt) {
  if (!doc || typeof doc !== 'object') return null;
  return (fmt === 'apresentacao' ? doc.presentationPlan : doc.socialPlan) || null;
}
