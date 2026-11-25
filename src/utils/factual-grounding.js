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
  // Qualquer forma do verbo ou do nome (auditoria 23/11, IA-05): antes só
  // "garantia", "garantido" e "garantimos" eram vistos, e "A encomenda garante
  // seu pão", exemplo da própria instrução ao modelo, passava.
  { category: 'garantia', regex: /\b(?:garant(?:ias?|id[oa]s?|imos|indo|ir(?:a|ao|emos)?|iu|em|es|am|a|e|o)|sem risco|guarantee[ds]?|risk.free)\b[^.!?\n]{0,90}/giu },
  { category: 'prazo', regex: /\b(?:pronto|entregue|resultado|receba|comece)\s+(?:em|dentro de)\s+\d+\s*(?:hora|dia|semana|m[eê]s)(?:s|es)?\b[^.!?\n]{0,70}/giu },
  { category: 'preço', regex: /(?:R\$|US\$|\$|€)\s*\d(?:[\d.,]*\d)?|\b(?:gr[aá]tis|gratuito|sem taxas?(?: escondidas?)?|sem custo|sem compromisso|no hidden fees|free of charge|no obligation)\b/giu },
  { category: 'item incluso', regex: /\b(?:inclui|inclus[oa]s?|vem com|acompanha|includes?)\b[^.!?\n]{1,100}/giu },
  // Auditoria 23/11 (B3): condição de pagamento trocada passava sem aviso. O
  // briefing dizia "you only pay when you like it" e o card 1 saiu "pay later"
  // (soa como parcelamento). Só a expressão é conferida, sem o resto da frase.
  { category: 'condição de pagamento', regex: /\b(?:buy now,?\s+pay later|pay(?:ing)?\s+later|pay\s+over\s+time|financ(?:ing|ed)|installment plans?|zero\s+down|no\s+upfront(?:\s+(?:cost|payment|fee)s?)?|pague\s+depois|pagamento\s+depois|parcelad[oa]s?|sem\s+entrada|entrada\s+zero)\b/giu },
];

const INSTALLMENT_CLAIM = /^(?:parcelad[oa]s?|installment plans?|pay\s+over\s+time)$/;
const INSTALLMENT_SOURCE = /\b(?:parcelas?|parcelad[oa]s?|installments?|\d+\s*x\s+de)\b/;

const NUMBERS = { um: '1', uma: '1', one: '1', dois: '2', duas: '2', two: '2', tres: '3', three: '3', quatro: '4', four: '4', cinco: '5', five: '5', seis: '6', six: '6', sete: '7', seven: '7', oito: '8', eight: '8', nove: '9', nine: '9', dez: '10', ten: '10', vinte: '20', trinta: '30', cem: '100', hundred: '100',
  onze: '11', doze: '12', treze: '13', catorze: '14', quatorze: '14', quinze: '15', dezesseis: '16', dezessete: '17', dezoito: '18', dezenove: '19',
  eleven: '11', twelve: '12', thirteen: '13', fourteen: '14', fifteen: '15', sixteen: '16', seventeen: '17', eighteen: '18', nineteen: '19' };
const TEENS = 'onze|doze|treze|quatorze|catorze|quinze|dezesseis|dezessete|dezoito|dezenove|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen';
const TENS = { vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60, setenta: 70, oitenta: 80, noventa: 90, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const SINGLE = 'um|uma|dois|duas|tr[eê]s|quatro|cinco|seis|sete|oito|nove|one|two|three|four|five|six|seven|eight|nine';
const COMPOUND = `(?:${Object.keys(TENS).join('|')})(?:\\s+e\\s+|[ -])(?:${SINGLE})`;
const COUNT = `(?:\\d+(?:[.,]\\d+)?|${COMPOUND}|${TEENS}|${SINGLE}|dez|vinte|trinta|cem|ten|hundred)`;
// Quantidade e unidade na mesma linha: numa tabela, "41.200" seguido da
// célula "Ano" não é a alegação "41.200 anos" (MF-04).
const QUANTITY = new RegExp(`\\b${COUNT}[^\\S\\n]*(?:%|por cento|percent|vezes|vez|times?|anos?|years?|meses|m[eê]s|months?|semanas?|weeks?|dias?|days?|horas?|hours?|minutos?|minutes?|segundos?|seconds?|cliques?|clicks?|toques?|taps?|clientes?|customers?|patients?|pacientes?|parcelas?|payments?|installments?)\\b`, 'giu');
// Percent signs have no word boundary after them; keep that alternative apart.
const PERCENTAGE = /\b\d+(?:[.,]\d+)?\s*%/gu;
const UNIT_ALIASES = [
  // "3 parcelas" sustenta "três vezes" (reteste 22/11, WebExpresso).
  [/\b(?:vezes|vez|times?|parcelas?|payments?|installments?)\b/g, 'times'], [/\b(?:anos?|years?)\b/g, 'years'],
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
const WEEKDAYS = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
const WEEKDAYS_EN = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const dayIndex = word => {
  const w = String(word).replace(/-feira$|s$/, '');
  const pt = WEEKDAYS.indexOf(w);
  return pt >= 0 ? pt : WEEKDAYS_EN.indexOf(w);
};
const DAY = '(segunda|terca|quarta|quinta|sexta|sabado|domingo|monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?:-feira)?s?';
const DAY_RANGE = new RegExp(`\\b${DAY}\\s+(?:a|ate|to|through|-)\\s+${DAY}\\b`, 'g');
const HOUR_RANGE = /\b(\d{1,2})\s*(?:h|:00|horas?)\s*(?:as|a|ate|to|-)\s*(\d{1,2})\s*(?:h|:00|horas?)?\b/g;

/**
 * Contagens que decorrem diretamente do material (MF-04): "terça a domingo"
 * sustenta "seis dias"; "das 7h às 13h" sustenta "seis horas"; um ano
 * informado sustenta "um ano". Aritmética sobre o informado não é dado novo.
 */
function derivedQuantityKeys(text) {
  const t = normalize(text);
  const keys = [];
  for (const [, from, to] of t.matchAll(DAY_RANGE)) {
    const a = dayIndex(from); const b = dayIndex(to);
    if (a >= 0 && b >= 0) keys.push(`${((b - a + 7) % 7) + 1}days`);
  }
  for (const [, from, to] of t.matchAll(HOUR_RANGE)) {
    const diff = Number(to) - Number(from);
    if (diff > 0 && diff < 24) keys.push(`${diff}hours`);
  }
  // "Em 2025 vendeu 41.200" sustenta "em um ano"; "fundada em 2019" e "em
  // 2025" sustentam "seis anos" entre as duas datas (reteste 20/11, Caso).
  // Só conta como ano o número introduzido como data ("em 2025", "desde
  // 2019", "Ano 2025"); "2010 clientes" e "2000 pães" são quantidades
  // (MOO-12). "Um ano" exige um resultado no mesmo trecho do ano.
  const years = new Set();
  let annualResult = false;
  for (const clause of String(text).split(/[.!?;](?=\s|$)/u)) {
    const c = normalize(clause);
    const found = [...c.matchAll(YEAR_IN_CONTEXT)].map(match => match[1]);
    found.forEach(year => years.add(Number(year)));
    if (found.length && /\d/.test(found.reduce((rest, year) => rest.replace(year, ' '), c))) annualResult = true;
  }
  if (annualResult) keys.push('1years');
  for (const a of years) for (const b of years) if (b > a) keys.push(`${b - a}years`);
  return keys;
}
// "mais de 2000 clientes em 2024": depois de um quantificador o número é
// quantidade, não data (resto do MOO-12, auditoria 23/11).
const YEAR_IN_CONTEXT = /(?<!\b(?:mais|menos|cerca|perto|acima|abaixo|quase|uns|umas|more|less|over|under|about|almost)\s+(?:de\s+|than\s+)?)\b(?:em|de|desde|ate|no|na|do|da|a|ano|in|since|from|to|until|year)\s+((?:19|20)\d{2})\b(?!\s+(?:clientes?|pacientes?|paes|unidades|pessoas|sites|pedidos|alunos|seguidores|customers?|people|orders|units)\b)/g;
// "Um segundo idioma", "um segundo site": ordinal seguido de substantivo, não
// um segundo de tempo (reteste real 23/11, Pitch WebExpresso). Continua tempo
// quando a frase acaba ali ou segue com palavra de ligação ("um segundo para
// pedir", "um segundo de atraso", "um segundo e meio").
const ORDINAL_SECOND = /^(?:um|one)\s+(?:segundo|second)$/;
const AFTER_TIME = new Set('para pra por que apenas mais menos antes depois ate com sem voce nao nem cada inteiro sequer meio and for before after later more less the you your not'.split(' '));
function ordinalSecond(text, match) {
  if (!ORDINAL_SECOND.test(normalize(match[0]))) return false;
  const next = /^[^\S\n]+([\p{L}]{3,})/u.exec(String(text).slice(match.index + match[0].length));
  return Boolean(next) && !AFTER_TIME.has(normalize(next[1]));
}
const quantityMatches = text => [...String(text).matchAll(QUANTITY)].filter(match => !ordinalSecond(text, match));
const quantityKeys = text => new Set([
  ...[...quantityMatches(text), ...String(text).matchAll(PERCENTAGE)].map(match => canonicalQuantity(match[0])),
  ...derivedQuantityKeys(text),
]);

// "A maioria dos pães industrializados..." generaliza sobre terceiros sem
// fonte (MF-04); qualquer "a maioria de/das/dos" precisa estar no material.
const ABSOLUTES = /\b(?:a maioria d(?:e|as|os) [a-z]+|most (?:people|customers|visitors|[a-z]+ (?:brands|companies|bakeries|stores))|unicos? argumentos? que convertem|adaptacao perfeita|friccao zero|friction.free|vai (?:aumentar|converter|garantir)|(?:desiste e )?vai para o concorrente|site desatualizado e pior que nenhum)\b/giu;
// Rotina e feitura que o material não informa: o QA viu passar "à mão,
// todos os dias" e "pão fresco toda manhã" (MF-04). Só vale quando o material
// não traz a expressão. "à mão" sozinho saiu (auditoria 23/11, IA-04): "tenha o
// contato sempre à mão" não fala de feitura.
const ROUTINES = /\b(?:feit[oa]s? a mao|todos os dias|todo dia|toda manha|todas as manhas|diariamente|producao diaria|quentinh[oa]s?|fresquinh[oa]s?|saindo do forno|recem-said[oa]s? do forno)\b/gu;
// Escassez, disponibilidade e superioridade que o material não traz (MF-16,
// reteste 21/11: "quem pede no dia pode ficar sem", "pode não encontrar o
// pão", "no horário que você escolher", "nenhuma prensa industrial consegue
// imitar"). Não usa a exceção do condicional: a escassez vem justamente com
// "pode".
// Reteste 0b1cb62 (D07): "depende do que sobra na vitrine", "o que restou na
// vitrine": quem marca é "o que sobra/restou". A palavra "vitrine" sozinha saiu
// (auditoria 23/11, IA-04): "seu site é a vitrine do seu negócio" é metáfora.
const AVAILABILITY = /\b(?:pode(?:m)?\s+(?:ficar|sair)\s+sem|pode(?:m)?\s+nao\s+encontrar|quem\s+chega\s+(?:cedo|tarde|primeiro|sem)|acaba(?:m)?\s+(?:cedo|rapido|logo)|esgota(?:m|do|dos|da|das)?|estoque\s+limitado|ultimas\s+unidades|antes\s+que\s+acabe|vagas?\s+limitadas?|no\s+horario\s+que\s+(?:voce|preferir|quiser|escolher)|quando\s+(?:voce\s+)?quiser|a\s+qualquer\s+hora|(?:ja\s+)?reserva(?:m)?\s+o\s+seu|nenhum[a]?\s+(?:\S+\s+){0,3}(?:consegue|pode)\s+(?:imitar|copiar|igualar)|pouca\s+gente\s+(?:imagina|sabe|conhece)|d?o\s+que\s+(?:sobra|sobrar|sobrou|sobrarem|resta|restar|restou)|(?:pode|podem|vai|vao|antes\s+de|ate)\s+acabar)\b/gu;
// Reteste 21/11 (T02, T06): regra geral e atributo sensorial do produto que o
// material não traz ("costuma levar", "crosta firme e miolo que rende").
const GENERALIZATION = /\b(?:costuma(?:m)?|geralmente|normalmente|em geral|a maioria d[oa]s?|quase sempre|tipicamente|muit[oa]s\s+(?:acham|pensam|acreditam|dizem|imaginam)|tod[oa]\s+mundo\s+(?:acha|pensa|sabe)|most\s+people|many\s+(?:people\s+)?(?:think|believe|assume)|everyone\s+(?:knows|thinks)|usually|typically)\b/gu;
// Reteste 22/11 (WebExpresso): vantagem de posição e propriedade prometidas
// sem estar no material ("quem tem site aparece primeiro", "You keep full
// ownership").
const ADVANTAGE = /\b(?:aparece(?:m)?\s+primeiro|sai(?:em)?\s+na\s+frente|fica(?:m)?\s+na\s+frente|primeiro\s+lugar\s+no\s+google|show(?:s)?\s+up\s+first|ranks?\s+(?:first|higher)|stand(?:s)?\s+out\s+from\s+(?:the\s+)?competition)\b/gu;
const OWNERSHIP = /\b(?:full\s+ownership|you\s+own\s+(?:it|everything|the\s+site)|(?:é|e)\s+(?:todo\s+)?(?:seu|sua)\s+para\s+sempre|tod[oa]\s+seu|propriedade\s+(?:total|completa)|seu\s+para\s+sempre|forever\s+yours)\b/gu;
// Atributo físico do produto marca sozinho. "Sabor", "aroma" e "textura"
// também são linguagem figurada ("um cardápio com mais sabor"): só marcam em
// par ou ao lado de um atributo físico (auditoria 23/11, IA-04).
const SENSORY = /\b(?:crosta|casca|crocante|crocantes|miolo|macio|macia|aerad[oa]|umid[oa]|perfumad[oa]|derrete(?:m)?)\b/gu;
const SENSORY_LOOSE = /\b(?:sabor|sabores|aroma|aromas|textura|texturas)\b/gu;
// "Direct" e "comentários" só são canal em construção de contato ("chame no
// direct", "nos comentários"). "A direct line" e "os comentários dos clientes"
// não são (auditoria 23/11, IA-04).
const CHANNELS = /\b(?:whatsapp|DM|(?:no|pelo|por|via|meu|nosso|um)\s+direct|direct\s+do\s+instagram|(?:nos|pelos)\s+coment[aá]rios|agendamento|agende (?:uma )?consulta|patients?|pacientes?)\b/giu;
// No material basta a palavra: quem informa "atendemos pelo direct" autoriza
// "chame no direct".
const CHANNEL_WORDS = /\b(?:whatsapp|DM|direct|coment[aá]rios|agendamento|agende (?:uma )?consulta|patients?|pacientes?)\b/giu;
const channelKey = match => {
  const value = normalize(match);
  if (value.includes('direct')) return 'direct';
  if (value.includes('comentarios')) return 'comentarios';
  if (value.startsWith('agende')) return 'agende consulta';
  return value;
};
const CONDITIONAL = /\b(?:pode|podem|poderia|talvez|se (?:voce|sua|seu|ja)|por exemplo|uma opcao|may|might|could|if (?:you|your)|for example|an option)\b/;
const negatedGuarantee = (text, index) => /\b(?:nao|nem|no|not|never|without)\b(?:\s+[\p{L}]+){0,4}\s*$/u.test(normalize(text.slice(0, index).split(/[.!?;\n]/u).pop()));
// An explicit exclusion is not a positive promise of an included service.
// The evidence filter still removes negated clauses, so that an exclusion in
// the brief cannot substantiate a newly invented positive inclusion.
const negatedInclusion = (text, index) => /\b(?:nao|nem|not|never|without|don['’]t|doesn['’]t)\b(?:\s+(?:esta|estao|estara|estarao|sera|serao|foi|foram|is|are|be|being|been|tambem|also|even)){0,2}\s*$/u.test(normalize(text.slice(0, index).split(/[.!?;\n]/u).pop()));
// Section labels such as "O que o serviço inclui e exclui" name no service.
// Match only the bare label; a question or heading naming an actual extra
// remains subject to the same evidence check as the rest of the copy.
const inclusionWithoutItem = claim => /^(?:inclui|inclus[oa]s?|includes?)(?:\s+(?:e\s+exclui|and\s+excludes?))?\s*[?:—–-]?$/u.test(normalize(claim));

// "Acompanha" também é seguir: "o pagamento acompanha a entrega", "acompanha o
// avanço do projeto" (reteste real 23/11, Pitch e Caso WebExpresso). Item que a
// oferta traz chega sem artigo definido ("acompanha manual", "acompanha um
// brinde"); depois de artigo definido, possessivo, "cada" ou "todo", o verbo é
// seguir e não há item a conferir.
const followsNotIncludes = claim => /^acompanha\s+(?:o|a|os|as|seus?|suas?|teus?|tuas?|noss[oa]s?|voces?|cada|tod[oa]s?|ess[ea]s?|est[ea]s?|aquel[ea]s?|quem|tudo|de perto)\b/.test(normalize(claim));

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
        if (rule.category === 'item incluso' && (negatedInclusion(text, match.index) || inclusionWithoutItem(claim) || followsNotIncludes(claim))) continue;
        // Mesma equivalência da auditoria de fatos (reteste 22/11).
        if (rule.category === 'item incluso' && inclusionCovered(claim, source)) continue;
        if (!sourceText.includes(normalize(claim)) && !equivalent(sourceText).includes(equivalent(normalize(claim)))) violations.push({ slideIndex, category: rule.category, claim });
      }
    }
  }
  return violations;
}

const moneyValue = text => {
  const digits = String(text).replace(/^[^\d]*/, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.');
  const value = Number.parseFloat(digits);
  return Number.isFinite(value) ? value : null;
};
const sourcePrices = text => [...new Set([...String(text).matchAll(/(?:R\$|US\$|\$|€)\s*\d(?:[\d.,]*\d)?/gu)]
  .map(match => moneyValue(match[0])).filter(value => value > 0))].slice(0, 6);

/**
 * Conta com os preços informados (resposta-modelo de Aula: 2 × R$ 28 + R$ 36
 * = R$ 92) não é preço inventado. Aceita somas de até 4 unidades de cada
 * preço do material; qualquer outro valor continua sem fonte.
 */
function derivedPrice(claim, prices) {
  const target = moneyValue(claim);
  if (target == null || !prices.length) return false;
  const walk = (index, total) => {
    if (Math.abs(total - target) < 0.005) return true;
    if (index >= prices.length || total > target) return false;
    for (let units = 0; units <= 4; units += 1) {
      if (walk(index + 1, total + units * prices[index])) return true;
    }
    return false;
  };
  return walk(0, 0);
}

/**
 * Reteste 22/11 (WebExpresso): paráfrase do próprio material virava "sem
 * fonte" e 6 de 7 apresentações saíram como rascunho. Equivalências fechadas:
 * "grátis" = "gratuito" = "sem custo" = "sem cobrar" = "free"; vagas contadas
 * no material sustentam "vagas limitadas"; um "inclui …" cujos itens estão no
 * material é paráfrase, não item novo.
 */
const FREE_WORDS = /\b(?:gratis|gratuit[oa]s?|sem custo(?: extra| adicional)?|sem cobrar|sem cobranca|de graca|free(?: of charge)?|for free|no charge|no cost|at no cost|no extra cost)\b/g;
const equivalent = text => String(text).replace(FREE_WORDS, 'gratis');
const COUNTED_SPOTS = /\b(?:\d+|dez|ten|cinco|five|vinte|twenty)\s+(?:vagas|spots|sites|websites|lugares|unidades|clientes|places)\b|\b(?:only|apenas|somente|so)\s+\d+\b/;
const LIMITED_SPOTS = /^(?:vagas?\s+limitadas?|poucas\s+vagas|limited\s+(?:spots|availability|places))$/;
const STOP = new Set('a o as os de da do das dos e em um uma para por com no na nos nas que como ao aos seu sua sao the and of to in for with your you inclui inclusos inclusas incluso inclusa vem acompanha includes include'.split(' '));
const stemsOf = text => normalize(text).split(/[^a-z0-9]+/).filter(word => word.length > 2 && !STOP.has(word)).map(word => word.slice(0, 6));
function inclusionCovered(claim, sourceText) {
  const stems = stemsOf(claim.replace(/^\S+\s*/, ''));
  if (stems.length < 2) return false;
  const sourceStems = new Set(stemsOf(sourceText));
  return stems.filter(stem => sourceStems.has(stem)).length / stems.length >= 0.8;
}

/**
 * Números em algarismos (auditoria 23/11, V4-X1). A conferência de quantidade
 * só conhecia uma lista de unidades; "Vendemos 41.200 pães", "12 lojas em 4
 * cidades" e "Fundada em 1998" saíam como revisados. Agora todo número de dois
 * ou mais algarismos, ou com casa decimal, precisa estar no material. Um
 * algarismo sozinho fica de fora: é quase sempre enumeração ("3 passos").
 */
const NUMBER_TOKEN = /\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:[.,]\d+)?/g;
const MULTIPLIER = /^\s*(mil(?:h[õo]es|h[ãa]o)?|k|thousand|million)\b/iu;
function numbersIn(text) {
  const source = String(text || '');
  const found = [];
  for (const match of source.matchAll(NUMBER_TOKEN)) {
    const raw = match[0];
    const before = source.slice(0, match.index);
    // Minutos de um horário ("13:00", "7h30") não são dado próprio.
    if (/\d[:h]$/iu.test(before) && /^\d{2}$/.test(raw)) continue;
    // Algarismo colado a letra, @ ou # é nome ("@padaria2019", "#bf2026", "MP3").
    if (/[\p{L}_@#]$/u.test(before)) continue;
    const thousands = /^\d{1,3}(?:\.\d{3})+/.test(raw);
    let value = Number((thousands ? raw.replace(/\./g, '') : raw).replace(',', '.'));
    if (!Number.isFinite(value)) continue;
    const scale = source.slice(match.index + raw.length).match(MULTIPLIER)?.[1]?.toLowerCase();
    if (scale) value *= /^(?:mil|k|thousand)$/.test(scale) ? 1_000 : 1_000_000;
    const decimal = !thousands && /[.,]\d/.test(raw);
    if (value < 10 && !decimal) continue;
    found.push({ raw, index: match.index, value, rounded: Boolean(scale) });
  }
  return found;
}
const MONTHS = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const MONTHS_EN = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
/** Tudo o que o material sustenta como número: algarismos, por extenso e mês citado ("25 de novembro" = 25/11). */
function evidenceNumbers(evidence) {
  const values = new Set(numbersIn(evidence).map(number => number.value));
  const text = normalize(evidence);
  for (const [word, digits] of Object.entries(NUMBERS)) {
    if (Number(digits) >= 10 && new RegExp(`\\b${word}\\b`).test(text)) values.add(Number(digits));
  }
  for (const [word, tens] of Object.entries(TENS)) {
    if (new RegExp(`\\b${word}\\b`).test(text)) values.add(tens);
  }
  for (const match of text.matchAll(new RegExp(`\\b(${Object.keys(TENS).join('|')})(?:\\s+e\\s+|[ -])(${SINGLE})\\b`, 'g'))) {
    values.add(TENS[match[1]] + Number(NUMBERS[normalize(match[2])] || 0));
  }
  [MONTHS, MONTHS_EN].forEach(list => list.forEach((month, index) => {
    if (index >= 9 && new RegExp(`\\b${month}\\b`).test(text)) values.add(index + 1);
  }));
  // "dez mil" e "10 mil" no material valem 10.000.
  for (const match of text.matchAll(/\b([a-z]+)\s+mil\b/g)) {
    const base = NUMBERS[match[1]] ? Number(NUMBERS[match[1]]) : TENS[match[1]];
    if (base) values.add(base * 1_000);
  }
  return values;
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
  const sourceEquivalent = equivalent(sourceText);
  const countedSpots = COUNTED_SPOTS.test(sourceText);
  const quantities = quantityKeys(evidence);
  const channels = new Set([...evidence.matchAll(CHANNEL_WORDS)].map(match => channelKey(match[0])));
  const numbers = evidenceNumbers(evidence);
  const enumerationLimit = Math.max(Array.isArray(draft?.slides) ? draft.slides.length : 0, Number(config.count) || 0);
  const currentYear = Number(config.currentYear) || new Date().getFullYear();
  const prices = sourcePrices(evidence);
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
        if (rule.category === 'item incluso' && (negatedInclusion(text, match.index) || inclusionWithoutItem(claim) || followsNotIncludes(claim))) continue;
        if (rule.category === 'preço' && derivedPrice(claim, prices)) continue;
        // "Parcelado" é paráfrase de "3 parcelas" (reteste real 23/11, Proposta
        // WebExpresso: cabeçalho "Parcelado" de tabela com o material falando em
        // parcelas). Só a forma parcelada é coberta; "sem entrada" e "pague
        // depois" continuam exigindo a expressão no material.
        if (rule.category === 'condição de pagamento' && INSTALLMENT_CLAIM.test(normalize(claim)) && INSTALLMENT_SOURCE.test(sourceText)) continue;
        if (rule.category === 'item incluso' && inclusionCovered(claim, evidence)) continue;
        if (!sourceText.includes(normalize(claim)) && !sourceEquivalent.includes(equivalent(normalize(claim)))) add(rule.category, claim);
      }
    }
    // Trechos que a regra de preço e a de quantidade já avaliaram: o número
    // dentro deles não é conferido de novo pela regra geral abaixo.
    const judged = [...text.matchAll(/(?:R\$|US\$|\$|€)\s*\d(?:[\d.,]*\d)?/gu)].map(match => [match.index, match.index + match[0].length]);
    for (const match of [...quantityMatches(text), ...text.matchAll(PERCENTAGE)]) {
      judged.push([match.index, match.index + match[0].length]);
      // "um cliente", "uma vez", "uma paciente": artigo, não contagem (lote B 21/11).
      if (/^(?:um|uma)\s+(?:clientes?|customers?|pacientes?|patients?|vez|vezes)$/iu.test(match[0].trim())) continue;
      if (!quantities.has(canonicalQuantity(match[0]))) add('dado sem fonte', match[0]);
    }
    for (const number of numbersIn(text)) {
      if (judged.some(([from, to]) => number.index < to && number.index + number.raw.length > from)) continue;
      if (numbers.has(number.value)) continue;
      // "Mais de 41 mil pães" arredonda os 41.200 do material (reteste real
      // de 22/11, repetido em 23/11): forma com "mil"/"milhões" aceita 5% de folga.
      if (number.rounded && [...numbers].some(value => value > 0 && Math.abs(value - number.value) / value <= 0.05)) continue;
      // "12 erros" num carrossel de 12 cards é a própria enumeração.
      // Auditoria 23/11 (G1): "Restam 10 vagas" / "Only 10 spots left" num deck
      // de 12 cards passava como enumeração. Contagem de vaga, lugar ou cliente
      // não é numeração de card.
      const countedNoun = /^\s*(?:vagas?|lugares|spots?|seats?|places?|unidades|units?|clientes|clients?|customers?|pessoas|people)\b/iu
        .test(text.slice(number.index + number.raw.length));
      if (Number.isInteger(number.value) && number.value <= enumerationLimit && !countedNoun) continue;
      if (number.value === currentYear || number.value === currentYear + 1) continue;
      add('dado sem fonte', number.raw);
    }
    for (const sentence of text.split(/(?<=[.!?])\s+|\n/u)) {
      const normalized = normalize(sentence);
      for (const match of normalized.matchAll(ABSOLUTES)) {
        if (!sourceText.includes(match[0]) && !CONDITIONAL.test(normalized)) add('afirmação absoluta', sentence.trim());
      }
      for (const match of normalized.matchAll(ROUTINES)) {
        if (!sourceText.includes(match[0]) && !CONDITIONAL.test(normalized)) add('rotina ou feitura sem fonte', match[0]);
      }
      for (const match of normalized.matchAll(AVAILABILITY)) {
        if (countedSpots && LIMITED_SPOTS.test(match[0])) continue;
        if (!sourceText.includes(match[0])) add('disponibilidade ou escassez sem fonte', match[0]);
      }
      for (const match of normalized.matchAll(GENERALIZATION)) {
        if (!sourceText.includes(match[0])) add('generalização sem fonte', match[0]);
      }
      const sensory = [...normalized.matchAll(SENSORY)].filter(match => !sourceText.includes(match[0]));
      const loose = [...normalized.matchAll(SENSORY_LOOSE)].filter(match => !sourceText.includes(match[0]));
      for (const match of sensory.length || loose.length > 1 ? [...sensory, ...loose] : []) {
        add('atributo sensorial sem fonte', match[0]);
      }
      for (const match of normalized.matchAll(ADVANTAGE)) {
        if (!sourceText.includes(match[0])) add('vantagem sem fonte', match[0]);
      }
      for (const match of normalized.matchAll(OWNERSHIP)) {
        if (!sourceText.includes(match[0])) add('propriedade ou posse sem fonte', match[0]);
      }
      for (const match of sentence.matchAll(CHANNELS)) {
        if (!channels.has(channelKey(match[0])) && !CONDITIONAL.test(normalized)) add('canal ou serviço não informado', match[0]);
      }
    }
  }
  return violations;
}

/**
 * Lacuna do material é bastidor (MF-12, reteste 21/11: "Não há dados de
 * concorrentes…", "…não foram documentados", "Faltam combinar o endereço…").
 */
export const NO_GAP_NOTE_RULE = 'Nunca escreva no card ou slide que um dado falta, não foi informado, não foi documentado ou não existe (ex.: "não há dados de…", "não foram documentados", "faltam definir o endereço"). Mostre o que o material traz; o que falta fica fora do texto visível.';
// QA 24/11 (texto 1): a apresentação não recebia a regra acima (só a ressalva
// essencial) e a lacuna virou slide inteiro em Pitch, Proposta, Relatório e
// Caso do briefing em inglês. O que falta vai para gaps do plano, que a pessoa
// lê no aviso de material, fora do slide.
export const PRESENTATION_GAP_RULE = '- O texto visível do slide (title, subtitle, bodyAfterImage e presentationBlocks) nunca diz que um dado falta, não foi informado, não foi documentado, não foi especificado ou não pode ser avaliado (ex.: "no prior results documented", "unspecified", "cannot be evaluated", "based on the available evidence", "não há dados de…", "não especificado"). Nenhum slide, linha de tabela ou métrica tem a lacuna como assunto. O que falta fica em gaps do plano, que a pessoa lê fora do slide; na página, mostre o que o material traz. Decisão pendente só entra quando o próprio material diz que ela está em aberto; ausência de dado não é decisão pendente.';

export function buildFactualGroundingPrompt(config = {}) {
  const source = config.factualSource ?? config.commercialClaimSource;
  return `FIDELIDADE AO MATERIAL — vale para títulos, apoio, fecho e legenda em TODOS os modos.
O modo muda o ritmo e a ordem, nunca a verdade dos fatos. Tom provocador não autoriza certeza, exagero factual ou promessa.
${typeof source === 'string' ? `<material_factual_do_usuario>\n${String(source)}\n</material_factual_do_usuario>` : 'Use somente os fatos do pedido e do material fornecido no briefing.'}
${config.userInstructions ? `<instrucoes_do_usuario>\n${String(config.userInstructions)}\n</instrucoes_do_usuario>` : ''}
As instruções, exemplos de estilo e listas do sistema NÃO são evidência. Uma proibição (ex.: não prometa prazo) também não comprova uma oferta.
Separe internamente: fato explícito; inferência prudente; exemplo hipotético solicitado; dado não fornecido. Use fatos explícitos; formule inferências como possibilidade (pode, ajuda a). Omita dados não fornecidos. Só crie um caso fictício se o usuário pedir, identificando-o como exemplo.
Não acrescente duração, frequência, números por extenso, maioria, histórico de cliente, causa, resultado ou canal de atendimento ao caso fornecido. Telefone antigo não significa que mudou três vezes nem que está errado há dois anos. Enumeração de passos não é prova estatística.
Não transforme benefício esperado em garantia. Não use garantir, garante, garantia nem garantido quando o material não usa essa palavra: uma encomenda reserva o pedido, não garante disponibilidade, frescor ou resultado. Não invente preço, prazo, taxas, serviços inclusos, gratuidade, agendamento ou WhatsApp/DM/comentários como canal da oferta. Preserve o público e os termos do usuário (clientes não viram pacientes).
Quando um dado não foi informado (endereço, telefone, preço, horário), não escreva isso no card nem no slide: nada de "não foi informado", "não informado", "o briefing não traz", "a confirmar" ou colchetes para preencher. O texto é para o público final, não um bilhete para quem pediu. Omita o dado e siga a sequência.
Não use travessão (—): use vírgula, dois-pontos ou ponto.
O CTA usa a ação pedida. Não acrescente canal, recompensa ou condição comercial. Não repita o mesmo fato/argumento para preencher cards; cada card deve avançar a sequência. Quando faltar informação, mantenha uma formulação útil e neutra, sem completar com um detalhe plausível.
${NO_GAP_NOTE_RULE}`;
}

/**
 * Checagem de fatos da revisão (MF-04). A revisão lia o pedido inteiro e se
 * ocupava de tamanho e clareza; invenções plausíveis passavam ("à mão, todos
 * os dias", "volta do trabalho" com loja que fecha às 13h, "seis mãos" para 6
 * funcionários). A conferência frase a frase vem antes das outras correções e
 * nomeia os tipos de detalhe que costumam escapar.
 */
export function buildReviewFactCheckPrompt() {
  return `CHECAGEM DE FATOS — faça antes de qualquer outra correção.
Leia cada frase do rascunho, inclusive títulos, blocos e legenda, e confira no material: a frase está nele ou decorre dele por conta direta (terça a domingo = seis dias)? Se não, reescreva sem o detalhe ou remova a frase. Saem, quando o material não os traz:
- características de produto ou serviço: ingredientes, textura, sabor, durabilidade, uso, combinações, "artesanal", "feito à mão";
- rotina e frequência: "todos os dias", "toda manhã", "na hora", "quentinho", "sai do forno às";
- motivo ou intenção atribuídos: por que fecha, por que demora, para que serve;
- comparação com terceiros ou com o que não se faz ("sem fermento industrial", "nada de produção em escala");
- reação, sensação ou benefício do cliente apresentado como fato;
- conveniência que contradiz um fato (ex.: "na volta do trabalho" para loja que fecha às 13h; "retire quando quiser" com horário definido);
- número reinterpretado ("seis mãos" para 6 funcionários).
- escassez, disponibilidade ou superioridade: "pode ficar sem", "quem chega cedo leva", "esgota", "no horário que você escolher", "nenhum concorrente consegue imitar".
- generalização apresentada como regra: "costuma levar", "geralmente", "a maioria das padarias", "muitos acham", "most people think".
- vantagem ou posse prometida: "quem tem site aparece primeiro", "you keep full ownership", "é todo seu".
Corrija também erros de digitação e palavras inexistentes. Uma frase verdadeira e simples vale mais que um detalhe específico inventado. Ao corrigir, mantenha a função do card no arco.`;
}

/**
 * Observação interna do modelo sobre o próprio pedido ("o número de WhatsApp
 * não foi informado", "o briefing não traz o endereço"). É anotação de
 * bastidor: nunca pode sair no card ou slide do cliente (MF-12).
 */
const BRIEFING_NOTE = /\b(?:n[ãa]o\s+(?:foi|foram|est[áa]|est[ãa]o|ser[áa]|consta(?:m)?)\s+(?:informad|fornecid|especificad|indicad|mencionad|dispon[ií]vel|dispon[ií]veis)\w*|n[ãa]o\s+(?:informad|fornecid|especificad|mencionad)[oa]s?\b|sem\s+(?:informa[çc][ãa]o|dado)s?\s+(?:sobre|de)\b|(?:o|no|pelo|do)\s+briefing\b|(?:o|no|do)\s+material\s+(?:fornecido|enviado)\b|informa[çc][ãa]o\s+ausente|dados?\s+ausentes?|a\s+confirmar\b)|\[(?:inserir|preencher|a\s+definir)[^\]]*\]/iu;
// Reteste 21/11 (A02, A04): a mesma nota em outras redações. "Não há dados
// de…", "…não foram documentados", "Faltam definir o endereço…". Fatos do
// tipo "não há entrega fora do bairro" continuam no card.
const BRIEFING_NOTE_MORE = /\b(?:n[ãa]o\s+h[áa]\s+(?:dados?|informa[çc](?:[ãa]o|[õo]es)|registros?|n[úu]meros?)\s+(?:de|sobre|do|da|dos|das)\b|n[ãa]o\s+(?:foi|foram|est[áa]|est[ãa]o)?\s*documentad[oa]s?\b|^\s*faltam?\s+\p{L}+\s+(?:o|a|os|as)?\s*(?:n[úu]mero|endere[çc]o|contato|telefone|forma\s+de\s+pagamento|dados|informa[çc])|\bfalta(?:m)?\s+(?:o|a|os|as)?\s*(?:n[úu]mero\s+de\s+(?:contato|telefone|whatsapp)|endere[çc]o|forma\s+de\s+pagamento))/iu;

// Auditoria 23/11 (B2): as duas regras acima só entendiam português. Em
// apresentação em inglês (BLK FROGDAY) saíram no slide do cliente "No portfolio
// or case studies were shared", "...were not specified", "...not detailed" e
// "not available in the material provided". "Your data is not shared" fica.
const BRIEFING_NOTE_EN = /\b(?:(?:was|were)\s+not\s+(?:specified|provided|detailed|shared|included|mentioned|given|stated|documented)\b|(?:is|are)\s+not\s+(?:specified|detailed|mentioned|stated|documented)\b|not\s+(?:specified|provided|detailed|mentioned|stated|available)\s+in\s+the\s+(?:material|brief|briefing)\b|(?:in|from)\s+the\s+(?:material|brief|briefing)\s+(?:provided|supplied|shared)\b)|^\s*no\s+[^.!?]{0,60}\b(?:was|were)\s+(?:shared|provided|given)\b/iu;

// QA 24/11 (texto 1), BLK FROGDAY em produção: a lacuna voltou em redações que
// as regras acima não viam ("No prior results documented", "Timeline:
// unspecified", "…cannot be evaluated", "The available evidence does not
// show…") e nas equivalentes em português. Fato do cliente fica: "No payment
// until you see the site", "Every step is documented in your dashboard",
// "Não dá para comparar com o pão de mercado".
// Sem vírgula entre o "no/sem/nenhum" e o particípio, e particípio no fim da
// oração em português: "Sem surpresas, tudo detalhado na proposta" e "Nenhum
// valor é cobrado sem ser informado antes" são fala do cliente.
const GAP_NOTE_EN = /\bno\s+(?:prior|previous|past|earlier|historical)\s+[^.!?;:,]{0,60}\b(?:documented|recorded|reported|provided|available|specified|shared|disclosed|on\s+(?:record|file))\b|^\s*no\s+[^.!?;:,]{0,60}\b(?:is|are|was|were|has\s+been|have\s+been)\s+(?:documented|recorded|reported|specified|disclosed)\b|\bno\s+(?:data|information|evidence|details?|figures|metrics|benchmarks?|market\s+sizing)\s+(?:(?:is|are|was|were)\s+)?(?:available|provided|documented|on|about|regarding)\b|\b(?:unspecified|undocumented)\b|^\s*(?:not|never)\s+(?:specified|provided|stated|mentioned|detailed|informed)\s*\.?\s*$|\b(?:not|never)\s+(?:yet\s+)?(?:been\s+)?(?:documented|disclosed)\b|\b(?:cannot|can\s?not|can['’]t|could\s+not|couldn['’]t)\s+(?:yet\s+)?be\s+(?:evaluated|assessed|verified|determined|measured|compared|quantified|validated|estimated|established|judged)\b|\b(?:(?:it\s+is|it['’]s)\s+)?(?:not\s+possible|impossible)\s+to\s+(?:evaluate|assess|verify|determine|measure|quantify|validate|estimate)\b|\b(?:the\s+)?available\s+(?:evidence|documentation)\b|\bevidence\s+available\b|\binsufficient\s+(?:data|information|evidence|details?|documentation)\b|\black\s+of\s+(?:data|information|evidence|documentation)\b/iu;
const GAP_NOTE_PT = /\b(?:nenhum[a]?|sem|n[ãa]o\s+h[áa])\s+[^.!?;:,]{0,60}\b(?:documentad|especificad|informad|divulgad|detalhad)[oa]s?(?=\s*(?:[.!?;:,]|$))|\bn[ãa]o\s+h[áa]\s+(?:dimensionamento|estimativas?|m[ée]tricas?|evid[êe]ncias?|comprova[çc][ãa]o|valida[çc](?:[ãa]o|[õo]es)|benchmarks?)\b|\bn[ãa]o\s+(?:pode(?:m)?|d[áa]\s+para|[ée]\s+poss[ií]vel|foi\s+poss[ií]vel)\s+(?:se\s+)?(?:ser\s+(?:avaliad|verificad|medid|comparad|determinad|estimad|quantificad|mensurad|aferid)[oa]s?|avaliar|verificar|medir|determinar|estimar|quantificar|mensurar|aferir)\b|\bevid[êe]ncias?\s+dispon[ií]ve(?:l|is)\b|\b(?:dados|informa[çc][õo]es|evid[êe]ncias?|detalhes)\s+insuficientes\b|\bfalta\s+de\s+(?:dados|informa[çc](?:[ãa]o|[õo]es)|evid[êe]ncias?|documenta[çc][ãa]o)\b/iu;
// "Based on the available evidence, the offer targets small businesses.": a
// ressalva de abertura sai e a afirmação fica.
const GAP_HEDGE = /^\s*(?:(?:based\s+on|from|given|according\s+to)\s+(?:the\s+)?(?:available|provided|supplied)\s+(?:evidence|information|data|material|details|documentation)|(?:based\s+on|from|given|according\s+to)\s+(?:the\s+)?(?:evidence|information|data|material|details|documentation)\s+(?:available|provided|supplied|shared)|(?:com\s+base\s+n[oa]s?|a\s+partir\s+d[oa]s?|segundo|conforme|pel[oa]s?)\s+(?:(?:[oa]s?)\s+)?(?:evid[êe]ncias?|informa[çc](?:[ãa]o|[õo]es)|dados|materia(?:l|is)|documenta[çc][ãa]o)\s+(?:dispon[ií]ve(?:l|is)|fornecid[oa]s?|enviad[oa]s?|recebid[oa]s?))\s*[,:]\s*(?=\S)/iu;

const noteSentence = text => BRIEFING_NOTE.test(text) || BRIEFING_NOTE_MORE.test(text) || BRIEFING_NOTE_EN.test(text) || GAP_NOTE_EN.test(text) || GAP_NOTE_PT.test(text);

export function isBriefingNote(sentence) {
  const text = String(sentence || '');
  return noteSentence(text) || GAP_HEDGE.test(text);
}

/** Remove frases inteiras que comentam o briefing. Preserva o resto do texto. */
// "Preços definidos; investimento não informado" (título de Proposta, reteste
// 20/11): só a oração da nota sai, o resto do título fica.
function dropNoteClauses(sentence, notes) {
  const hedge = GAP_HEDGE.exec(sentence);
  if (hedge) {
    const rest = sentence.slice(hedge[0].length);
    sentence = rest.charAt(0).toUpperCase() + rest.slice(1);
  }
  if (!noteSentence(sentence)) return sentence;
  if (!/[;:]/.test(sentence)) { notes.push(sentence.trim()); return ''; }
  const clauses = sentence.split(/\s*[;:]\s*/u).filter(Boolean);
  const kept = clauses.filter(clause => !noteSentence(clause));
  // "Timeline: unspecified." é uma lacuna só; o rótulo sozinho não é texto.
  if (!kept.length || (clauses.length === 2 && kept.length === 1 && kept[0] === clauses[0] && /:/.test(sentence) && kept[0].split(/\s+/).length <= 4)) { notes.push(sentence.trim()); return ''; }
  notes.push(...clauses.filter(clause => noteSentence(clause)).map(clause => clause.trim()));
  const joined = kept.join('; ');
  return /[.!?…]$/u.test(sentence) && !/[.!?…]$/u.test(joined) ? `${joined}.` : joined;
}

/**
 * QA 24/11 (texto 1): além do texto sem a nota, devolve as frases tiradas. A
 * lacuna não some: vai para o aviso de material, fora do slide.
 */
export function splitBriefingNotes(text) {
  if (typeof text !== 'string' || !text || !isBriefingNote(text)) return { text, notes: [] };
  const notes = [];
  const kept = text
    .split(/\n/)
    .map(line => line.split(/(?<=[.!?…])\s+/u).map(sentence => dropNoteClauses(sentence, notes)).filter(Boolean).join(' '))
    .filter((line, index, lines) => line.trim() || (index > 0 && index < lines.length - 1 && lines[index - 1].trim()))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return { text: kept, notes };
}

export function stripBriefingNotes(text) {
  return splitBriefingNotes(text).text;
}

/** Texto do aviso "Sobre o material" com as lacunas que ficaram fora do slide. */
export function materialGapNotice(gaps) {
  const seen = new Set();
  const items = (Array.isArray(gaps) ? gaps : []).map(gap => String(gap || '').replace(/\s+/g, ' ').trim().replace(/[.;]+$/, '')).filter(gap => {
    const key = gap.toLowerCase();
    if (!gap || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (!items.length) return '';
  const shown = items.slice(0, 4).map(gap => `“${gap.length > 140 ? `${gap.slice(0, 139).trim()}…` : gap}”`);
  const more = items.length > shown.length ? ` e mais ${items.length - shown.length}` : '';
  return `Ficou fora do texto, porque o material não traz essa informação: ${shown.join('; ')}${more}. Para incluir, acrescente os dados ao material e gere de novo.`;
}

/**
 * Travessão no texto gerado (reteste 19/11: 4 de 7 apresentações). Vira
 * vírgula entre orações; travessão de abertura de linha some. Faixa numérica
 * sem espaço ("7h–13h") fica como está.
 */
export function replaceEmDashes(text) {
  if (typeof text !== 'string' || !/[—–]/.test(text)) return text;
  return text
    .split('\n')
    .map(line => line
      .replace(/^(\s*)—\s*/, '$1')
      .replace(/\s*—\s*(?=[.!?,;:]|$)/g, '')
      .replace(/(\S)\s+[—–]\s+(?=\S)|(\S)—(?=\S)/g, (_, a, b) => `${a || b}, `)
      .replace(/,\s*,/g, ',')
      .replace(/\s+,/g, ','))
    .join('\n');
}

