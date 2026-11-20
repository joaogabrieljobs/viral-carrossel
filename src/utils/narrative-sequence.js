/**
 * Roteiro card a card de cada modo narrativo (MF-06).
 *
 * Com um briefing factual (padaria: horário, preços, volume, encomenda), o
 * método em prosa do modo perdia para a lista de fatos: a IA escrevia um card
 * por fato, na ordem do briefing, e "Explicar com autoridade", "Falar da dor"
 * e "Contar uma história" devolviam a mesma sequência. Aqui o arco vira uma
 * função explícita para cada posição, calculada para o número real de cards.
 * Os fatos do material passam a servir às funções, e não o contrário.
 */

/**
 * Cada modo: capa, encerramento e funções do miolo em ordem de prioridade.
 * `core` sobrevive quando há poucos cards; `extra` entra quando há espaço,
 * na posição `at` do miolo;
 * `repeat` é a função que se desdobra quando o carrossel é longo.
 */
export const NARRATIVE_SEQUENCES = Object.freeze({
  editorial: {
    label: 'Explicar com autoridade',
    titles: 'Os títulos encadeiam o argumento: cada um afirma uma parte da tese, e lidos em sequência formam o raciocínio.',
    cover: 'TESE — a leitura específica que o carrossel vai defender sobre o tema, em uma frase que o miolo prova.',
    core: [
      'LEITURA COMUM — o que o público costuma supor ou fazer sobre o assunto.',
      'MECANISMO — por que a leitura comum não basta: o que de fato explica a diferença.',
      'EVIDÊNCIA — o fato do material que sustenta a tese (número, processo ou escolha concreta).',
      'CONSEQUÊNCIA — o que muda para quem decide, compra ou usa.',
    ],
    extra: [{ at: 1, text: 'CONTRASTE — o que se faz de outro jeito e o custo dessa escolha, sem inventar concorrente.' }],
    repeat: 'EVIDÊNCIA — outro fato do material que reforça a tese por um ângulo diferente.',
    closing: 'CONCLUSÃO — feche a tese e indique o próximo passo pedido.',
  },
  deep: {
    label: 'Ir a fundo',
    titles: 'Os títulos investigam: perguntas e respostas sobre como e por que funciona, não rótulos de produto.',
    cover: 'PERGUNTA — a questão específica que o carrossel investiga.',
    core: [
      'AUTÓPSIA — o mecanismo por dentro do fenômeno: como funciona, etapa por etapa.',
      'VARIÁVEIS — o que muda o resultado e por quê.',
      'DEMONSTRAÇÃO — um fato do material lido à luz do mecanismo.',
      'IMPLICAÇÃO — que decisão muda quando se entende isso.',
    ],
    extra: [{ at: 2, text: 'PADRÃO — o princípio que conecta os fatos visíveis.' }],
    repeat: 'VARIÁVEIS — mais um fator que interfere no resultado, com o porquê.',
    closing: 'DECISÃO — o que fazer diferente agora; pode terminar com uma pergunta específica.',
  },
  pain: {
    label: 'Falar da dor',
    titles: 'Os títulos das primeiras posições falam com o leitor em segunda pessoa, sobre a situação dele; o negócio aparece a partir da saída.',
    cover: 'IDENTIFICAÇÃO — a dificuldade ou desejo frustrado que o público reconhece em si, dito em segunda pessoa, sem números nem casos inventados.',
    core: [
      'VALIDAÇÃO — por que essa dificuldade é real e compreensível.',
      'RAIZ — a causa por trás do sintoma (o que de fato produz a dificuldade).',
      'SAÍDA — o que o material oferece que responde à raiz.',
      'COMO FUNCIONA — o fato concreto do material que torna a saída possível.',
    ],
    extra: [{ at: 2, text: 'O QUE NÃO RESOLVE — o atalho que o leitor talvez já tenha tentado, dito como possibilidade, sem atribuir histórico a ele nem afirmar fatos, números ou "a maioria" sobre terceiros.' }],
    repeat: 'COMO FUNCIONA — outro fato do material que torna a saída concreta.',
    // Com poucos cards, a saída vale mais que o detalhe de como funciona.
    keepLast: false,
    closing: 'CONVITE — um passo pequeno e possível, coerente com o CTA pedido.',
  },
  viral: {
    label: 'Prender atenção',
    titles: 'Os títulos puxam o próximo card: a capa abre uma pergunta, os do meio dão pistas sem entregar tudo e o payoff responde. Nenhum título é rótulo de dado ou horário.',
    cover: 'PARADA DE SCROLL — uma única técnica do método (interrupção, revelação atrasada, número real, identificação ou pergunta) que abre uma pergunta.',
    core: [
      'BUILD-UP — aprofunda a pergunta da capa e entrega a primeira pista.',
      'PROVA — o fato do material que começa a responder.',
      'SHARE-TRIGGER — uma frase curta e verdadeira que alguém guardaria ou enviaria.',
      'PAYOFF — fecha a pergunta aberta na capa.',
    ],
    extra: [{ at: 2, text: 'VIRADA — o detalhe que muda a leitura da pergunta.' }],
    repeat: 'PROVA — mais um fato do material que alimenta a resposta.',
    closing: 'PRÓXIMO PASSO — o motivo concreto para salvar, enviar ou agir.',
  },
  storytelling: {
    label: 'Contar uma história',
    cover: 'CENA — abra no meio da ação: uma pessoa ou lugar do material fazendo algo (sujeito + verbo), sem horário, fala ou acontecimento inventado.',
    core: [
      'CONTEXTO — quem é a personagem da história e o que ela queria ou decidiu fazer.',
      'VIRADA — a escolha que muda a situação, contada como decisão de alguém.',
      'CONSEQUÊNCIA — o que essa escolha produziu, com os números do material.',
    ],
    titles: 'Os títulos narram: personagem ou lugar + verbo de ação (ex.: "Ela decidiu esperar"), em sequência de história. Nenhum título é rótulo de produto, preço ou número.',
    extra: [
      { at: 1, text: 'DESENVOLVIMENTO — a cena avança: o processo acontecendo, contado como ação.' },
      { at: 'end', text: 'SIGNIFICADO — o que a história revela além deste caso.' },
    ],
    repeat: 'DESENVOLVIMENTO — a história avança mais uma etapa.',
    closing: 'DESFECHO — onde a história está hoje e o convite ao leitor para fazer parte dela.',
  },
  how_to: {
    label: 'Ensinar passo a passo',
    cover: 'PROMESSA — o resultado e o número exato de passos do miolo.',
    core: ['PASSO — "Passo N · verbo + objeto" e como executar.'],
    extra: [],
    repeat: 'PASSO — o passo seguinte, numerado em sequência.',
    closing: 'SÍNTESE — o procedimento resumido e o CTA pedido.',
  },
  jornalistico: {
    label: 'Tom jornalístico',
    cover: 'CAPA — selo de editoria, manchete objetiva e lead com por que importa agora.',
    core: [
      'FATO PRINCIPAL — a informação mais importante, primeiro.',
      'CONTEXTO — o que ajuda a entender o fato.',
      'DADO — o número ou detalhe verificável do material.',
      'POR QUE IMPORTA — a consequência para o público.',
    ],
    extra: [{ at: 'end', text: 'O QUE FALTA SABER — o ponto em aberto, sem especular.' }],
    repeat: 'DADO — outro fato verificável do material.',
    closing: 'FECHO EDITORIAL — o que acompanhar ou fazer a seguir.',
  },
  sensacionalista: {
    label: 'Alto impacto',
    cover: 'GANCHO — revelação, contraste ou pergunta incômoda que o miolo sustenta.',
    core: [
      'CONTRASTE — "parecia X / era Y" com fatos do material.',
      'REVELAÇÃO — o detalhe que surpreende e é verdadeiro.',
      'FRASE DE IMPACTO — curta, compartilhável, sem exagerar fatos.',
      'PROVA — o fato que sustenta o gancho.',
    ],
    extra: [{ at: 1, text: 'MICRO-GANCHO — abre a próxima tensão.' }],
    repeat: 'PROVA — outro fato que mantém a tensão.',
    closing: 'SÍNTESE — a revelação completa e o CTA pedido.',
  },
});

/** Funções do miolo para `middle` posições, na ordem do arco. */
export function narrativeMiddleBeats(modeId, middle) {
  const seq = NARRATIVE_SEQUENCES[modeId];
  const slots = Math.max(0, Number(middle) || 0);
  if (!seq || !slots) return [];
  if (modeId === 'how_to') return Array.from({ length: slots }, (_, i) => `PASSO ${i + 1} — "Passo ${i + 1} · verbo + objeto" e como executar.`);
  const core = seq.core;
  if (slots <= core.length) {
    // Poucos cards: mantém o começo do arco e, salvo `keepLast: false`, a
    // última função do miolo, que fecha o argumento.
    return seq.keepLast === false ? core.slice(0, slots) : [...core.slice(0, slots - 1), core[core.length - 1]];
  }
  const beats = [...core];
  // Extras entram na posição do arco em que fazem sentido (ex.: em "dor", o
  // que não resolve vem antes da saída); `end` fecha o miolo.
  for (const extra of seq.extra) {
    if (beats.length >= slots) break;
    beats.splice(extra.at === 'end' ? beats.length : extra.at, 0, extra.text);
  }
  // Carrossel longo: desdobra a função de desenvolvimento antes da última
  // função do argumento.
  const anchor = seq.extra.some(extra => extra.at === 'end') && beats.length > core.length ? 2 : 1;
  while (beats.length < slots) beats.splice(beats.length - anchor, 0, seq.repeat);
  return beats;
}

/**
 * Bloco do prompt com uma função por posição. Vazio para "Seguir meu pedido"
 * (none) e para pacotes com arco próprio (apresentação, tendência, modelos).
 */
export function buildNarrativeModeSequence(modeId, presetId = 'livre', count = 7) {
  const seq = NARRATIVE_SEQUENCES[modeId];
  const n = Math.max(1, Number(count) || 1);
  if (!seq || presetId !== 'livre' || n < 3) return '';
  const beats = narrativeMiddleBeats(modeId, n - 2);
  const lines = [`1. ${seq.cover}`, ...beats.map((beat, i) => `${i + 2}. ${beat}`), `${n}. ${seq.closing}`];
  return `ROTEIRO DO MODO «${seq.label}» — ${n} CARDS (uma função por card, nesta ordem):
${lines.join('\n')}
Como aplicar:
- Em cada item de slides, escreva primeiro o campo interno "funcao" com o nome da função da posição (ex.: "${(seq.cover.split(' — ')[0])}"). Ele não aparece no card; o texto visível nunca repete esse nome.
- Cada card cumpre a função da sua posição, e o título mostra essa função ao leitor. Título não é rótulo de dado ("41.200 pães em 2025", "Três pães", "Terça a domingo"): números, preços e horários entram no apoio do card cuja função eles provam.
${seq.titles ? `- ${seq.titles}\n` : ''}- Distribua os fatos do material entre as funções que eles sustentam. Um card não é um fato: não siga a ordem em que os fatos aparecem no briefing nem dedique um card a cada dado.
- Use apenas fatos do material. Se uma função não tiver fato que a sustente, cumpra-a com raciocínio sobre o que já foi dito, sem criar número, prazo, depoimento, rotina ou característica de produto.
- Este roteiro prevalece sobre exemplos genéricos de estrutura deste pedido; fatos, restrições, idioma e CTA continuam acima dele.`;
}
