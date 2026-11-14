// A conservative guard for claims we can check against the supplied material.
// This is not a fact checker: semantic grounding still belongs to the review.
const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[*_]/g, '').replace(/\s+/g, ' ').trim();

const NEGATIVE_INSTRUCTION = /(?:\bnao\s+(?:invente|inventar|use|usar|diga|afirme|prometa|inclua|acrescente|oferecemos|oferece|incluimos|inclui|garantimos|garante|prometemos|promete|ha|temos|tem)|\bsem\s+inventar|\b(?:do not|does not|don't|doesn't|never)\s+(?:invent|use|claim|promise|add|say|offer|include|guarantee|have)|\b(?:evite|proibido)\b)/;

/** A prohibition containing a price/deadline is not evidence for that claim. */
export function factualEvidenceText(source) {
  return String(source || '').split(/(?:[.!?;](?=\s|$)|\n)+/u)
    .filter(clause => !NEGATIVE_INSTRUCTION.test(normalize(clause)))
    .join('\n');
}

const COMMERCIAL_RULES = [
  { category: 'garantia', regex: /\b(?:garanti(?:a|do|mos)|resultado garantido|sem risco|guaranteed|risk.free)\b[^.!?\n]{0,90}/giu },
  { category: 'prazo', regex: /\b(?:pronto|entregue|resultado|receba|comece)\s+(?:em|dentro de)\s+\d+\s*(?:hora|dia|semana|m[eê]s)(?:s|es)?\b[^.!?\n]{0,70}/giu },
  { category: 'preço', regex: /(?:R\$|US\$|\$|€)\s*\d(?:[\d.,]*\d)?|\b(?:gr[aá]tis|gratuito|sem taxas?(?: escondidas?)?|sem custo|sem compromisso|no hidden fees|free of charge|no obligation)\b/giu },
  { category: 'item incluso', regex: /\b(?:inclui|inclus[oa]s?|vem com|acompanha|includes?)\b[^.!?\n]{1,100}/giu },
];

const NUMBERS = { um: '1', uma: '1', one: '1', dois: '2', duas: '2', two: '2', tres: '3', three: '3', quatro: '4', four: '4', cinco: '5', five: '5', seis: '6', six: '6', sete: '7', seven: '7', oito: '8', eight: '8', nove: '9', nine: '9', dez: '10', ten: '10', vinte: '20', trinta: '30', cem: '100', hundred: '100' };
const TENS = { vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60, setenta: 70, oitenta: 80, noventa: 90, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const SINGLE = 'um|uma|dois|duas|tr[eê]s|quatro|cinco|seis|sete|oito|nove|one|two|three|four|five|six|seven|eight|nine';
const COMPOUND = `(?:${Object.keys(TENS).join('|')})(?:\\s+e\\s+|[ -])(?:${SINGLE})`;
const COUNT = `(?:\\d+(?:[.,]\\d+)?|${COMPOUND}|${SINGLE}|dez|vinte|trinta|cem|ten|hundred)`;
const QUANTITY = new RegExp(`\\b${COUNT}\\s*(?:%|por cento|percent|vezes|vez|times?|anos?|years?|meses|m[eê]s|months?|semanas?|weeks?|dias?|days?|horas?|hours?|minutos?|minutes?|segundos?|seconds?|cliques?|clicks?|toques?|taps?|clientes?|customers?|patients?|pacientes?)\\b`, 'giu');
// Percent signs have no word boundary after them; keep that alternative apart.
const PERCENTAGE = /\b\d+(?:[.,]\d+)?\s*%/gu;
const UNIT_ALIASES = [
  [/\b(?:vezes|vez|times?)\b/g, 'times'], [/\b(?:anos?|years?)\b/g, 'years'],
  [/\b(?:meses|mes|months?)\b/g, 'months'], [/\b(?:semanas?|weeks?)\b/g, 'weeks'],
  [/\b(?:dias?|days?)\b/g, 'days'], [/\b(?:horas?|hours?)\b/g, 'hours'],
  [/\b(?:minutos?|minutes?)\b/g, 'minutes'], [/\b(?:segundos?|seconds?)\b/g, 'seconds'],
  [/\b(?:cliques?|clicks?)\b/g, 'clicks'], [/\b(?:toques?|taps?)\b/g, 'taps'],
  [/\b(?:clientes?|customers?)\b/g, 'customers'], [/\b(?:pacientes?|patients?)\b/g, 'patients'],
  [/\b(?:por cento|percent)\b/g, '%'],
];
const canonicalQuantity = text => {
  let value = normalize(text).replace(new RegExp(`\\b(${Object.keys(TENS).join('|')})(?:\\s+e\\s+|[ -])(${SINGLE})\\b`, 'g'),
    (_, tens, units) => String(TENS[tens] + Number(NUMBERS[units])));
  value = value.replace(/\b[a-z]+\b/g, word => NUMBERS[word] || word);
  for (const [pattern, replacement] of UNIT_ALIASES) value = value.replace(pattern, replacement);
  return value.replace(/\s+/g, '').replace(',', '.');
};
const quantityKeys = text => new Set([...String(text).matchAll(QUANTITY), ...String(text).matchAll(PERCENTAGE)].map(match => canonicalQuantity(match[0])));

const ABSOLUTES = /\b(?:a maioria (?:das pessoas|dos (?:clientes|acessos|consumidores))|most (?:people|customers|visitors)|unicos? argumentos? que convertem|adaptacao perfeita|friccao zero|friction.free|vai (?:aumentar|converter|garantir)|(?:desiste e )?vai para o concorrente|site desatualizado e pior que nenhum)\b/giu;
const CHANNELS = /\b(?:whatsapp|DM|direct|coment[aá]rios|agendamento|agende (?:uma )?consulta|patients?|pacientes?)\b/giu;
const CONDITIONAL = /\b(?:pode|podem|poderia|talvez|se (?:voce|sua|seu|ja)|por exemplo|uma opcao|may|might|could|if (?:you|your)|for example|an option)\b/;
const negatedGuarantee = (text, index) => /\b(?:nao|nem|no|not|never|without)\b(?:\s+[\p{L}]+){0,4}\s*$/u.test(normalize(text.slice(0, index).split(/[.!?;\n]/u).pop()));

function textFields(draft) {
  const result = (Array.isArray(draft?.slides) ? draft.slides : []).flatMap((slide, slideIndex) =>
    ['title', 'subtitle', 'bodyAfterImage'].map(field => ({ slideIndex, field, text: String(slide?.[field] || '') })));
  if (typeof draft?.caption === 'string') result.push({ slideIndex: null, field: 'caption', text: draft.caption });
  return result;
}

export function auditUnsupportedCommercialClaims(slides, source) {
  if (typeof source !== 'string' || !source.trim()) return [];
  const sourceText = normalize(factualEvidenceText(source));
  const violations = [];
  for (const { slideIndex, text } of textFields({ slides })) {
    for (const rule of COMMERCIAL_RULES) {
      for (const match of text.matchAll(rule.regex)) {
        const claim = match[0].trim();
        if (rule.category === 'garantia' && negatedGuarantee(text, match.index)) continue;
        if (!sourceText.includes(normalize(claim))) violations.push({ slideIndex, category: rule.category, claim });
      }
    }
  }
  return violations;
}

export function auditDraftFactuality(draft, config = {}) {
  // Never treat the fully expanded generation prompt (examples, templates,
  // narrative recipes) as evidence. Callers pass raw user material explicitly.
  const source = config.factualSource ?? config.commercialClaimSource;
  if (typeof source !== 'string') return [];
  // Current user instructions may also supply real offer details. They are
  // kept separate in the prompt but pass the same negative-clause filter here.
  const evidence = factualEvidenceText([source, config.userInstructions].filter(Boolean).join('\n'));
  const sourceText = normalize(evidence);
  const quantities = quantityKeys(evidence);
  const channels = new Set([...evidence.matchAll(CHANNELS)].map(match => normalize(match[0])));
  const violations = [];
  for (const { slideIndex, field, text } of textFields(draft)) {
    const add = (category, claim) => {
      if (!violations.some(v => v.slideIndex === slideIndex && v.field === field && v.claim === claim)) {
        violations.push({ slideIndex, field, category, claim });
      }
    };
    for (const rule of COMMERCIAL_RULES) {
      for (const match of text.matchAll(rule.regex)) {
        const claim = match[0].trim();
        if (rule.category === 'garantia' && negatedGuarantee(text, match.index)) continue;
        if (!sourceText.includes(normalize(claim))) add(rule.category, claim);
      }
    }
    for (const match of [...text.matchAll(QUANTITY), ...text.matchAll(PERCENTAGE)]) {
      if (!quantities.has(canonicalQuantity(match[0]))) add('dado sem fonte', match[0]);
    }
    for (const sentence of text.split(/(?<=[.!?])\s+|\n/u)) {
      const normalized = normalize(sentence);
      for (const match of normalized.matchAll(ABSOLUTES)) {
        if (!sourceText.includes(match[0]) && !CONDITIONAL.test(normalized)) add('afirmação absoluta', sentence.trim());
      }
      for (const match of sentence.matchAll(CHANNELS)) {
        if (!channels.has(normalize(match[0])) && !CONDITIONAL.test(normalized)) add('canal ou serviço não informado', match[0]);
      }
    }
  }
  return violations;
}

export function buildFactualGroundingPrompt(config = {}) {
  const source = config.factualSource ?? config.commercialClaimSource;
  return `FIDELIDADE AO MATERIAL — vale para títulos, apoio, fecho e legenda em TODOS os modos.
O modo muda o ritmo e a ordem, nunca a verdade dos fatos. Tom provocador não autoriza certeza, exagero factual ou promessa.
${typeof source === 'string' ? `<material_factual_do_usuario>\n${String(source)}\n</material_factual_do_usuario>` : 'Use somente os fatos do pedido e do material fornecido no briefing.'}
${config.userInstructions ? `<instrucoes_do_usuario>\n${String(config.userInstructions)}\n</instrucoes_do_usuario>` : ''}
As instruções, exemplos de estilo e listas do sistema NÃO são evidência. Uma proibição (ex.: não prometa prazo) também não comprova uma oferta.
Separe internamente: fato explícito; inferência prudente; exemplo hipotético solicitado; dado não fornecido. Use fatos explícitos; formule inferências como possibilidade (pode, ajuda a). Omita dados não fornecidos. Só crie um caso fictício se o usuário pedir, identificando-o como exemplo.
Não acrescente duração, frequência, números por extenso, maioria, histórico de cliente, causa, resultado ou canal de atendimento ao caso fornecido. Telefone antigo não significa que mudou três vezes nem que está errado há dois anos. Enumeração de passos não é prova estatística.
Não transforme benefício esperado em garantia. Não invente preço, prazo, taxas, serviços inclusos, gratuidade, agendamento ou WhatsApp/DM/comentários como canal da oferta. Preserve o público e os termos do usuário (clientes não viram pacientes).
O CTA usa a ação pedida. Não acrescente canal, recompensa ou condição comercial. Não repita o mesmo fato/argumento para preencher cards; cada card deve avançar a sequência. Quando faltar informação, mantenha uma formulação útil e neutra, sem completar com um detalhe plausível.`;
}
