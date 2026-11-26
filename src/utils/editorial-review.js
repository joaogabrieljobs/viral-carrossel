import { normalizePresentationEyebrow } from './presentation-eyebrow.js';
import { isGenerationCancelled, throwIfGenerationCancelled } from './generation-control.js';
import { isPersoHybridDensity, isTendenciaCulturaPreset } from './generation-prompts.js';
import { normalizeInstagramCaption } from './editorial-strategy.js';
import { isPitchPath, cleanPitchSlide, cleanPitchText } from './pitch-content.js';
import { presentationAIOptions, buildPresentationReviewRules, getPresentationPath } from './presentation.js';
import { buildPresentationPlanBlock, attachPresentationPlan } from './presentation-plan.js';
import { generatePresentationPlan, parsePresentationPlanResponse, presentationResponseMetadata } from './presentation-planning.js';
import { buildPresentationBlocksPrompt, mapPresentationBlockStrings, normalizePresentationBlocks } from './presentation-quality.js';
import { requiresSocialTitles, recoverSocialTitle, recoverSocialTitleForEditing, missingSocialTitleIndexes, auditSocialTextDensity, buildSocialTextLimitsPrompt } from './social-generation.js';
import { auditDraftFactuality, auditUnsupportedCommercialClaims, buildFactualGroundingPrompt, buildReviewFactCheckPrompt, goalTitleAsFactSlides, groundPresentationBlocks, replaceEmDashes, splitBriefingNotes } from './factual-grounding.js';
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

function presentationReviewBlockContract(nativeBlocks, free = false) {
  if (nativeBlocks === false) return 'Neste padrão personalizado presentationBlocks permanece [].';
  const freeTypes = free ? `
- quote: type, text (até 240, frase literal do material, sem aspas) e author ("" ou autoria como está no material).
- bignumber: type, value (até 16, com o número do material), label até 90 e detail opcional até 160.
- icons: type, items (2–4 objetos com icon da lista fechada, title até 60 e body opcional até 140).` : '';
  return `CONTRATO DE PATCH PARA BLOCOS: só inclua presentationBlocks na edição se esse campo precisar mudar. O valor substitui o array existente: [] ou exatamente um bloco de um destes tipos:
- comparison: type, headers (2–4 strings até 80 caracteres), rows (1–5 linhas com o mesmo número de células dos cabeçalhos; cada célula até 240).
- metrics: type, items (1–4 objetos com label até 100, value até 48 e detail opcional até 180 caracteres).
- steps: type, items (2–5 objetos com title até 100 e body opcional até 260 caracteres).${freeTypes}
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

function mapBlockText(blocks, fn) {
  return blocks.map(block => mapPresentationBlockStrings(block, fn));
}

/**
 * QA 24/11 (texto 1): a lacuna do briefing virou slide ("No prior results
 * documented", célula "Unspecified"). A frase sai do texto visível, inclusive
 * dos blocos, e é devolvida para o aviso de material. Linha de tabela, métrica
 * ou etapa cujo valor é só a lacuna sai inteira; o bloco que não se sustenta
 * sem ela sai também.
 */
function blocksWithoutGapNotes(blocks, gaps) {
  const clean = value => {
    if (typeof value !== 'string') return value;
    const { text, notes } = splitBriefingNotes(value);
    return { text, notes, emptied: !String(text).trim() && !!value.trim() };
  };
  return blocks.flatMap((block) => {
    if (block?.type === 'comparison' && Array.isArray(block.rows) && Array.isArray(block.headers)) {
      if (block.headers.some(header => clean(header).emptied)) { gaps.push(block.headers.join(' / ')); return []; }
      const rows = block.rows.flatMap((row) => {
        const cells = row.map(clean);
        if (cells.some(cell => cell.emptied)) { gaps.push(`${row[0]}: ${row.slice(1).join(' / ')}`); return []; }
        cells.forEach(cell => gaps.push(...cell.notes));
        return [cells.map(cell => cell.text)];
      });
      return rows.length ? [{ ...block, rows }] : [];
    }
    if (block?.type === 'quote' || block?.type === 'bignumber') {
      const keys = block.type === 'quote' ? ['text', 'author'] : ['value', 'label', 'detail'];
      const essential = block.type === 'quote' ? ['text'] : ['value', 'label'];
      const cells = Object.fromEntries(keys.map(key => [key, clean(block[key])]));
      if (essential.some(key => cells[key]?.emptied)) { gaps.push(essential.map(key => block[key]).filter(Boolean).join(': ')); return []; }
      keys.forEach(key => Array.isArray(cells[key]?.notes) && gaps.push(...cells[key].notes));
      return [{ ...block, ...Object.fromEntries(keys.map(key => [key, typeof block[key] === 'string' ? cells[key].text : block[key]])) }];
    }
    if (!Array.isArray(block?.items)) return [block];
    const main = block.type === 'metrics' ? ['label', 'value'] : ['title'];
    const items = block.items.flatMap((item) => {
      const cells = Object.fromEntries(Object.entries(item).map(([key, value]) => [key, clean(value)]));
      if (main.some(key => cells[key]?.emptied)) { gaps.push(main.map(key => item[key]).filter(Boolean).join(': ')); return []; }
      Object.values(cells).forEach(cell => Array.isArray(cell?.notes) && gaps.push(...cell.notes));
      return [Object.fromEntries(Object.entries(cells).map(([key, cell]) => [key, typeof item[key] === 'string' ? cell.text : item[key]]))];
    });
    return items.length >= (['steps', 'icons'].includes(block.type) ? 2 : 1) ? [{ ...block, items }] : [];
  });
}

export function moveGapNotesOutOfSlides(draft) {
  const gaps = [];
  const emptiedTitles = [];
  let changed = false;
  const slides = (Array.isArray(draft?.slides) ? draft.slides : []).map((slide, slideIndex) => {
    const next = { ...slide };
    // O rótulo acima do título (eyebrow, parte 5) passa pela mesma limpeza de
    // metacomentário; vazio, ele só some (não é título).
    for (const field of [...PRESENTATION_TEXT_FIELDS, 'eyebrow']) {
      if (typeof slide?.[field] !== 'string') continue;
      const { text, notes } = splitBriefingNotes(slide[field]);
      if (text === slide[field]) continue;
      changed = true;
      next[field] = text;
      gaps.push(...notes);
      if (field === 'title' && !text.trim()) emptiedTitles.push(slideIndex);
    }
    if (Array.isArray(slide?.presentationBlocks) && slide.presentationBlocks.length) {
      const blocks = blocksWithoutGapNotes(slide.presentationBlocks, gaps);
      if (JSON.stringify(blocks) !== JSON.stringify(slide.presentationBlocks)) { changed = true; next.presentationBlocks = blocks; }
    }
    return next;
  });
  return { draft: changed ? { ...draft, slides } : draft, gaps, emptiedTitles };
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
    // "funcao" orienta a escrita card a card (roteiro do modo, MF-06); não é
    // conteúdo do card e não vai para o projeto.
    delete slide.funcao;
    // Rótulo acima do título (direção de arte, parte 5): só na apresentação,
    // 1–3 palavras em caixa alta; fora do contrato, sai inteiro.
    if (presetId === 'apresentacao' && hasOwn(s, 'eyebrow')) slide.eyebrow = normalizePresentationEyebrow(s.eyebrow);
    else delete slide.eyebrow;
    if (presetId === 'apresentacao' && draft.presentationPlan && !String(slide.title || '').trim()) {
      throw Object.assign(new Error(`O slide ${index + 1} precisa de um título específico.`), { code: 'presentation_title_missing', field: 'title', slideIndex: index });
    }
    if (presetId === 'apresentacao' && draft.presentationPlan) {
      // Lote B (21/11): o travessão voltava dentro dos blocos ("brioche — três
      // opções"); a limpeza do texto gerado só passava por título e apoio.
      slide.presentationBlocks = mapBlockText(normalizePresentationBlocks(s.presentationBlocks), replaceEmDashes);
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

/**
 * Teste 6 da Apoteose (26/11), item 5: no modo livre a IA deixou o eyebrow
 * vazio em todos os slides. O pedido de redação do modo livre passa a exigir
 * o rótulo (menos na capa), com exemplo; vazio, o código deriva um rótulo
 * (free-draft.js), sem fato novo.
 */
export const FREE_EYEBROW_RULE = 'MODO LIVRE — eyebrow é obrigatório em todas as páginas, menos na capa (na capa use ""): 1 a 3 palavras em CAIXA ALTA no idioma do deck que nomeiam o tema da página, como "A FESTA", "O PÚBLICO", "A MÚSICA", "O POSICIONAMENTO", "A PERSONALIDADE"; no fecho, o nome do projeto. Sem número, promessa ou fato novo; não repete o título nem outro eyebrow do deck.';

/**
 * Teste 6 da Apoteose (26/11), item 2: o slide 10 tinha o título "Como se o
 * Carnaval não fosse suficiente" e a mesma frase na citação do bloco. Título
 * igual (ou quase: 75% das palavras de conteúdo nos dois sentidos) a uma
 * frase do apoio, do corpo ou de um bloco do próprio slide vai ao reparo de
 * repetição; o que se reescreve é o título (a assinatura no bloco fica).
 */
export function titleEchoesSlideTextIndexes(slides) {
  const words = text => (String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[*_]/g, '').match(/[\p{L}\d]+(?:[.,]\d+)*/gu) || []).filter(word => word.length > 2);
  const covers = (a, b) => a.filter(word => b.has(word)).length / a.length >= 0.75;
  const blockTexts = block => (!block || typeof block !== 'object' ? []
    : block.type === 'quote' ? [block.text]
      : block.type === 'bignumber' ? [block.label]
        : block.type === 'comparison' ? (block.rows || []).map(row => (Array.isArray(row) ? row.join(' ') : ''))
          : Array.isArray(block.items) ? block.items.map(item => [item?.title, item?.label, item?.body].filter(Boolean).join(' ')) : []);
  const sentences = text => String(text || '').split(/[.!?]+(?=\s|$)|\n/).map(sentence => sentence.trim()).filter(Boolean);
  return (Array.isArray(slides) ? slides : []).flatMap((slide, index) => {
    const title = words(slide?.title);
    if (title.length < 2) return [];
    const units = [
      ...sentences(slide?.subtitle), ...sentences(slide?.bodyAfterImage),
      ...(Array.isArray(slide?.presentationBlocks) ? slide.presentationBlocks : []).flatMap(blockTexts).flatMap(sentences),
    ].map(words).filter(unit => unit.length >= 2);
    const titleSet = new Set(title);
    return units.some(unit => covers(title, new Set(unit)) && covers(unit, titleSet)) ? [index] : [];
  });
}

/**
 * Apoio que só repete o título (lote B 21/11, Editorial Magazine: "Marta pede
 * um dia de antecedência" + "MARTA PEDE UM DIA DE ANTECEDÊNCIA PELO
 * WHATSAPP"). Três quartos das palavras de conteúdo do título reaparecem no
 * apoio, e o apoio acrescenta no máximo quatro palavras.
 */
export function supportEchoesTitleIndexes(slides, { lastLine = false } = {}) {
  const words = text => String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[*_]/g, '').match(/[\p{L}\d]+(?:[.,]\d+)*/gu) || [];
  const covers = (a, b) => a.filter(word => b.has(word)).length / a.length >= 0.75;
  // Spec 1.1, entrega 3 (Apoteose, slide 10): o apoio era longo e só a última
  // linha ("Apoteose, o esquenta de Carnaval de São Paulo.", no corpo) repetia
  // o título. Na apresentação, a última frase de apoio e corpo também conta
  // quando ela e o título são quase iguais nos dois sentidos (75%). Ponto
  // dentro de endereço ("blkfrog.com/brief") não fecha a frase.
  const lastSentence = slide => [slide?.subtitle, slide?.bodyAfterImage].map(value => String(value || '')).join('\n')
    .split(/[.!?]+(?=\s|$)|\n/).map(sentence => sentence.trim()).filter(Boolean).at(-1);
  return (Array.isArray(slides) ? slides : []).flatMap((slide, index) => {
    const title = words(slide?.title).filter(word => word.length > 2);
    if (title.length < 2) return [];
    const support = words(slide?.subtitle);
    if (support.length && covers(title, new Set(support)) && support.length <= words(slide?.title).length + 4) return [index];
    const last = lastLine ? words(lastSentence(slide)).filter(word => word.length > 2) : [];
    if (last.length >= 2 && covers(title, new Set(last)) && covers(last, new Set(title))) return [index];
    // Teste 4 da Apoteose (25/11), slide 6: título "Irreverente e
    // bem-humorada, sem anunciar exclusividade" e linha de apoio "Inteligente,
    // provocativa, irreverente e bem-humorada". A linha é curta (até 8
    // palavras de conteúdo) e mais da metade dela, com ao menos duas palavras,
    // é o próprio título: repete mais do que acrescenta.
    if (!lastLine) return [];
    const line = words(slide?.bodyAfterImage).filter(word => word.length > 2 && !PHRASE_STOP.has(word));
    const titleWords = new Set(title);
    const shared = line.filter(word => titleWords.has(word)).length;
    return line.length >= 2 && line.length <= 8 && shared >= 2 && shared / line.length > 0.5 ? [index] : [];
  });
}

/**
 * Teste 4 da Apoteose (25/11), slide 7: a linha de apoio "Atual sem depender
 * de tendências" é um pedaço do parágrafo do mesmo slide ("... se mantendo
 * atual sem depender de tendências"). Quando 80% ou mais das palavras de
 * conteúdo do bodyAfterImage estão no subtitle do mesmo slide, o campo fica
 * vazio, sem pedir reescrita à IA: a informação continua no parágrafo.
 */
export const SUPPORT_IN_PARAGRAPH_THRESHOLD = 0.8;
export function withoutEchoedSupportLines(slides) {
  return (Array.isArray(slides) ? slides : []).map((slide) => {
    const line = contentStems(slide?.bodyAfterImage);
    if (!line.size || !String(slide?.subtitle || '').trim()) return slide;
    const paragraph = contentStems(slide.subtitle);
    const inside = [...line].filter(stem => paragraph.has(stem)).length / line.size;
    return inside >= SUPPORT_IN_PARAGRAPH_THRESHOLD ? { ...slide, bodyAfterImage: '' } : slide;
  });
}

/**
 * Títulos iguais ou quase iguais em slides diferentes (reteste 21/11: T05 com
 * "Tempo é ingrediente, não detalhe" duas vezes; A02 "41.200 pães vendidos em
 * 2025" nos slides 6 e 11; A04 e A05 com pares quase idênticos). Devolve o
 * índice da repetição (o segundo do par). Mesma regra para carrossel e deck.
 */
export function repeatedTitleIndexes(slides) {
  const words = text => new Set((String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[*_]/g, '').match(/[\p{L}\d]+(?:[.,]\d+)*/gu) || []).filter(word => word.length > 2 || /\d/.test(word)));
  const list = (Array.isArray(slides) ? slides : []).map(slide => words(slide?.title));
  const repeated = [];
  list.forEach((current, index) => {
    if (current.size < 2) return;
    const hit = list.slice(0, index).some(previous => {
      if (previous.size < 2) return false;
      const shared = [...current].filter(word => previous.has(word)).length;
      // Reteste real 24/11 (RT24 2): a divisão era pelo título MENOR, e "Send
      // us your link" virou repetição de "Step 1 · Send your link or fill the
      // brief" (3 palavras em comum de 3). Vale a média dos dois tamanhos: os
      // dois títulos precisam ser quase o mesmo, não um caber dentro do outro.
      return shared >= 3 ? (2 * shared) / (current.size + previous.size) >= 0.6 : shared === current.size && shared === previous.size;
    });
    if (hit) repeated.push(index);
  });
  return repeated;
}

/**
 * Reteste 21/11 (A01–A06): o mesmo fato ("36 horas", "1 dia de
 * antecedência") aparecia em 5 a 9 slides. Número com unidade presente no
 * texto visível de 3 ou mais slides.
 */
const blockText = value => typeof value === 'string' ? value : Array.isArray(value)
  ? value.map(blockText).join(' ') : isObject(value) ? Object.values(value).map(blockText).join(' ') : '';
const NUMBER_WORDS = { um: 1, uma: 1, dois: 2, duas: 2, tres: 3, 'três': 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10 };

export function repeatedFactSlides(slides) {
  const seen = new Map();
  (Array.isArray(slides) ? slides : []).forEach((slide, index) => {
    // Reteste 0b1cb62 (D02): o fato repetia também nos blocos e como "um dia".
    const text = [...['title', 'subtitle', 'bodyAfterImage'].map(field => String(slide?.[field] || '')), blockText(slide?.presentationBlocks)].join(' ')
      .replace(/[*_]/g, '').toLowerCase()
      .replace(/\b(um|uma|dois|duas|tr[eê]s|quatro|cinco|seis|sete|oito|nove|dez)\s+(dias?|horas?|semanas?|m[eê]s|meses|anos?)\b/gu,
        (_, word, unit) => `${NUMBER_WORDS[word] ?? NUMBER_WORDS[word.normalize('NFD').replace(/\p{M}/gu, '')]} ${unit}`);
    const facts = new Set((text.match(/r\$\s?\d[\d.,]*|\d[\d.,]*\s*(?:%|\p{L}{2,})/gu) || [])
      .map(fact => fact.replace(/\s+/g, ' ').replace(/[.,]$/, '').trim()));
    facts.forEach(fact => seen.set(fact, [...(seen.get(fact) || []), index]));
  });
  return [...seen].filter(([, indexes]) => indexes.length >= 3).map(([fact, slideIndexes]) => ({ fact, slideIndexes }));
}

// Reteste 22/11 (WebExpresso): "segunda língua grátis" em 3 cards; sem
// número, a contagem de fatos não via. Trinca de palavras de conteúdo
// repetida em 3 ou mais cards (dentro da mesma frase).
const PHRASE_STOP = new Set('a o as os de da do das dos e em um uma uns umas para por com no na nos nas que como ao aos seu sua seus suas se sem mais muito esta estao este essa esse isso sao foi ser tem ter vai pode podem cada pelo pela quando onde voce the and of to in for with your you on at by is are this that it from have will can'.split(' '));
const plainWords = text => String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[*_]/g, '');

// Número fica na frase: "Passo 1" e "Passo 2" não são repetição.
const isContentWord = word => (word.length > 3 || /\d/.test(word)) && !PHRASE_STOP.has(word);
const tokensOf = text => plainWords(text).match(/[a-z0-9]+/g) || [];
const containsRun = (tokens, run) => run.length > 0 && tokens.some((_, start) => run.every((word, k) => tokens[start + k] === word));

/**
 * Teste 4 da Apoteose (25/11): "Como se o Carnaval não fosse suficiente" é o
 * conceito de campanha do material e aparecia na capa, no slide 2 e na
 * citação do slide 9; a contagem de repetição a tratava como frase repetida e
 * o reparo pedia para tirá-la. A assinatura do deck não é repetição. Conta
 * como assinatura:
 * 1. a frase que o roteiro marca em signature (só entra no plano se estiver
 *    literal no material; ver validatePresentationPlan);
 * 2. a frase (2+ palavras de conteúdo) que está na capa e no fecho;
 * 3. a evidência curta do roteiro (até 12 palavras, 3+ de conteúdo) que a capa
 *    cita literalmente: frase curta do material que abre o deck é a linha da
 *    campanha. É o caso do Teste 4, cujo roteiro não tinha signature.
 * Devolve as frases como estão (capa, fecho ou citação).
 */
export function deckSignatures(slides, plan) {
  const found = [];
  const add = (text) => {
    const clean = String(text || '').replace(/[*_]/g, '').replace(/\s+/g, ' ').trim();
    if (clean && !found.some(item => plainWords(item) === plainWords(clean))) found.push(clean);
  };
  (Array.isArray(plan?.signature) ? plan.signature : [plan?.signature]).forEach(item => typeof item === 'string' && add(item));
  const list = Array.isArray(slides) ? slides : [];
  if (list.length < 2) return found;
  // Título igual na capa e no fecho é título repetido (repeatedTitleIndexes), não assinatura.
  const sentencesOf = slide => [['title', String(slide?.title || '')], ...['subtitle', 'bodyAfterImage'].map(field => [field, String(slide?.[field] || '')]), ['block', blockText(slide?.presentationBlocks)]]
    .flatMap(([field, text]) => text.split(/[.!?;:\n]+/).map(sentence => ({ title: field === 'title', text: sentence.replace(/[*_]/g, '').replace(/\s+/g, ' ').trim() })))
    .filter(sentence => tokensOf(sentence.text).filter(isContentWord).length >= 2);
  const cover = sentencesOf(list[0]);
  const closing = sentencesOf(list.at(-1));
  for (const a of cover) {
    for (const b of closing) {
      if (a.title && b.title) continue;
      const [short, long] = tokensOf(a.text).length <= tokensOf(b.text).length ? [a.text, b.text] : [b.text, a.text];
      if (containsRun(tokensOf(long), tokensOf(short))) add(short);
    }
  }
  const coverTokens = tokensOf([...['title', 'subtitle', 'bodyAfterImage'].map(field => String(list[0]?.[field] || '')), blockText(list[0]?.presentationBlocks)].join(' '));
  for (const item of Array.isArray(plan?.evidence) ? plan.evidence : []) {
    const quote = tokensOf(item?.quote);
    if (quote.length <= 12 && quote.filter(isContentWord).length >= 3 && containsRun(coverTokens, quote)) add(item.quote);
  }
  return found;
}

/** Palavras de uma frase em trechos, sem as sequências que são assinatura. */
function segmentsWithoutSignatures(sentence, signatures) {
  const tokens = sentence.match(/[a-z0-9]+/g) || [];
  const runs = signatures.map(tokensOf).filter(run => run.length);
  const segments = [[]];
  for (let i = 0; i < tokens.length;) {
    const run = runs.find(candidate => candidate.every((word, k) => tokens[i + k] === word));
    if (run) { segments.push([]); i += run.length; continue; }
    segments.at(-1).push(tokens[i]);
    i += 1;
  }
  return segments.map(segment => segment.filter(isContentWord));
}

export function repeatedPhraseSlides(slides, { signatures = deckSignatures(slides) } = {}) {
  const seen = new Map();
  (Array.isArray(slides) ? slides : []).forEach((slide, index) => {
    const text = [...['title', 'subtitle', 'bodyAfterImage'].map(field => String(slide?.[field] || '')), blockText(slide?.presentationBlocks)].join('. ');
    const phrases = new Set();
    for (const sentence of plainWords(text).split(/[.!?;:\n]+/)) {
      for (const words of segmentsWithoutSignatures(sentence, signatures)) {
        for (let i = 0; i + 2 < words.length; i += 1) phrases.add(words.slice(i, i + 3).join(' '));
      }
    }
    phrases.forEach(phrase => seen.set(phrase, [...(seen.get(phrase) || []), index]));
  });
  const found = [...seen].filter(([, indexes]) => indexes.length >= 3);
  // Trincas sobrepostas da mesma frase longa: fica a primeira por conjunto de cards.
  const bySet = new Map();
  for (const [phrase, slideIndexes] of found) {
    const key = slideIndexes.join(',');
    if (!bySet.has(key)) bySet.set(key, { phrase, slideIndexes });
  }
  return [...bySet.values()];
}

/**
 * Spec 1.1, entrega 3 (Apoteose, 24/11): a trinca acima só conta a partir de
 * 3 slides, e a comparação de corpo divide pelo slide inteiro. A mesma frase
 * copiada em 2 slides passava: "O Carnaval aparece como estado de espírito,
 * não como representação literal" (3 e 4) e "entre a promessa de se comportar
 * e a absoluta falta de intenção de cumpri-la" (3 e 10). Na apresentação,
 * seis palavras de conteúdo seguidas, iguais e na mesma frase, em 2 slides ou
 * mais, contam. Frase curta de ligação tem menos de seis e não entra.
 * Devolve { phrase, slideIndexes }, com a frase como está no primeiro slide.
 */
export const REPEATED_SENTENCE_WORDS = 6;

export function repeatedSentenceSlides(slides, { signatures = deckSignatures(slides) } = {}) {
  const seen = new Map();
  const quoteOf = new Map();
  (Array.isArray(slides) ? slides : []).forEach((slide, index) => {
    // Bloco fica de fora: o texto dele não tem frases, e bloco repetido tem
    // regra própria (passos e métricas).
    const text = ['title', 'subtitle', 'bodyAfterImage'].map(field => String(slide?.[field] || '')).join('. ');
    // A divisão é a mesma nas duas versões: tirar acento não mexe na pontuação.
    const original = text.split(/[.!?;:\n]+/);
    plainWords(text).split(/[.!?;:\n]+/).forEach((sentence, position) => {
      // Teste 4: a assinatura do deck sai da conta (deckSignatures).
      for (const words of segmentsWithoutSignatures(sentence, signatures)) {
        for (let i = 0; i + REPEATED_SENTENCE_WORDS <= words.length; i += 1) {
          const run = words.slice(i, i + REPEATED_SENTENCE_WORDS).join(' ');
          const slidesWithRun = seen.get(run) || new Set();
          if (!slidesWithRun.size) quoteOf.set(run, original[position].replace(/[*_]/g, '').replace(/\s+/g, ' ').trim());
          seen.set(run, slidesWithRun.add(index));
        }
      }
    });
  });
  // Trechos sobrepostos da mesma frase: fica um por frase e conjunto de slides.
  const found = new Map();
  for (const [run, indexes] of seen) {
    if (indexes.size < 2) continue;
    const slideIndexes = [...indexes].sort((a, b) => a - b);
    const key = `${slideIndexes.join(',')}|${quoteOf.get(run)}`;
    if (!found.has(key)) found.set(key, { phrase: quoteOf.get(run), slideIndexes });
  }
  return [...found.values()];
}

/**
 * QA 24/11 (texto 3): repetição não é só título igual. Dois cards dizem o
 * mesmo quando o menor conjunto de radicais de conteúdo cobre 80% do maior
 * (mesma conta de radicais de inclusionCovered, em factual-grounding). No
 * catálogo real de 22/11, de 0,80 para cima todo par era o mesmo conteúdo
 * reescrito; em 0,70 já entrava o CTA que só retoma o assunto.
 */
export const REPEATED_CONTENT_THRESHOLD = 0.8;
const MIN_CONTENT_STEMS = 4;
// Reteste real 24/11 (RT24 1): as repetições que a pessoa viu não eram pegas.
// A conta acima soma título, apoio, corpo e blocos e divide pelo slide maior:
// um título diferente ou um bloco a mais derrubava o resultado (Pitch 10~11 =
// 0,56; Alto impacto 2~5 = 0,67 com o corpo idêntico). O corpo (apoio e
// texto, sem título nem bloco) passa a ser comparado à parte. Nos textos
// reais, os pares apontados dão 0,76, 0,80 e 1,00 e o par mais próximo que
// não é repetição dá 0,65: o limiar do corpo é 0,70. Corpo com menos de seis
// radicais não entra: uma linha curta de apoio se repete sem ser a mesma ideia.
export const REPEATED_BODY_THRESHOLD = 0.7;
const MIN_BODY_STEMS = 6;
// "builds" e "build", "negócios" e "negócio" são a mesma palavra.
const stemOf = word => (word.length > 4 && /[^s]s$/.test(word) ? word.slice(0, -1) : word).slice(0, 6);
const contentStems = text => new Set((plainWords(text).match(/[a-z0-9]+/g) || [])
  .filter(word => (word.length > 2 || /\d/.test(word)) && !PHRASE_STOP.has(word)).map(stemOf));
const bodyText = slide => ['subtitle', 'bodyAfterImage'].map(field => String(slide?.[field] || '')).join(' ');
const visibleText = slide => [...['title', 'subtitle', 'bodyAfterImage'].map(field => String(slide?.[field] || '')), blockText(slide?.presentationBlocks)].join(' ');
// Integração de 24/11: a regra tirava do projeto cards que só mudavam o
// número. Ela não distingue contador de dado ("Plano de 3 meses" e "Plano de
// 12 meses" são ofertas diferentes), e paráfrase repete os mesmos fatos.
// Número só de um lado e número só do outro: não é repetição. "1 dia" de um
// lado e "um dia" do outro continua sendo (só um lado tem número a mais).
const numbersConflict = (a, b) => [...a].some(stem => /\d/.test(stem) && !b.has(stem)) && [...b].some(stem => /\d/.test(stem) && !a.has(stem));
const stemOverlap = (a, b, minimum = MIN_CONTENT_STEMS) => (Math.min(a.size, b.size) < minimum || numbersConflict(a, b) ? 0
  : [...a].filter(stem => b.has(stem)).length / Math.max(a.size, b.size));

export function slideSimilarity(a, b) {
  return stemOverlap(contentStems(visibleText(a)), contentStems(visibleText(b)));
}

export function bodySimilarity(a, b) {
  return stemOverlap(contentStems(bodyText(a)), contentStems(bodyText(b)), MIN_BODY_STEMS);
}

/**
 * Card ou slide que repete um anterior com outras palavras: { slideIndex,
 * duplicateOf, score }. Vale o texto inteiro (0,80) ou só o corpo (0,70).
 */
export function repeatedContentSlides(slides) {
  const safe = Array.isArray(slides) ? slides : [];
  const list = safe.map(slide => contentStems(visibleText(slide)));
  const bodies = safe.map(slide => contentStems(bodyText(slide)));
  return list.flatMap((current, slideIndex) => {
    let best = null;
    for (let duplicateOf = 0; duplicateOf < slideIndex; duplicateOf += 1) {
      const whole = stemOverlap(list[duplicateOf], current);
      const body = stemOverlap(bodies[duplicateOf], bodies[slideIndex], MIN_BODY_STEMS);
      const score = whole >= REPEATED_CONTENT_THRESHOLD ? whole : body >= REPEATED_BODY_THRESHOLD ? body : 0;
      if (score && (!best || score > best.score)) best = { slideIndex, duplicateOf, score: Math.round(score * 100) / 100 };
    }
    return best ? [best] : [];
  });
}

/** O mesmo bloco de passos em mais de um slide (compara os títulos das etapas; rótulo "Passo 1" não conta). */
export function repeatedStepBlockSlides(slides) {
  const list = (Array.isArray(slides) ? slides : []).map((slide) => {
    const block = (Array.isArray(slide?.presentationBlocks) ? slide.presentationBlocks : []).find(item => item?.type === 'steps' && Array.isArray(item.items));
    if (!block) return null;
    const titles = contentStems(block.items.map(item => String(item?.title || '').replace(/\b(?:passo|etapa|step|fase|phase)\b/giu, ' ')).join(' '));
    for (const stem of [...titles]) if (/^\d+$/.test(stem)) titles.delete(stem);
    return titles.size >= 2 ? titles : contentStems(blockText(block));
  });
  return list.flatMap((current, slideIndex) => {
    if (!current) return [];
    // RT24 1: Relatório real, slides 5 e 7, dois de três passos com o mesmo
    // título e o terceiro reescrito: 0,80 com "builds" = "build", 0,70 sem.
    const duplicateOf = list.findIndex((previous, index) => index < slideIndex && previous && stemOverlap(previous, current, 2) >= REPEATED_BODY_THRESHOLD);
    return duplicateOf >= 0 ? [{ slideIndex, duplicateOf }] : [];
  });
}

/**
 * RT24 1: o mesmo bloco de métricas em mais de um slide (Relatório real, 3 e
 * 6: "Site price", "Logo included", "Payment timing"). Vale quando os rótulos
 * do bloco menor estão no outro (70%), cada bloco tem ao menos duas métricas
 * e os valores não trazem números diferentes: "Pães vendidos 35.000" em 2024
 * e "41.200" em 2025 são dados novos.
 */
export function repeatedMetricBlockSlides(slides) {
  const list = (Array.isArray(slides) ? slides : []).map((slide) => {
    const block = (Array.isArray(slide?.presentationBlocks) ? slide.presentationBlocks : []).find(item => item?.type === 'metrics' && Array.isArray(item.items));
    if (!block || block.items.length < 2) return null;
    return { labels: contentStems(block.items.map(item => item?.label).join(' ')), values: contentStems(block.items.map(item => item?.value).join(' ')) };
  });
  const sameLabels = (a, b) => {
    const [small, large] = a.size <= b.size ? [a, b] : [b, a];
    return small.size >= 2 && [...small].filter(stem => large.has(stem)).length / small.size >= REPEATED_BODY_THRESHOLD;
  };
  return list.flatMap((current, slideIndex) => {
    if (!current) return [];
    const duplicateOf = list.findIndex((previous, index) => index < slideIndex && previous
      && sameLabels(previous.labels, current.labels) && !numbersConflict(previous.values, current.values));
    return duplicateOf >= 0 ? [{ slideIndex, duplicateOf }] : [];
  });
}

/** Aviso fora do slide: repetição que o reparo não resolveu numa apresentação. */
export function repeatedSlidesNotice(repeated) {
  const list = (Array.isArray(repeated) ? repeated : []).map(item => `${item.duplicateOf + 1} e ${item.slideIndex + 1}`);
  if (!list.length) return '';
  const advice = `O material rende menos slides do que o pedido: ${list.length > 1 ? 'junte cada par' : 'junte os dois'}, reescreva um deles ou gere de novo com menos slides.`;
  return list.length > 1
    ? `Estes slides dizem o mesmo com outras palavras: ${list.join('; ')}. ${advice}`
    : `Os slides ${list[0]} dizem o mesmo com outras palavras. ${advice}`;
}

/**
 * Reteste real 24/11 (RT24 3): Caso, slide 10, tinha como título "What happens
 * if you don't like the site?", a mesma lacuna que o plano listou ("Sem
 * detalhes sobre o que acontece se o cliente não gostar do site"). O slide é
 * em inglês e a lacuna em português: a comparação usa a pergunta que o plano
 * deu à posição, escrita no idioma das lacunas. Vale só para título que é
 * pergunta, com três quartos dos radicais da pergunta dentro de uma lacuna.
 */
export function gapQuestionSlides(slides, plan) {
  const gaps = (Array.isArray(plan?.gaps) ? plan.gaps : []).map(gap => contentStems(gap)).filter(gap => gap.size);
  if (!gaps.length) return [];
  const covered = (text) => {
    const stems = [...contentStems(text)];
    return stems.length >= 2 && gaps.some(gap => stems.filter(stem => gap.has(stem)).length / stems.length >= 0.75);
  };
  return (Array.isArray(slides) ? slides : []).flatMap((slide, index) => (/\?\s*$/.test(String(slide?.title || '').trim())
    && (covered(slide.title) || covered(plan.slides?.[index]?.question)) ? [index] : []));
}

function repeatedContentRule(slides, unit = 'CARD') {
  const repeated = repeatedContentSlides(slides);
  return repeated.length
    ? `\n${unit} REPETIDO — ${repeated.map(item => `slideIndex ${item.slideIndex} repete o slideIndex ${item.duplicateOf}`).join('; ')} com outras palavras. Correção obrigatória: reescreva o que repete com outra informação do material; não copie nem parafraseie o CTA ou outro ${unit.toLowerCase()}. Não mude a quantidade.`
    : '';
}

const slideHasText = slide => ['title', 'subtitle', 'bodyAfterImage'].some(field => String(slide?.[field] || '').trim());

/**
 * Assinaturas do deck para o pedido à IA: as medidas nos slides atuais mais as
 * que o chamador mediu no rascunho (config.deckSignatures). Teste 4 (25/11): a
 * régua da contagem é a do rascunho; se o texto mudou depois (a capa deixou de
 * citar a frase), o pedido não pode voltar a tratá-la como fato repetido.
 */
function promptSignatures(slides, plan, measured) {
  const found = deckSignatures(slides, plan);
  for (const item of Array.isArray(measured) ? measured : []) {
    if (typeof item === 'string' && tokensOf(item).length && !found.some(known => tokensOf(known).join(' ') === tokensOf(item).join(' '))) found.push(item);
  }
  return found;
}

/** Fato com número que está dentro de uma assinatura não é repetição (Teste 4). */
/**
 * Desfechos do reparo de repetição em reviewDiagnostics (entrada com stage
 * 'repetition', sizeBefore e sizeAfter = tamanho da repetição antes e no deck
 * que segue; targets = slides pedidos):
 * - repetition_none: não havia repetição; o reparo não foi chamado. Deck sem
 *   nenhuma entrada 'repetition' foi gerado antes deste registro (25/11).
 * - repetition_repaired: reparo aceito (menos repetição, sem fato novo nem
 *   limite pior).
 * - repetition_request_failed: a chamada falhou (status e message).
 * - repetition_invalid_response: resposta sem edits ou com edição que não
 *   passa no contrato (message).
 * - repetition_out_of_scope: editou slide fora da lista (outOfScope).
 * - repetition_not_improved: não reduziu a repetição; unchanged quando o
 *   texto voltou igual; sizeProposed.
 * - repetition_rejected_facts_or_limits: reduziu, mas criou fato sem fonte
 *   ou passou do limite (rejectedBy) e nenhuma edição isolada se aproveitou.
 * - repetition_partially_salvaged: mesmo caso, com parte das edições mantida
 *   slide a slide (kept, dropped). Desfecho próprio porque o deck mudou; é a
 *   convenção da revisão ('salvaged').
 */
export const REPETITION_REPAIR_OUTCOMES = Object.freeze([
  'repetition_none', 'repetition_repaired', 'repetition_request_failed', 'repetition_invalid_response', 'repetition_out_of_scope',
  'repetition_not_improved', 'repetition_rejected_facts_or_limits', 'repetition_partially_salvaged',
]);

export function factsOutsideSignatures(facts, signatures) {
  const runs = (Array.isArray(signatures) ? signatures : []).map(tokensOf).filter(run => run.length);
  return runs.length ? facts.filter(item => !runs.some(run => containsRun(run, tokensOf(item.fact)))) : facts;
}

function repeatedFactRule(slides, plan, measured) {
  const signatures = promptSignatures(slides, plan, measured);
  const repeated = [...factsOutsideSignatures(repeatedFactSlides(slides), signatures), ...repeatedPhraseSlides(slides, { signatures }).map(item => ({ fact: item.phrase, slideIndexes: item.slideIndexes }))];
  return repeated.length
    ? `\nFATO REPETIDO — ${repeated.map(item => `"${item.fact}" aparece nos slideIndex ${item.slideIndexes.join(', ')}`).join('; ')}. Mantenha cada fato no slide em que ele é o assunto (no máximo 2 slides); nos outros, troque por outra informação do material ou condense, sem inventar e sem mudar a quantidade de slides.`
    : '';
}

function repeatedTitleRule(slides) {
  const repeated = repeatedTitleIndexes(slides);
  return repeated.length
    ? `\nTÍTULO REPETIDO — correção obrigatória nos slideIndex ${repeated.join(', ')}: o title repete (ou quase) o de um slide anterior. Reescreva com a ideia própria deste slide, sem repetir o mesmo fato; se o slide não tem ideia nova, condense o conteúdo com o anterior sem mudar a quantidade.`
    : '';
}

// Reteste 22/11 (W02): título "segunda língua grátis" com apoio sobre os
// modelos de taqueria. Não há regra segura por palavras; a revisão confere.
// Teste 4 (25/11): a revisão não pode tirar a linha da campanha da capa.
function signatureRule(slides, plan, measured) {
  const signatures = promptSignatures(slides, plan, measured);
  return signatures.length
    ? `\nASSINATURA DO DECK — ${signatures.map(item => `"${item}"`).join('; ')}: é a linha da campanha, não repetição. Mantenha-a na capa e no fecho onde já estiver; não a remova nem a reescreva por causa de repetição.`
    : '';
}

const TITLE_SUPPORT_RULE = '\nTÍTULO × APOIO — em cada card, título e apoio tratam do mesmo assunto. Se o apoio desenvolve outro fato, reescreva o título para o assunto do apoio (ou o apoio para o assunto do título), usando só o material.';

export function buildEditorialReviewPrompt(prompt, draft, config = {}) {
  if (config.presetId === 'apresentacao') {
    const limitsBlock = buildPresentationLimitsBlock(config, draft?.slides?.length || config.count || 0);
    const lessonRepair = getPresentationPath(config.presentationPath).id === 'aula_workshop'
      ? ' Em Aula, o arco a preservar é o aprendizado: corrija uma etapa de prática/correção omitida e não mantenha um desvio comercial só porque ele foi planejado, sem alterar quantidade ou ordem física.'
      : '';
    const plannedRules = config.presentationPlan
      ? `\nCompare também o roteiro validado com a redação: cada pergunta precisa ser respondida, mas fatos e estágio (fato, proposta ou desconhecido) devem ser conferidos nas fontes originais. Validar a estrutura do roteiro não comprova suas afirmações. Não use o roteiro nem o rascunho como fonte de si mesmos. Não acrescente tração, preço, equipe ou promessa ausentes. Notas complementam a página, sem esconder ali a conclusão essencial.\n${plannedReviewStructure(config.presentationPlan)}\nPreserve o tipo do bloco e a integridade dos valores/unidades/condições; não duplique tabela em parágrafos. ${presentationReviewBlockContract(config.nativeBlocks, config.freeDesign === true)}`
      : '';
    const reviewDraft = config.presentationPlan ? {
      // Auditoria 23/11 (B7): o índice explícito evita a edição contada a partir
      // de 1 (Relatório 5 e 6, Caso 6 e 8: texto do slide vizinho no slide errado).
      slides: draft.slides.map((slide, slideIndex) => ({ slideIndex, ...Object.fromEntries(['title', 'eyebrow', 'subtitle', 'bodyAfterImage', 'speakerNotes', 'presentationBlocks']
        .filter(field => hasOwn(slide, field)).map(field => [field, slide[field]])) })),
      caption: draft.caption,
    } : draft;
    const editableFields = config.presentationPlan
      ? 'title, eyebrow, subtitle, bodyAfterImage, speakerNotes ou presentationBlocks'
      : 'title, subtitle ou bodyAfterImage';
    return `REVISÃO DE APRESENTAÇÃO — UMA RODADA, SOMENTE TEXTO.
O briefing abaixo é referência, não um pedido para gerar o deck novamente.
<briefing>\n${prompt}\n</briefing>
<rascunho>\n${JSON.stringify(reviewDraft)}\n</rascunho>
${buildReviewFactCheckPrompt()}
Verifique também: promessa da capa entregue; caminho escolhido respeitado; uma ideia por slide; progressão sem repetição; títulos legíveis a distância; argumentos e exemplos sustentados pelo material; síntese e próximo passo coerentes.${limitsBlock}
Leia todos os campos do rascunho, inclusive blocos nativos, speakerNotes e caption. Verifique fatos, estágio e condições em cada campo, não apenas no texto principal. Decisão pendente permanece pendente; aceite não autoriza deduzir encerramento contratual. Base, período e condições essenciais de indicadores e escopo devem estar visíveis no slide correspondente, não somente nas notas.
Corrija apenas problemas identificados. Preserve ordem, quantidade, assunto, arco, números e fatos sustentados.${lessonRepair} Remova ou qualifique alegações sem apoio; não acrescente fontes ou fatos. Não altere imageQuery nem configuração visual.
Use slideIndex começando em zero. Não envie edições para slides que já estejam bons. Cada índice aparece no máximo uma vez. ${buildPresentationReviewRules(config.presentationPath)}${repeatedTitleRule(draft?.slides)}${repeatedContentRule(draft?.slides, 'SLIDE')}${repeatedFactRule(draft?.slides, config.presentationPlan, config.deckSignatures)}${signatureRule(draft?.slides, config.presentationPlan, config.deckSignatures)}${TITLE_SUPPORT_RULE}
Resposta: um único objeto JSON {"edits":[{"slideIndex":0,"reason":"problema concreto","title":"texto corrigido"}],"caption":"resumo geral corrigido apenas se necessário"}.
Cada edição exige slideIndex e reason; inclua somente os campos que mudam: ${editableFields}. caption é opcional. Se estiver adequado, retorne {"edits":[]}. Sem texto fora do JSON ou campos adicionais.${plannedRules}`;
  }
  // QA 24/11 (texto 3): o card que a IA não devolveu chega aqui vazio. Mandar
  // "preencher o título com o que já está escrito" fazia a revisão copiar o CTA.
  const emptyCards = (Array.isArray(draft?.slides) ? draft.slides : []).flatMap((slide, index) => slideHasText(slide) ? [] : [index]);
  const missingTitles = missingSocialTitleIndexes(draft?.slides, config).filter(index => !emptyCards.includes(index));
  const longSupport = [...new Set(auditSocialTextDensity(draft?.slides, config).map(item => item.slideIndex))];
  const echoes = supportEchoesTitleIndexes(draft?.slides);
  const unsupportedClaims = auditDraftFactuality(draft, config);
  const titleRule = requiresSocialTitles(config)
    ? `\nTODOS os cards, em qualquer modo narrativo, exigem title curto e específico, nunca vazio nem "Seu título aqui". Separe a ideia principal de subtitle sem apagar o desenvolvimento. ${buildSocialTextLimitsPrompt(config)}${missingTitles.length ? ` Correção obrigatória: preencha title nos slideIndex ${missingTitles.join(', ')} usando apenas o argumento já escrito.` : ''}${longSupport.length ? ` Correção obrigatória: condense o texto nos slideIndex ${longSupport.join(', ')} sem perder fatos ou condições. Não transfira excesso de subtitle para bodyAfterImage: a soma também tem limite.` : ''}`
    : '';
  const claimsRule = unsupportedClaims.length
    ? `\nALEGAÇÕES COMERCIAIS SUGERIDAS SEM APOIO E OUTROS DADOS NÃO SUSTENTADOS — correção obrigatória: ${unsupportedClaims.map(item => `${item.slideIndex == null ? 'caption' : `slideIndex ${item.slideIndex}, ${item.field}`}: ${item.claim}`).join('; ')}. Remova o detalhe sem apoio; não substitua por outra promessa. Qualificar um número inventado como possibilidade não o transforma em fato.`
    : '';
  const echoRule = echoes.length
    ? `\nAPOIO QUE REPETE O TÍTULO — correção obrigatória nos slideIndex ${echoes.join(', ')}: o subtitle diz de novo o que o title já diz. Reescreva o subtitle com uma informação nova do material ou deixe-o vazio.`
    : '';
  const emptyRule = emptyCards.length
    ? `\nCARD SEM TEXTO — ${emptyCards.length > 1 ? `os slideIndex ${emptyCards.join(', ')} vieram vazios` : `o slideIndex ${emptyCards[0]} veio vazio`}. Só preencha com uma informação do material que ainda não está em outro card; não copie nem parafraseie o CTA ou outro card. Sem informação nova, deixe title e subtitle vazios.`
    : '';
  const repeatRule = repeatedTitleRule(draft?.slides) + repeatedContentRule(draft?.slides) + repeatedFactRule(draft?.slides) + TITLE_SUPPORT_RULE + emptyRule;
  const explicitScriptRule = config?.explicitCardScript?.count
    ? `\nROTEIRO EXPLÍCITO DO USUÁRIO — preserve a correspondência entre cada bloco e o slideIndex equivalente. Não funda, reordene, mova para outro card nem omita um bloco. A revisão pode melhorar clareza e encaixe dentro do próprio card, sem trocar sua função, fatos ou intenção.`
    : '';
  return `REVISÃO EDITORIAL — UMA RODADA, SOMENTE TEXTO.
O briefing abaixo é referência, não um pedido para gerar o carrossel novamente.
<briefing>\n${prompt}\n</briefing>
<rascunho>\n${JSON.stringify(draft)}\n</rascunho>
${buildFactualGroundingPrompt(config)}
${buildReviewFactCheckPrompt()}
Verifique também: promessa da capa entregue pelo miolo; slide 2 útil; progressão sem repetição; exemplos concretos; afirmações sustentadas pelo material; voz e densidade; legenda complementar; um CTA coerente com o objetivo; linguagem idiomática e natural. Corrija traduções literais, provérbios inventados, ditados combinados e metáforas ambíguas ou sem sentido.${titleRule}${claimsRule}${echoRule}${repeatRule}${explicitScriptRule}
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
  const editableTextFields = ['title', 'subtitle', 'bodyAfterImage', ...(planned ? ['speakerNotes', 'eyebrow'] : [])];
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
    ...repeatedTitleIndexes(draft.slides).map(slideIndex => ({ kind: 'repeated_title', slideIndex, field: 'title', code: 'social_title_repeated' })),
    // QA 24/11 (texto 3): corpo e paráfrase também contam, não só o título.
    ...repeatedContentSlides(draft.slides).filter(item => !repeatedTitleIndexes(draft.slides).includes(item.slideIndex))
      .map(item => ({ kind: 'repeated_content', slideIndex: item.slideIndex, field: 'subtitle', code: 'social_content_repeated', duplicateOf: item.duplicateOf })),
    ...auditDraftFactuality(draft, config).map(item => ({ kind: 'factual', ...item })),
  ];
}

/**
 * QA 24/11 (texto 3): card que veio vazio e a revisão preencheu com a cópia de
 * outro (o CTA) volta a ficar vazio. O aviso de "menos cards do que o pedido"
 * já acompanha esse espaço.
 */
function withoutCopiedFills(candidate, draft) {
  const plain = slide => plainWords(visibleText(slide)).replace(/[^a-z0-9]+/g, ' ').trim();
  let changed = false;
  const slides = candidate.slides.map((slide, index) => {
    if (slideHasText(draft.slides[index]) || !slideHasText(slide)) return slide;
    const copied = candidate.slides.some((other, otherIndex) => otherIndex !== index && slideHasText(other)
      && (plain(other) === plain(slide) || plain(other).includes(plain(slide)) || slideSimilarity(other, slide) >= REPEATED_CONTENT_THRESHOLD));
    if (!copied && !repeatedTitleIndexes(candidate.slides).includes(index)) return slide;
    changed = true;
    return draft.slides[index];
  });
  return changed ? { ...candidate, slides } : candidate;
}

/**
 * Último recurso sem IA: o card que ainda repete outro sai. Só quando a
 * quantidade pode mudar (não é "refazer" nem roteiro card a card do usuário).
 */
function withoutRepeatedCards(candidate, config) {
  if (config?.keepCardCount || config?.explicitCardScript?.count) return null;
  // RT24 1: quando o repetido é o último card (o fecho), sai o anterior.
  const last = candidate.slides.length - 1;
  const drop = new Set(repeatedContentSlides(candidate.slides).map(item => (item.slideIndex === last && item.duplicateOf > 0 ? item.duplicateOf : item.slideIndex)));
  if (!drop.size) return null;
  const kept = candidate.slides.filter((_, index) => !drop.has(index));
  return { ...candidate, slides: kept.map((slide, index) => (typeof slide.bodyAfterImage === 'string' && slide.bodyAfterImage
    && !bodyAllowed(index, kept.length, config.presetId, config.densityId) ? { ...slide, bodyAfterImage: '' } : slide)) };
}

/** Refinements are a single paid call. Reject a bad replacement and keep the
 * user's current cards; existing claims are not new evidence for new claims. */
export function assertSocialRefinement(previous, candidate, config) {
  if (candidate.slides.length !== previous.slides.length) throw new Error('O refinamento mudou a quantidade de cards. Mantive o conteúdo anterior.');
  const key = issue => JSON.stringify([issue.slideIndex, issue.field, issue.category, issue.claim]);
  const priorFacts = new Set(auditDraftFactuality(previous, config).map(key));
  // Paráfrase entre cards é assunto da geração (reparo e aviso próprios). No
  // refinamento ela não recusa o texto: a mensagem abaixo fala de título e
  // tamanho, e recusar por outro motivo deixaria a pessoa sem saber o que mudar.
  const issues = auditSocialDraft(candidate, config).filter(issue => (issue.kind !== 'factual' || !priorFacts.has(key(issue)))
    && issue.kind !== 'repeated_content');
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

/**
 * MF-04: uma única edição com campo fora do layout (ex.: corpo num card que
 * não tem corpo) descartava a revisão inteira, e as correções de fatos da
 * mesma resposta se perdiam ("Rascunho preservado"). Aqui o campo inválido sai
 * e as demais edições seguem. Resposta sem nada aproveitável, índice repetido
 * ou fora do formato continua inválida.
 */
function salvageSocialReview(draft, review, config) {
  const value = unwrapEditorialReview(review);
  if (!isObject(value) || !Array.isArray(value.edits)) return value;
  const count = draft.slides.length;
  const indexes = value.edits.map(edit => edit?.slideIndex);
  if (new Set(indexes).size !== indexes.length) return value;
  let dropped = 0;
  const edits = [];
  for (const edit of value.edits) {
    if (!isObject(edit) || !Number.isInteger(edit.slideIndex) || edit.slideIndex < 0 || edit.slideIndex >= count
        || typeof edit.reason !== 'string' || !edit.reason.trim()) { dropped += 1; continue; }
    const clean = { slideIndex: edit.slideIndex, reason: edit.reason };
    for (const field of ['title', 'subtitle', 'bodyAfterImage']) {
      if (!hasOwn(edit, field)) continue;
      if (typeof edit[field] !== 'string'
          || (field === 'bodyAfterImage' && !bodyAllowed(edit.slideIndex, count, config.presetId, config.densityId))) { dropped += 1; continue; }
      clean[field] = edit[field];
    }
    if (Object.keys(clean).length > 2) edits.push(clean);
  }
  const salvaged = { edits };
  if (hasOwn(value, 'caption')) {
    if (typeof value.caption === 'string') salvaged.caption = value.caption;
    else dropped += 1;
  }
  // Nada aproveitável numa resposta com partes inválidas: revisão inválida.
  if (dropped && !edits.length && !hasOwn(salvaged, 'caption')) return value;
  return salvaged;
}

async function reviewSocialDraft({ prompt, draft, config, textOptions, onStage }, callAI) {
  let candidate = draft;
  let reviewResponded = false;
  let reviewApplied = false;
  // Reteste 21/11 (T09): resposta fora do formato não é queda do serviço.
  // Ela ganha uma segunda tentativa antes de o rascunho seguir sem revisão;
  // erro da chamada (serviço fora) continua sem nova chamada.
  for (let attempt = 0; attempt < 2 && !reviewApplied; attempt += 1) {
    let responded = false;
    try {
      const review = await callAI(buildEditorialReviewPrompt(prompt, draft, config), textOptions);
      throwIfGenerationCancelled(textOptions.signal);
      reviewResponded = responded = true;
      const proposed = applyEditorialReview(draft, salvageSocialReview(draft, review, config), config, { deferQualityChecks: true });
      const accepted = retainGroundedFields(proposed, draft, config);
      candidate = withoutCopiedFills(accepted.result, draft);
      // MF-04: uma revisão válida cujas edições foram todas recusadas por
      // acrescentar fato sem fonte ainda conferiu o rascunho. Não é "revisão não
      // concluída"; o rascunho segue para as auditorias como conferido.
      reviewApplied = true;
    } catch (error) {
      if (isGenerationCancelled(error) || textOptions.signal?.aborted) throw error;
      if (!responded) break;
    }
  }
  let violations = auditSocialDraft(candidate, config);
  if (!violations.length) {
    const status = reviewApplied
      ? JSON.stringify(candidate) === JSON.stringify(draft) ? 'unchanged' : 'revised'
      : 'unavailable';
    // Reteste 22/11 (WebExpresso): a mesma frase ou fato em 3+ cards depois
    // da revisão ganha um reparo dirigido; falha não vira rascunho.
    const repeated = [...repeatedFactSlides(candidate.slides), ...repeatedPhraseSlides(candidate.slides).map(item => ({ fact: item.phrase, slideIndexes: item.slideIndexes }))];
    if (reviewResponded && repeated.length) {
      const sizeOf = slides => [...repeatedFactSlides(slides), ...repeatedPhraseSlides(slides)].reduce((sum, item) => sum + item.slideIndexes.length - 2, 0);
      const targets = [...new Set(repeated.flatMap(item => item.slideIndexes))].sort((a, b) => a - b);
      onStage?.('repairing');
      try {
        const repair = unwrapEditorialReview(await callAI(`${buildEditorialReviewPrompt(prompt, candidate, config)}
REPARO DE REPETIÇÃO — última passagem, sem gerar outro carrossel.
Edite somente slideIndex ${targets.join(', ')}. Repetições: ${repeated.map(item => `"${item.fact}" nos slideIndex ${item.slideIndexes.join(', ')}`).join('; ')}. Mantenha cada uma só no card em que ela é o assunto; nos outros, use outra informação do material ou condense. Não acrescente fatos nem mude a quantidade de cards. Preserve caption.`, textOptions));
        throwIfGenerationCancelled(textOptions.signal);
        if (Array.isArray(repair?.edits) && repair.edits.every(edit => targets.includes(edit?.slideIndex)) && !hasOwn(repair, 'caption')) {
          const repaired = retainGroundedFields(applyEditorialReview(candidate, repair, config, { deferQualityChecks: true }), candidate, config).result;
          if (!auditSocialDraft(repaired, config).length && sizeOf(repaired.slides) < sizeOf(candidate.slides)) {
            return finishSocialReview(repaired, 'repaired');
          }
        }
      } catch (error) {
        if (isGenerationCancelled(error) || textOptions.signal?.aborted) throw error;
      }
    }
    return finishSocialReview(candidate, status);
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
Reescreva frases completas para respeitar o limite. Preserve números, condições e fatos com fonte. Remova dados sem apoio. Card que repete outro, no título ou no texto, ganha outra informação do material; não copie o CTA. Não corte finais de frase, não troque por promessas novas, não acrescente novos cards.`, textOptions));
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
  // QA 24/11 (texto 3): a repetição era só marcada. Sem reparo da IA, o card
  // repetido sai e o projeto avisa que ficou com menos cards.
  const deduped = withoutRepeatedCards(candidate, config);
  const removed = deduped ? [{ kind: 'normalization', slideIndex: null, code: 'repeated_cards_removed' }] : [];
  if (deduped) {
    candidate = deduped;
    violations = auditSocialDraft(candidate, config);
  }
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
  return finishSocialReview(candidate, 'needs_attention', [...violations, ...removed]);
}

// Normalization is reversible editorial recovery, never silent proof that the
// provider followed the requested shape. Retain the legacy issue codes while
// exposing the same notices to the progressive-review UI.
function finishSocialReview(result, reviewStatus, violations = []) {
  const normalization = (Array.isArray(result.normalizationIssues) ? result.normalizationIssues : []).map(code => ({ kind:'normalization', slideIndex:null, code }));
  const all = [...violations, ...normalization];
  // QA 24/11 (texto 1): a lacuna que sobrou no card vai para o aviso de
  // material; o editor já tira a frase do card ao montar o projeto.
  const materialGaps = moveGapNotesOutOfSlides(result).gaps;
  return {
    result,
    reviewStatus:all.length ? 'needs_attention' : reviewStatus,
    ...(all.length ? { violations:all, issues:all.filter(item => item.code).map(({slideIndex, code}) => ({slideIndex, code})) } : {}),
    ...(materialGaps.length ? { materialGaps } : {}),
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
  // N1 (reteste 20/11): um lote de três que falha duas vezes não encerra mais
  // a geração. Ele volta à fila como posições individuais, com resposta menor
  // e as mesmas duas tentativas; só uma posição isolada que falha interrompe.
  const queue = [];
  for (let offset = 0; offset < plan.slides.length; offset += batchSize) queue.push([offset, Math.min(batchSize, plan.slides.length - offset)]);
  while (queue.length) {
    const [offset, size] = queue.shift();
    const entries = plan.slides.slice(offset, offset + size);
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
${lessonContinuity.length ? `ATIVIDADES JÁ REDIGIDAS — CONTINUIDADE, NÃO FONTE FACTUAL:\n${JSON.stringify(lessonContinuity)}\nSe esta chamada inclui a correção, responda à mesma tarefa e ao critério anunciados acima. Confira o conteúdo nas fontes originais; não legitime um cenário que o lote anterior inventou. Não troque a entrega do caso por uma pergunta pessoal ou por outro conceito.\n` : ''}Todo slide exige título específico, curto e não vazio. Respeite os limites de cada posição. speakerNotes é opcional, até 600 caracteres; não copie o briefing nem repita o slide nas notas. Limites são tetos, não metas de preenchimento. Não gere configuração visual, plano ou evidências no JSON de redação. Escreva apenas title, eyebrow (rótulo acima do título, 1 a 3 palavras em caixa alta, ou ""), subtitle, bodyAfterImage, imageQuery, presentationBlocks e speakerNotes em cada slide, mais caption (resumo breve ou vazio).
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
        const accessError = error?.isSessionGate || ['session_required', 'subscription_required', 'subscription_inactive', 'session_expired', 'unauthorized', 'payment_required', 'access_denied', 'rate_limited', 'text_quota_exhausted', 'provider_key_rejected'].includes(error?.code) || [401, 402, 403, 429].includes(error?.status);
        const interruptionReason = error?.code === 'provider_key_rejected' ? 'provider_key_rejected'
          : ['subscription_required', 'subscription_inactive', 'payment_required'].includes(error?.code) || error?.status === 402 ? 'subscription_required'
          : ['session_required', 'session_expired', 'unauthorized'].includes(error?.code) || error?.status === 401 ? 'session_required'
            : error?.code === 'text_quota_exhausted' ? 'text_quota_exhausted'
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
        if (attempt === 2 && !accessError && entries.length > 1) {
          diagnostics.push({ stage: 'writing', from: offset + 1, to: offset + entries.length, outcome: 'split_into_single_slides' });
          queue.unshift(...entries.map((_, index) => [offset + index, 1]));
          batch = null;
          break;
        }
        if (attempt === 2 || accessError) {
          if (!slides.length) throw Object.assign(new Error('O roteiro está pronto, mas não foi possível escrever os primeiros slides. Tente novamente com as mesmas escolhas.'), { code: 'presentation_writing_failed', stage: 'writing', writingDiagnostics: diagnostics });
          onStage?.('writing_interrupted', { completedCount: slides.length, totalCount: plan.slides.length, interruptionReason, diagnostics });
          return { draft: { slides, caption, presentationPlan: plan }, incomplete: true, completedCount: slides.length, totalCount: plan.slides.length, interruptionReason, diagnostics };
        }
      }
    }
    if (!batch) continue;
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
/** Aplica só as edições que passam sozinhas; devolve null se nenhuma passar. */
function salvagePresentationReview(draft, review, config) {
  const value = unwrapEditorialReview(review);
  if (!isObject(value) || !Array.isArray(value.edits) || !value.edits.length) return null;
  const indexes = value.edits.map(edit => edit?.slideIndex);
  if (new Set(indexes).size !== indexes.length) return null;
  const valid = value.edits.filter(edit => leniently(() => { applyEditorialReview(draft, { edits: [edit] }, config); return true; }, false));
  if (!valid.length || valid.length === value.edits.length) return null;
  const result = leniently(() => applyEditorialReview(draft, { edits: valid }, config), null);
  return result ? { result, dropped: value.edits.length - valid.length } : null;
}

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
    freeDesign: config.freeDesign === true,
    // Direção visual do deck: cores escritas no kit e referência que a IA não vê.
    kitColors: Array.isArray(planning.kitColors) ? planning.kitColors : [], kitReferenceWithoutText: planning.kitReferenceWithoutText === true,
    // Teste 6, item 1: cores extraídas da imagem de referência do kit.
    referenceColors: Array.isArray(planning.referenceColors) ? planning.referenceColors : [],
    aiOptions: textOptions, onStage, onPlan,
  }, callAI);
  let writingDiagnostics = [];
  // Reteste 0b1cb62 (D06): a revisão não rodou e não ficou registrado por quê.
  // Vai para presentationQuality.reviewDiagnostics no projeto. Entradas com
  // attempt são da revisão; entradas com stage 'repetition' são do reparo de
  // repetição (REPETITION_REPAIR_OUTCOMES).
  const reviewDiagnostics = [];
  // Visible native blocks and speaker notes carry factual claims as well.
  // This conservative check flags calculations/paraphrases for review; it
  // never deletes them or presents a literal matcher as a truth verifier.
  const collectText = value => typeof value === 'string' ? value : Array.isArray(value)
    ? value.map(collectText).join('\n') : isObject(value) ? Object.values(value).map(collectText).join('\n') : '';
  const factsOf = result => auditDraftFactuality({ ...result, slides: result.slides.map(slide => ({ ...slide,
    bodyAfterImage: [slide.bodyAfterImage, slide.speakerNotes, collectText(slide.presentationBlocks)].filter(Boolean).join('\n'),
  })) }, factualConfig).map(issue => ({ ...issue, kind: 'factual' }));
  // QA 24/11 (texto 1): slide cujo título é só a lacuna ("No prior results
  // documented") entra no reparo de fatos que já existe; o resto sai sem IA.
  // RT24 3: a pergunta-título cujo assunto é uma lacuna do plano segue o mesmo caminho.
  const gapTitlesOf = result => [...new Set([...moveGapNotesOutOfSlides(result).emptiedTitles, ...gapQuestionSlides(result.slides, plan)])].sort((a, b) => a - b)
    .map(slideIndex => ({ slideIndex, field: 'title', category: 'lacuna do material', claim: String(result.slides[slideIndex].title).trim(), kind: 'factual' }));
  // Teste 4 (25/11): linha de apoio que é pedaço do parágrafo do slide fica
  // vazia, sem IA (withoutEchoedSupportLines).
  const withCleanSupport = (value) => {
    const slides = withoutEchoedSupportLines(value.slides);
    return slides.some((slide, index) => slide !== value.slides[index]) ? { ...value, slides } : value;
  };
  const finish = (rawReviewed, reviewStatus, extra = {}) => {
    // Modo livre, fase 3: citação e número grande sem fonte literal no
    // material caem antes das conferências (a página fica sem o bloco).
    const grounded = config.freeDesign === true ? groundPresentationBlocks(rawReviewed.slides, factualConfig) : null;
    const reviewed = withCleanSupport(grounded && grounded.slides !== rawReviewed.slides ? { ...rawReviewed, slides: grounded.slides } : rawReviewed);
    // A lacuna sai do texto visível e vai, com as do plano, para o aviso de
    // material. Título que ficou vazio é marcado para revisão.
    const moved = moveGapNotesOutOfSlides(reviewed);
    const questions = gapQuestionSlides(moved.draft.slides, plan);
    const result = questions.length ? { ...moved.draft, slides: moved.draft.slides.map((slide, index) => (questions.includes(index) ? { ...slide, title: '' } : slide)) } : moved.draft;
    const facts = [...[...moved.emptiedTitles, ...questions].sort((a, b) => a - b).map(slideIndex => ({ kind: 'missing_title', slideIndex, field: 'title' })), ...factsOf(result)];
    const materialGaps = [...(Array.isArray(plan.gaps) ? plan.gaps : []), ...moved.gaps];
    // RT24 1: slide que ainda diz o mesmo que outro não vira rascunho; é
    // avisado fora do slide, junto do aviso sobre o material.
    const repetitionNotice = repeatedSlidesNotice(repeatedContentSlides(result.slides));
    return { result, plan, planningDiagnostics, writingDiagnostics, reviewDiagnostics, reviewStatus: facts.length ? 'needs_attention' : reviewStatus, ...extra,
      ...((facts.length || extra.violations?.length) ? { violations: [...(extra.violations || []), ...facts] } : {}),
      ...(materialGaps.length ? { materialGaps } : {}), ...(repetitionNotice ? { repetitionNotice } : {}) };
  };
  const plannedConfig = {
    ...factualConfig, presentationPlan: plan, freeDesign: config.freeDesign === true,
    presentationTextLimits: typeof config.presentationLimitsForPlan === 'function'
      ? config.presentationLimitsForPlan(plan)
      : config.presentationTextLimits,
  };
  const blockRules = config.nativeBlocks === false ? 'Neste padrão personalizado presentationBlocks deve ser []. Preserve a composição livre do usuário.' : buildPresentationBlocksPrompt({ free: config.freeDesign === true });
  const generationPrompt = `${prompt}\nINSTRUÇÕES ATUAIS DO USUÁRIO — restrições também válidas para cada lote de redação:\n${config.userInstructions || ''}\n${buildPresentationPlanBlock(plan)}\n${blockRules}\nCONTRATO COMPLEMENTAR: em cada slide inclua presentationBlocks (ou [] quando não houver bloco), speakerNotes (complemento opcional no idioma definido, até 600 caracteres, ou "") e eyebrow (rótulo acima do título, 1 a 3 palavras em caixa alta no idioma definido, ou "").${config.freeDesign === true ? ` ${FREE_EYEBROW_RULE}` : ''} O texto visível deve ser autossuficiente. Não coloque nomes de arquivos, rótulos de extração nem instruções ao designer no texto final. Dados, exemplos e condições permanecem fiéis às evidências. Em slides com bloco, subtitle contextualiza sem repetir suas células; bodyAfterImage fica vazio e apenas aprofundamento vai para speakerNotes.${buildPresentationLimitsBlock(plannedConfig, config.count)}`;
  const written = await writePresentationBatches({ prompt: generationPrompt, plan, config: plannedConfig, textOptions, onStage, onDraft }, callAI);
  writingDiagnostics = written.diagnostics;
  const draft = written.draft;
  // Teste 4 (25/11): a assinatura do deck (roteiro, capa e fecho, ou a frase
  // curta do material citada na capa) sai da conta de repetição. Medida uma
  // vez, no rascunho, para que antes e depois do reparo usem a mesma régua.
  const signatures = deckSignatures(draft.slides, plan);
  // O pedido da revisão e dos reparos usa a mesma régua (promptSignatures).
  plannedConfig.deckSignatures = signatures;
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
  const briefing = plannedReviewBriefing(config, planning, sources);
  const reviewPrompt = buildEditorialReviewPrompt(briefing, draft, plannedConfig);
  const limitsFor = slides => (typeof config.presentationLimitsForPlan === 'function'
    ? config.presentationLimitsForPlan(plan, slides) : plannedConfig.presentationTextLimits);
  // Excesso de até 10% cabe pelo autoajuste do layout; a exportação ainda mede
  // a página real (presentation-quality). Só o excesso maior pede reparo.
  const overLimits = slides => auditPresentationTextLimits(slides, limitsFor(slides))
    .filter(item => item.rule !== 'maxChars' || !(item.max > 0) || item.actual > item.max * 1.1);
  // Lote B (21/11): 5 de 7 apresentações nasciam como "Rascunho preservado",
  // quase todas por "garante"/"garantido" que a revisão não tirou. Antes de
  // entregar com aviso, uma chamada corrige só os slides com detalhe sem fonte.
  // Reteste 0b1cb62 (D02): a regra de repetição ia no prompt da revisão e o
  // modelo a ignorava. Sobrando título repetido ou fato em 3+ slides, um reparo
  // dirigido; se falhar ou não melhorar, o deck segue como estava (repetição
  // é qualidade, não fato sem fonte).
  const repetitionOf = slides => {
    const facts = [...factsOutsideSignatures(repeatedFactSlides(slides), signatures), ...repeatedPhraseSlides(slides, { signatures }).map(item => ({ fact: item.phrase, slideIndexes: item.slideIndexes }))];
    const titles = repeatedTitleIndexes(slides);
    // QA 24/11 (texto 3): corpo, paráfrase e bloco de passos também contam.
    const contents = repeatedContentSlides(slides);
    const steps = repeatedStepBlockSlides(slides);
    const metrics = repeatedMetricBlockSlides(slides);
    // Spec 1.1, entrega 3: frase inteira em 2 slides (de 3 em diante a trinca
    // acima já conta) e última linha do apoio igual ao título do slide.
    const sentences = repeatedSentenceSlides(slides, { signatures }).filter(item => item.slideIndexes.length === 2);
    const echoes = supportEchoesTitleIndexes(slides, { lastLine: true });
    // Teste 6 (26/11), item 2: título igual ao bloco ou ao apoio do mesmo slide.
    const titleEchoes = titleEchoesSlideTextIndexes(slides).filter(index => !echoes.includes(index) && !titles.includes(index));
    // Teste 4 (25/11): a conta é de ocorrências além da primeira. Com "- 2",
    // a frase copiada em 3 slides valia 1 e, tirada de um, virava frase em 2
    // slides (também 1): o reparo parcial era recusado como se não melhorasse.
    return { facts, titles, contents, steps, metrics, sentences, echoes, titleEchoes, size: facts.reduce((sum, item) => sum + item.slideIndexes.length - 1, 0) + titles.length
      + contents.filter(item => !titles.includes(item.slideIndex)).length + steps.length + metrics.length + sentences.length + echoes.length + titleEchoes.length };
  };
  // Slides que a repetição envolve, para o aviso no bloco de revisão.
  const repeatedSlidesOf = repetition => [...new Set([...repetition.facts.flatMap(item => item.slideIndexes), ...repetition.titles,
    ...repetition.contents.flatMap(item => [item.duplicateOf, item.slideIndex]), ...repetition.steps.flatMap(item => [item.duplicateOf, item.slideIndex]),
    ...repetition.metrics.flatMap(item => [item.duplicateOf, item.slideIndex]), ...repetition.sentences.flatMap(item => item.slideIndexes), ...repetition.echoes, ...repetition.titleEchoes])].sort((a, b) => a - b);
  // Teste 4: frase repetida que está no fecho fica no fecho; o reparo pede os outros slides.
  const closingIndex = draft.slides.length - 1;
  const withoutClosing = indexes => (indexes.length > 1 && indexes.includes(closingIndex) ? indexes.filter(index => index !== closingIndex) : indexes);
  // A assinatura que estava na capa ou no fecho volta ao campo de onde o reparo a tirou.
  const keepSignatureFields = (before, after) => {
    if (!signatures.length) return after;
    const runs = signatures.map(tokensOf).filter(run => run.length);
    const has = text => runs.some(run => containsRun(tokensOf(text), run));
    let changed = false;
    // Teste 6, item 2: a assinatura que continua no slide (na citação do
    // bloco, por exemplo) não volta ao título reescrito.
    const blockText = slide => JSON.stringify(Array.isArray(slide?.presentationBlocks) ? slide.presentationBlocks : []);
    const slides = after.slides.map((slide, index) => {
      if (index !== 0 && index !== closingIndex) return slide;
      if (has(blockText(slide)) && has(blockText(before.slides[index]))) return slide;
      const restored = Object.fromEntries(['title', 'subtitle', 'bodyAfterImage']
        .filter(field => has(before.slides[index]?.[field]) && !has(slide?.[field])).map(field => [field, before.slides[index][field]]));
      if (!Object.keys(restored).length) return slide;
      changed = true;
      return { ...slide, ...restored };
    });
    return changed ? { ...after, slides } : after;
  };
  // Último recurso sem IA: o segundo bloco igual (passos ou métricas) sai do
  // slide. O texto do slide não é trocado. Até o reteste de 24/11 o slide
  // repetido recebia a pergunta e a mensagem do plano; os planos reais mostram
  // que esse texto é anotação de planejamento ("Resultado observado: N/A",
  // "sem resultados de projeto documentados"), em português mesmo com o deck em
  // inglês. O slide que continua repetido é avisado fora do slide (finish).
  const dedupeWithoutAI = (result) => {
    const sameBlock = new Set([...repeatedStepBlockSlides(result.slides), ...repeatedMetricBlockSlides(result.slides)].map(item => item.slideIndex));
    return sameBlock.size ? { ...result, slides: result.slides.map((slide, index) => (sameBlock.has(index) ? { ...slide, presentationBlocks: [] } : slide)) } : result;
  };
  const settleRepetition = async (result, reviewStatus, extra) => {
    const repetition = repetitionOf(result.slides);
    if (!repetition.size) {
      reviewDiagnostics.push({ stage: 'repetition', outcome: 'repetition_none', sizeBefore: 0, sizeAfter: 0 });
      return finish(result, reviewStatus, extra);
    }
    const targets = [...new Set([...repetition.facts.flatMap(item => withoutClosing(item.slideIndexes)), ...repetition.titles,
      ...repetition.contents.map(item => item.slideIndex), ...repetition.steps.map(item => item.slideIndex), ...repetition.metrics.map(item => item.slideIndex),
      ...repetition.sentences.flatMap(item => withoutClosing(item.slideIndexes)), ...repetition.echoes, ...repetition.titleEchoes])].sort((a, b) => a - b);
    const closingNote = [...repetition.facts.map(item => item.slideIndexes), ...repetition.sentences.map(item => item.slideIndexes)]
      .some(indexes => indexes.length > 1 && indexes.includes(closingIndex))
      ? ` Quando a repetição inclui o fecho (slideIndex ${closingIndex}), a frase fica no fecho e sai dos outros slides.` : '';
    const signatureNote = signatures.length ? ` Assinatura do deck, que não é repetição e fica onde está: ${signatures.map(item => `"${item}"`).join('; ')}.` : '';
    let current = result;
    let status = reviewStatus;
    // Teste 4 (revisão de 25/11): o desfecho do reparo fica registrado; antes,
    // falha, edição fora da lista, texto igual e descarte por fato ou limite
    // sumiam no mesmo catch.
    const diagnostic = { stage: 'repetition', outcome: '', sizeBefore: repetition.size, sizeAfter: repetition.size, targets };
    const failure = (outcome, error) => Object.assign(diagnostic, { outcome,
      ...(Number.isInteger(error?.status) ? { status: error.status } : {}), message: String(error?.message || '').slice(0, 160) });
    let repair;
    onStage?.('repairing');
    try {
      repair = await callAI(`${buildEditorialReviewPrompt(briefing, result, plannedConfig)}
REPARO DE REPETIÇÃO: edite somente os slides com slideIndex ${targets.join(', ')}.${repetition.facts.length ? ` Fatos que se repetem: ${repetition.facts.map(item => `"${item.fact}" nos slideIndex ${item.slideIndexes.join(', ')}`).join('; ')}. Mantenha cada fato só nos slides em que ele é o assunto; nos outros, troque por outra informação do material ou condense.` : ''}${repetition.titles.length ? ` Títulos que repetem um anterior: slideIndex ${repetition.titles.join(', ')}; reescreva com a ideia própria do slide.` : ''}${repetition.contents.length ? ` Slides que repetem outro com outras palavras: ${repetition.contents.map(item => `slideIndex ${item.slideIndex} (repete o ${item.duplicateOf})`).join('; ')}; reescreva com a contribuição própria da posição no roteiro.` : ''}${repetition.steps.map(item => ` Mesmo bloco de passos nos slideIndex ${item.duplicateOf} e ${item.slideIndex}: mantenha o bloco só no primeiro; no slideIndex ${item.slideIndex}, devolva presentationBlocks [] ou um bloco com outra informação do material.`).join('')}${repetition.metrics.map(item => ` Mesmo bloco de métricas nos slideIndex ${item.duplicateOf} e ${item.slideIndex}: mantenha o bloco só no primeiro; no slideIndex ${item.slideIndex}, devolva presentationBlocks [] ou um bloco com outra informação do material.`).join('')}${repetition.sentences.length ? ` Frase repetida em dois slides: ${repetition.sentences.map(item => `"${item.phrase}" nos slideIndex ${item.slideIndexes.join(' e ')}`).join('; ')}; mantenha a frase só no slide em que ela é o assunto e, no outro, escreva outra informação do material.` : ''}${repetition.echoes.length ? ` Apoio que termina repetindo o título do próprio slide: slideIndex ${repetition.echoes.join(', ')}; tire essa linha ou troque por uma informação nova do material.` : ''}${repetition.titleEchoes.length ? ` Título igual ao bloco ou ao apoio do próprio slide: slideIndex ${repetition.titleEchoes.join(', ')}; reescreva só o title (curto, de autor, com a ideia própria da posição) e mantenha o bloco e o apoio como estão.` : ''} ${closingNote}${signatureNote} Inclua presentationBlocks quando a repetição estiver no bloco. Não acrescente fatos, não mude quantidade nem ordem.`, reviewOptions);
      throwIfGenerationCancelled(aiOptions?.signal);
    } catch (error) {
      if (isGenerationCancelled(error) || aiOptions?.signal?.aborted) throw error;
      failure('repetition_request_failed', error);
    }
    const outOfScope = Array.isArray(repair?.edits) ? [...new Set(repair.edits.map(edit => edit?.slideIndex).filter(index => !targets.includes(index)))] : [];
    if (diagnostic.outcome) {
      // A chamada falhou: o deck segue como estava.
    } else if (!Array.isArray(repair?.edits)) {
      failure('repetition_invalid_response', new Error('Resposta sem a lista edits'));
    } else if (outOfScope.length) {
      Object.assign(diagnostic, { outcome: 'repetition_out_of_scope', outOfScope });
    } else {
      let applyError = null;
      let repaired = null;
      try { repaired = keepSignatureFields(result, applyEditorialReview(result, repair, plannedConfig, { deferQualityChecks: true })); } catch (error) { applyError = error; }
      if (!repaired) {
        failure('repetition_invalid_response', applyError);
      } else {
        const proposed = repetitionOf(repaired.slides).size;
        const rejectedBy = [...(factsOf(repaired).length > factsOf(result).length ? ['facts'] : []),
          ...(overLimits(repaired.slides).length > overLimits(result.slides).length ? ['limits'] : [])];
        // Item 2 do Teste 4: melhora parcial (menos ocorrências) é aceita. A
        // regra de aceite não mudou: menos repetição, sem fato novo, sem limite pior.
        if (proposed < repetition.size && !rejectedBy.length) {
          current = repaired;
          status = 'repaired';
          diagnostic.outcome = 'repetition_repaired';
        } else if (proposed >= repetition.size) {
          Object.assign(diagnostic, { outcome: 'repetition_not_improved', sizeProposed: proposed,
            unchanged: JSON.stringify(repaired.slides) === JSON.stringify(result.slides) });
        } else {
          // Reduziu a repetição, mas criou fato sem fonte ou passou do limite.
          // Cada edição entra sozinha sobre as já mantidas e fica só se reduz
          // a repetição sem piorar fatos nem limites (mesmos validadores).
          let kept = result;
          const keptSlides = [];
          const droppedSlides = [];
          for (const edit of repair.edits) {
            const candidate = leniently(() => keepSignatureFields(result, applyEditorialReview(kept, { edits: [edit] }, plannedConfig, { deferQualityChecks: true })), null);
            const helps = candidate && repetitionOf(candidate.slides).size < repetitionOf(kept.slides).size
              && factsOf(candidate).length <= factsOf(kept).length && overLimits(candidate.slides).length <= overLimits(kept.slides).length;
            if (helps) { kept = candidate; keptSlides.push(edit.slideIndex); } else droppedSlides.push(edit?.slideIndex ?? null);
          }
          if (keptSlides.length) { current = kept; status = 'repaired'; }
          Object.assign(diagnostic, { outcome: keptSlides.length ? 'repetition_partially_salvaged' : 'repetition_rejected_facts_or_limits',
            rejectedBy, sizeProposed: proposed, kept: keptSlides, dropped: droppedSlides });
        }
      }
    }
    diagnostic.sizeAfter = current === result ? repetition.size : repetitionOf(current.slides).size;
    reviewDiagnostics.push(diagnostic);
    const deduped = dedupeWithoutAI(current);
    // Teste 4, item 2: o que sobrou depois do reparo vai para o bloco de
    // revisão com os números dos slides, como o card removido.
    // Repetição é qualidade, não fato sem fonte: o status não muda e o deck
    // não vira "Rascunho preservado" (reteste 0b1cb62); o aviso vai à parte.
    const left = repeatedSlidesOf(repetitionOf(deduped.slides));
    return finish(deduped, deduped === current ? status : 'repaired', left.length ? { ...extra,
      repetitionRemaining: left.map(slideIndex => ({ kind: 'repetition_remaining', code: 'repetition_remaining', slideIndex, field: null })) } : extra);
  };
  // Teste 4, item 4: título que dá como fato o que o apoio do mesmo slide
  // chama de intenção vai ao reparo de fatos.
  const goalTitlesOf = result => goalTitleAsFactSlides(result.slides)
    .map(slideIndex => ({ slideIndex, field: 'title', category: 'intenção como fato', claim: String(result.slides[slideIndex].title).replace(/[*_]/g, '').trim(), kind: 'factual' }));
  const settle = async (input, inputStatus, extra = {}) => {
    const result = withCleanSupport(input);
    const reviewStatus = result !== input && inputStatus === 'unchanged' ? 'revised' : inputStatus;
    const problemsOf = value => [...factsOf(value), ...gapTitlesOf(value), ...goalTitlesOf(value)];
    const facts = problemsOf(result);
    const indexes = [...new Set(facts.map(item => item.slideIndex).filter(Number.isInteger))];
    if (!indexes.length) return settleRepetition(result, reviewStatus, extra);
    const missing = facts.filter(item => Number.isInteger(item.slideIndex) && item.category !== 'intenção como fato');
    const goals = facts.filter(item => item.category === 'intenção como fato');
    onStage?.('repairing');
    try {
      const repair = await callAI(`${buildEditorialReviewPrompt(briefing, result, plannedConfig)}
REPARO DE FATOS: edite somente os slides com slideIndex ${indexes.join(', ')}.${missing.length ? ` Estes trechos não estão no material: ${missing.map(item => `slideIndex ${item.slideIndex}, ${item.field === 'bodyAfterImage' ? 'apoio, notas ou bloco' : item.field}: "${item.claim}"`).join('; ')}.` : ''}${goals.length ? ` Título que afirma como fato o que o apoio do mesmo slide trata como intenção (pretende, quer, busca, meta): ${goals.map(item => `slideIndex ${item.slideIndex}, "${item.claim}"`).join('; ')}. Reescreva esse title no estágio do apoio (intenção ou meta), sem dar o resultado como alcançado.` : ''} Reescreva cada frase sem o detalhe, com o que o material sustenta (uma encomenda reserva, não garante). Título que só comenta um dado ausente sai: reescreva o slide com o que o material traz sobre o assunto. Não acrescente fatos; preserve números, unidades e condições do material.`, reviewOptions);
      throwIfGenerationCancelled(aiOptions?.signal);
      if (!Array.isArray(repair?.edits) || repair.edits.some(edit => !indexes.includes(edit?.slideIndex))) throw new Error('Reparo fora do escopo');
      const repaired = applyEditorialReview(result, repair, plannedConfig, { deferQualityChecks: true });
      if (problemsOf(repaired).length < facts.length && overLimits(repaired.slides).length <= overLimits(result.slides).length) {
        // Auditoria 23/11 (B1): o reparo de fatos encerrava aqui e o de repetição
        // nunca rodava (Pitch BLK FROGDAY: slides 8 e 9 idênticos).
        return settleRepetition(repaired, 'repaired', extra);
      }
    } catch (error) {
      if (isGenerationCancelled(error) || aiOptions?.signal?.aborted) throw error;
    }
    return settleRepetition(result, reviewStatus, extra);
  };
  let review;
  // Resposta fora do formato ganha uma segunda tentativa; erro da chamada
  // (serviço fora) não repete. Cada tentativa fica registrada.
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    let responded = false;
    try {
      const response = await callAI(reviewPrompt, reviewOptions);
      throwIfGenerationCancelled(aiOptions?.signal);
      responded = true;
      review = response;
      const result = applyEditorialReview(draft, response, plannedConfig);
      reviewDiagnostics.push({ attempt, outcome: 'applied' });
      return settle(result, JSON.stringify(result) === JSON.stringify(draft) ? 'unchanged' : 'revised');
    } catch (error) {
      if (isGenerationCancelled(error) || aiOptions?.signal?.aborted) throw error;
      // Revisão válida que só passou do limite segue para o reparo de excesso
      // abaixo (MF-04), sem nova tentativa.
      const validButLong = responded && leniently(() => { applyEditorialReview(draft, review, plannedConfig, { deferQualityChecks: true }); return true; }, false);
      if (validButLong) { reviewDiagnostics.push({ attempt, outcome: 'over_limits' }); break; }
      // Reteste 22/11 (WebExpresso): uma edição inválida (bloco fora do
      // contrato) descartava a revisão inteira. Aproveita as válidas.
      const salvaged = responded ? salvagePresentationReview(draft, review, plannedConfig) : null;
      if (salvaged) {
        reviewDiagnostics.push({ attempt, outcome: 'salvaged', dropped: salvaged.dropped, message: String(error?.message || '').slice(0, 160) });
        return settle(salvaged.result, JSON.stringify(salvaged.result) === JSON.stringify(draft) ? 'unchanged' : 'revised');
      }
      reviewDiagnostics.push({
        attempt, outcome: responded ? 'invalid_response' : 'request_failed',
        ...(Number.isInteger(error?.status) ? { status: error.status } : {}),
        message: String(error?.message || '').slice(0, 160),
      });
      if (!responded) break;
    }
  }
  // MF-04: a revisão era tudo-ou-nada. Se o texto revisado ainda passava do
  // limite, as correções de fato da mesma resposta iam embora, o reparo
  // partia do rascunho original e o deck saía como "Rascunho preservado".
  // Agora a revisão válida é mantida e só o excesso é reparado.
  const base = review === undefined ? draft : leniently(() => {
    const reviewed = applyEditorialReview(draft, review, plannedConfig, { deferQualityChecks: true });
    const claimSource = [plannedConfig.factualSource, plannedConfig.userInstructions].filter(Boolean).join('\n');
    const before = new Set(auditUnsupportedCommercialClaims(draft.slides, claimSource).map(item => item.claim));
    // Revisão que acrescenta promessa comercial não entra.
    if (auditUnsupportedCommercialClaims(reviewed.slides, claimSource).some(item => !before.has(item.claim))) return draft;
    return reviewed;
  }, draft);
  let current = base;
  let remaining = overLimits(current.slides);
  if (!remaining.length) {
    const same = JSON.stringify(current) === JSON.stringify(draft);
    return settle(current, current === draft ? 'unavailable' : same ? 'unchanged' : 'revised');
  }
  // Never cut the end of a sentence to fit: it may contain a condition or risk.
  // One semantic repair is limited to fields/slides known to exceed the layout.
  const indexes = [...new Set(remaining.map(item => item.slideIndex))];
  onStage?.('repairing');
  try {
    const repair = await callAI(`${buildEditorialReviewPrompt(briefing, current, plannedConfig)}\nREPARO DIRECIONADO: edite somente os slides com slideIndex ${indexes.join(', ')}. Reescreva sem perder números, unidades, hipóteses ou condições. Transfira explicações complementares para speakerNotes, mantendo a conclusão compreensível na página. Não corte frases por caracteres.`, reviewOptions);
    throwIfGenerationCancelled(aiOptions?.signal);
    if (!Array.isArray(repair?.edits) || repair.edits.some(edit => !indexes.includes(edit?.slideIndex))) throw new Error('Reparo fora do escopo');
    const repaired = applyEditorialReview(current, repair, plannedConfig, { deferQualityChecks: true });
    const left = overLimits(repaired.slides);
    if (left.length < remaining.length) { current = repaired; remaining = left; }
    if (!remaining.length) return settle(current, 'repaired');
  } catch (repairError) {
    if (isGenerationCancelled(repairError) || aiOptions?.signal?.aborted) throw repairError;
  }
  // Último recurso sem perder conteúdo: frases inteiras que excedem o apoio
  // vão para as notas do apresentador. Título e frase única não são cortados.
  const moved = moveOverflowToSpeakerNotes(current.slides, limitsFor(current.slides));
  const afterMove = overLimits(moved.slides);
  if (!afterMove.length) return settle({ ...current, slides: moved.slides }, 'fitted', { fits: moved.fits });
  return settle(current, 'needs_attention', { violations: remaining });
}

function leniently(task, fallback) {
  try { return task(); } catch { return fallback; }
}

/**
 * Move frases inteiras do fim do apoio (subtitle/bodyAfterImage) para as
 * notas do apresentador até caber. Nunca corta uma frase nem mexe no título.
 */
export function moveOverflowToSpeakerNotes(slides, limits) {
  const normalized = normalizePresentationTextLimits(limits, slides.length);
  const fits = [];
  const next = slides.map((slide, slideIndex) => {
    const copy = { ...slide };
    for (const field of ['bodyAfterImage', 'subtitle']) {
      const max = normalized[slideIndex]?.[field]?.maxChars;
      const text = String(copy[field] || '').trim();
      if (!max || text.length <= max) continue;
      let sentences = text.split(/(?<=[.!?…])\s+/u);
      // Frase única longa: a oração depois de travessão ou ponto e vírgula
      // também pode ir para as notas (lote B 21/11, Aula).
      if (sentences[0].length > max) {
        const [first, ...rest] = sentences;
        const clauses = first.split(/\s+[—–]\s+|;\s+/u);
        if (clauses.length > 1) sentences = [`${clauses[0].trim().replace(/[,;:]$/, '')}.`, `${clauses.slice(1).join('; ').replace(/^./, c => c.toUpperCase())}`, ...rest];
      }
      const keep = [];
      for (const sentence of sentences) {
        if ([...keep, sentence].join(' ').length > max) break;
        keep.push(sentence);
      }
      if (!keep.length) continue;
      const rest = sentences.slice(keep.length).join(' ');
      copy[field] = keep.join(' ');
      copy.speakerNotes = [rest, String(copy.speakerNotes || '').trim()].filter(Boolean).join('\n\n');
      fits.push({ slideIndex, field, max, movedToNotes: true });
    }
    return copy;
  });
  return { slides: next, fits };
}
