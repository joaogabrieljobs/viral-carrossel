# Teste de produção dos modos narrativos — 14/11/2026

## Escopo

Teste manual realizado no `moont.ai`, pela interface de criação, com nove projetos reais salvos na biblioteca da conta.

Configuração mantida em todas as tentativas:

- 7 cards;
- Feed 4:5;
- texto `Balanceado`;
- `Criar o texto primeiro`;
- identidade padrão do Moont;
- português brasileiro;
- mesmo tema, material de apoio e instruções;
- primeira tentativa de cada modo, sem regenerar.

Tema de controle: por que um site desatualizado faz um pequeno negócio local perder confiança antes do primeiro contato e como corrigir isso.

O apoio forneceu público, cinco etapas do processo, problemas observáveis, benefício esperado, caso narrativo permitido e CTA final. Também proibiu inventar preço, prazo, percentual, garantia, taxas, clientes ou resultados.

## Resultado executivo

- 9 de 9 modos concluíram na primeira tentativa;
- 63 de 63 cards vieram com título;
- 9 de 9 resultados ficaram em português brasileiro;
- 9 de 9 encerraram com CTA compatível com “solicitar uma análise do site”;
- não apareceram placeholders nem Markdown cru;
- tempo médio aproximado: **4min46**;
- faixa observada: **3min39 a 5min33**;
- 3 de 9 modos ultrapassaram o teto de 5 minutos mostrado na interface;
- 9 de 9 resultados acrescentaram pelo menos uma afirmação não sustentada pelo material;
- 8 de 9 ficaram densos demais nos cards 3–7, apesar da opção `Balanceado`.

## Comparação

| Modo | Tempo | Estrutura do modo | Fidelidade factual | Densidade | Veredito |
|---|---:|---|---|---|---|
| Seguir meu pedido | ~4min | Boa; preserva a sequência geral | Média-baixa | Pesada nos cards 3–7 | Base coerente, mas não preserva fatos com rigor |
| Explicar com autoridade | 5min07 | Boa; tese, contexto e consequência | Baixa | Parede de texto do card 3 em diante | Convincente, porém pouco seguro |
| Ensinar passo a passo | 5min33 | Excelente; cinco passos numerados | Baixa | Muito densa | Melhor aderência estrutural, mas o mais lento |
| Contar uma história | 4min52 | Excelente; situação, descoberta, mudança e consequência | Baixa | Muito densa após a abertura | Boa narrativa, mas transforma inferências em fatos |
| Prender atenção | 3min39 | Excelente; gancho, tensão, resposta e CTA | Média | Melhor leitura da rodada | **Melhor resultado geral** |
| Falar da dor | 4min51 | Excelente; identificação, falso remendo, causa e saída | Muito baixa | Muito densa | Persuasivo, porém arriscado |
| Ir a fundo | 4min58 | Boa; tese, padrão, demonstração e implicação | Muito baixa | Muito densa | Pior fidelidade factual da rodada |
| Informar com clareza | 5min02 | Boa; manchete, lead, contexto e processo | Baixa | Longa apesar da aparência editorial | Parece jornalístico sem manter rigor jornalístico |
| Criar alto impacto | 4min54 | Boa; ritmo e contraste fortes | Muito baixa | Pesada | O impacto vem de hipérbole, não só de composição |

## Evidências por modo

### Seguir meu pedido

Acertos: sequência coerente, títulos completos e CTA correto.

Desvios: “a maioria das pessoas”, “botão de agendamento”, “adaptação perfeita” e promessa de “trazer clientes”. Surgiu também o erro linguístico “botões peques”.

### Explicar com autoridade

Acertos: tese e encadeamento argumentativo claros.

Desvios: concorrente, localização, WhatsApp, formulário e “conversão imediata” não estavam no material. Cards 3–7 ficaram extensos.

### Ensinar passo a passo

Acertos: cinco passos numerados e alinhados ao processo fornecido.

Desvios: incluiu preço, cardápio, WhatsApp, formulário e afirmações sobre tempo de decisão. Os cards centrais têm dois parágrafos longos.

### Contar uma história

Acertos: arco narrativo natural e caso inicial reconhecível.

Desvios: concorrente, endereço, “dois cliques” e conversão foram apresentados como fatos. O título “diagnóstico do prejuízo” aumenta o tom sem evidência.

### Prender atenção

Acertos: melhor ritmo, melhor leitura, boa progressão e CTA direto.

Desvios: “vai para o concorrente”, “pior que nenhum” e “um toque” são extrapolações.

### Falar da dor

Acertos: o modo mais fiel ao contrato identificação → falso remendo → causa → saída.

Desvios: “mudou três vezes”, volta ao Google, concorrente, perda de clientes e deterioração “em poucos meses” foram inventados.

### Ir a fundo

Acertos: tese contrária ao senso comum, padrão e implicações bem organizados.

Desvios: telefone desligado “há dois anos”, página de erro, clientes apenas pelo WhatsApp, custos e horários foram inventados. O aprofundamento ocorreu por fabricação de detalhes.

### Informar com clareza

Acertos: manchete, linha fina, contexto e processo bem identificáveis.

Desvios: concorrente, endereço, deslocamento de ônibus, WhatsApp e conversão não vieram do material.

### Criar alto impacto

Acertos: contraste e ritmo fortes.

Desvios: “sabotagem”, “sobrevivência”, perda da maioria dos acessos, dinheiro perdido e vitória do concorrente. O impacto dependeu de hipérbole e promessa.

## Problemas transversais e prioridade

### P0 — Falta um validador factual comum a todos os modos

Cada afirmação deve ser classificada como:

1. fornecida explicitamente;
2. inferência segura;
3. exemplo hipotético claramente marcado;
4. não sustentada.

Afirmações da classe 4 precisam ser removidas ou reescritas antes de o projeto chegar ao editor. As regras específicas de “dor”, “profundo” e “alto impacto” não podem sobrepor essa trava global.

### P0 — `Balanceado` não controla a densidade final

A revisão editorial precisa aplicar um teto depois de todas as reescritas, por campo e por card. Hoje o rascunho começa enxuto, mas os cards 3–7 recebem dois parágrafos extensos.

Critério sugerido para este preset:

- título: até 8 palavras;
- subtítulo: até 2 linhas;
- corpo total: até 320 caracteres ou 3 linhas por bloco;
- no máximo 2 blocos de corpo por card;
- se exceder, dividir a ideia ou resumir sem criar um card extra silenciosamente.

### P1 — A etapa de revisão é opaca

A interface informa que os cards prontos aparecem durante a geração, mas nenhum apareceu nesta rodada. A etapa 2 permaneceu por minutos sem contagem, prévia ou indicação de avanço.

Mostrar:

- `Rascunho concluído`;
- `Revisando card X de 7`;
- cada card assim que aprovado;
- tempo decorrido e nova estimativa quando o teto original for ultrapassado.

### P1 — Estimativa de tempo imprecisa

Três modos passaram dos 5 minutos anunciados, mesmo sem imagens. A estimativa deve usar histórico por modo, quantidade e densidade, ou ser apresentada como faixa dinâmica.

### P2 — Especificidade incompatível com público amplo

WhatsApp, cardápio, agendamento, endereço, recepção e formulário apareceram sem estarem no briefing. Esses detalhes só devem entrar se fornecidos ou se o sistema os marcar como exemplo opcional.

### P2 — Revisão linguística final

Executar uma última checagem de ortografia e formulações imprecisas. Exemplo observado: “botões peques”.

## Ranking da rodada

1. **Prender atenção** — mais rápido, mais legível e melhor composto.
2. **Ensinar passo a passo** — melhor cumprimento do contrato narrativo.
3. **Contar uma história** — arco mais natural e fácil de acompanhar.

## Conclusão

Os modos estão claramente diferenciados e a estabilidade melhorou: todos concluíram na primeira tentativa, com títulos completos, idioma correto e CTA coerente. O lançamento automático ainda deve ser bloqueado por revisão humana porque a fidelidade factual falhou em todos os modos e a densidade `Balanceado` falhou em oito deles.
