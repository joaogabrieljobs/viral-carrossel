import { CONTENT_OBJECTIVES, EDITORIAL_STRUCTURES } from './editorial-strategy.js';

export const RESULT_WINDOWS = [1, 7, 30];
export const RESULT_METRICS = [
  { id: 'reach', label: 'Contas alcançadas' },
  { id: 'shares', label: 'Compartilhamentos' },
  { id: 'saves', label: 'Salvamentos' },
  { id: 'comments', label: 'Comentários' },
  { id: 'profileVisits', label: 'Visitas ao perfil' },
  { id: 'leads', label: 'Contatos comerciais atribuídos ao post' },
];
export const OBJECTIVE_METRIC = {
  shares: 'shares', saves: 'saves', conversation: 'comments',
  authority: 'profileVisits', culture: 'shares', leads: 'leads',
};
const DAY = 86400000;
const MIN_SAMPLE = 3;
const structureById = Object.fromEntries(EDITORIAL_STRUCTURES.map(s => [s.id, s]));
const normalizedText = v => String(v || '').trim().toLocaleLowerCase('pt-BR');
const dayNumber = value => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return NaN;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? date.getTime() / DAY : NaN;
};
export function normalizeResultAccount(value) {
  const account = normalizedText(value).replace(/^@/, '');
  return /^[a-z0-9._]{1,30}$/.test(account) ? account : '';
}
export function canonicalPublicationURL(value) {
  try {
    const url = new URL(String(value || '').trim());
    const match = url.pathname.match(/^\/p\/([A-Za-z0-9_-]+)\/?$/);
    return ['https:', 'http:'].includes(url.protocol) && ['instagram.com', 'www.instagram.com'].includes(url.hostname) && match
      ? `https://www.instagram.com/p/${match[1]}/` : '';
  } catch { return ''; }
}

/** O snapshot pertence à publicação, não ao rascunho que pode mudar depois. */
export function createPublicationResult(form, doc, previous = null, now = new Date()) {
  const account = normalizeResultAccount(form.account);
  const postURL = canonicalPublicationURL(form.postURL);
  if (!account) throw new Error('Informe o @ da conta, sem espaços.');
  if (!postURL) throw new Error('Cole o link do post: https://www.instagram.com/p/…');
  const publishedDay = dayNumber(form.publishedAt);
  const measuredDay = dayNumber(form.measuredAt);
  const windowDays = Number(form.windowDays);
  if (previous && (account !== previous.account || postURL !== previous.postURL || form.publishedAt !== previous.publishedAt ||
      form.measuredAt !== previous.measuredAt || windowDays !== previous.windowDays)) {
    throw new Error('Para outra publicação ou período, crie um novo registro.');
  }
  if (!RESULT_WINDOWS.includes(windowDays) || !Number.isFinite(publishedDay) || !Number.isFinite(measuredDay) ||
      measuredDay > dayNumber(now.toISOString().slice(0, 10)) || measuredDay - publishedDay !== windowDays) {
    throw new Error('A data da medição deve ser 1, 7 ou 30 dias após a publicação, conforme o período escolhido, e não pode estar no futuro.');
  }
  if (!OBJECTIVE_METRIC[form.objective]) throw new Error('Escolha o objetivo da publicação.');
  if (!['organic', 'paid'].includes(form.distribution)) throw new Error('Informe se houve impulsionamento.');
  const structureId = structureById[form.structureId] ? form.structureId : 'unknown';
  const metrics = {};
  for (const { id, label } of RESULT_METRICS) {
    const raw = form.metrics?.[id];
    if (raw == null || raw === '') { metrics[id] = null; continue; }
    if (!['string', 'number'].includes(typeof raw) || !/^\d+$/.test(String(raw)) || !Number.isSafeInteger(Number(raw))) {
      throw new Error(`${label}: informe um número inteiro, sem sinal ou separador de milhar.`);
    }
    metrics[id] = Number(raw);
  }
  if (!(metrics.reach > 0)) throw new Error('Informe pelo menos uma conta alcançada para calcular as taxas.');
  return {
    id: previous?.id || crypto.randomUUID(),
    account, postURL, publishedAt: form.publishedAt, measuredAt: form.measuredAt, windowDays,
    objective: form.objective, structureId, distribution: form.distribution, metrics,
    niche: String(form.niche || '').trim().slice(0, 200),
    mode: previous?.mode || doc.mode || 'editorial',
    presetId: previous?.presetId || doc.creativePreset || 'livre',
    snapshot: previous?.snapshot || {
      slides: (doc.slides || []).map(s => ({ title: s.title || '', subtitle: s.subtitle || '', bodyAfterImage: s.bodyAfterImage || '' })),
      caption: doc.caption || '',
    },
    createdAt: previous?.createdAt || now.toISOString(), updatedAt: now.toISOString(),
  };
}

export function collectPublicationResults(library) {
  const unique = new Map();
  for (const entry of library || []) {
    for (const record of Array.isArray(entry?.publicationResults) ? entry.publicationResults : []) {
      if (!record || typeof record !== 'object') continue;
      const url = canonicalPublicationURL(record.postURL);
      if (!url || !RESULT_WINDOWS.includes(record.windowDays)) continue;
      const key = `${url}|${record.windowDays}`;
      const old = unique.get(key);
      if (!old || String(record.updatedAt || '') > String(old.updatedAt || '')) {
        unique.set(key, { ...record, postURL: url, projectId: entry.id, projectName: entry.name });
      }
    }
  }
  return [...unique.values()].sort((a, b) => String(b.publishedAt).localeCompare(String(a.publishedAt)));
}

/** Atualiza importações duplicadas juntas; uma publicação nunca vira duas amostras. */
export function savePublicationResult(library, projectId, record) {
  if (!library.some(entry => entry.id === projectId)) throw new Error('O projeto deste registro não está mais na biblioteca.');
  const records = collectPublicationResults(library);
  const same = records.find(r => r.postURL === record.postURL && r.windowDays === record.windowDays);
  if (same && same.id !== record.id) throw new Error('Este post já tem uma medição nesse período. Use “Atualizar números” no registro existente.');
  const post = records.find(r => r.postURL === record.postURL);
  if (post && (post.account !== record.account || post.publishedAt !== record.publishedAt)) throw new Error('Este link já está associado a outra conta ou data na biblioteca. Confira o registro existente.');
  // Uma nova janela de medição pertence ao mesmo post e mantém seu texto original.
  const stored = post ? { ...record, snapshot: post.snapshot, mode: post.mode, presetId: post.presetId } : record;
  const isSameMeasurement = r => r && (r.id === record.id || (canonicalPublicationURL(r.postURL) === record.postURL && r.windowDays === record.windowDays));
  return library.map(entry => {
    const list = Array.isArray(entry.publicationResults) ? entry.publicationResults : [];
    const hasRecord = list.some(isSameMeasurement);
    if (!hasRecord && entry.id !== projectId) return entry;
    const next = hasRecord ? list.map(r => isSameMeasurement(r) ? stored : r) : [...list, stored];
    return { ...entry, publicationResults: next, updatedAt: Date.now() };
  });
}

export function removePublicationResult(library, recordId) {
  const selected = collectPublicationResults(library).find(r => r.id === recordId);
  return library.map(entry => ({ ...entry, publicationResults: (Array.isArray(entry.publicationResults) ? entry.publicationResults : [])
    .filter(r => r && r.id !== recordId && !(selected && canonicalPublicationURL(r.postURL) === selected.postURL && r.windowDays === selected.windowDays)) }));
}

const median = values => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

export function analyzePublicationResults(library, context, now = new Date()) {
  const account = normalizeResultAccount(context.account);
  const metric = OBJECTIVE_METRIC[context.objective];
  const today = dayNumber(now.toISOString().slice(0, 10));
  const groups = new Map();
  let included = 0;
  for (const r of collectPublicationResults(library)) {
    const age = today - dayNumber(r.publishedAt);
    const measured = dayNumber(r.measuredAt);
    const reach = r.metrics?.reach;
    const value = r.metrics?.[metric];
    if (!account || !metric || r.account !== account || r.objective !== context.objective ||
        r.windowDays !== Number(context.windowDays) || r.distribution !== 'organic' ||
        normalizedText(r.niche) !== normalizedText(context.niche) || r.mode !== context.mode || r.presetId !== context.presetId ||
        !structureById[r.structureId] || !Number.isFinite(age) || age < 0 || age > 180 ||
        !Number.isFinite(measured) || measured > today || measured - dayNumber(r.publishedAt) !== r.windowDays ||
        !Number.isSafeInteger(reach) || reach <= 0 || !Number.isSafeInteger(value) || value < 0) continue;
    const values = groups.get(r.structureId) || [];
    values.push(value / reach * 1000);
    groups.set(r.structureId, values);
    included++;
  }
  const rows = [...groups].map(([structureId, values]) => ({
    structureId, label: structureById[structureId].label, count: values.length, rate: median(values),
  })).sort((a, b) => b.rate - a.rate);
  const eligible = rows.filter(r => r.count >= MIN_SAMPLE);
  const preferred = eligible.length >= 2 && eligible[0].rate > eligible[1].rate ? eligible[0] : null;
  return {
    rows, included, preferred, metric,
    metricLabel: RESULT_METRICS.find(m => m.id === metric)?.label || '',
    reason: preferred ? 'Sinal descritivo do seu histórico; não comprova que a estrutura causou o resultado.'
      : eligible.length < 2 ? 'Para orientar a geração, registre pelo menos 3 posts de cada uma de 2 estruturas nas mesmas condições.'
        : 'As estruturas empataram. O histórico não indica uma preferência.',
  };
}

export function buildPerformanceGuidance(library, context) {
  if (context.enabled === false) return { prompt: '', preferredStructureId: null };
  const analysis = analyzePublicationResults(library, context);
  if (!analysis.preferred) return { prompt: '', preferredStructureId: null };
  const goal = CONTENT_OBJECTIVES.find(o => o.id === context.objective)?.label;
  const comparison = analysis.rows.filter(r => r.count >= MIN_SAMPLE)
    .map(r => `${r.label}: mediana ${r.rate.toFixed(2)} por mil contas alcançadas; ${r.count} posts`).join('\n');
  return {
    preferredStructureId: analysis.preferred.structureId,
    prompt: `HISTÓRICO INFORMADO PELO USUÁRIO (observacional, não verificado pelo Instagram):
Objetivo: ${goal}. Métrica: ${analysis.metricLabel}. Mesma conta, nicho, modo, pacote e janela de ${context.windowDays} dias; orgânicos dos últimos 180 dias.
${comparison}
Considere ${analysis.preferred.label} entre as abordagens a testar, quando houver material adequado. Não copie posts anteriores nem afirme causalidade, superioridade comprovada ou resultado garantido. Visitas ao perfil e compartilhamentos não comprovam autoridade ou qualidade da interpretação.
Tema, fatos fornecidos, voz, modo narrativo, arco do pacote e limites de texto continuam prioritários. O histórico orienta escolhas de escrita; não aparece nos slides ou na legenda.`,
  };
}
