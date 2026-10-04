/**
 * Templates por objetivo (Fatia 3) — lançar, educar, prova social, bastidor.
 * Não confundir com CONTENT_OBJECTIVES (métrica IG) nem com pacotes criativos T/C.
 */

export const OBJECTIVE_TEMPLATES = [
  {
    id: 'lancar',
    label: 'Lançar',
    desc: 'Anúncio ou abertura de oferta — gancho, prova e CTA claro.',
    narrativeMode: 'viral',
    promptSeed: 'Criar um carrossel de lançamento: gancho que para o scroll, o que muda agora, prova rápida e CTA para agir.',
  },
  {
    id: 'educar',
    label: 'Educar',
    desc: 'Ensinar um passo ou framework útil sem virar aula genérica.',
    narrativeMode: 'how_to',
    promptSeed: 'Criar um carrossel educativo: problema concreto, método em passos curtos e aplicação imediata no dia a dia do público.',
  },
  {
    id: 'prova_social',
    label: 'Prova social',
    desc: 'Resultados, depoimentos ou evidência que gera confiança.',
    narrativeMode: 'editorial',
    promptSeed: 'Criar um carrossel de prova social: resultado real ou padrão observado, o que isso prova e o próximo passo para quem se identifica.',
  },
  {
    id: 'bastidor',
    label: 'Bastidor',
    desc: 'Processo, erro ou dia a dia — proximidade sem forçar intimidade.',
    narrativeMode: 'storytelling',
    promptSeed: 'Criar um carrossel de bastidor: uma cena real do processo, o que aprendi e o que o público pode levar daqui.',
  },
];

export const OBJECTIVE_TEMPLATE_BY_ID = Object.fromEntries(
  OBJECTIVE_TEMPLATES.map((t) => [t.id, t]),
);

export function resolveObjectiveTemplate(id) {
  return OBJECTIVE_TEMPLATE_BY_ID[id] || null;
}

/** Aplica o template ao pedido atual (não apaga contexto/tom). */
export function applyObjectiveTemplate(templateId, { quickPrompt = '' } = {}) {
  const t = resolveObjectiveTemplate(templateId);
  if (!t) return null;
  const current = String(quickPrompt || '').trim();
  return {
    id: t.id,
    narrativeMode: t.narrativeMode,
    quickPrompt: current || t.promptSeed,
    promptSeed: t.promptSeed,
  };
}
