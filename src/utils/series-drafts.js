/**
 * Gerar série (Fatia 3): ideias → seleção → rascunhos de projeto.
 * Não gera carrosséis completos de uma vez — só cria docs com contexto herdado.
 */

import { OBJECTIVE_TEMPLATE_BY_ID } from './objective-templates.js';

export function buildSeriesIdeasPrompt({
  brandBio = '',
  contextMd = '',
  objectiveId = 'educar',
  ideaCount = 5,
  variety = 'media',
} = {}) {
  const objective = OBJECTIVE_TEMPLATE_BY_ID[objectiveId] || OBJECTIVE_TEMPLATE_BY_ID.educar;
  const n = Math.min(8, Math.max(3, Number(ideaCount) || 5));
  const varietyHint = variety === 'alta'
    ? 'Varie bastante ângulo, gancho e promessa — quase nenhum tema deve se sobrepor.'
    : variety === 'baixa'
      ? 'Mantenha os temas próximos ao mesmo eixo editorial, com nuances diferentes.'
      : 'Equilibre continuidade de marca com ângulos distintos.';
  return `Gere ideias de carrossel Instagram em português brasileiro para uma série.
Objetivo da série: ${objective.label} — ${objective.desc}
Quantidade: exatamente ${n} ideias.
Variedade: ${varietyHint}

Contexto da marca (fatos, não invente o que não estiver aqui):
${String(brandBio || '').trim() || '(sem bio)'}
${String(contextMd || '').trim() || '(sem brief de projeto)'}

Cada ideia precisa de título de capa (gancho) e ângulo editorial curto.
Não escreva os cards completos. Não invente números, cases ou provas.
Retorne APENAS JSON:
{"ideas":[{"title":"capa","angle":"recorte e utilidade","objectiveHint":"${objective.id}"}]}`;
}

export function normalizeSeriesIdeas(raw, { max = 8 } = {}) {
  const list = Array.isArray(raw?.ideas) ? raw.ideas : [];
  return list.slice(0, max).map((idea, i) => ({
    id: `idea-${i}-${String(idea?.title || '').slice(0, 12)}`,
    title: typeof idea?.title === 'string' ? idea.title.trim() : '',
    angle: typeof idea?.angle === 'string' ? idea.angle.trim() : '',
    objectiveHint: typeof idea?.objectiveHint === 'string' ? idea.objectiveHint : '',
  })).filter((idea) => idea.title);
}

/**
 * Seed de documento para rascunho de série (slides vazios + prompt/material).
 * O caller passa styleKit/brand já normalizados do projeto origem.
 */
export function buildSeriesDraftSeed({
  idea,
  styleKit = null,
  objectiveId = 'educar',
  folderId = '',
  publicationDate = '',
} = {}) {
  const objective = OBJECTIVE_TEMPLATE_BY_ID[objectiveId]
    || OBJECTIVE_TEMPLATE_BY_ID[idea?.objectiveHint]
    || OBJECTIVE_TEMPLATE_BY_ID.educar;
  const title = String(idea?.title || '').trim() || 'Rascunho da série';
  const angle = String(idea?.angle || '').trim();
  const prompt = angle
    ? `${objective.promptSeed}\n\nTema aprovado: ${title}. Ângulo: ${angle}.`
    : `${objective.promptSeed}\n\nTema aprovado: ${title}.`;
  return {
    name: title.slice(0, 60),
    folderId: folderId || '',
    publicationDate: publicationDate || '',
    seedDoc: {
      mode: objective.narrativeMode,
      creativePreset: 'livre',
      styleKit: styleKit
        ? {
            stylePrompt: styleKit.stylePrompt || '',
            contextMd: styleKit.contextMd || '',
            refImages: Array.isArray(styleKit.refImages) ? [...styleKit.refImages] : [],
            logo: styleKit.logo || null,
            logoOnGenerate: styleKit.logoOnGenerate !== false,
          }
        : { stylePrompt: '', contextMd: '', refImages: [] },
      material: {
        content: `Ideia da série: ${title}${angle ? `\nÂngulo: ${angle}` : ''}`,
        sources: '',
        context: '',
      },
      caption: '',
      // slides omitidos → newDoc cria um card vazio com a marca ativa
    },
    quickPrompt: prompt,
  };
}
