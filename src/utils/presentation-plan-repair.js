/**
 * Apoio à recuperação do roteiro de apresentação — sem afrouxar a checagem de fonte.
 *
 * Rodada R2 (15–16/11/2026): Relatório e Estudo de caso falharam com "Não foi
 * possível conferir o roteiro e suas evidências após a recuperação", sem dizer
 * qual regra reprovou. O validador rejeita o plano inteiro por qualquer item;
 * a causa mais provável em material numérico é a citação que não é cópia
 * literal de um trecho.
 *
 * Duas ajudas, ambas determinísticas:
 *
 * 1. `quoteCandidatesBlock` — na segunda tentativa, mostra ao modelo os trechos
 *    REAIS da fonte mais próximos de cada citação reprovada. É sugestão, não
 *    validação: a fonte pode trazer os mesmos números com outra entidade,
 *    período ou negação. O validador continua exigindo cópia literal, e a
 *    afirmação continua sendo conferida na revisão.
 * 2. `summarizePlanIssues` — transforma os códigos do diagnóstico num motivo
 *    legível, sem expor conteúdo gerado.
 */

const QUOTE_MAX = 160;
const MIN_SCORE = 0.34;

const semAcento = (texto) => String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const termos = (texto) => new Set(semAcento(texto).split(/[^a-z0-9%$,.]+/).map((t) => t.replace(/^[.,]+|[.,]+$/g, ''))
  .filter((t) => t.length >= 3 || /\d/.test(t)));

function frases(texto) {
  return String(texto || '').split(/(?<=[.!?;:])\s+|\n+/u).map((f) => f.trim()).filter((f) => f.length >= 12);
}

/** Recorte literal da frase, no limite de citação do contrato, sem cortar palavra. */
function recorteLiteral(frase) {
  if (frase.length <= QUOTE_MAX) return frase;
  const corte = frase.slice(0, QUOTE_MAX);
  const espaco = corte.lastIndexOf(' ');
  return (espaco > 40 ? corte.slice(0, espaco) : corte).trim();
}

function textosDaFonte(source) {
  if (!source) return [];
  return Array.isArray(source.chunks) && source.chunks.length
    ? source.chunks.map((chunk) => chunk?.text).filter(Boolean)
    : [source.text].filter(Boolean);
}

/**
 * Trechos literais da fonte mais parecidos com a citação reprovada.
 * Devolve no máximo `limit` recortes que existem, caractere por caractere, na fonte.
 */
export function quoteCandidates(quote, sources = [], { sourceId = '', limit = 3 } = {}) {
  const alvo = termos(quote);
  if (!alvo.size) return [];
  const lista = Array.isArray(sources) ? sources : [];
  const preferida = lista.filter((s) => s?.id === sourceId);
  const pontuados = [];
  for (const source of (preferida.length ? preferida : lista)) {
    for (const texto of textosDaFonte(source)) {
      for (const frase of frases(texto)) {
        const candidato = recorteLiteral(frase);
        const cand = termos(candidato);
        let comuns = 0;
        for (const t of alvo) if (cand.has(t)) comuns += 1;
        const score = comuns / Math.max(alvo.size, 1);
        if (score >= MIN_SCORE) pontuados.push({ sourceId: source.id, quote: candidato, score });
      }
    }
  }
  const vistos = new Set();
  return pontuados.sort((a, b) => b.score - a.score)
    .filter((c) => (vistos.has(c.quote) ? false : (vistos.add(c.quote), true)))
    .slice(0, limit)
    .map(({ sourceId: id, quote: q }) => ({ sourceId: id, quote: q }));
}

/**
 * Bloco para o pedido de recuperação: para cada citação reprovada, os trechos
 * reais disponíveis. Vazio quando não há citação reprovada ou nenhum candidato.
 */
export function quoteCandidatesBlock(previous, issues = [], sources = []) {
  const evidencias = Array.isArray(previous?.evidence) ? previous.evidence : [];
  const linhas = [];
  for (const issue of Array.isArray(issues) ? issues : []) {
    if (issue?.code !== 'quote_not_found') continue;
    const indice = Number(/^evidence\[(\d+)\]/.exec(String(issue.path || ''))?.[1]);
    const item = evidencias[indice];
    if (!item || typeof item.quote !== 'string') continue;
    const candidatos = quoteCandidates(item.quote, sources, { sourceId: item.sourceId });
    if (!candidatos.length) {
      linhas.push(`- evidence[${indice}]: nenhum trecho próximo encontrado nas fontes. Remova esta evidência ou registre a informação em gaps; não a reescreva de memória.`);
      continue;
    }
    linhas.push(`- evidence[${indice}]: escolha UM destes trechos, copiando-o por inteiro, e ajuste claim ao que ele sustenta:\n${candidatos.map((c) => `    · sourceId ${JSON.stringify(c.sourceId)} — ${JSON.stringify(c.quote)}`).join('\n')}`);
  }
  if (!linhas.length) return '';
  return `\nTRECHOS REAIS DAS FONTES PARA AS CITAÇÕES REPROVADAS — são sugestões de onde a informação está, não confirmação de que a afirmação anterior estava certa. Confira entidade, período, negação e estágio antes de escolher:\n${linhas.join('\n')}\n`;
}

const MOTIVOS = [
  [['quote_not_found', 'quote_required'], (n) => `${n === 1 ? 'uma citação do roteiro não foi localizada' : `${n} citações do roteiro não foram localizadas`} literalmente no material`],
  [['source_not_found'], () => 'o roteiro citou uma fonte que não existe'],
  [['evidence_reference', 'evidence_id', 'unknown_has_source', 'evidence_status', 'evidence_count'], () => 'o roteiro referenciou evidências de forma inválida'],
  [['slide_count', 'slide_index'], () => 'o roteiro veio com número de slides diferente do pedido'],
  [['invalid_json', 'invalid_object', 'plan_too_large', 'output_truncated'], () => 'a resposta do roteiro veio incompleta'],
  [['cover_required', 'closing_required'], () => 'o roteiro não marcou a abertura ou o fecho'],
];

/**
 * Motivo legível a partir dos códigos do diagnóstico. Nunca inclui texto
 * gerado, trechos de fonte ou mensagens do provedor.
 */
export function summarizePlanIssues(issues = []) {
  const contagem = {};
  for (const issue of Array.isArray(issues) ? issues : []) {
    const code = typeof issue?.code === 'string' ? issue.code : 'unknown';
    contagem[code] = (contagem[code] || 0) + 1;
  }
  const codigos = Object.keys(contagem);
  if (!codigos.length) return { codes: {}, motivo: '' };
  const partes = [];
  const cobertos = new Set();
  for (const [grupo, texto] of MOTIVOS) {
    const total = grupo.reduce((soma, code) => soma + (contagem[code] || 0), 0);
    if (!total) continue;
    grupo.forEach((code) => cobertos.add(code));
    partes.push(texto(total));
  }
  if (codigos.some((code) => !cobertos.has(code))) partes.push('o roteiro saiu fora do formato esperado');
  return { codes: contagem, motivo: partes.slice(0, 3).join('; ') };
}
