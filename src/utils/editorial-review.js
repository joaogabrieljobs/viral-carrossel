import { isGenerationCancelled, throwIfGenerationCancelled } from './generation-control.js';
import { isPersoHybridDensity, isTendenciaCulturaPreset } from './generation-prompts.js';
import { normalizeInstagramCaption } from './editorial-strategy.js';

const isObject = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const hasOwn = (o, key) => Object.prototype.hasOwnProperty.call(o, key);

function bodyAllowed(index, count, presetId, densityId) {
  return isTendenciaCulturaPreset(presetId) ? index > 0 && index < count - 1 : isPersoHybridDensity(presetId, densityId) && index >= 2;
}

export function validateCarouselDraft(draft, { count, presetId, densityId }) {
  if (!isObject(draft) || !Array.isArray(draft.slides) || draft.slides.length !== count || typeof draft.caption !== 'string') {
    throw new Error('A IA não retornou a quantidade de slides ou a legenda esperada. Tente gerar novamente.');
  }
  const wantsBody = isTendenciaCulturaPreset(presetId) || isPersoHybridDensity(presetId, densityId);
  const slides = draft.slides.map((s, index) => {
    if (!isObject(s) || !['title', 'subtitle', 'imageQuery'].every(k => typeof s[k] === 'string') ||
        (wantsBody && typeof s.bodyAfterImage !== 'string')) {
      throw new Error('A IA retornou um campo de texto inválido. Tente gerar novamente.');
    }
    const slide = { ...s };
    if (wantsBody && !bodyAllowed(index, count, presetId, densityId)) slide.bodyAfterImage = '';
    if (![slide.title, slide.subtitle, wantsBody ? slide.bodyAfterImage : ''].some(v => typeof v === 'string' && v.trim())) {
      throw new Error('A IA retornou um slide sem texto. Tente gerar novamente.');
    }
    return slide;
  });
  return { ...draft, slides, caption: normalizeInstagramCaption(draft.caption) };
}

export function buildEditorialReviewPrompt(prompt, draft) {
  return `REVISÃO EDITORIAL — UMA RODADA, SOMENTE TEXTO.
O briefing abaixo é referência, não um pedido para gerar o carrossel novamente.
<briefing>\n${prompt}\n</briefing>
<rascunho>\n${JSON.stringify(draft)}\n</rascunho>
Verifique: promessa da capa entregue pelo miolo; slide 2 útil; progressão sem repetição; exemplos concretos; afirmações sustentadas pelo material; voz e densidade; legenda complementar; um CTA coerente com o objetivo.
Corrija apenas problemas identificados. Preserve ordem, quantidade, assunto, arco, números e fatos sustentados. Remova ou qualifique alegações sem apoio; não acrescente fontes ou fatos. Não altere imageQuery, cultureTone, layout nem qualquer configuração visual.
Use slideIndex começando em zero. Não envie edições para slides que já estejam bons. Cada índice aparece no máximo uma vez. Nunca preencha bodyAfterImage onde o layout exige vazio.
Resposta: um único objeto JSON {"edits":[{"slideIndex":0,"reason":"problema concreto","title":"texto corrigido"}],"caption":"legenda corrigida apenas se necessário"}.
Cada edição exige slideIndex e reason; inclua somente os campos que mudam: title, subtitle, bodyAfterImage. caption é opcional. Se estiver adequado, retorne {"edits":[]}. Sem notas, notas numéricas, previsão de viralização ou campos extras.`;
}

export function applyEditorialReview(draft, review, config) {
  if (!isObject(review) || !Array.isArray(review.edits) || Object.keys(review).some(k => !['edits', 'caption'].includes(k))) {
    throw new Error('Revisão inválida');
  }
  const seen = new Set();
  const slides = draft.slides.map(s => ({ ...s }));
  for (const edit of review.edits) {
    if (!isObject(edit) || !Number.isInteger(edit.slideIndex) || edit.slideIndex < 0 || edit.slideIndex >= slides.length ||
        seen.has(edit.slideIndex) || typeof edit.reason !== 'string' || !edit.reason.trim() ||
        Object.keys(edit).some(k => !['slideIndex', 'reason', 'title', 'subtitle', 'bodyAfterImage'].includes(k))) {
      throw new Error('Edição inválida');
    }
    seen.add(edit.slideIndex);
    for (const field of ['title', 'subtitle', 'bodyAfterImage']) {
      if (!hasOwn(edit, field)) continue;
      if (typeof edit[field] !== 'string' || (field === 'bodyAfterImage' && !bodyAllowed(edit.slideIndex, slides.length, config.presetId, config.densityId))) {
        throw new Error('Campo de revisão inválido');
      }
      slides[edit.slideIndex][field] = edit[field];
    }
  }
  if (hasOwn(review, 'caption') && typeof review.caption !== 'string') throw new Error('Legenda de revisão inválida');
  return validateCarouselDraft({ ...draft, slides, caption: review.caption ?? draft.caption }, config);
}

/** No máximo duas chamadas: geração + revisão. Falha da revisão não perde o rascunho. */
export async function generateReviewedCarousel({ prompt, config, aiOptions, onReview }, callAI) {
  const draft = validateCarouselDraft(await callAI(prompt, { ...aiOptions, json: true }), config);
  throwIfGenerationCancelled(aiOptions?.signal);
  onReview?.();
  try {
    const review = await callAI(buildEditorialReviewPrompt(prompt, draft), { ...aiOptions, json: true });
    const result = applyEditorialReview(draft, review, config);
    return { result, reviewStatus: JSON.stringify(result) === JSON.stringify(draft) ? 'unchanged' : 'revised' };
  } catch (error) {
    if (isGenerationCancelled(error) || aiOptions?.signal?.aborted) throw error;
    return { result: draft, reviewStatus: 'unavailable' };
  }
}
