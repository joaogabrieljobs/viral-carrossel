import { isGenerationCancelled, throwIfGenerationCancelled } from './generation-control.js';
import { isPersoHybridDensity, isTendenciaCulturaPreset } from './generation-prompts.js';
import { normalizeInstagramCaption } from './editorial-strategy.js';
import { isPitchPath, cleanPitchSlide, cleanPitchText } from './pitch-content.js';
import { presentationAIOptions, buildPresentationReviewRules } from './presentation.js';
import { buildPresentationPlanPrompt, validatePresentationPlan, buildPresentationPlanBlock, attachPresentationPlan } from './presentation-plan.js';
import { buildPresentationBlocksPrompt, normalizePresentationBlocks } from './presentation-quality.js';
import { requiresSocialTitles, recoverSocialTitle, missingSocialTitleIndexes, longSocialSupportIndexes, SOCIAL_SUPPORT_MAX_CHARS, SOCIAL_SUPPORT_MAX_LINES } from './social-generation.js';

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

const COMMERCIAL_CLAIM_PATTERNS = [
  { category: 'garantia', regex: /\b(?:garanti(?:a|do|mos)|resultado garantido|sem risco)\b[^.!?\n]{0,90}/giu },
  { category: 'prazo', regex: /\b(?:pronto|entregue|resultado|receba|comece)\s+(?:em|dentro de)\s+\d+\s*(?:hora|dia|semana|m[eê]s)(?:s|es)?\b[^.!?\n]{0,70}/giu },
  { category: 'preço', regex: /(?:R\$|US\$|\$|€)\s*\d[\d.,]*|\b(?:gr[aá]tis|gratuito|sem taxas?(?: escondidas?)?|sem custo)\b/giu },
  { category: 'item incluso', regex: /\b(?:inclui|inclus[oa]s?|vem com|acompanha)\b[^.!?\n]{1,100}/giu },
];

const normalizeClaim = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

/** Marca promessas objetivas que aparecem no rascunho, mas não no material fornecido. */
export function auditUnsupportedCommercialClaims(slides, source) {
  if (typeof source !== 'string' || !source.trim()) return [];
  const sourceText = normalizeClaim(source);
  const violations = [];
  (Array.isArray(slides) ? slides : []).forEach((slide, slideIndex) => {
    const text = [slide?.title, slide?.subtitle, slide?.bodyAfterImage].filter(Boolean).join(' ');
    for (const rule of COMMERCIAL_CLAIM_PATTERNS) {
      for (const match of text.matchAll(rule.regex)) {
        const claim = String(match[0] || '').trim();
        if (!claim || sourceText.includes(normalizeClaim(claim))) continue;
        violations.push({ slideIndex, category: rule.category, claim });
      }
    }
  });
  return violations;
}

export function validateCarouselDraft(draft, { count, presetId, densityId, presentationPath, nativeBlocks = true, narrativeMode, allowMissingSocialTitles = false, allowLongSocialSupport = false }) {
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
    const titleConfig = { presetId, narrativeMode };
    const slide = pitch ? cleanPitchSlide(s)
      : requiresSocialTitles(titleConfig) ? recoverSocialTitle({ ...s }) : { ...s };
    if (presetId === 'apresentacao' && draft.presentationPlan) {
      slide.presentationBlocks = normalizePresentationBlocks(s.presentationBlocks);
      if (!nativeBlocks && slide.presentationBlocks.length) throw new Error('Este padrão personalizado não permite quadros automáticos.');
      if (s.presentationBlocks != null && (!Array.isArray(s.presentationBlocks) || (s.presentationBlocks.length && !slide.presentationBlocks.length))) {
        throw new Error('A IA retornou uma tabela ou sequência inválida. Seu projeto foi preservado.');
      }
      if (s.speakerNotes != null && typeof s.speakerNotes !== 'string') {
        throw new Error('A IA retornou notas de apresentação inválidas.');
      }
      slide.speakerNotes = String(s.speakerNotes || '').trim();
      if (slide.presentationBlocks.length) {
        // The native block carries the evidence. Keep extra explanation in the
        // editable notes, including any original source/condition lines.
        if (String(s.bodyAfterImage || '').trim()) slide.speakerNotes = [slide.speakerNotes, String(s.bodyAfterImage).trim()].filter(Boolean).join('\n\n');
        slide.bodyAfterImage = '';
        slide.imageQuery = '';
      }
      if (slide.speakerNotes.length > 6000) throw new Error('As notas ultrapassaram o limite desta apresentação.');
    }
    if (wantsBody && !bodyAllowed(index, count, presetId, densityId)) slide.bodyAfterImage = '';
    if (![slide.title, slide.subtitle, wantsBody ? slide.bodyAfterImage : ''].some(v => typeof v === 'string' && v.trim())) {
      throw new Error('A IA retornou um slide sem texto. Tente gerar novamente.');
    }
    if (!allowMissingSocialTitles && missingSocialTitleIndexes([slide], titleConfig).length) {
      throw Object.assign(new Error(`O card ${index + 1} ficou sem título. Seu projeto foi preservado.`), { code: 'social_title_missing' });
    }
    if (!allowLongSocialSupport && longSocialSupportIndexes([slide], titleConfig).length) {
      throw Object.assign(new Error(`O apoio do card ${index + 1} ficou longo demais. Seu projeto foi preservado.`), { code: 'social_support_too_long' });
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
    const plannedRules = config.presentationPlan
      ? `\nCompare também o roteiro validado com a redação: cada pergunta precisa ser respondida e cada argumento deve preservar as evidências e seu estágio (fato, proposta ou desconhecido). O roteiro já foi planejado separadamente. Não acrescente tração, preço, equipe ou promessa ausentes. Notas complementam a página, sem esconder ali a conclusão essencial.\n${buildPresentationPlanBlock(config.presentationPlan)}\nPreserve o tipo do bloco e a integridade dos valores/unidades/condições; não duplique tabela em parágrafos. ${config.nativeBlocks === false ? 'Neste padrão personalizado presentationBlocks permanece [].' : buildPresentationBlocksPrompt()}`
      : '';
    const editableFields = config.presentationPlan
      ? 'title, subtitle, bodyAfterImage, speakerNotes ou presentationBlocks'
      : 'title, subtitle ou bodyAfterImage';
    return `REVISÃO DE APRESENTAÇÃO — UMA RODADA, SOMENTE TEXTO.
O briefing abaixo é referência, não um pedido para gerar o deck novamente.
<briefing>\n${prompt}\n</briefing>
<rascunho>\n${JSON.stringify(draft)}\n</rascunho>
Verifique: promessa da capa entregue; caminho escolhido respeitado; uma ideia por slide; progressão sem repetição; títulos legíveis a distância; argumentos e exemplos sustentados pelo material; síntese e próximo passo coerentes.${limitsBlock}
Corrija apenas problemas identificados. Preserve ordem, quantidade, assunto, arco, números e fatos sustentados. Remova ou qualifique alegações sem apoio; não acrescente fontes ou fatos. Não altere imageQuery nem configuração visual.
Use slideIndex começando em zero. Não envie edições para slides que já estejam bons. Cada índice aparece no máximo uma vez. ${buildPresentationReviewRules(config.presentationPath)}
Resposta: um único objeto JSON {"edits":[{"slideIndex":0,"reason":"problema concreto","title":"texto corrigido"}],"caption":"resumo geral corrigido apenas se necessário"}.
Cada edição exige slideIndex e reason; inclua somente os campos que mudam: ${editableFields}. caption é opcional. Se estiver adequado, retorne {"edits":[]}. Sem texto fora do JSON ou campos adicionais.${plannedRules}`;
  }
  const missingTitles = missingSocialTitleIndexes(draft?.slides, config);
  const longSupport = longSocialSupportIndexes(draft?.slides, config);
  const unsupportedClaims = auditUnsupportedCommercialClaims(draft?.slides, config?.commercialClaimSource);
  const titleRule = requiresSocialTitles(config)
    ? `\nTODOS os cards, em qualquer modo narrativo, exigem title curto e específico, nunca vazio nem "Seu título aqui". Separe a ideia principal de subtitle sem apagar o desenvolvimento. Subtitle deve ocupar no máximo ${SOCIAL_SUPPORT_MAX_LINES} linhas curtas e ${SOCIAL_SUPPORT_MAX_CHARS} caracteres.${missingTitles.length ? ` Correção obrigatória: preencha title nos slideIndex ${missingTitles.join(', ')} usando apenas o argumento já escrito.` : ''}${longSupport.length ? ` Correção obrigatória: condense subtitle nos slideIndex ${longSupport.join(', ')} sem perder fatos.` : ''}`
    : '';
  const claimsRule = unsupportedClaims.length
    ? `\nALEGAÇÕES COMERCIAIS SUGERIDAS SEM APOIO NO BRIEFING — correção obrigatória: ${unsupportedClaims.map(item => `slideIndex ${item.slideIndex}: ${item.claim}`).join('; ')}. Remova a alegação ou qualifique explicitamente como hipótese; não substitua por outra promessa.`
    : '';
  return `REVISÃO EDITORIAL — UMA RODADA, SOMENTE TEXTO.
O briefing abaixo é referência, não um pedido para gerar o carrossel novamente.
<briefing>\n${prompt}\n</briefing>
<rascunho>\n${JSON.stringify(draft)}\n</rascunho>
Verifique: promessa da capa entregue pelo miolo; slide 2 útil; progressão sem repetição; exemplos concretos; afirmações sustentadas pelo material; voz e densidade; legenda complementar; um CTA coerente com o objetivo.${titleRule}${claimsRule}
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
  const planned = isPresentation && !!config.presentationPlan;
  const allowedEditFields = ['slideIndex', 'reason', 'title', 'subtitle', 'bodyAfterImage', ...(planned ? ['speakerNotes', 'presentationBlocks'] : [])];
  const editableTextFields = ['title', 'subtitle', 'bodyAfterImage', ...(planned ? ['speakerNotes'] : [])];
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
    if (planned && hasOwn(edit, 'presentationBlocks')) {
      const normalized = normalizePresentationBlocks(edit.presentationBlocks);
      if (!Array.isArray(edit.presentationBlocks) || (edit.presentationBlocks.length && !normalized.length)) throw new Error('Bloco de revisão inválido');
      slides[edit.slideIndex].presentationBlocks = normalized;
    }
  }
  if (hasOwn(review, 'caption') && typeof review.caption !== 'string') throw new Error('Legenda de revisão inválida');
  const result = validateCarouselDraft({ ...draft, slides, caption: review.caption ?? draft.caption }, config);
  const unsupportedClaims = auditUnsupportedCommercialClaims(result.slides, config?.commercialClaimSource);
  if (unsupportedClaims.length) {
    const error = new Error(`A revisão manteve uma promessa comercial sem apoio no briefing: ${unsupportedClaims[0].claim}.`);
    error.code = 'unsupported_commercial_claim';
    error.violations = unsupportedClaims;
    throw error;
  }
  if (isPresentation) {
    const limits = planned && typeof config.presentationLimitsForPlan === 'function'
      ? config.presentationLimitsForPlan(config.presentationPlan, result.slides)
      : config?.presentationTextLimits;
    assertPresentationTextLimits(result.slides, limits, 'Revisão');
  }
  return result;
}

/**
 * No máximo duas chamadas: geração + revisão. Falha da revisão preserva apenas
 * um rascunho que já tenha passado pelos limites editoriais da apresentação.
 */
export async function generateReviewedCarousel({ prompt, config, aiOptions, onReview, onStage }, callAI) {
  if (config?.presetId === 'apresentacao' && config.presentationPlanning) {
    return generatePlannedPresentation({ prompt, config, aiOptions, onStage, onReview }, callAI);
  }
  const isPresentation = config?.presetId === 'apresentacao';
  const textOptions = {
    ...aiOptions,
    ...presentationAIOptions(config?.presetId, config?.presentationPath),
    json: true,
  };
  // Entregue os limites ao primeiro rascunho, quando ainda há liberdade para
  // estruturar cada slide. A revisão continua sendo a segunda barreira, mas
  // não deve ser a primeira vez que a IA descobre quanto texto realmente cabe.
  const generationPrompt = isPresentation
    ? `${prompt}${buildPresentationLimitsBlock(config, config?.count || 0)}`
    : prompt;
  // Missing titles get the same existing editorial round, not another paid
  // retry. Complete first sentences can already be moved without losing copy.
  const draft = validateCarouselDraft(await callAI(generationPrompt, textOptions), { ...config, allowMissingSocialTitles: true, allowLongSocialSupport: true });
  const draftLimitViolations = isPresentation
    ? auditPresentationTextLimits(draft.slides, config?.presentationTextLimits)
    : [];
  throwIfGenerationCancelled(aiOptions?.signal);
  onReview?.();
  try {
    const review = await callAI(buildEditorialReviewPrompt(prompt, draft, config), textOptions);
    const result = applyEditorialReview(draft, review, config);
    return { result, reviewStatus: JSON.stringify(result) === JSON.stringify(draft) ? 'unchanged' : 'revised' };
  } catch (error) {
    if (isGenerationCancelled(error) || aiOptions?.signal?.aborted) throw error;
    if (missingSocialTitleIndexes(draft.slides, config).length || longSocialSupportIndexes(draft.slides, config).length) {
      // Keep the complete unmodified draft available to callers for recovery;
      // do not replace the current project with known title placeholders.
      throw Object.assign(new Error('A revisão não conseguiu completar os títulos. Seu projeto foi preservado.'), {
        code: missingSocialTitleIndexes(draft.slides, config).length ? 'social_title_missing' : 'social_support_too_long', generatedDraft: draft,
      });
    }
    if (auditUnsupportedCommercialClaims(draft.slides, config?.commercialClaimSource).length) {
      throw Object.assign(new Error('A revisão não conseguiu remover promessas comerciais sem apoio no briefing. Seu projeto foi preservado.'), {
        code: 'unsupported_commercial_claim', generatedDraft: draft,
      });
    }
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

/** A bounded pipeline: outline → draft → review, with one targeted text repair.
 * Source documents remain data. The validated plan, rather than model-supplied
 * layout code, drives the allowlisted compositions in the editor. */
export async function generatePlannedPresentation({ prompt, config, aiOptions, onStage, onReview }, callAI) {
  const textOptions = { ...aiOptions, ...presentationAIOptions('apresentacao', config.presentationPath), json: true, temperature: 0.2 };
  const planning = config.planningContext || {};
  const sources = Array.isArray(planning.sources) ? planning.sources : [];
  throwIfGenerationCancelled(aiOptions?.signal);
  onStage?.('planning');
  const rawPlan = await callAI(buildPresentationPlanPrompt({
    brief: planning.brief || '', sources, count: config.count, presentationPath: config.presentationPath,
  }), { ...textOptions, maxTokens: Math.min(8192, 3072 + config.count * 210) });
  throwIfGenerationCancelled(aiOptions?.signal);
  const validation = validatePresentationPlan(rawPlan, { count: config.count, sources });
  if (!validation.valid) {
    const error = new Error('Não consegui validar o roteiro e suas evidências. Seu projeto foi preservado. Revise o material e tente novamente.');
    error.code = 'presentation_plan_invalid';
    // Codes/paths only; source text must never be logged with this error.
    error.validationErrors = validation.errors;
    throw error;
  }
  const plan = validation.plan;
  const plannedConfig = {
    ...config, presentationPlan: plan,
    presentationTextLimits: typeof config.presentationLimitsForPlan === 'function'
      ? config.presentationLimitsForPlan(plan)
      : config.presentationTextLimits,
  };
  const blockRules = config.nativeBlocks === false ? 'Neste padrão personalizado presentationBlocks deve ser []. Preserve a composição livre do usuário.' : buildPresentationBlocksPrompt();
  const generationPrompt = `${prompt}\n${buildPresentationPlanBlock(plan)}\n${blockRules}\nCONTRATO COMPLEMENTAR: em cada slide inclua presentationBlocks (ou [] quando não houver bloco) e speakerNotes (texto complementar em português, até 3600 caracteres, ou ""). O texto visível deve ser autossuficiente. Não coloque nomes de arquivos, rótulos de extração nem instruções ao designer no texto final. Dados, exemplos e condições permanecem fiéis às evidências. Em slides com bloco, subtitle contextualiza sem repetir suas células; bodyAfterImage fica vazio e o aprofundamento vai para speakerNotes.${buildPresentationLimitsBlock(plannedConfig, config.count)}`;
  onStage?.('writing');
  const rawDraft = await callAI(generationPrompt, textOptions);
  throwIfGenerationCancelled(aiOptions?.signal);
  const attached = attachPresentationPlan({ ...rawDraft, presentationPlan: plan }, plan);
  if (typeof config.presentationLimitsForPlan === 'function') {
    plannedConfig.presentationTextLimits = config.presentationLimitsForPlan(plan, attached.slides);
  }
  const draft = validateCarouselDraft({ ...attached, slides: attached.slides.map(slide => {
    const blocks = normalizePresentationBlocks(slide.presentationBlocks);
    if (!blocks.length || !String(slide.bodyAfterImage || '').trim()) return slide;
    return {
      ...slide,
      bodyAfterImage: '',
      speakerNotes: [slide.speakerNotes, slide.bodyAfterImage].filter(Boolean).join('\n\n'),
    };
  }) }, plannedConfig);
  const violations = auditPresentationTextLimits(draft.slides, plannedConfig.presentationTextLimits);
  onStage?.('reviewing');
  onReview?.();
  try {
    const review = await callAI(buildEditorialReviewPrompt(generationPrompt, draft, plannedConfig), textOptions);
    throwIfGenerationCancelled(aiOptions?.signal);
    const result = applyEditorialReview(draft, review, plannedConfig);
    return { result, plan, reviewStatus: JSON.stringify(result) === JSON.stringify(draft) ? 'unchanged' : 'revised' };
  } catch (error) {
    if (isGenerationCancelled(error) || aiOptions?.signal?.aborted) throw error;
    if (!violations.length) return { result: draft, plan, reviewStatus: 'unavailable' };
    // Never cut the end of a sentence to fit: it may contain a condition or risk.
    // One semantic repair is limited to fields/slides known to exceed the layout.
    const indexes = [...new Set(violations.map(item => item.slideIndex))];
    onStage?.('repairing');
    try {
      const repair = await callAI(`${buildEditorialReviewPrompt(generationPrompt, draft, plannedConfig)}\nREPARO DIRECIONADO: edite somente os slides com slideIndex ${indexes.join(', ')}. Reescreva sem perder números, unidades, hipóteses ou condições. Transfira explicações complementares para speakerNotes, mantendo a conclusão compreensível na página. Não corte frases por caracteres.`, textOptions);
      throwIfGenerationCancelled(aiOptions?.signal);
      if (!Array.isArray(repair?.edits) || repair.edits.some(edit => !indexes.includes(edit?.slideIndex))) throw new Error('Reparo fora do escopo');
      const result = applyEditorialReview(draft, repair, plannedConfig);
      return { result, plan, reviewStatus: 'repaired' };
    } catch (repairError) {
      if (isGenerationCancelled(repairError) || aiOptions?.signal?.aborted) throw repairError;
      return { result: draft, plan, reviewStatus: 'needs_attention', violations };
    }
  }
}
