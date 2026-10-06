import { buildResearchPromptBias } from './generation-prompts.js';
import { buildContentObjectiveReminder } from './editorial-strategy.js';
import { getPresentationPath } from './presentation.js';

const isPresentationResearch = ({ productKind, creativePreset } = {}) => (
  productKind === 'apresentacao' || creativePreset === 'apresentacao'
);

export function buildResearchUserPrompt({
  niche,
  narrativeMode,
  creativePreset,
  contentObjective,
  productKind,
  presentationPath = 'auto',
  hasWeb = true,
  today = new Date().toISOString().slice(0, 10),
}) {
  if (isPresentationResearch({ productKind, creativePreset })) {
    const route = getPresentationPath(presentationPath);
    return `Pesquise base factual e ângulos para uma APRESENTAÇÃO 16:9 em português brasileiro.
Tema, setor ou contexto: ${JSON.stringify(niche)}. Data de referência: ${today}.
Caminho da apresentação: ${route.label}. Objetivo: ${route.intent}
${buildResearchPromptBias(narrativeMode, 'apresentacao', hasWeb, route.id)}
${hasWeb
    ? 'Use pesquisa web para encontrar evidências atuais e relevantes. Prefira fontes primárias. Cada evidência factual precisa de URL consultada, nome da fonte, data de publicação e data do evento quando disponível. Diferencie acontecimento recente de matéria recente sobre acontecimento antigo. Não invente fonte, número ou data; use string vazia quando a data do evento não estiver disponível.'
    : 'SEM WEB AO VIVO: formule hipóteses de ângulo e possíveis evidências a buscar. Não afirme que pesquisou fatos atuais. Não invente URLs, fontes, estudos, números ou datas; deixe sources e eventDate vazios e identifique as lacunas.'}
Cada ângulo deve conectar quatro partes: uma afirmação/título conclusivo, o recorte, a evidência que o sustentaria e a decisão, aprendizagem ou ação que muda para o público.
As aberturas orientadas à decisão devem preparar a sala para o assunto sem usar parada de scroll, promessa viral, cliffhanger ou CTA social.
Cada sourceIndexes referencia a posição de um item de evidence_topics, começando em zero; deixe vazio para hipóteses.
Retorne APENAS JSON:
{"evidence_topics":[{"topic":"evidência ou assunto","why":"o que foi observado e por que sustenta o deck, separando interpretação","eventDate":"AAAA-MM-DD ou vazio","sources":[{"name":"fonte","url":"https://...","publishedAt":"AAAA-MM-DD"}]}],"presentation_angles":[{"title":"afirmação-conclusão","angle":"recorte do argumento","evidence":"dado, caso, comparação, demonstração ou diagrama que sustentaria a afirmação","decision":"decisão, aprendizagem ou ação que este ângulo ajuda a tomar","sourceIndexes":[0]}],"decision_openings":[{"title":"abertura orientada à sala","evidence":"evidência ou contexto que autoriza a abertura","decision":"questão ou decisão que o deck vai resolver"}],"warning":"lacunas e limitações ou string vazia"}
Até 5 tópicos de evidência, 5 ângulos e 5 aberturas. Não preencha cota com fatos inventados. Se faltarem fontes confiáveis, retorne menos evidências e explique a limitação em warning.`;
  }
  return `Pesquise ângulos de conteúdo para Instagram em português brasileiro.
Nicho: ${JSON.stringify(niche)}. Data de referência: ${today}.
${buildContentObjectiveReminder(contentObjective)}
${buildResearchPromptBias(narrativeMode, creativePreset, hasWeb)}
${hasWeb
    ? 'Use pesquisa web para identificar fatos relevantes e atuais. Prefira fontes primárias. Cada fato precisa de URL consultada, nome da fonte, data de publicação e data do evento quando disponível. Diferencie acontecimento recente de matéria recente sobre acontecimento antigo. Não invente fonte nem data; use string vazia se a data do evento não estiver disponível.'
    : 'SEM WEB AO VIVO: gere hipóteses editoriais e assuntos duradouros. Não afirme que pesquisou tendências atuais. Não invente URLs, fontes, estudos ou datas; deixe sources vazio e eventDate vazio. Identifique as ideias como hipóteses a validar.'}
Varie os ganchos entre observação concreta, pergunta específica, utilidade e interpretação. Não force tese contraintuitiva nem fórmulas binárias repetidas.
Ideias devem corresponder a fatos encontrados ou estar identificadas como hipóteses. Cada sourceIndexes referencia a posição de um item de trending_topics, começando em zero; deixe vazio para hipóteses.
Retorne APENAS JSON:
{"trending_topics":[{"topic":"assunto","why":"fato observado e relevância, separando interpretação","eventDate":"AAAA-MM-DD ou vazio","sources":[{"name":"fonte","url":"https://...","publishedAt":"AAAA-MM-DD"}]}],"viral_hooks":["gancho"],"carousel_ideas":[{"title":"capa","angle":"recorte e utilidade","sourceIndexes":[0]}],"warning":"limitações da pesquisa ou string vazia"}
Até 5 assuntos, 7 ganchos e 5 ideias. Não preencha uma cota com fatos inventados. Se faltarem fontes confiáveis, retorne menos assuntos e explique a limitação em warning.`;
}

function safeUrl(value) {
  try {
    const u = new URL(value);
    return ['http:', 'https:'].includes(u.protocol) ? u.href : '';
  } catch { return ''; }
}
const text = value => typeof value === 'string' ? value : '';
const date = value => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text(value))) return '';
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? value : '';
};

export function normalizeResearchResult(raw, hasWeb, options = {}) {
  const presentation = isPresentationResearch(options);
  const rawTopics = presentation
    ? (Array.isArray(raw?.evidence_topics) ? raw.evidence_topics : raw?.trending_topics)
    : raw?.trending_topics;
  const topics = (Array.isArray(rawTopics) ? rawTopics : []).slice(0, 5).map(t => ({
    topic: typeof t === 'string' ? t : text(t?.topic), why: text(t?.why),
    eventDate: hasWeb ? date(t?.eventDate) : '',
    sources: hasWeb && Array.isArray(t?.sources) ? t.sources.map(s => ({ name: text(s?.name), url: safeUrl(s?.url), publishedAt: date(s?.publishedAt) })).filter(s => s.name && s.url && s.publishedAt).slice(0, 3) : [],
  }));
  if (presentation) {
    const rawAngles = Array.isArray(raw?.presentation_angles) ? raw.presentation_angles : raw?.carousel_ideas;
    const angles = (Array.isArray(rawAngles) ? rawAngles : []).slice(0, 5).map(i => ({
      title: text(i?.title),
      angle: text(i?.angle),
      evidence: text(i?.evidence),
      decision: text(i?.decision),
      sourceIndexes: hasWeb && Array.isArray(i?.sourceIndexes)
        ? [...new Set(i.sourceIndexes.filter(n => Number.isInteger(n) && topics[n]?.sources.length > 0))]
        : [],
    })).filter(i => i.title);
    const rawOpenings = Array.isArray(raw?.decision_openings) ? raw.decision_openings : raw?.viral_hooks;
    const openings = (Array.isArray(rawOpenings) ? rawOpenings : []).slice(0, 5).map((item) => (
      typeof item === 'string'
        ? { title: item, evidence: '', decision: '' }
        : { title: text(item?.title), evidence: text(item?.evidence), decision: text(item?.decision) }
    )).filter(item => item.title);
    return {
      evidence_topics: topics,
      presentation_angles: angles,
      decision_openings: openings,
      warning: !hasWeb ? 'Ângulos sem pesquisa web ao vivo; valide evidências e números antes de apresentar.' :
        topics.some(t => !t.sources.length) ? 'Algumas evidências não têm fonte datada e devem ser tratadas como hipóteses.' : text(raw?.warning),
    };
  }
  const ideas = (Array.isArray(raw?.carousel_ideas) ? raw.carousel_ideas : []).slice(0, 5).map(i => ({
    title: text(i?.title), angle: text(i?.angle),
    sourceIndexes: hasWeb && Array.isArray(i?.sourceIndexes) ? [...new Set(i.sourceIndexes.filter(n => Number.isInteger(n) && topics[n]?.sources.length > 0))] : [],
  })).filter(i => i.title);
  return {
    trending_topics: topics,
    carousel_ideas: ideas,
    viral_hooks: (Array.isArray(raw?.viral_hooks) ? raw.viral_hooks : []).filter(h => typeof h === 'string').slice(0, 7),
    warning: !hasWeb ? 'Ideias sem pesquisa web ao vivo; valide os fatos antes de publicar.' :
      topics.some(t => !t.sources.length) ? 'Alguns assuntos não têm fonte datada e devem ser tratados como hipóteses.' : text(raw?.warning),
  };
}

/** Fontes acompanham a ideia até o material do carrossel, não ficam só na pesquisa. */
export function researchIdeaMaterial(idea, topics) {
  const referenced = (idea.sourceIndexes || []).map(index => topics[index]).filter(t => t?.sources?.length);
  const isPresentationAngle = 'evidence' in (idea || {}) || 'decision' in (idea || {});
  const angleContext = isPresentationAngle
    ? [
        `Ângulo da apresentação: ${idea.title}.`,
        idea.angle ? `Recorte: ${idea.angle}.` : '',
        idea.evidence ? `Evidência sugerida: ${idea.evidence}.` : '',
        idea.decision ? `Decisão/aprendizagem: ${idea.decision}.` : '',
      ].filter(Boolean).join(' ')
    : `${idea.title}. ${idea.angle || ''}`;
  if (!referenced.length) return {
    content: `${isPresentationAngle ? 'Hipótese para apresentação' : 'Hipótese editorial'} a validar: ${angleContext}`,
    sources: '',
  };
  return {
    content: [
      isPresentationAngle ? angleContext : '',
      referenced.map(t => `${t.topic}: ${t.why}${t.eventDate ? `\nData do evento: ${t.eventDate}` : ''}\n${t.sources.map(s => `${s.name} (${s.publishedAt}): ${s.url}`).join('\n')}`).join('\n\n'),
    ].filter(Boolean).join('\n\n'),
    sources: [...new Set(referenced.flatMap(t => t.sources.map(s => s.url)))].join('\n'),
  };
}
