import { buildResearchPromptBias } from './generation-prompts.js';
import { buildContentObjectiveReminder } from './editorial-strategy.js';

export function buildResearchUserPrompt({ niche, narrativeMode, creativePreset, contentObjective, hasWeb = true, today = new Date().toISOString().slice(0, 10) }) {
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

export function normalizeResearchResult(raw, hasWeb) {
  const topics = (Array.isArray(raw?.trending_topics) ? raw.trending_topics : []).slice(0, 5).map(t => ({
    topic: typeof t === 'string' ? t : text(t?.topic), why: text(t?.why),
    eventDate: hasWeb ? date(t?.eventDate) : '',
    sources: hasWeb && Array.isArray(t?.sources) ? t.sources.map(s => ({ name: text(s?.name), url: safeUrl(s?.url), publishedAt: date(s?.publishedAt) })).filter(s => s.name && s.url && s.publishedAt).slice(0, 3) : [],
  }));
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
  if (!referenced.length) return { content: `Hipótese editorial a validar: ${idea.title}. ${idea.angle || ''}`, sources: '' };
  return {
    content: referenced.map(t => `${t.topic}: ${t.why}${t.eventDate ? `\nData do evento: ${t.eventDate}` : ''}\n${t.sources.map(s => `${s.name} (${s.publishedAt}): ${s.url}`).join('\n')}`).join('\n\n'),
    sources: [...new Set(referenced.flatMap(t => t.sources.map(s => s.url)))].join('\n'),
  };
}
