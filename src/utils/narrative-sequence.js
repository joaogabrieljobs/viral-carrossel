/**
 * Roteiro card a card de cada modo narrativo (MF-06).
 *
 * Com um briefing factual (padaria: horário, preços, volume, encomenda), o
 * método em prosa do modo perdia para a lista de fatos: a IA escrevia um card
 * por fato, na ordem do briefing, e "Explicar com autoridade", "Falar da dor"
 * e "Contar uma história" devolviam a mesma sequência. Aqui o arco vira uma
 * função explícita para cada posição, calculada para o número real de cards.
 *
 * Catálogo final de 22/11: cada posição tem dois nomes. `id` é o valor interno
 * do campo "funcao" (não muda, é o que a IA devolve por card). `text` é a
 * função editorial que a IA lê no roteiro, e só pede o que o material sustenta.
 */

/**
 * Cada modo: capa, encerramento e funções do miolo em ordem de prioridade.
 * `core` sobrevive quando há poucos cards; `extra` entra quando há espaço,
 * na posição `at` do miolo;
 * `repeat` é a função que se desdobra quando o carrossel é longo;
 * `note` fecha o roteiro com a regra de adequação do modo.
 *
 * As posições de 6 cards vêm do catálogo. `extra` e `repeat` (7 cards ou mais)
 * não vieram nele: seguem a mesma regra, condicionadas ao material.
 */
export const NARRATIVE_SEQUENCES = Object.freeze({
  editorial: {
    label: 'Explicar com autoridade',
    cover: { id: 'TESE', text: 'TESE — uma leitura específica sustentada que o desenvolvimento explica, sem prometer prova inexistente.' },
    core: [
      { id: 'LEITURA COMUM', text: 'CONTEXTO — a situação documentada que torna a tese relevante; leitura comum só se fornecida.' },
      { id: 'MECANISMO', text: 'EXPLICAÇÃO — como a relação ou processo descrito funciona; causa apenas se sustentada.' },
      { id: 'EVIDÊNCIA', text: 'SUSTENTAÇÃO — detalhe, escolha ou evidência do material que dá apoio à tese, sem equiparar oferta a eficácia.' },
      { id: 'CONSEQUÊNCIA', text: 'IMPLICAÇÃO — consequência ou critério de decisão no alcance do material.' },
    ],
    extra: [{ at: 1, id: 'CONTRASTE', text: 'CONTRASTE — diferença ou alternativa que o material informa; sem ela, outra condição documentada da mesma situação, sem inventar concorrente, custo ou leitura do público.' }],
    repeat: { id: 'EVIDÊNCIA', text: 'SUSTENTAÇÃO — outro detalhe, escolha ou evidência do material ainda não apresentado, sem repetir o apoio anterior.' },
    closing: { id: 'CONCLUSÃO', text: 'CONCLUSÃO — conclusão da tese e CTA pedido, sem recapitular os fatos.' },
    note: 'Em oferta, conecte necessidade declarada, solução e condições; não invente crença do público ou contexto de mercado.',
  },
  deep: {
    label: 'Ir a fundo',
    cover: { id: 'PERGUNTA', text: 'PERGUNTA — questão delimitada investigável com o material.' },
    core: [
      { id: 'AUTÓPSIA', text: 'FUNCIONAMENTO — processo ou relação explicitamente descritos; não invente mecanismo causal.' },
      { id: 'VARIÁVEIS', text: 'CONDIÇÕES — fatores, limites ou diferenças fornecidos que ajudam a explicar essa relação.' },
      { id: 'DEMONSTRAÇÃO', text: 'DEMONSTRAÇÃO — caso, trecho ou aplicação já presentes, sem transformar preço ou volume em prova de eficácia.' },
      { id: 'IMPLICAÇÃO', text: 'IMPLICAÇÃO — o que a análise permite concluir e seus limites, sem repetir a demonstração.' },
    ],
    extra: [{ at: 2, id: 'PADRÃO', text: 'RELAÇÃO — o que liga os elementos já descritos, somente se o material sustentar; não nomeie padrão, causa ou regra geral ausentes.' }],
    repeat: { id: 'VARIÁVEIS', text: 'CONDIÇÕES — outro fator, limite ou diferença fornecido que ainda não foi explicado.' },
    closing: { id: 'DECISÃO', text: 'DECISÃO — critério ou próximo passo sustentado, preservando o CTA pedido; não recapitule os fatos.' },
    note: 'Em uma oferta, investigue sua lógica explícita — relação entre o que é oferecido e suas condições — em vez de dedicar um card a cada fato comercial. Sem relações, mecanismo, condições ou demonstração suficientes, obtenha contexto ou outra escolha de modo antes desta chamada; não chame paráfrase de profundidade.',
  },
  pain: {
    label: 'Falar da dor',
    cover: { id: 'IDENTIFICAÇÃO', text: 'SITUAÇÃO — dificuldade ou necessidade expressamente fornecida; segunda pessoa só quando sustentada, sem sentimento presumido.' },
    core: [
      { id: 'VALIDAÇÃO', text: 'CONTEXTO — uma condição concreta que ajuda a entender essa dificuldade, sem repetir a abertura.' },
      { id: 'RAIZ', text: 'OBSTÁCULO — restrição informada; causa somente se documentada, sem diagnosticar o leitor.' },
      { id: 'SAÍDA', text: 'SAÍDA — o que a solução descrita se propõe a fazer em relação à necessidade, sem prometer cura ou resultado comprovado.' },
      { id: 'COMO FUNCIONA', text: 'FUNCIONAMENTO — como essa saída opera ou em quais condições se aplica, conforme o material.' },
    ],
    extra: [{ at: 2, id: 'O QUE NÃO RESOLVE', text: 'LIMITE — tentativa anterior ou alternativa que o material diz não resolver; sem esse dado, outra restrição concreta informada, sem atribuir histórico ao leitor.' }],
    repeat: { id: 'COMO FUNCIONA', text: 'FUNCIONAMENTO — outra condição ou etapa informada de como a saída opera, sem repetir a anterior.' },
    // Com poucos cards, a saída vale mais que o detalhe de como funciona.
    keepLast: false,
    closing: { id: 'CONVITE', text: 'CONVITE — o CTA pedido, proporcional e sem pressão; sem CTA, conclua de modo útil.' },
    note: 'Se não houver dor, uma necessidade declarada pode orientar a sequência; não deduza problema, causa ou emoção do benefício de uma oferta. Sem essa base, resolva o contexto ou a escolha de modo antes desta chamada.',
  },
  viral: {
    label: 'Prender atenção',
    cover: { id: 'PARADA DE SCROLL', text: 'GANCHO — pergunta respondível ou contraste sustentado que delimita o assunto.' },
    core: [
      { id: 'BUILD-UP', text: 'PRIMEIRA ENTREGA — comece a responder com informação concreta; não reabra a mesma pergunta.' },
      { id: 'PROVA', text: 'EXPLICAÇÃO — acrescente relação, funcionamento ou condição sustentada.' },
      { id: 'SHARE-TRIGGER', text: 'DIFERENÇA — mais um detalhe útil e distinto, sem card obrigatório de slogan.' },
      { id: 'PAYOFF', text: 'RESPOSTA — complete o que ainda falta responder; se a resposta já estiver completa, acrescente uma aplicação ou condição fornecida, sem repeti-la.' },
    ],
    extra: [{ at: 2, id: 'VIRADA', text: 'CONDIÇÃO — detalhe ou condição fornecida que muda a resposta ou sua aplicação, sem criar surpresa nem adiar informação.' }],
    repeat: { id: 'PROVA', text: 'EXPLICAÇÃO — outra relação, funcionamento ou condição sustentada que ainda não foi apresentada.' },
    closing: { id: 'PRÓXIMO PASSO', text: 'PRÓXIMO PASSO — conclusão ou CTA pedido; não force salvar ou enviar quando o pedido tiver outra ação.' },
    note: 'Os títulos encadeiam informação, sem esconder preço, condição ou informação essencial por suspense. Uma mesma evidência pode sustentar o raciocínio, mas não deve ser reapresentada como novo conteúdo.',
  },
  // Dois ramos com as mesmas posições: história fornecida ou processo descrito.
  storytelling: {
    label: 'Contar uma história',
    intro: 'Escolha apenas um ramo sustentado pelo material; não misture história real com percurso projetado.',
    cover: { id: 'CENA', story: 'ABERTURA — ação ou situação inicial documentada', process: 'INÍCIO — condição inicial descrita' },
    core: [
      { id: 'CONTEXTO', story: 'CONTEXTO — quem participa e o que está em jogo, se informado', process: 'CONTEXTO — o que o processo busca fazer, se informado' },
      { id: 'VIRADA', story: 'MUDANÇA — mudança informada, ou continuação real da sequência sem virada forçada', process: 'TRANSIÇÃO — próximo estágio existente' },
      { id: 'CONSEQUÊNCIA', story: 'CONSEQUÊNCIA — estado posterior documentado, sem atribuir causalidade não demonstrada', process: 'DESTINO — saída ou próximo estado informado, preservando se é previsto' },
    ],
    extra: [
      { at: 1, id: 'DESENVOLVIMENTO', story: 'AVANÇO — próximo acontecimento distinto', process: 'AVANÇO — ação descrita' },
      { at: 'end', id: 'SIGNIFICADO', story: 'SIGNIFICADO — o que a sequência permite concluir sobre este caso, sem ampliá-lo para outros', process: 'ALCANCE — o que o processo descrito permite ou exige, conforme o material' },
    ],
    repeat: { id: 'DESENVOLVIMENTO', story: 'AVANÇO — próximo acontecimento distinto', process: 'AVANÇO — próxima ação descrita, na ordem do processo' },
    closing: { id: 'DESFECHO', story: 'DESFECHO — estado final conhecido e CTA pedido, sem recontar o arco', process: 'FECHO — conclusão e CTA pedido' },
    processNote: 'Não fabrique cliente, decisão pessoal ou experiência para personificar o processo.',
    note: 'Em ambos, os títulos acompanham a progressão com verbos precisos, sem transformar preço, prazo ou quantidade em acontecimentos. Só oferta sem sequência não sustenta este roteiro: obtenha material ou escolha de modo antes da geração, sem usar lista comercial como história.',
  },
  // O miolo é uma faixa de execução: a quantidade de cards não fixa a de passos.
  how_to: {
    label: 'Ensinar passo a passo',
    cover: { id: 'PROMESSA', text: 'OBJETIVO — o que o procedimento permite fazer e seu número real de passos, sem garantia inventada.' },
    core: [],
    extra: [],
    closing: { id: 'SÍNTESE', text: 'CONCLUSÃO — o que o leitor consegue verificar ao concluir, se informado, e o CTA pedido; não reliste os passos.' },
    note: 'Se houver mais passos reais do que posições de execução e cada passo precisar de um card, a quantidade deve ser ajustada antes da geração. Não divida uma ação artificialmente nem acrescente erro, etapa ou resultado para ocupar as posições. Sem procedimento executável ou suporte suficiente para a quantidade pedida, resolva o material ou a escolha do modo antes desta chamada.',
  },
  jornalistico: {
    label: 'Informar com clareza',
    cover: { id: 'CAPA', text: 'MANCHETE — fato principal de modo objetivo, com contexto essencial no subtitle se couber; não force selo editorial.' },
    core: [
      { id: 'FATO PRINCIPAL', text: 'DESDOBRAMENTO — detalhe relevante que acrescenta ao fato principal, sem reescrever a capa.' },
      { id: 'CONTEXTO', text: 'CONTEXTO — o que o material fornece para compreender o fato.' },
      { id: 'DADO', text: 'DETALHE — condição, dado ou distinção relevante ainda não apresentada; número não é obrigatório.' },
      { id: 'POR QUE IMPORTA', text: 'RELEVÂNCIA — implicação sustentada para o público; sem consequência comprovada, apresente uma condição prática fornecida sem especular.' },
    ],
    extra: [{ at: 'end', id: 'O QUE FALTA SABER', text: 'PENDÊNCIA — o ponto em aberto que o material informa; sem ele, outra condição prática fornecida, sem especular nem prometer novidade.' }],
    repeat: { id: 'DADO', text: 'DETALHE — outra condição, dado ou distinção relevante do material ainda não apresentada.' },
    closing: { id: 'FECHO EDITORIAL', text: 'FECHO — conclusão ou CTA solicitado; não prometa acompanhamento ou novidade futura ausentes.' },
    note: 'Mantenha anúncio como anúncio, proposta como proposta e fato realizado como realizado; não simule apuração jornalística ou atualidade. Títulos podem conter o dado central quando isso os torna mais informativos.',
  },
  sensacionalista: {
    label: 'Criar alto impacto',
    cover: { id: 'GANCHO', text: 'GANCHO — afirmação, contraste ou pergunta que o material sustenta.' },
    core: [
      { id: 'CONTRASTE', text: 'DESDOBRAMENTO — explique o primeiro aspecto relevante; contraste somente se os dois lados forem fornecidos.' },
      { id: 'REVELAÇÃO', text: 'DETALHE — informação distinta que dá precisão ao assunto, sem surpresa obrigatória.' },
      { id: 'FRASE DE IMPACTO', text: 'IMPLICAÇÃO — relação ou consequência sustentada, com título incisivo e sem card exclusivo para slogan.' },
      { id: 'PROVA', text: 'SUSTENTAÇÃO — evidência, condição ou explicação ainda necessária para completar o argumento, sem repetir prova já exposta.' },
    ],
    extra: [{ at: 1, id: 'MICRO-GANCHO', text: 'AVANÇO — mais um aspecto relevante do material, com título incisivo; sem reabrir suspense nem adiar informação essencial.' }],
    repeat: { id: 'PROVA', text: 'SUSTENTAÇÃO — outra evidência, condição ou explicação do material ainda não exposta.' },
    closing: { id: 'SÍNTESE', text: 'CONCLUSÃO — encerre o argumento e use o CTA pedido; não reexponha a revelação inteira.' },
    note: 'Se não houver oposição, segredo ou antes/depois, use destaque e ritmo, sem fabricar um "parecia X / era Y". Preserve qualificadores e não adie informação essencial apenas para aumentar tensão.',
  },
});

/** Funções do miolo para `middle` posições, na ordem do arco. */
export function narrativeMiddleBeats(modeId, middle) {
  const seq = NARRATIVE_SEQUENCES[modeId];
  const slots = Math.max(0, Number(middle) || 0);
  if (!seq || !slots) return [];
  if (modeId === 'how_to') return Array.from({ length: slots }, (_, i) => ({ id: `PASSO ${i + 1}` }));
  const core = seq.core;
  if (slots <= core.length) {
    // Poucos cards: mantém o começo do arco e, salvo `keepLast: false`, a
    // última função do miolo, que fecha o argumento.
    return seq.keepLast === false ? core.slice(0, slots) : [...core.slice(0, slots - 1), core[core.length - 1]];
  }
  const beats = [...core];
  // Extras entram na posição do arco em que fazem sentido (ex.: em "dor", o
  // limite do que não resolve vem antes da saída); `end` fecha o miolo.
  for (const extra of seq.extra) {
    if (beats.length >= slots) break;
    beats.splice(extra.at === 'end' ? beats.length : extra.at, 0, extra);
  }
  // Carrossel longo: desdobra a função de desenvolvimento antes da última
  // função do argumento.
  const anchor = seq.extra.some(extra => extra.at === 'end') && beats.length > core.length ? 2 : 1;
  while (beats.length < slots) beats.splice(beats.length - anchor, 0, seq.repeat);
  // Quando a função desdobrada é a última do miolo (dor, alto impacto), a
  // original vem primeiro e a continuação ("outra…") depois dela.
  const first = beats.indexOf(seq.repeat);
  const original = beats.findIndex(beat => beat !== seq.repeat && beat.id === seq.repeat.id);
  if (first >= 0 && original > first && beats.slice(first, original).every(beat => beat === seq.repeat)) {
    beats.splice(first, 0, ...beats.splice(original, 1));
  }
  return beats;
}

/** Posições do carrossel inteiro: capa, miolo e encerramento. */
function narrativePositions(modeId, count) {
  const seq = NARRATIVE_SEQUENCES[modeId];
  const n = Math.max(1, Number(count) || 1);
  if (!seq || n < 3) return [];
  return [seq.cover, ...narrativeMiddleBeats(modeId, n - 2), seq.closing];
}

/** Valores do campo interno "funcao", um por card, na ordem do carrossel. */
export function narrativeFunctionIds(modeId, count = 7) {
  return narrativePositions(modeId, count).map(position => position.id);
}

const NUMEROS = ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'catorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove', 'vinte', 'vinte e um', 'vinte e dois'];
const porExtenso = (n, feminino = false) => {
  const palavra = NUMEROS[n] || String(n);
  return feminino ? palavra.replace(/um$/, 'uma').replace(/dois$/, 'duas') : palavra;
};
const maiuscula = texto => texto.charAt(0).toUpperCase() + texto.slice(1);

/** Passo a passo: o miolo é uma faixa de execução, não um passo por posição. */
function buildHowToOutline(seq, n) {
  const middle = n - 2;
  const faixa = middle > 1 ? `2–${n - 1}` : '2';
  const execucao = 'distribua os passos reais em ordem, um por card, com "Passo N · verbo + objeto" e como executar.';
  const sobra = middle > 1
    ? ` ${maiuscula(porExtenso(middle, true))} posições não significam ${porExtenso(middle)} passos obrigatórios: se houver menos, use posições restantes para condição, preparação ou verificação já fornecida, na ordem em que forem úteis, sem contá-las como passos nem repeti-las.`
    : ' Se o material não trouxer um passo para esta posição, use-a para condição, preparação ou verificação já fornecida, sem contá-la como passo.';
  return [`1. ${seq.cover.text}`, `${faixa}. EXECUÇÃO — ${execucao}${sobra}`, `${n}. ${seq.closing.text}`, seq.note].join('\n');
}

/** Texto do roteiro para a quantidade pedida ({{carouselOutline}} do catálogo). */
function buildCarouselOutline(modeId, n) {
  const seq = NARRATIVE_SEQUENCES[modeId];
  if (modeId === 'how_to') return buildHowToOutline(seq, n);
  const positions = narrativePositions(modeId, n);
  if (seq.intro) {
    const ramo = campo => positions.map((position, i) => `${i + 1}. ${position[campo]}`).join('; ');
    return [
      seq.intro,
      `HISTÓRIA FORNECIDA: ${ramo('story')}.`,
      `PROCESSO FORNECIDO, SEM HISTÓRIA: ${ramo('process')}. ${seq.processNote}`,
      seq.note,
    ].join('\n');
  }
  return [...positions.map((position, i) => `${i + 1}. ${position.text}`), seq.note].join('\n');
}

/**
 * Bloco do prompt com uma função por posição. Vazio para "Seguir meu pedido"
 * (none) e para pacotes com arco próprio (apresentação, tendência, modelos).
 */
export function buildNarrativeModeSequence(modeId, presetId = 'livre', count = 7) {
  const seq = NARRATIVE_SEQUENCES[modeId];
  const n = Math.max(1, Number(count) || 1);
  if (!seq || presetId !== 'livre' || n < 3) return '';
  const passos = modeId === 'how_to' ? ' Numere no título apenas ações reais do procedimento, independentemente do valor interno de "funcao".' : '';
  return `ROTEIRO DO MODO «${seq.label}» — ${n} CARDS:
${buildCarouselOutline(modeId, n)}
Como aplicar:
- Escreva primeiro o campo interno "funcao". Use na ordem os valores de funcao desta solicitação: ${narrativeFunctionIds(modeId, n).join(' | ')}. Esses valores identificam posições internas. O texto visível cumpre a função editorial descrita acima, inclusive quando a fonte exige adaptação.${passos}
- Cada card responde a uma pergunta distinta; títulos específicos podem conter número, preço ou prazo quando forem o núcleo relevante da ideia e preservarem suas condições. Não force dado no apoio nem reserve card para dado isolado sem função.
- Distribua o material conforme a progressão, sem seguir automaticamente a ordem do briefing. Uma referência breve à tese ou ao CTA pode orientar a leitura; não reexponha fatos, listas ou argumentos.
- Fato, mecanismo, causa, padrão, sensação, hábito, intenção, acontecimento e resultado precisam de suporte no material. Uma função ausente não pode ser preenchida por "raciocínio" especulativo; use apenas outra relação sustentada que avance a mesma pergunta e preserve a modalidade.
- Preserve o total solicitado, os campos e limites de texto; não fabrique conteúdo para preencher posições. A adequação e a suficiência do material precisam estar resolvidas antes desta chamada quando não houver contribuição distinta para cada posição.
- Este roteiro prevalece sobre exemplos genéricos de estrutura; fatos, restrições, idioma, limites e CTA do pedido continuam acima dele.`;
}
