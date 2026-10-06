import { isGenerationCancelled, throwIfGenerationCancelled } from './generation-control.js';
import { isPersoHybridDensity, isTendenciaCulturaPreset } from './generation-prompts.js';
import { normalizeInstagramCaption } from './editorial-strategy.js';

const isObject = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const hasOwn = (o, key) => Object.prototype.hasOwnProperty.call(o, key);

function bodyAllowed(index, count, presetId, densityId) {
  if (presetId === 'apresentacao') return true;
  return isTendenciaCulturaPreset(presetId)
    ? index > 0 && index < count - 1
    : isPersoHybridDensity(presetId, densityId) && index >= 2;
}

export function validateCarouselDraft(draft, { count, presetId, densityId }) {
  if (!isObject(draft) || !Array.isArray(draft.slides) || draft.slides.length !== count || typeof draft.caption !== 'string') {
    throw new Error('A IA não retornou a quantidade de slides ou a legenda esperada. Tente gerar novamente.');
  }
  const wantsBody = presetId === 'apresentacao'
    || isTendenciaCulturaPreset(presetId)
    || isPersoHybridDensity(presetId, densityId);
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
  const isPresentation = presetId === 'apresentacao';
  return {
    ...draft,
    slides,
    caption: isPresentation
      ? String(draft.caption || '').trim().slice(0, 2400)
      : normalizeInstagramCaption(draft.caption),
  };
}

export function buildEditorialReviewPrompt(prompt, draft, config = {}) {
  if (config.presetId === 'apresentacao') {
    return `REVISÃO DE APRESENTAÇÃO — UMA RODADA, SOMENTE TEXTO.
O briefing abaixo é referência, não um pedido para gerar o deck novamente.
<briefing>\n${prompt}\n</briefing>
<rascunho>\n${JSON.stringify(draft)}\n</rascunho>
Verifique: promessa da capa entregue; caminho escolhido respeitado; uma ideia por slide; progressão sem repetição; títulos legíveis a distância; argumentos e exemplos sustentados pelo material; síntese e próximo passo coerentes.
Corrija apenas problemas identificados. Preserve ordem, quantidade, assunto, arco, números e fatos sustentados. Remova ou qualifique alegações sem apoio; não acrescente fontes ou fatos. Não altere imageQuery nem configuração visual.
Use slideIndex começando em zero. Não envie edições para slides que já estejam bons. Cada índice aparece no máximo uma vez. Preserve bodyAfterImage como fonte, unidade, período, ressalva ou instrução; não o edite nesta revisão.
Resposta: um único objeto JSON {"edits":[{"slideIndex":0,"reason":"problema concreto","title":"texto corrigido"}],"caption":"resumo geral corrigido apenas se necessário"}.
Cada edição exige slideIndex e reason; inclua somente os campos que mudam: title ou subtitle. caption é opcional. Se estiver adequado, retorne {"edits":[]}. Sem notas extras ou campos adicionais.`;
  }
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
  const isPresentation = config?.presetId === 'apresentacao';
  const allowedEditFields = isPresentation
    ? ['slideIndex', 'reason', 'title', 'subtitle']
    : ['slideIndex', 'reason', 'title', 'subtitle', 'bodyAfterImage'];
  const editableTextFields = isPresentation
    ? ['title', 'subtitle']
    : ['title', 'subtitle', 'bodyAfterImage'];
  const seen = new Set();
  const slides = draft.slides.map(s => ({ ...s }));
  for (const edit of review.edits) {
    if (!isObject(edit) || !Number.isInteger(edit.slideIndex) || edit.slideIndex < 0 || edit.slideIndex >= slides.length ||
        seen.has(edit.slideIndex) || typeof edit.reason !== 'string' || !edit.reason.trim() ||
        Object.keys(edit).some(k => !allowedEditFields.includes(k))) {
      throw new Error('Edição inválida');
    }
    seen.add(edit.slideIndex);
    for (const field of editableTextFields) {
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
    const review = await callAI(buildEditorialReviewPrompt(prompt, draft, config), { ...aiOptions, json: true });
    const result = applyEditorialReview(draft, review, config);
    return { result, reviewStatus: JSON.stringify(result) === JSON.stringify(draft) ? 'unchanged' : 'revised' };
  } catch (error) {
    if (isGenerationCancelled(error) || aiOptions?.signal?.aborted) throw error;
    return { result: draft, reviewStatus: 'unavailable' };
  }
}
