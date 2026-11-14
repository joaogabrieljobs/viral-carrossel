# Moont — avaliação dos modos de apresentação

14/11/2026 · Avaliação concluída: sete modos e um controle.

## Resumo

**Sete modos e um controle foram executados: oito falhas na etapa 1, zero decks concluídos e nenhuma prévia de slides.** Cinco tentativas terminaram com resposta incompleta e três com plano reprovado na validação. Os sete modos falharam com 12 slides; o controle Auto também falhou com seis. Reduzir a quantidade não resolveu este caso, o que não permite generalizar o resultado para outros materiais ou execuções. A comparação editorial permanece bloqueada: os contratos do código diferenciam os modos, mas não houve slides gerados para avaliar sua aplicação.

O assistente apresentou os sete caminhos com nomes claros. Ele preservou a quantidade de 12 slides na troca Auto → Pitch e ofereceu dez presets visuais. O principal problema observado é a geração interrompida antes da redação; no Auto, a mensagem de erro também ficou fora da área inicialmente visível.

## Protocolo e versão

- As oito execuções ocorreram no Chrome em `https://moont.ai`, na mesma aba com frontend **`9a38663`**, mantida sem recarregar durante a comparação e o controle.
- **Nas sete execuções comparativas, o resumo foi conferido:** mesmo brief literal abaixo, material com 2.330 caracteres, 12 slides em 16:9, Balanceado, texto primeiro, padrão Moont, sem logo e zero referências.
- O oitavo ensaio é um controle Auto com **seis slides**, também confirmado na revisão, mantendo o mesmo brief de 2.330 caracteres e os demais controles. Ele não integra a comparação principal dos sete modos.
- O material é fictício, deliberadamente suficiente para comparar os sete propósitos sem pesquisa externa.
- `a4f72af` está em deploy Ready e o CI `43619614104` está verde, segundo o avaliador. O frontend da aba de teste permaneceu `9a38663`. A correção contém dois ajustes de persistência/nome, sem mudança em IA/prompts; o estado do CI/deploy não comprova sucesso de geração.
- CI informado pelo avaliador: 2.111 testes unitários/integração passaram, quatro resultados esperados como falha; 225 E2E passaram e 13 foram ignorados, sem retries; build, acessibilidade e gate verdes. Esses testes automatizados não substituem os resultados de geração real abaixo.
- Código inspecionado somente para leitura: `/private/tmp/moont-release-1411.g8s5MD`. Não houve mudança de código, Git ou geração por API nesta avaliação; MCP foi usado para ler projetos.

## Testado na UI — resultados

Tempos abaixo são checagens observadas, não durações exatas da falha. “Até” indica o limite superior; intervalos começam na última checagem ainda em andamento.

| Modo | Projeto | Resultado | Janela observada | Evidência |
|---|---|---|---|---|
| Auto | `lo937rv` | Falhou na etapa 1: validação de roteiro/evidências | Entre 2:04 e 3:21; erro visto aos 201s | [Captura Auto](apresentacoes-producao-2026-11-14/auto-validacao-erro.jpg) |
| Pitch | `lze02ue` | Falhou na etapa 1: resposta incompleta | Entre 2:15 e 3:23; erro visto aos 203s | [Captura Pitch](apresentacoes-producao-2026-11-14/pitch-resposta-incompleta.jpg) |
| Aula / Workshop | `62x4ct8` | Falhou na etapa 1: validação de roteiro/evidências | Entre 1:25 e 2:56; erro visto até 176s | [Captura Aula](apresentacoes-producao-2026-11-14/aula-validacao-erro.jpg) |
| Proposta comercial | `r82trdm` | Falhou na etapa 1: resposta incompleta | Erro visto até 2:40 / 160s | [Captura Proposta](apresentacoes-producao-2026-11-14/proposta-resposta-incompleta.jpg) |
| Relatório executivo | `ejwwfk1` | Falhou na etapa 1: resposta incompleta | Entre 1:40 e 2:46; erro visto até 166s | [Captura Relatório](apresentacoes-producao-2026-11-14/relatorio-resposta-incompleta.jpg) |
| Estudo de caso | `2hdo37n` | Falhou na etapa 1: resposta incompleta | Entre 1:52 e 2:47; erro visto aos 167s | [Captura Caso](apresentacoes-producao-2026-11-14/caso-resposta-incompleta.jpg) |
| Keynote / Manifesto | `wd5v7fk` | Falhou na etapa 1: validação de roteiro/evidências | Entre 1:09 e 2:26; erro visto aos 146s | [Captura Palestra](apresentacoes-producao-2026-11-14/palestra-validacao-erro.jpg) |
| Controle Auto — seis slides | `k5aomo7` | Falhou na etapa 1: resposta incompleta | Entre 1:39 e 2:41; erro visto aos 161s | Estado da árvore de acessibilidade registrado na sessão; sem captura de imagem |

Nenhuma das oito falhas entregou prévia ou slide gerado. A leitura MCP final confirmou os oito projetos em versão 1; `get_project_content` foi chamado individualmente nos oito e retornou, em todos, `format: ""`, `caption: ""`, `slideCount: 1`, título “Seu título aqui”, subtítulo “Subtítulo descritivo que reforça o gancho principal do carrossel.” e `hasPhoto: false`. Isso confirma projetos iniciais preservados com um slide de exemplo, sem conteúdo gerado observado; não demonstra perda de dados. A resposta da ferramenta não expõe `editorialContext`, portanto não permite concluir se o briefing foi persistido ou perdido. As sete capturas da tabela documentam a comparação principal; o controle possui observação de acessibilidade da sessão, sem screenshot anexado.

## Achados comuns

**1. Dois bloqueios diferentes impedem chegar ao deck.** Auto com 12 slides, Aula e Palestra (três de oito tentativas) mostraram: “Não consegui validar o roteiro e suas evidências. Seu projeto foi preservado. Revise o material e tente novamente.” Pitch, Proposta, Relatório, Caso e o controle Auto com seis slides (cinco de oito) mostraram: “A resposta da IA ficou incompleta. Reduza a quantidade de slides ou o material e tente novamente. Seu projeto foi preservado.” São falhas observadas de entrega, sem evidência suficiente para avaliar qualidade editorial.

**2. O erro pode ficar distante do ponto de atenção.** No Auto, a tela voltou ao topo do resumo e o avaliador precisou rolar aproximadamente duas páginas até a mensagem. Não houve warning/error observado no console. Isso não identifica a causa da falha; foco de teclado e anúncio por leitor de tela não foram testados.

**3. A mensagem genérica não informa qual ajuste do material resolveria a validação.** O caso de teste usa poucas fontes e fatos explícitos, mas o usuário é orientado a revisar o material sem saber o que foi rejeitado. O mecanismo técnico exige diagnóstico antes de atribuir a falha ao conteúdo fornecido.

**4. A redução sugerida não recuperou esta execução.** O controle manteve o mesmo brief e as demais escolhas, reduzindo apenas o total de 12 para seis slides. Também falhou na etapa 1, por resposta incompleta. Isso demonstra que a orientação não bastou neste caso; não demonstra que reduzir quantidade nunca funciona ou qual foi a causa técnica da falha.

## Verificado no código — mecanismo e limites do diagnóstico

| Verificação | Constatação | O que ainda não se sabe |
|---|---|---|
| Caminho de `rawPlan` | `generateReviewedCarousel` encaminha a `generatePlannedPresentation`; `callAI` devolve o JSON e o validador examina o plano antes de copiar suas chaves (`editorial-review.js:410–412,583–599`) | A resposta real e o motivo específico da rejeição em Auto/Aula/Palestra |
| Parser | `extractJSON` remove fences, aplica `JSON.parse` ou recorta o primeiro objeto completo; não filtra campos. Probe local de plano sintético com 12 slides preservou todos os campos e validou (`parsers.js:9–60`) | Se as respostas reais tinham múltiplos objetos ou estrutura incorreta; isso exigiria a resposta bruta |
| Resposta incompleta | `assertCompleteText` lança o código local `ai_output_truncated` para `length`/`max_tokens`, antes de parsear (`ai-client.js:145–147,195,248,367`) | O provedor/modelo e metadados concretos da resposta de cada execução não foram capturados. A mensagem corresponde a esse mecanismo no código examinado |
| Orçamento do plano | A chamada usa `min(8192, 3072 + count × 210)`: **5.592 tokens** para 12 slides e **4.332** para seis. O prompt pede que o plano caiba em **8.192 tokens** (`editorial-review.js:591`; `presentation-plan.js:46`) | A divergência pode contribuir para truncamento, mas não confirma sua causa. O controle também reduz o orçamento de saída; não isola a suficiência de um teto fixo |
| Validação rígida | Versões, campos, enums, fontes, citações literais, quantidade, ordem e referências devem corresponder ao contrato. Falha recebe código local `presentation_plan_invalid`; erros detalhados ficam em `validationErrors` (`presentation-plan.js:60–98`; `editorial-review.js:595–598`) | Os códigos e campos específicos rejeitados não foram expostos na observação da UI |
| Recuperação | Há uma chamada de planejamento; truncamento ou plano inválido interrompem o fluxo. O reparo limitado só existe após redação/revisão (`editorial-review.js:589–599,632–652`) | Não foi testado aqui um fluxo alternativo de repetição/reparo do plano, pois ele não aparece nesse trecho |

A comparação de citações normaliza apenas Unicode NFC e espaços (`presentation-plan.js:7,82–84`). Paráfrases ou mudanças de pontuação podem reprovar a correspondência; isso é hipótese a investigar, não causa confirmada. A cópia de chaves conhecidas ocorre somente depois de o plano ser validado (`:99–105`), portanto não explica uma rejeição anterior. Não foi encontrado normalizador de slides que descarte propriedades de `rawPlan` antes da validação.

Próximo diagnóstico útil: registrar códigos de `validationErrors` e metadados de término/uso do provedor sem expor o material privado. Separar interrupção por orçamento de saída de rejeição de um plano completo, e tratar cada caminho de recuperação de forma específica.

## Prioridades propostas

| Ordem | Melhoria | Benefício e base |
|---|---|---|
| 1 | Tornar o orçamento de planejamento consistente com o contrato e a quantidade, limitando o tamanho esperado do plano | Nenhuma das oito tentativas produziu deck. A divergência é verificável; aumentar tokens sozinho ainda não é solução comprovada |
| 2 | Registrar diagnósticos de término e validação; oferecer reparo limitado e seguro quando houver erro corrigível do plano | Distinguir truncamento de campo/fonte/enum inválido; não inventar evidência, relaxar rastreabilidade ou repetir indefinidamente. O reparo atual só atua depois da redação |
| 3 | Manter o erro junto ao progresso e ao botão de nova tentativa, preservando escolhas e identificando a etapa interrompida | Evita procurar a mensagem após o retorno ao topo, como ocorreu no Auto |
| 4 | Mostrar uma prévia progressiva de estrutura: sequência-base no resumo e perguntas do plano quando validado, antes do texto completo | Torna concreta a diferença entre modos e permite acompanhar progresso útil. A prévia atual só aparece quando existem slides de rascunho (`GenerationPreview.jsx:33–53`). Sem aprovação obrigatória extra |
| 5 | Preservar a contagem explicitamente escolhida em todas as entradas; oferecer a sugestão do modo separadamente | Já funciona no assistente e foi visto em Auto → Pitch com 12. Modal legado e criação rápida redefinem o número no código (`GenerateModal.jsx:372`; `CriarRapidoHome.jsx:273`) |

Depois de estabilizar o fluxo, ajustar a estimativa por quantidade/caminho/imagens com dados de duração por etapa: hoje, sem imagens, o código sempre mostra `2–5 min` (`CreateProjectFlow.jsx:115–117`), faixa em que ocorreram as falhas observadas. Também é útil mostrar um exemplo de densidade para leitura autônoma versus apoio à fala, esclarecendo texto visível e notas sem esconder condições essenciais. Nenhum desses dois ajustes teve eficácia testada nesta avaliação.

## Não validado

A avaliação não determina qualidade editorial, fidelidade factual ou diferenciação real dos sete modos; composição, densidade e notas; cortes e sobreposições; consistência dos dez presets; exportação e tela cheia; refinamento, remix ou recuperação de rascunho gerado; persistência integral do briefing; nem taxa de confiabilidade geral. Uma tentativa por caminho e um controle não medem variabilidade. O código local comprova a intenção e o mecanismo inspecionados, não substitui evidência de execução da versão servida. Os códigos e causas específicas das rejeições de plano continuam desconhecidos, assim como os metadados concretos das respostas interrompidas.

## Apêndice A — propósito e arco esperado por modo

Estes são **contratos verificados no código**, não resultados editoriais observados. Todos os caminhos são 16:9, aceitam 5–24 slides e combinam etapas para respeitar o total escolhido. Fontes: `src/utils/presentation.js:48`, `src/utils/presentation-content.js:18`, `src/utils/pitch-content.js:38`; rótulos de interface em `src/components/CreateProjectFlow.jsx:22`.

| Modo / quantidade sugerida | Propósito e uso | Arco esperado e critério essencial |
|---|---|---|
| Auto / 10 | Organizar o material; híbrido | Contexto → explicação → sustentação → síntese → ação. Escolher uma lógica dominante, sem misturar todas as estruturas |
| Pitch / 13 | Compreender o negócio e decidir avançar; leitura autônoma | Empresa/cliente/problema → oportunidade → solução/mecanismo → mercado/prova → modelo/execução → pedido. Preservar estágio; piloto não é receita, capacidade não é tração |
| Aula / Workshop / 12 | Compreender e aplicar; ao vivo | Diagnóstico → objetivo observável → conceito → exemplo resolvido → verificação → prática → debrief → transferência. Atividade com tarefa, insumos, entrega e critério |
| Proposta / 12 | Avaliar solução e aprovar escopo; leitura autônoma | Contexto/valor → desafio → abordagem → entregáveis/aceite → cronograma/dependências → investimento → limites → decisão. Condições e obrigações apenas quando fornecidas |
| Relatório / 11 | Decidir com base nos resultados; leitura autônoma | Recorte/período → síntese → indicadores → achados → interpretação/limites → riscos/opções → recomendação/decisão. Preservar bases, unidade, períodos e distinção entre percentual e ponto percentual |
| Caso / 11 | Explicar mudança e aprendizagem; híbrido | Resultado qualificado → baseline → desafio/diagnóstico → intervenção/escolhas → antes/depois → atribuição/limites → aprendizado. Não atribuir automaticamente a mudança à intervenção |
| Keynote / Manifesto / 12 | Mudar percepção e mobilizar; ao vivo | Tese → experiência reconhecível → tensão → sustentação → nova interpretação → princípios → implicações → ação. Ritmo sem slogans vazios, histórias inventadas ou falsa dicotomia |

Regras comuns: cada slide acrescenta informação; uma ideia central com sustentação; distinguir fato, plano, hipótese e informação ausente; preservar condições e ressalvas; imagens são opcionais e não substituem evidência. Pitch pede leitura autônoma e até 110 palavras por slide, com título de até 90 caracteres e duas linhas. Os demais caminhos adaptam densidade ao uso. Caption e notas não substituem conteúdo essencial visível.

## Apêndice B — brief literal executado

Tema, Texto de apoio e Instruções adicionais foram confirmados como colados sem adaptação. Todas as execuções tiveram os controles conferidos no resumo; apenas o controle final mudou a quantidade de 12 para seis slides.

### Tema

Mesa Clara: decisões mais claras em reuniões internas. Adapte o material ao caminho escolhido, para líderes e coordenadores de pequenas equipes. Português brasileiro, tom claro, concreto e sóbrio.

### Texto de apoio

Este é um caso fictício criado exclusivamente para teste; todos os nomes e números abaixo pertencem a essa simulação. Mesa Clara é um serviço de facilitação e organização de reuniões, executado por uma facilitadora e um analista. O método tem três passos: enviar pauta com decisão esperada antes da reunião; registrar decisão, responsável e prazo durante a reunião; revisar pendências no encontro seguinte. Não inclui software próprio nem automação.

O piloto gratuito ocorreu em quatro equipes de uma organização fictícia, com oito pessoas por equipe. Foram observadas 20 reuniões de rotina em abril de 2026 e outras 20 reuniões do mesmo tipo e das mesmas equipes em maio de 2026. A duração média registrada passou de 45 para 33 minutos. A proporção de reuniões com uma decisão documentada passou de 12 de 20 para 17 de 20. O total de reuniões observadas foi o mesmo nos dois períodos. Não houve grupo de controle; os facilitadores de duas equipes também mudaram em maio. Portanto, o antes/depois não isola o efeito do método. Não foram medidos receita, satisfação, retenção nem produtividade individual.

A oferta proposta é um programa de seis semanas por R$ 6.000, com pagamento de 50% no início e 50% na entrega. Inclui diagnóstico de quatro equipes, dois encontros de capacitação, um modelo editável de pauta e registro e revisão de dez reuniões. Exclui licenças de software, integração de sistemas e facilitação contínua após as seis semanas. O cliente fornece registros e indica um responsável por equipe. O aceite depende da entrega dos materiais, realização dos dois encontros e revisão das dez reuniões; não depende de promessa de economia.

Ainda não existem contratos pagos nem dados sobre disposição a pagar. O segmento inicial pretendido são organizações com equipes administrativas de 5–10 pessoas e reuniões recorrentes; o tamanho desse mercado não foi estimado. A aquisição inicial proposta é indicação pelos participantes do piloto, ainda sem conversão medida.

A decisão em discussão é aprovar o programa de R$ 6.000 para um novo ciclo de seis semanas. Data de início e nomes dos responsáveis permanecem em definição. O objetivo do novo ciclo é verificar se o método é executável em outras equipes e registrar duração e decisões documentadas com as mesmas definições. Não há meta numérica de melhoria aprovada.

### Instruções adicionais

Preserve o caráter fictício do caso. Diferencie observações, oferta proposta e decisões pendentes. Não invente clientes, citações, fontes, equipe nominal, resultados, metas ou compromissos. Em aula, use apenas os dados fornecidos para uma atividade com critério de correção. Em keynote, a tese possível é: reuniões melhores tornam a decisão explícita. Em Auto, escolha uma lógica dominante a partir deste material.


## Apêndice C — referência factual para eventual revisão de slides

- Caso fictício: quatro equipes de oito pessoas; 20 reuniões em abril e 20 em maio de 2026, mesmas equipes e tipo.
- Duração média: 45 → 33 minutos; redução observada de 12 minutos ou aproximadamente 26,7%, sem atribuição causal demonstrada.
- Decisão documentada: 12/20 → 17/20, ou 60% → 85%; diferença de 25 pontos percentuais.
- Sem grupo de controle; facilitadores de duas equipes mudaram. Receita, satisfação, retenção e produtividade individual não foram medidas.
- Piloto gratuito; nenhum contrato pago; disposição a pagar e conversão das indicações ainda não medidas; mercado sem dimensionamento.
- Oferta proposta: seis semanas, R$ 6.000, pagamento 50% no início e 50% na entrega. Entregas, exclusões e aceite exatamente como no apoio; sem garantia de economia.
- Próximo ciclo proposto, sem início e responsáveis nominais definidos; sem meta numérica de melhoria aprovada.
