import { isGenerationCancelled, throwIfGenerationCancelled } from './generation-control.js';
import { isPersoHybridDensity, isTendenciaCulturaPreset } from './generation-prompts.js';
import { normalizeInstagramCaption } from './editorial-strategy.js';
import { isPitchPath, buildPitchReviewRules, cleanPitchSlide, cleanPitchText } from './pitch-content.js';

const isObject = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const hasOwn = (o, key) => Object.prototype.hasOwnProperty.call(o, key);
const PRESENTATION_TEXT_FIELDS = ['title', 'subtitle', 'bodyAfterImage'];

function positiveInteger(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : null;
}

/**
 * Sanitizes the per-slide editorial limits supplied by a presentation preset.
 * Missing fields remain unrestricted so older presentation configs keep working.
 */
export function normalizePresentationTextLimits(limits, slideCount = Array.isArray(limits) ? limits.length : 0) {
  const source = Array.isArray(limits) ? limits : [];
  return Array.from({ length: Math.max(0, slideCount) }, (_, slideIndex) => {
    const slideLimit = isObject(source[slideIndex]) ? source[slideIndex] : {};
    return Object.fromEntries(PRESENTATION_TEXT_FIELDS.map((field) => {
      const fieldLimit = isObject(slideLimit[field]) ? slideLimit[field] : {};
      return [field, {
        maxChars: positiveInteger(fieldLimit.maxChars),
        maxLines: positiveInteger(fieldLimit.maxLines),
      }];
    }));
  });
}

/**
 * Converts the runtime metadata stored by each presentation composition into
 * the editorial-review shape. The design system calls the evidence field
 * `body`; the document model calls it `bodyAfterImage`.
 */
export function presentationTextLimitsFromSlides(slides) {
  return (Array.isArray(slides) ? slides : []).map((slide) => {
    const limits = isObject(slide?.presentationTextLimits)
      ? slide.presentationTextLimits
      : {};
    return {
      title: limits.title,
      subtitle: limits.subtitle,
      bodyAfterImage: limits.bodyAfterImage ?? limits.body,
    };
  });
}

function explicitLineCount(value) {
  const text = String(value ?? '').trim();
  return text ? text.split(/\r\n|\r|\n/).length : 0;
}

/**
 * Audits deterministic constraints only. maxLines counts explicit line breaks;
 * visual wrapping remains an editorial instruction because it depends on layout.
 */
export function auditPresentationTextLimits(slides, limits) {
  const safeSlides = Array.isArray(slides) ? slides : [];
  const normalized = normalizePresentationTextLimits(limits, safeSlides.length);
  const violations = [];
  safeSlides.forEach((slide, slideIndex) => {
    for (const field of PRESENTATION_TEXT_FIELDS) {
      const text = String(slide?.[field] ?? '').trim();
      const fieldLimit = normalized[slideIndex][field];
      if (fieldLimit.maxChars && text.length > fieldLimit.maxChars) {
        violations.push({
          slideIndex, field, rule: 'maxChars', actual: text.length, max: fieldLimit.maxChars,
        });
      }
      const lines = explicitLineCount(text);
      if (fieldLimit.maxLines && lines > fieldLimit.maxLines) {
        violations.push({
          slideIndex, field, rule: 'maxLines', actual: lines, max: fieldLimit.maxLines,
        });
      }
    }
  });
  return violations;
}

const FIELD_LABEL = { title: 'título', subtitle: 'subtítulo', bodyAfterImage: 'texto' };

function violationSentence(violation) {
  const name = FIELD_LABEL[violation.field] || 'texto';
  const unit = violation.rule === 'maxLines' ? 'linhas' : 'caracteres';
  return `O ${name} do slide ${violation.slideIndex + 1} passou do limite editorial (${violation.max} ${unit})`;
}

/** Corta no limite, de preferência no fim de uma palavra, sem inventar texto. */
export function fitTextToEditorialLimit(text, limit = {}) {
  let next = String(text ?? '').trim();
  if (limit.maxLines) {
    const lines = next.split(/\r\n|\r|\n/);
    if (lines.length > limit.maxLines) next = lines.slice(0, limit.maxLines).join('\n').trim();
  }
  if (limit.maxChars && next.length > limit.maxChars) {
    const slice = next.slice(0, limit.maxChars);
    const cut = slice.lastIndexOf(' ');
    next = (cut > limit.maxChars * 0.6 ? slice.slice(0, cut) : slice).trim();
  }
  return next;
}

/** Encaixa cada campo no limite do slide. O que já cabe permanece igual. */
export function fitPresentationSlidesToLimits(slides, limits) {
  const safeSlides = Array.isArray(slides) ? slides : [];
  const normalized = normalizePresentationTextLimits(limits, safeSlides.length);
  const fits = [];
  const next = safeSlides.map((slide, slideIndex) => {
    const copy = { ...slide };
    for (const field of PRESENTATION_TEXT_FIELDS) {
      const limit = normalized[slideIndex][field];
      const before = String(copy[field] ?? '');
      const after = fitTextToEditorialLimit(before, limit);
      if (after !== before.trim()) {
        copy[field] = after;
        fits.push({ slideIndex, field, max: limit.maxChars || limit.maxLines });
      }
    }
    return copy;
  });
  return { slides: next, fits };
}

export function assertPresentationTextLimits(slides, limits, context = 'Texto') {
  const violations = auditPresentationTextLimits(slides, limits);
  if (!violations.length) return slides;
  const error = new Error(`${context}: ${violationSentence(violations[0])}.`);
  error.code = 'presentation_text_limit_exceeded';
  error.violations = violations;
  throw error;
}

export function buildPresentationLimitsBlock(config, slideCount, slideIndexes = null) {
  const limits = normalizePresentationTextLimits(config?.presentationTextLimits, slideCount);
  const includedIndexes = Array.isArray(slideIndexes)
    ? new Set(slideIndexes.filter(index => Number.isInteger(index) && index >= 0 && index < limits.length))
    : null;
  const rows = limits.flatMap((slide, slideIndex) => {
    if (includedIndexes && !includedIndexes.has(slideIndex)) return [];
    const fields = PRESENTATION_TEXT_FIELDS.flatMap((field) => {
      const { maxChars, maxLines } = slide[field];
      if (!maxChars && !maxLines) return [];
      const parts = [
        maxChars ? `até ${maxChars} caracteres` : null,
        maxLines ? `até ${maxLines} linhas` : null,
      ].filter(Boolean).join(' e ');
      return `${field}: ${parts}`;
    });
    return fields.length ? [`- Slide ${slideIndex + 1} (slideIndex ${slideIndex}): ${fields.join('; ')}.`] : [];
  });
  if (!rows.length) return '';
  return `\nLIMITES EDITORIAIS OBRIGATÓRIOS POR SLIDE:\n${rows.join('\n')}\nmaxLines descreve o limite visual desejado. Respeite-o editorialmente; a validação automática conta apenas quebras de linha explícitas.`;
}

function bodyAllowed(index, count, presetId, densityId) {
  if (presetId === 'apresentacao') return true;
  return isTendenciaCulturaPreset(presetId)
    ? index > 0 && index < count - 1
    : isPersoHybridDensity(presetId, densityId) && index >= 2;
}

export function validateCarouselDraft(draft, { count, presetId, densityId, presentationPath }) {
  if (!isObject(draft) || !Array.isArray(draft.slides) || draft.slides.length !== count || typeof draft.caption !== 'string') {
    throw new Error('A IA não retornou a quantidade de slides ou a legenda esperada. Tente gerar novamente.');
  }
  const wantsBody = presetId === 'apresentacao'
    || isTendenciaCulturaPreset(presetId)
    || isPersoHybridDensity(presetId, densityId);
  const pitch = presetId === 'apresentacao' && isPitchPath(presentationPath);
  const slides = draft.slides.map((s, index) => {
    if (!isObject(s) || !['title', 'subtitle', 'imageQuery'].every(k => typeof s[k] === 'string') ||
        (wantsBody && typeof s.bodyAfterImage !== 'string')) {
      throw new Error('A IA retornou um campo de texto inválido. Tente gerar novamente.');
    }
    const slide = pitch ? cleanPitchSlide(s) : { ...s };
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
      ? (pitch ? cleanPitchText(draft.caption) : String(draft.caption || '').trim()).slice(0, 2400)
      : normalizeInstagramCaption(draft.caption),
  };
}

export function buildEditorialReviewPrompt(prompt, draft, config = {}) {
  if (config.presetId === 'apresentacao') {
    const limitsBlock = buildPresentationLimitsBlock(config, draft?.slides?.length || config.count || 0);
    const pitch = isPitchPath(config.presentationPath);
    return `REVISÃO DE APRESENTAÇÃO — UMA RODADA, SOMENTE TEXTO.
O briefing abaixo é referência, não um pedido para gerar o deck novamente.
<briefing>\n${prompt}\n</briefing>
<rascunho>\n${JSON.stringify(draft)}\n</rascunho>
Verifique: promessa da capa entregue; caminho escolhido respeitado; uma ideia por slide; progressão sem repetição; títulos legíveis a distância; argumentos e exemplos sustentados pelo material; síntese e próximo passo coerentes.${limitsBlock}
Corrija apenas problemas identificados. Preserve ordem, quantidade, assunto, arco, números e fatos sustentados. Remova ou qualifique alegações sem apoio; não acrescente fontes ou fatos. Não altere imageQuery nem configuração visual.
Use slideIndex começando em zero. Não envie edições para slides que já estejam bons. Cada índice aparece no máximo uma vez. ${pitch ? buildPitchReviewRules() : 'bodyAfterImage continua reservado a fonte, unidade, período, ressalva ou instrução; você pode condensá-lo para cumprir os limites sem mudar seu sentido, números ou fonte.'}
Resposta: um único objeto JSON {"edits":[{"slideIndex":0,"reason":"problema concreto","title":"texto corrigido"}],"caption":"resumo geral corrigido apenas se necessário"}.
Cada edição exige slideIndex e reason; inclua somente os campos que mudam: title, subtitle ou bodyAfterImage. caption é opcional. Se estiver adequado, retorne {"edits":[]}. Sem notas extras ou campos adicionais.`;
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
  const allowedEditFields = ['slideIndex', 'reason', 'title', 'subtitle', 'bodyAfterImage'];
  const editableTextFields = ['title', 'subtitle', 'bodyAfterImage'];
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
  const result = validateCarouselDraft({ ...draft, slides, caption: review.caption ?? draft.caption }, config);
  if (isPresentation) {
    assertPresentationTextLimits(result.slides, config?.presentationTextLimits, 'Revisão');
  }
  return result;
}

/**
 * No máximo duas chamadas: geração + revisão. Falha da revisão preserva apenas
 * um rascunho que já tenha passado pelos limites editoriais da apresentação.
 */
export async function generateReviewedCarousel({ prompt, config, aiOptions, onReview }, callAI) {
  const isPresentation = config?.presetId === 'apresentacao';
  // Entregue os limites ao primeiro rascunho, quando ainda há liberdade para
  // estruturar cada slide. A revisão continua sendo a segunda barreira, mas
  // não deve ser a primeira vez que a IA descobre quanto texto realmente cabe.
  const generationPrompt = isPresentation
    ? `${prompt}${buildPresentationLimitsBlock(config, config?.count || 0)}`
    : prompt;
  const draft = validateCarouselDraft(await callAI(generationPrompt, { ...aiOptions, json: true }), config);
  const draftLimitViolations = isPresentation
    ? auditPresentationTextLimits(draft.slides, config?.presentationTextLimits)
    : [];
  throwIfGenerationCancelled(aiOptions?.signal);
  onReview?.();
  try {
    const review = await callAI(buildEditorialReviewPrompt(prompt, draft, config), { ...aiOptions, json: true });
    const result = applyEditorialReview(draft, review, config);
    return { result, reviewStatus: JSON.stringify(result) === JSON.stringify(draft) ? 'unchanged' : 'revised' };
  } catch (error) {
    if (isGenerationCancelled(error) || aiOptions?.signal?.aborted) throw error;
    // A revisão é a única oportunidade automática de corrigir um primeiro
    // rascunho acima dos limites. Se ela falhar ou continuar inválida, não
    // publique silenciosamente o texto que sabemos que não cabe.
    if (draftLimitViolations.length) {
      const fitted = fitPresentationSlidesToLimits(draft.slides, config?.presentationTextLimits);
      const result = validateCarouselDraft({ ...draft, slides: fitted.slides }, config);
      return { result, reviewStatus: 'fitted', fits: fitted.fits };
    }
    return { result: draft, reviewStatus: 'unavailable' };
  }
}
