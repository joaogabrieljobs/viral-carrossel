import { isGenerationCancelled, throwIfGenerationCancelled } from './generation-control.js';
import { isPersoHybridDensity, isTendenciaCulturaPreset } from './generation-prompts.js';
import { normalizeInstagramCaption } from './editorial-strategy.js';
import { isPitchPath, cleanPitchSlide, cleanPitchText } from './pitch-content.js';
import { presentationAIOptions, buildPresentationReviewRules, getPresentationPath } from './presentation.js';
import { buildPresentationPlanBlock, attachPresentationPlan } from './presentation-plan.js';
import { generatePresentationPlan, parsePresentationPlanResponse, presentationResponseMetadata } from './presentation-planning.js';
import { buildPresentationBlocksPrompt, normalizePresentationBlocks } from './presentation-quality.js';
import { requiresSocialTitles, recoverSocialTitle, recoverSocialTitleForEditing, missingSocialTitleIndexes, auditSocialTextDensity, buildSocialTextLimitsPrompt } from './social-generation.js';
import { auditDraftFactuality, auditUnsupportedCommercialClaims, buildFactualGroundingPrompt } from './factual-grounding.js';
export { auditUnsupportedCommercialClaims } from './factual-grounding.js';

const isObject = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const hasOwn = (o, key) => Object.prototype.hasOwnProperty.call(o, key);
const PRESENTATION_TEXT_FIELDS = ['title', 'subtitle', 'bodyAfterImage'];
export const PRESENTATION_REVIEW_SYSTEM_PROMPT = `Você é o revisor factual e editorial de uma apresentação existente. Sua única entrega é um objeto JSON de correções {"edits":[{"slideIndex":0,"reason":"problema concreto","title":"texto corrigido"}]}, com caption geral opcional. Nunca devolva slides, um novo deck, plano, evidências, raciocínio ou markdown. Use apenas os campos de correção permitidos no pedido.
Respeite integralmente as instruções atuais do usuário, inclusive limites para exemplos, exercícios, idioma, ficção e uso exclusivo dos dados fornecidos. As fontes originais são a base factual; rascunho, roteiro gerado e exemplos de estilo não comprovam nada. O roteiro orienta a estrutura e também pode conter erros.
Confira títulos, textos, blocos nativos, notas e resumo. Remova nomes, datas, fornecedores, cenários, compromissos e números que o rascunho acrescentou sem apoio ou sem autorização explícita. Chamar algo de fictício ou didático não autoriza inventar um exemplo quando o usuário pediu somente os dados fornecidos. Não resolva uma lacuna criando outro detalhe. Preserve condições, exclusões, modalidade, unidades, base, período e limitações; decisão pendente continua pendente. Aceite não implica encerramento contratual. Corrija apenas os campos necessários; preserve quantidade, ordem e conteúdo sustentado. Se não houver correção necessária, devolva {"edits":[]}.`;

function plannedReviewStructure(plan) {
  return `ROTEIRO — SOMENTE ESTRUTURA, NÃO É FONTE FACTUAL:
${JSON.stringify({ slides: (plan.slides || []).map(({ index, purpose, visualRole, question }) => ({ index, purpose, visualRole, question })) })}`;
}

function presentationReviewBlockContract(nativeBlocks) {
  if (nativeBlocks === false) return 'Neste padrão personalizado presentationBlocks permanece [].';
  return `CONTRATO DE PATCH PARA BLOCOS: só inclua presentationBlocks na edição se esse campo precisar mudar. O valor substitui o array existente: [] ou exatamente um bloco de um destes tipos:
- comparison: type, headers (2–4 strings até 80 caracteres), rows (1–5 linhas com o mesmo número de células dos cabeçalhos; cada célula até 240).
- metrics: type, items (1–4 objetos com label até 100, value até 48 e detail opcional até 180 caracteres).
- steps: type, items (2–5 objetos com title até 100 e body opcional até 260 caracteres).
Preserve o tipo e a ordem do bloco. Os valores devem vir das fontes originais; não preencha ausências com zero, nomes, datas, exemplos ou comparações inventadas. Não gere um objeto de slide ou configurações visuais dentro do patch.`;
}

function plannedReviewBriefing(config, planning, sources) {
  // Do not reuse the writing prompt: it includes layout recipes and example
  // decks that the reviewer must never mistake for this project's evidence.
  return `PEDIDO ATUAL E FONTES ORIGINAIS — DADOS PARA CONFERÊNCIA:
${JSON.stringify({
    brief: planning.brief || '',
    userInstructions: config.userInstructions || '',
    factualContext: config.factualSource ?? config.commercialClaimSource ?? '',
    sources: sources.filter(isObject).map(source => ({
      id: source.id, title: source.title || '',
      excerpts: (Array.isArray(source.chunks) && source.chunks.length ? source.chunks.map(chunk => chunk?.text) : [source.text])
        .filter(text => typeof text === 'string'),
    })),
  })}`;
}

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

export function normalizeCarouselDraftInput(rawDraft, { count, presetId, densityId } = {}) {
  let draft = rawDraft;
  if (isObject(draft) && !Array.isArray(draft.slides)) {
    const wrapper = ['carrossel', 'carousel', 'result', 'data']
      .map(key => draft[key])
      .find(value => isObject(value) && Array.isArray(value.slides));
    if (wrapper) draft = wrapper;
  }
  if (!isObject(draft) || !Array.isArray(draft.slides)) return { draft, issues: ['invalid_shape'] };
  const expected = Number.isInteger(count) && count > 0 ? count : draft.slides.length;
  const wantsBody = presetId === 'apresentacao'
    || isTendenciaCulturaPreset(presetId)
    || isPersoHybridDensity(presetId, densityId);
  const issues = [];
  if (draft.slides.length !== expected) issues.push(draft.slides.length > expected ? 'extra_slides_trimmed' : 'missing_slides_padded');
  const meaningfulCount = draft.slides.filter((slide) => {
    if (!isObject(slide)) return false;
    const visibleText = ['title', 'subtitle', 'bodyAfterImage', 'speakerNotes']
      .some(field => typeof slide[field] === 'string' && slide[field].trim());
    return visibleText || (Array.isArray(slide.presentationBlocks) && slide.presentationBlocks.length > 0);
  }).length;
  const minimumMeaningful = expected <= 2 ? 1 : Math.max(2, Math.ceil(expected * 0.4));
  if (meaningfulCount < minimumMeaningful) issues.push('insufficient_draft_content');
  const slides = draft.slides.slice(0, expected).map((slide) => {
    const source = isObject(slide) ? slide : {};
    if (!isObject(slide)) issues.push('invalid_slide_normalized');
    const normalizeField = (field) => {
      if (source[field] == null) return '';
      return typeof source[field] === 'string' ? source[field] : String(source[field]);
    };
    return {
      ...source,
      title: normalizeField('title'),
      subtitle: normalizeField('subtitle'),
      imageQuery: normalizeField('imageQuery'),
      ...(wantsBody ? { bodyAfterImage:normalizeField('bodyAfterImage') } : {}),
    };
  });
  while (slides.length < expected) {
    slides.push({ title:'', subtitle:'', imageQuery:'', ...(wantsBody ? { bodyAfterImage:'' } : {}) });
  }
  return {
    draft:{ ...draft, slides, caption:typeof draft.caption === 'string' ? draft.caption : '' },
    issues:[...new Set(issues)],
  };
}

export function validateCarouselDraft(rawDraft, { count, presetId, densityId, presentationPath, nativeBlocks = true, narrativeMode, allowMissingSocialTitles = false, allowLongSocialSupport = false, allowIncompleteDraft = false }) {
  const normalized = normalizeCarouselDraftInput(rawDraft, { count, presetId, densityId });
  const draft = normalized.draft;
  if (!isObject(draft) || !Array.isArray(draft.slides)
    || normalized.issues.includes('insufficient_draft_content')
    || (!allowIncompleteDraft && normalized.issues.includes('missing_slides_padded'))) {
    throw new Error('A IA não retornou conteúdo suficiente para montar os slides. Tente gerar novamente.');
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
    const titleConfig = { presetId, narrativeMode, densityId };
    const slide = pitch ? cleanPitchSlide(s)
      : requiresSocialTitles(titleConfig) ? recoverSocialTitle({ ...s }) : { ...s };
    if (presetId === 'apresentacao' && draft.presentationPlan && !String(slide.title || '').trim()) {
      throw Object.assign(new Error(`O slide ${index + 1} precisa de um título específico.`), { code: 'presentation_title_missing', field: 'title', slideIndex: index });
    }
    if (presetId === 'apresentacao' && draft.presentationPlan) {
      slide.presentationBlocks = normalizePresentationBlocks(s.presentationBlocks);
      if (!nativeBlocks && slide.presentationBlocks.length) throw Object.assign(new Error('Este padrão personalizado não permite quadros automáticos.'), { code: 'presentation_blocks_not_allowed', field: 'presentationBlocks', slideIndex: index });
      if (s.presentationBlocks != null && (!Array.isArray(s.presentationBlocks) || (s.presentationBlocks.length && !slide.presentationBlocks.length))) {
        throw Object.assign(new Error('A IA retornou uma tabela ou sequência inválida. Seu projeto foi preservado.'), { code: 'presentation_blocks_invalid', field: 'presentationBlocks', slideIndex: index });
      }
      if (s.speakerNotes != null && typeof s.speakerNotes !== 'string') {
        throw Object.assign(new Error('A IA retornou notas de apresentação inválidas.'), { code: 'presentation_notes_invalid', field: 'speakerNotes', slideIndex: index });
      }
      slide.speakerNotes = String(s.speakerNotes || '').trim();
      if (slide.presentationBlocks.length) {
        // The native block carries the evidence. Keep extra explanation in the
        // editable notes, including any original source/condition lines.
        if (String(s.bodyAfterImage || '').trim()) slide.speakerNotes = [slide.speakerNotes, String(s.bodyAfterImage).trim()].filter(Boolean).join('\n\n');
        slide.bodyAfterImage = '';
        slide.imageQuery = '';
      }
      if (slide.speakerNotes.length > 6000) throw Object.assign(new Error('As notas ultrapassaram o limite desta apresentação.'), { code: 'presentation_notes_too_long', field: 'speakerNotes', slideIndex: index });
    }
    if (wantsBody && !bodyAllowed(index, count, presetId, densityId)) slide.bodyAfterImage = '';
    if (!allowIncompleteDraft && ![slide.title, slide.subtitle, wantsBody ? slide.bodyAfterImage : ''].some(v => typeof v === 'string' && v.trim())) {
      throw new Error('A IA retornou um slide sem texto. Tente gerar novamente.');
    }
    if (!allowIncompleteDraft && !allowMissingSocialTitles && missingSocialTitleIndexes([slide], titleConfig).length) {
      throw Object.assign(new Error(`O card ${index + 1} ficou sem título. Seu projeto foi preservado.`), { code: 'social_title_missing' });
    }
    if (!allowLongSocialSupport && auditSocialTextDensity([slide], titleConfig).length) {
      throw Object.assign(new Error(`O texto do card ${index + 1} ficou longo demais. Seu projeto foi preservado.`), { code: 'social_support_too_long' });
    }
    return slide;
  });
  const isPresentation = presetId === 'apresentacao';
  const normalizationIssues = [...new Set([...(Array.isArray(draft.normalizationIssues) ? draft.normalizationIssues : []), ...normalized.issues])];
  return {
    ...draft,
    slides,
    ...(normalizationIssues.length ? { normalizationIssues } : {}),
    caption: isPresentation
      ? (pitch ? cleanPitchText(draft.caption) : String(draft.caption || '').trim()).slice(0, 2400)
      : normalizeInstagramCaption(draft.caption),
  };
}

export function buildEditorialReviewPrompt(prompt, draft, config = {}) {
  if (config.presetId === 'apresentacao') {
    const limitsBlock = buildPresentationLimitsBlock(config, draft?.slides?.length || config.count || 0);
    const lessonRepair = getPresentationPath(config.presentationPath).id === 'aula_workshop'
      ? ' Em Aula, o arco a preservar é o aprendizado: corrija uma etapa de prática/correção omitida e não mantenha um desvio comercial só porque ele foi planejado, sem alterar quantidade ou ordem física.'
      : '';
    const plannedRules = config.presentationPlan
      ? `\nCompare também o roteiro validado com a redação: cada pergunta precisa ser respondida, mas fatos e estágio (fato, proposta ou desconhecido) devem ser conferidos nas fontes originais. Validar a estrutura do roteiro não comprova suas afirmações. Não use o roteiro nem o rascunho como fonte de si mesmos. Não acrescente tração, preço, equipe ou promessa ausentes. Notas complementam a página, sem esconder ali a conclusão essencial.\n${plannedReviewStructure(config.presentationPlan)}\nPreserve o tipo do bloco e a integridade dos valores/unidades/condições; não duplique tabela em parágrafos. ${presentationReviewBlockContract(config.nativeBlocks)}`
      : '';
    const reviewDraft = config.presentationPlan ? {
      slides: draft.slides.map(slide => Object.fromEntries(['title', 'subtitle', 'bodyAfterImage', 'speakerNotes', 'presentationBlocks']
        .filter(field => hasOwn(slide, field)).map(field => [field, slide[field]]))),
      caption: draft.caption,
    } : draft;
    const editableFields = config.presentationPlan
      ? 'title, subtitle, bodyAfterImage, speakerNotes ou presentationBlocks'
      : 'title, subtitle ou bodyAfterImage';
    return `REVISÃO DE APRESENTAÇÃO — UMA RODADA, SOMENTE TEXTO.
O briefing abaixo é referência, não um pedido para gerar o deck novamente.
<briefing>\n${prompt}\n</briefing>
<rascunho>\n${JSON.stringify(reviewDraft)}\n</rascunho>
Verifique: promessa da capa entregue; caminho escolhido respeitado; uma ideia por slide; progressão sem repetição; títulos legíveis a distância; argumentos e exemplos sustentados pelo material; síntese e próximo passo coerentes.${limitsBlock}
Leia todos os campos do rascunho, inclusive blocos nativos, speakerNotes e caption. Verifique fatos, estágio e condições em cada campo, não apenas no texto principal. Decisão pendente permanece pendente; aceite não autoriza deduzir encerramento contratual. Base, período e condições essenciais de indicadores e escopo devem estar visíveis no slide correspondente, não somente nas notas.
Corrija apenas problemas identificados. Preserve ordem, quantidade, assunto, arco, números e fatos sustentados.${lessonRepair} Remova ou qualifique alegações sem apoio; não acrescente fontes ou fatos. Não altere imageQuery nem configuração visual.
Use slideIndex começando em zero. Não envie edições para slides que já estejam bons. Cada índice aparece no máximo uma vez. ${buildPresentationReviewRules(config.presentationPath)}
Resposta: um único objeto JSON {"edits":[{"slideIndex":0,"reason":"problema concreto","title":"texto corrigido"}],"caption":"resumo geral corrigido apenas se necessário"}.
Cada edição exige slideIndex e reason; inclua somente os campos que mudam: ${editableFields}. caption é opcional. Se estiver adequado, retorne {"edits":[]}. Sem texto fora do JSON ou campos adicionais.${plannedRules}`;
  }
  const missingTitles = missingSocialTitleIndexes(draft?.slides, config);
  const longSupport = [...new Set(auditSocialTextDensity(draft?.slides, config).map(item => item.slideIndex))];
  const unsupportedClaims = auditDraftFactuality(draft, config);
  const titleRule = requiresSocialTitles(config)
    ? `\nTODOS os cards, em qualquer modo narrativo, exigem title curto e específico, nunca vazio nem "Seu título aqui". Separe a ideia principal de subtitle sem apagar o desenvolvimento. ${buildSocialTextLimitsPrompt(config)}${missingTitles.length ? ` Correção obrigatória: preencha title nos slideIndex ${missingTitles.join(', ')} usando apenas o argumento já escrito.` : ''}${longSupport.length ? ` Correção obrigatória: condense o texto nos slideIndex ${longSupport.join(', ')} sem perder fatos ou condições. Não transfira excesso de subtitle para bodyAfterImage: a soma também tem limite.` : ''}`
    : '';
  const claimsRule = unsupportedClaims.length
    ? `\nALEGAÇÕES COMERCIAIS SUGERIDAS SEM APOIO E OUTROS DADOS NÃO SUSTENTADOS — correção obrigatória: ${unsupportedClaims.map(item => `${item.slideIndex == null ? 'caption' : `slideIndex ${item.slideIndex}, ${item.field}`}: ${item.claim}`).join('; ')}. Remova o detalhe sem apoio; não substitua por outra promessa. Qualificar um número inventado como possibilidade não o transforma em fato.`
    : '';
  const explicitScriptRule = config?.explicitCardScript?.count
    ? `\nROTEIRO EXPLÍCITO DO USUÁRIO — preserve a correspondência entre cada bloco e o slideIndex equivalente. Não funda, reordene, mova para outro card nem omita um bloco. A revisão pode melhorar clareza e encaixe dentro do próprio card, sem trocar sua função, fatos ou intenção.`
    : '';
  return `REVISÃO EDITORIAL — UMA RODADA, SOMENTE TEXTO.
O briefing abaixo é referência, não um pedido para gerar o carrossel novamente.
<briefing>\n${prompt}\n</briefing>
<rascunho>\n${JSON.stringify(draft)}\n</rascunho>
${buildFactualGroundingPrompt(config)}
Verifique: promessa da capa entregue pelo miolo; slide 2 útil; progressão sem repetição; exemplos concretos; afirmações sustentadas pelo material; voz e densidade; legenda complementar; um CTA coerente com o objetivo; linguagem idiomática e natural. Corrija traduções literais, provérbios inventados, ditados combinados e metáforas ambíguas ou sem sentido.${titleRule}${claimsRule}${explicitScriptRule}
Corrija apenas problemas identificados. Preserve ordem, quantidade, assunto, arco, números e fatos sustentados. Remova ou qualifique alegações sem apoio; não acrescente fontes ou fatos. Não altere imageQuery, cultureTone, layout nem qualquer configuração visual.
Use slideIndex começando em zero. Não envie edições para slides que já estejam bons. Cada índice aparece no máximo uma vez. Nunca preencha bodyAfterImage onde o layout exige vazio.
Resposta: um único objeto JSON {"edits":[{"slideIndex":0,"reason":"problema concreto","title":"texto corrigido"}],"caption":"legenda corrigida apenas se necessário"}.
Cada edição exige slideIndex e reason; inclua somente os campos que mudam: title, subtitle, bodyAfterImage. caption é opcional. Se estiver adequado, retorne {"edits":[]}. Sem notas, notas numéricas, previsão de viralização ou campos extras.`;
}

function unwrapEditorialReview(review) {
  if (isObject(review) && !Array.isArray(review.edits)) {
    const wrapper = ['review', 'editorialReview', 'result', 'data']
      .map(key => review[key])
      .find(value => isObject(value) && Array.isArray(value.edits));
    if (wrapper) return wrapper;
  }
  return review;
}

export function applyEditorialReview(draft, review, config, { deferQualityChecks = false } = {}) {
  review = unwrapEditorialReview(review);
  if (!isObject(review) || !Array.isArray(review.edits)) {
    throw new Error('Revisão inválida');
  }
  const isPresentation = config?.presetId === 'apresentacao';
  const planned = isPresentation && !!config.presentationPlan;
  const editableTextFields = ['title', 'subtitle', 'bodyAfterImage', ...(planned ? ['speakerNotes'] : [])];
  if (planned && Object.keys(review).some(key => !['edits', 'caption'].includes(key))) throw new Error('A revisão deve retornar somente correções, não outro deck.');
  const seen = new Set();
  const slides = draft.slides.map(s => ({ ...s }));
  for (const edit of review.edits) {
    if (!isObject(edit) || !Number.isInteger(edit.slideIndex) || edit.slideIndex < 0 || edit.slideIndex >= slides.length ||
        seen.has(edit.slideIndex) || typeof edit.reason !== 'string' || !edit.reason.trim()) {
      throw new Error('Edição inválida');
    }
    if (planned && Object.keys(edit).some(key => !['slideIndex', 'reason', ...editableTextFields, 'presentationBlocks'].includes(key))) throw new Error('Campo não permitido na revisão.');
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
  const result = validateCarouselDraft({ ...draft, slides, caption: review.caption ?? draft.caption }, deferQualityChecks
    ? { ...config, allowMissingSocialTitles: true, allowLongSocialSupport: true, allowIncompleteDraft: true }
    : config);
  const unsupportedClaims = isPresentation
    ? auditUnsupportedCommercialClaims(result.slides, planned ? [config.factualSource, config.userInstructions].filter(Boolean).join('\n') : config?.commercialClaimSource)
    : auditDraftFactuality(result, config);
  if (!deferQualityChecks && unsupportedClaims.length) {
    const error = new Error(`A revisão manteve uma promessa comercial sem apoio no briefing: ${unsupportedClaims[0].claim}.`);
    error.code = 'unsupported_commercial_claim';
    error.violations = unsupportedClaims;
    throw error;
  }
  if (isPresentation && !deferQualityChecks) {
    const limits = planned && typeof config.presentationLimitsForPlan === 'function'
      ? config.presentationLimitsForPlan(config.presentationPlan, result.slides)
      : config?.presentationTextLimits;
    assertPresentationTextLimits(result.slides, limits, 'Revisão');
  }
  return result;
}

export function auditSocialDraft(draft, config) {
  return [
    ...missingSocialTitleIndexes(draft.slides, config).map(slideIndex => ({ kind: 'missing_title', slideIndex, field: 'title' })),
    ...auditSocialTextDensity(draft.slides, config).map(item => ({ kind: 'density', ...item })),
    ...auditDraftFactuality(draft, config).map(item => ({ kind: 'factual', ...item })),
  ];
}

/** Refinements are a single paid call. Reject a bad replacement and keep the
 * user's current cards; existing claims are not new evidence for new claims. */
export function assertSocialRefinement(previous, candidate, config) {
  if (candidate.slides.length !== previous.slides.length) throw new Error('O refinamento mudou a quantidade de cards. Mantive o conteúdo anterior.');
  const key = issue => JSON.stringify([issue.slideIndex, issue.field, issue.category, issue.claim]);
  const priorFacts = new Set(auditDraftFactuality(previous, config).map(key));
  const issues = auditSocialDraft(candidate, config).filter(issue => issue.kind !== 'factual' || !priorFacts.has(key(issue)));
  if (issues.length) {
    throw Object.assign(new Error(issues.some(issue => issue.kind === 'factual')
      ? 'O refinamento acrescentou informações sem apoio no briefing. Mantive o texto anterior; inclua os dados corretos no material e tente novamente.'
      : 'O refinamento não respeitou os títulos ou o limite de texto escolhido. Mantive o texto anterior; peça uma versão mais concisa.'), { code: 'social_refinement_needs_attention', violations: issues });
  }
}

/** Two normal calls: draft + review. At most one targeted repair when the
 * response still violates a measurable contract. Never silently truncate copy. */
export async function generateReviewedCarousel({ prompt, config, aiOptions, onReview, onStage, onDraft, onPlan }, callAI) {
  if (config?.presetId === 'apresentacao' && config.presentationPlanning) {
    return generatePlannedPresentation({ prompt, config, aiOptions, onStage, onReview, onDraft, onPlan }, callAI);
  }
  const isPresentation = config?.presetId === 'apresentacao';
  const textOptions = {
    ...aiOptions,
    ...presentationAIOptions(config?.presetId, config?.presentationPath),
    json: true,
    // GLM-4.7 thinks by default. Hidden reasoning shares the bounded output
    // budget and was exhausting it before the social JSON could finish.
    // The transport scopes this option to models that support the switch.
    thinking: 'disabled',
  };
  // Entregue os limites ao primeiro rascunho, quando ainda há liberdade para
  // estruturar cada slide. A revisão continua sendo a segunda barreira, mas
  // não deve ser a primeira vez que a IA descobre quanto texto realmente cabe.
  const generationPrompt = isPresentation
    ? `${prompt}${buildPresentationLimitsBlock(config, config?.count || 0)}`
    : `${prompt}\n${buildSocialTextLimitsPrompt(config)}\n${buildFactualGroundingPrompt(config)}`;
  // Recover complete opening sentences without losing copy, then send missing
  // titles and excessive text through the same editorial review.
  throwIfGenerationCancelled(aiOptions?.signal);
  const rawDraft = await callAI(generationPrompt, textOptions);
  throwIfGenerationCancelled(aiOptions?.signal);
  const draft = validateCarouselDraft(rawDraft, { ...config, allowMissingSocialTitles: true, allowLongSocialSupport: true, allowIncompleteDraft: true });
  const draftLimitViolations = isPresentation
    ? auditPresentationTextLimits(draft.slides, config?.presentationTextLimits)
    : [];
  throwIfGenerationCancelled(aiOptions?.signal);
  onDraft?.(draft, { phase: 'reviewing' });
  throwIfGenerationCancelled(aiOptions?.signal);
  onReview?.();
  if (!isPresentation) {
    return reviewSocialDraft({ prompt, draft, config, textOptions, onStage }, callAI);
  }
  try {
    const review = await callAI(buildEditorialReviewPrompt(prompt, draft, config), textOptions);
    throwIfGenerationCancelled(aiOptions?.signal);
    const result = applyEditorialReview(draft, review, config);
    const normalizationIssues = Array.isArray(draft.normalizationIssues) ? draft.normalizationIssues : [];
    if (normalizationIssues.length) {
      return {
        result,
        reviewStatus:'needs_attention',
        issues:normalizationIssues.map(code => ({ slideIndex:null, code })),
        violations:normalizationIssues.map(code => ({ kind:'normalization', slideIndex:null, code })),
      };
    }
    return { result, reviewStatus: JSON.stringify(result) === JSON.stringify(draft) ? 'unchanged' : 'revised' };
  } catch (error) {
    if (isGenerationCancelled(error) || aiOptions?.signal?.aborted) throw error;
    if (auditUnsupportedCommercialClaims(draft.slides, config?.commercialClaimSource).length) {
      throw Object.assign(new Error('A revisão não conseguiu remover promessas comerciais sem apoio no briefing. Seu projeto foi preservado.'), {
        code: 'unsupported_commercial_claim', generatedDraft: draft,
      });
    }
    const normalizationIssues = Array.isArray(draft.normalizationIssues) ? draft.normalizationIssues : [];
    if (normalizationIssues.length) {
      return {
        result:draft,
        reviewStatus:'needs_attention',
        issues:normalizationIssues.map(code => ({ slideIndex:null, code })),
        violations:normalizationIssues.map(code => ({ kind:'normalization', slideIndex:null, code })),
      };
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

async function reviewSocialDraft({ prompt, draft, config, textOptions, onStage }, callAI) {
  let candidate = draft;
  let reviewResponded = false;
  let reviewApplied = false;
  try {
    const review = await callAI(buildEditorialReviewPrompt(prompt, draft, config), textOptions);
    throwIfGenerationCancelled(textOptions.signal);
    reviewResponded = true;
    const proposed = applyEditorialReview(draft, review, config, { deferQualityChecks: true });
    const accepted = retainGroundedFields(proposed, draft, config);
    candidate = accepted.result;
    reviewApplied = !accepted.rejected || JSON.stringify(candidate) !== JSON.stringify(draft);
  } catch (error) {
    if (isGenerationCancelled(error) || textOptions.signal?.aborted) throw error;
  }
  let violations = auditSocialDraft(candidate, config);
  if (!violations.length) {
    return finishSocialReview(candidate, reviewApplied
      ? JSON.stringify(candidate) === JSON.stringify(draft) ? 'unchanged' : 'revised'
      : 'unavailable');
  }
  // A service outage is not a reason to make another equally expensive call.
  // If a response arrived, give the specific remaining problems one repair.
  const repairable = violations.filter(item => item.kind !== 'missing_title' ||
    ['title', 'subtitle', 'bodyAfterImage'].some(field => String(candidate.slides[item.slideIndex]?.[field] || '').trim()));
  if (reviewResponded && repairable.length) {
    const indexes = [...new Set(repairable.filter(item => item.slideIndex != null).map(item => item.slideIndex))];
    const repairCaption = repairable.some(item => item.field === 'caption');
    onStage?.('repairing');
    throwIfGenerationCancelled(textOptions.signal);
    try {
      const repair = unwrapEditorialReview(await callAI(`${buildEditorialReviewPrompt(prompt, candidate, config)}
REPARO DIRECIONADO — última passagem, sem gerar outro carrossel.
Edite somente slideIndex ${indexes.join(', ') || '(nenhum)'}.${repairCaption ? ' Corrija também caption.' : ' Preserve caption.'}
Problemas restantes: ${JSON.stringify(repairable)}.
Reescreva frases completas para respeitar o limite. Preserve números, condições e fatos com fonte. Remova dados sem apoio. Não corte finais de frase, não troque por promessas novas, não acrescente novos cards.`, textOptions));
      throwIfGenerationCancelled(textOptions.signal);
      if (!Array.isArray(repair?.edits) || repair.edits.some(edit => !indexes.includes(edit?.slideIndex)) || (!repairCaption && hasOwn(repair, 'caption'))) {
        throw new Error('Reparo fora do escopo');
      }
      const proposed = applyEditorialReview(candidate, repair, config, { deferQualityChecks: true });
      const repaired = retainGroundedFields(proposed, candidate, config).result;
      const remaining = auditSocialDraft(repaired, config);
      // Keep corrections only when they reduce the known problems, never
      // replace a useful draft with a worse final repair.
      if (remaining.length < violations.length) {
        candidate = repaired;
        violations = remaining;
      }
      if (!violations.length) return finishSocialReview(candidate, 'repaired');
    } catch (error) {
      if (isGenerationCancelled(error) || textOptions.signal?.aborted) throw error;
    }
  }
  throwIfGenerationCancelled(textOptions.signal);
  const missingTitles = missingSocialTitleIndexes(candidate.slides, config);
  if (missingTitles.length) {
    const recovered = candidate.slides.map(recoverSocialTitleForEditing);
    const recoveredIndexes = missingTitles.filter(index => String(recovered[index].title || '').trim());
    candidate = { ...candidate, slides:recovered };
    violations = [
      ...auditSocialDraft(candidate, config),
      ...recoveredIndexes.map(slideIndex => ({ kind:'recovered_title', slideIndex, field:'title', code:'social_title_recovered' })),
    ];
  }
  return finishSocialReview(candidate, 'needs_attention', violations);
}

// Normalization is reversible editorial recovery, never silent proof that the
// provider followed the requested shape. Retain the legacy issue codes while
// exposing the same notices to the progressive-review UI.
function finishSocialReview(result, reviewStatus, violations = []) {
  const normalization = (Array.isArray(result.normalizationIssues) ? result.normalizationIssues : []).map(code => ({ kind:'normalization', slideIndex:null, code }));
  const all = [...violations, ...normalization];
  return {
    result,
    reviewStatus:all.length ? 'needs_attention' : reviewStatus,
    ...(all.length ? { violations:all, issues:all.filter(item => item.code).map(({slideIndex, code}) => ({slideIndex, code})) } : {}),
  };
}

// A review is not entitled to introduce a new unsupported fact. Keep useful
// changes in other fields and restore the previous wording in that field.
function retainGroundedFields(proposed, previous, config) {
  const key = issue => JSON.stringify([issue.slideIndex, issue.field, issue.category, issue.claim]);
  const before = new Set(auditDraftFactuality(previous, config).map(key));
  const added = auditDraftFactuality(proposed, config).filter(issue => !before.has(key(issue)));
  if (!added.length) return { result: proposed, rejected: false };
  const result = { ...proposed, slides: proposed.slides.map(slide => ({ ...slide })) };
  for (const issue of added) {
    if (issue.field === 'caption') result.caption = previous.caption;
    else result.slides[issue.slideIndex][issue.field] = previous.slides[issue.slideIndex][issue.field];
  }
  return { result, rejected: true };
}

/** Write a few slides at a time. Each batch is validated before it can enter
 * the preview; incomplete JSON never becomes a slide. One retry per batch is
 * bounded, and an outage cannot discard already completed work. */
async function writePresentationBatches({ prompt, plan, config, textOptions, onStage, onDraft }, callAI) {
  const slides = [];
  const diagnostics = [];
  const batchSize = 3;
  let caption = '';
  for (let offset = 0; offset < plan.slides.length; offset += batchSize) {
    const entries = plan.slides.slice(offset, offset + batchSize);
    const batchPlan = { ...plan, slides: entries };
    let batch;
    let previousIssue;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      let response;
      throwIfGenerationCancelled(textOptions.signal);
      onStage?.(attempt === 1 ? 'writing' : 'writing_repair', { completedCount: slides.length, totalCount: plan.slides.length, from: offset + 1, to: offset + entries.length });
      // Later batches must see the actual exercise, not only its title or the plan.
      // Generated text provides continuity only; source restrictions still prevail.
      const lessonContinuity = getPresentationPath(config.presentationPath).id === 'aula_workshop'
        ? slides.flatMap((slide, index) => plan.slides[index]?.purpose === 'practice' ? [{
          index: index + 1,
          ...Object.fromEntries(['title', 'subtitle', 'bodyAfterImage', 'presentationBlocks', 'speakerNotes']
            .filter(field => hasOwn(slide, field)).map(field => [field, slide[field]])),
        }] : []).slice(-4)
        : [];
      const task = `\nETAPA DE REDAÇÃO EM LOTES — CONTRATO DESTA RESPOSTA:
O projeto completo tem ${plan.slides.length} slides. Nesta chamada, devolva EXATAMENTE ${entries.length} objetos em slides, apenas as posições ${entries.map(entry => entry.index).join(', ')} do plano, na ordem. Não devolva posições anteriores nem posteriores, não reinicie a narrativa ou crie outra capa/fecho. O plano completo é contexto; as posições abaixo são a tarefa atual.
POSIÇÕES DESTA CHAMADA: ${JSON.stringify(entries)}
TÍTULOS JÁ ESCRITOS (continuidade, nunca novas evidências): ${JSON.stringify(slides.map(slide => slide.title))}
${lessonContinuity.length ? `ATIVIDADES JÁ REDIGIDAS — CONTINUIDADE, NÃO FONTE FACTUAL:\n${JSON.stringify(lessonContinuity)}\nSe esta chamada inclui a correção, responda à mesma tarefa e ao critério anunciados acima. Confira o conteúdo nas fontes originais; não legitime um cenário que o lote anterior inventou. Não troque a entrega do caso por uma pergunta pessoal ou por outro conceito.\n` : ''}Todo slide exige título específico, curto e não vazio. Respeite os limites de cada posição. speakerNotes é opcional, até 600 caracteres; não copie o briefing nem repita o slide nas notas. Limites são tetos, não metas de preenchimento. Não gere configuração visual, plano ou evidências no JSON de redação. Escreva apenas title, subtitle, bodyAfterImage, imageQuery, presentationBlocks e speakerNotes em cada slide, mais caption (resumo breve ou vazio).
${attempt > 1 ? `A resposta anterior deste lote não pôde ser utilizada. Refaça somente estas posições com JSON completo e conciso; preserve fatos e condições essenciais, sem adicionar detalhes para preencher espaço. Diagnóstico estrutural (sem conteúdo): ${JSON.stringify(previousIssue)}. O caminho refere-se ao array deste lote; slideIndex identifica a posição no deck completo, começando em zero. Corrija o campo indicado conforme o contrato; todos os valores textuais de blocos devem ser strings e o array aceita no máximo um bloco.` : ''}`;
      try {
        const raw = await callAI(prompt + task, { ...textOptions, maxTokens: 8192, jsonParser: parsePresentationPlanResponse,
          onResponseMetadata: metadata => {
            response = presentationResponseMetadata(metadata);
            textOptions.onResponseMetadata?.(metadata);
          },
        });
        throwIfGenerationCancelled(textOptions.signal);
        if (!Array.isArray(raw?.slides) || raw.slides.length !== entries.length) {
          throw Object.assign(new Error('A redação não completou as posições deste lote.'), { code: 'presentation_batch_invalid' });
        }
        const missingTitle = raw.slides.findIndex(slide => !isObject(slide) || typeof slide.title !== 'string' || !slide.title.trim());
        if (missingTitle >= 0) throw Object.assign(new Error('A redação não completou o título de uma posição deste lote.'), { code: 'presentation_title_missing', field: 'title', slideIndex: missingTitle });
        const attached = attachPresentationPlan({ ...raw, presentationPlan: batchPlan }, batchPlan);
        batch = validateCarouselDraft(attached, { ...config, count: entries.length });
        diagnostics.push({ stage: 'writing', from: offset + 1, to: offset + entries.length, attempt, outcome: 'validated', ...(response ? { response } : {}) });
        break;
      } catch (error) {
        if (isGenerationCancelled(error) || textOptions.signal?.aborted) throw error;
        // Session/subscription errors must not trigger another paid request.
        const accessError = error?.isSessionGate || ['session_required', 'subscription_required', 'subscription_inactive', 'session_expired', 'unauthorized', 'payment_required', 'access_denied', 'rate_limited'].includes(error?.code) || [401, 402, 403, 429].includes(error?.status);
        const interruptionReason = ['subscription_required', 'subscription_inactive', 'payment_required'].includes(error?.code) || error?.status === 402 ? 'subscription_required'
          : ['session_required', 'session_expired', 'unauthorized'].includes(error?.code) || error?.status === 401 ? 'session_required'
            : error?.status === 429 || error?.code === 'rate_limited' ? 'rate_limited'
              : accessError ? 'access_denied' : 'writing_failed';
        const safeCodes = ['ai_output_truncated', 'ai_invalid_json', 'presentation_batch_invalid', 'presentation_title_missing', 'presentation_blocks_invalid', 'presentation_blocks_not_allowed', 'presentation_notes_invalid', 'presentation_notes_too_long'];
        const safeField = ['title', 'speakerNotes', 'presentationBlocks'].includes(error?.field) ? error.field : null;
        const localIndex = Number.isInteger(error?.slideIndex) && error.slideIndex >= 0 && error.slideIndex < entries.length ? error.slideIndex : null;
        previousIssue = { code: safeCodes.includes(error?.code) ? error.code : error?.name === 'SyntaxError' ? 'ai_invalid_json' : interruptionReason,
          path: localIndex != null && safeField ? `slides[${localIndex}].${safeField}` : '$',
          ...(localIndex != null ? { slideIndex: offset + localIndex } : {}) };
        response = response || presentationResponseMetadata(error?.aiDiagnostics);
        const httpStatus = Number.isInteger(error?.status) && error.status >= 400 && error.status <= 599 ? error.status : undefined;
        diagnostics.push({ stage: 'writing', from: offset + 1, to: offset + entries.length, attempt,
          outcome: accessError ? 'access_interrupted' : 'failed', issue: previousIssue,
          ...(httpStatus ? { httpStatus } : {}), ...(response ? { response } : {}) });
        if (accessError && !slides.length) { error.writingDiagnostics = diagnostics; throw error; }
        if (attempt === 2 || accessError) {
          if (!slides.length) throw Object.assign(new Error('O roteiro está pronto, mas não foi possível escrever os primeiros slides. Tente novamente com as mesmas escolhas.'), { code: 'presentation_writing_failed', stage: 'writing', writingDiagnostics: diagnostics });
          onStage?.('writing_interrupted', { completedCount: slides.length, totalCount: plan.slides.length, interruptionReason, diagnostics });
          return { draft: { slides, caption, presentationPlan: plan }, incomplete: true, completedCount: slides.length, totalCount: plan.slides.length, interruptionReason, diagnostics };
        }
      }
    }
    slides.push(...batch.slides);
    if (batch.caption && !caption) caption = batch.caption;
    throwIfGenerationCancelled(textOptions.signal);
    onDraft?.({ slides: slides.map(slide => ({ ...slide })), caption, presentationPlan: plan }, { phase: 'writing', plan, completedCount: slides.length, totalCount: plan.slides.length, partial: slides.length < plan.slides.length });
    throwIfGenerationCancelled(textOptions.signal);
  }
  return { draft: { slides, caption, presentationPlan: plan }, incomplete: false, completedCount: slides.length, totalCount: plan.slides.length, diagnostics };
}

/** Planning → validated batches → review. Repair is bounded at each stage,
 * and complete, useful slides remain available if a later response fails. */
export async function generatePlannedPresentation({ prompt, config, aiOptions, onStage, onReview, onDraft, onPlan }, callAI) {
  const textOptions = { ...aiOptions, ...presentationAIOptions('apresentacao', config.presentationPath), json: true, jsonParser: parsePresentationPlanResponse, temperature: 0.2, thinking: 'disabled', maxTokens: 8192 };
  const planning = config.planningContext || {};
  const sources = Array.isArray(planning.sources) ? planning.sources : [];
  // The planning sources are the original supplied material. The caller's
  // factualSource may contain only the short topic when uploads were extracted
  // separately. Never use the generated plan/claims as evidence for themselves.
  const factualConfig = {
    ...config,
    factualSource: [
      config.factualSource ?? config.commercialClaimSource,
      ...sources.flatMap(source => {
        if (!isObject(source)) return [];
        const excerpts = Array.isArray(source.chunks) && source.chunks.length
          ? source.chunks.map(chunk => chunk?.text)
          : [source.text];
        return excerpts.filter(text => typeof text === 'string');
      }),
    ].filter(text => typeof text === 'string').join('\n'),
  };
  const { plan, diagnostics: planningDiagnostics } = await generatePresentationPlan({
    brief: planning.brief || '', userInstructions: config.userInstructions || '', sources, count: config.count, presentationPath: config.presentationPath,
    aiOptions: textOptions, onStage, onPlan,
  }, callAI);
  let writingDiagnostics = [];
  const finish = (result, reviewStatus, extra = {}) => {
    // Visible native blocks and speaker notes carry factual claims as well.
    // This conservative check flags calculations/paraphrases for review; it
    // never deletes them or presents a literal matcher as a truth verifier.
    const collectText = value => typeof value === 'string' ? value : Array.isArray(value)
      ? value.map(collectText).join('\n') : isObject(value) ? Object.values(value).map(collectText).join('\n') : '';
    const facts = auditDraftFactuality({ ...result, slides: result.slides.map(slide => ({ ...slide,
      bodyAfterImage: [slide.bodyAfterImage, slide.speakerNotes, collectText(slide.presentationBlocks)].filter(Boolean).join('\n'),
    })) }, factualConfig).map(issue => ({ ...issue, kind: 'factual' }));
    return { result, plan, planningDiagnostics, writingDiagnostics, reviewStatus: facts.length ? 'needs_attention' : reviewStatus, ...extra,
      ...((facts.length || extra.violations?.length) ? { violations: [...(extra.violations || []), ...facts] } : {}) };
  };
  const plannedConfig = {
    ...factualConfig, presentationPlan: plan,
    presentationTextLimits: typeof config.presentationLimitsForPlan === 'function'
      ? config.presentationLimitsForPlan(plan)
      : config.presentationTextLimits,
  };
  const blockRules = config.nativeBlocks === false ? 'Neste padrão personalizado presentationBlocks deve ser []. Preserve a composição livre do usuário.' : buildPresentationBlocksPrompt();
  const generationPrompt = `${prompt}\nINSTRUÇÕES ATUAIS DO USUÁRIO — restrições também válidas para cada lote de redação:\n${config.userInstructions || ''}\n${buildPresentationPlanBlock(plan)}\n${blockRules}\nCONTRATO COMPLEMENTAR: em cada slide inclua presentationBlocks (ou [] quando não houver bloco) e speakerNotes (complemento opcional no idioma definido, até 600 caracteres, ou ""). O texto visível deve ser autossuficiente. Não coloque nomes de arquivos, rótulos de extração nem instruções ao designer no texto final. Dados, exemplos e condições permanecem fiéis às evidências. Em slides com bloco, subtitle contextualiza sem repetir suas células; bodyAfterImage fica vazio e apenas aprofundamento vai para speakerNotes.${buildPresentationLimitsBlock(plannedConfig, config.count)}`;
  const written = await writePresentationBatches({ prompt: generationPrompt, plan, config: plannedConfig, textOptions, onStage, onDraft }, callAI);
  writingDiagnostics = written.diagnostics;
  const draft = written.draft;
  if (written.incomplete) {
    return finish(draft, 'needs_attention', { incomplete: true, interruptionReason: written.interruptionReason,
      completedCount: written.completedCount, totalCount: written.totalCount,
      issues: [{ code: 'presentation_incomplete', slideIndex: null, interruptionReason: written.interruptionReason }],
      violations: [{ code: 'presentation_incomplete', slideIndex: null, kind: 'incomplete', completedCount: written.completedCount, totalCount: written.totalCount, interruptionReason: written.interruptionReason }] });
  }
  if (typeof config.presentationLimitsForPlan === 'function') {
    plannedConfig.presentationTextLimits = config.presentationLimitsForPlan(plan, draft.slides);
  }
  const violations = auditPresentationTextLimits(draft.slides, plannedConfig.presentationTextLimits);
  throwIfGenerationCancelled(aiOptions?.signal);
  onDraft?.(draft, { phase: 'reviewing', plan, completedCount: draft.slides.length, totalCount: plan.slides.length });
  throwIfGenerationCancelled(aiOptions?.signal);
  onStage?.('reviewing');
  onReview?.();
  const reviewOptions = { ...textOptions, systemPrompt: PRESENTATION_REVIEW_SYSTEM_PROMPT };
  const reviewPrompt = buildEditorialReviewPrompt(plannedReviewBriefing(config, planning, sources), draft, plannedConfig);
  try {
    const review = await callAI(reviewPrompt, reviewOptions);
    throwIfGenerationCancelled(aiOptions?.signal);
    const result = applyEditorialReview(draft, review, plannedConfig);
    return finish(result, JSON.stringify(result) === JSON.stringify(draft) ? 'unchanged' : 'revised');
  } catch (error) {
    if (isGenerationCancelled(error) || aiOptions?.signal?.aborted) throw error;
    if (!violations.length) return finish(draft, 'unavailable');
    // Never cut the end of a sentence to fit: it may contain a condition or risk.
    // One semantic repair is limited to fields/slides known to exceed the layout.
    const indexes = [...new Set(violations.map(item => item.slideIndex))];
    onStage?.('repairing');
    try {
      const repair = await callAI(`${reviewPrompt}\nREPARO DIRECIONADO: edite somente os slides com slideIndex ${indexes.join(', ')}. Reescreva sem perder números, unidades, hipóteses ou condições. Transfira explicações complementares para speakerNotes, mantendo a conclusão compreensível na página. Não corte frases por caracteres.`, reviewOptions);
      throwIfGenerationCancelled(aiOptions?.signal);
      if (!Array.isArray(repair?.edits) || repair.edits.some(edit => !indexes.includes(edit?.slideIndex))) throw new Error('Reparo fora do escopo');
      const result = applyEditorialReview(draft, repair, plannedConfig);
      return finish(result, 'repaired');
    } catch (repairError) {
      if (isGenerationCancelled(repairError) || aiOptions?.signal?.aborted) throw repairError;
      return finish(draft, 'needs_attention', { violations });
    }
  }
}
