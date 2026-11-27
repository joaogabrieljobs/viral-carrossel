# Direção de arte das imagens da apresentação

Pedido do João (26/11/2026). O deck da Apoteose que ele montou no ChatGPT ficou muito superior ao do Moont, e ele mandou o deck e os prompts que usou. Este documento leva para o código o método por trás desse resultado. Vale para todas as apresentações (roteiro v2 e v3). O carrossel continua fora do ciclo.

## Diagnóstico: Moont × ChatGPT

| Aspecto | ChatGPT | Moont hoje |
|---|---|---|
| Direção visual comum | Texto-base que dá a cada cor um papel e um hex: índigo `#171344` como base, laranja `#FF6A1A` como luz sobre as pessoas, magenta `#B41275` nas sombras, ciano `#27DDE5` nos grafismos e verde ácido `#60EC2E` em pequenos acentos. Somam-se acabamento (grão analógico, serigrafia), atmosfera e exclusões. | A referência vai anexada com "pegue só o visual". O modelo adivinha a paleta, e cada slide adivinha diferente. |
| Cena | É um briefing de foto: casting (pessoa, idade, tom de pele), figurino, ação, expressão, luz pela paleta e grafismos daquele slide. | Quatro campos curtos em inglês (subject, action, setting, shot), por exemplo "Crowd at a stylish party". |
| Imagem × layout | A imagem nasce com o espaço do texto definido, por exemplo "rosto nos 48% à direita; os 50% à esquerda índigo escuro para tipografia". A foto ocupa o slide inteiro e o texto fica sobre a área reservada. | A imagem é gerada sem conhecer o layout e depois recortada para o painel. |
| Fundo | Um fundo abstrato da identidade, gerado uma vez, serve para os slides de posicionamento, personalidade e fecho. | Página sem foto fica só com cor sólida, e cada foto custa uma imagem. |
| Texto | Títulos de autor ("Brasil na pista"), rótulo acima do título ("A FESTA"), slides só de texto em cor cheia e a personalidade em duas colunas. | Títulos longos e descritivos, sem rótulo. |

Montagem que o ChatGPT usa: referência visual + direção visual comum + personagem ou assunto + ação e expressão + enquadramento e espaço para o texto + luz, textura e grafismos + formato e restrições. A consistência vem da relação entre cor, luz e acabamento. Rosto, cena, figurino e enquadramento podem variar.

## O que muda

### 1. Direção visual do deck (`visualDirection`)

Fica no roteiro, uma vez por deck, sem nova chamada à IA. A Z.ai escreve, a partir do briefing e do kit (estilo escrito, cores da marca, descrição da referência quando existir):

- `palette`: 3 a 6 itens, cada um com `role` e `hex`. Os papéis possíveis são base, luz sobre o assunto, sombra, grafismo e acento.
- `finish`: acabamento da imagem (grão, textura, tipo de impressão, nível de realismo).
- `atmosphere`: clima em uma frase.
- `graphics`: linguagem dos grafismos e intervenções, ou "none".
- `avoid`: exclusões do deck.

O código valida em listas fechadas e hex válido. Com kit, as cores do kit têm prioridade sobre as propostas. No modo livre, a paleta do slide (`deckDesign.palette`) e a paleta da imagem (`visualDirection`) precisam combinar.

### 2. Cena como briefing

A cena de cada slide passa a ter os campos abaixo, todos opcionais e retrocompatíveis com o `scene` atual:

- `subject`: quem ou o quê, com casting quando houver pessoas;
- `wardrobe`;
- `action`;
- `expression`;
- `light`: pela paleta do deck;
- `graphics`: intervenções gráficas daquele slide;
- `shot`.

Diversidade de casting é pedida, nunca estereótipo. Pessoas reais e marcas não são reproduzidas.

### 3. Imagem que conhece o layout

O código calcula, a partir da composição final do slide, onde fica a área do texto e quanto ela ocupa. Esse cálculo entra no pedido de imagem como um bloco de composição, por exemplo: "keep the left 55% dark and quiet in the base colour for typography; place the subject in the right 45%".

Entra também uma composição **foto em tela cheia com texto sobre a área reservada**. O pedido de imagem reserva o lado do texto. O texto fica sobre essa área, com uma proteção leve de contraste e o mínimo de 4,5:1 garantido pelo código.

Ela é usada na capa e em slides de destaque, quando a família permite. No modo livre, `ground: 'photo'` passa a usar essa composição. O que já existe continua funcionando.

### 4. Arte de fundo reaproveitada (modo livre)

Uma imagem abstrata da identidade, sem pessoas, com o grafismo concentrado num lado e a maior parte lisa na cor base. Ela é gerada uma vez por deck e reaproveitada nos slides com `ground: 'art'`, um fundo novo do modo livre. Conta 1 crédito para o deck inteiro.

O diretor de arte reserva de 1 a 3 slides elegíveis sem foto para esse fundo, quando o roteiro oferece essas páginas. Sem crédito ou sem imagem, o fundo cai para a cor base.

### 5. Texto editorial

- **Título:** curto e de autor, com até 6 palavras quando possível, sem repetir o subtítulo.
- **Rótulo acima do título** (`eyebrow`), de 1 a 3 palavras em caixa alta, renderizado pela família ou pelo modo livre. É opcional nos presets comuns; no Livre, os vazios das páginas após a capa recebem um rótulo editorial derivado do conteúdo ou da função do slide.
- **No modo livre:** slide de texto em cor cheia (`ground: 'accent'` com título grande) entra no ritmo, e o bloco `comparison` aceita o par "traço / sem ser…" em duas colunas.
- **Fidelidade:** as regras de fato e de repetição continuam iguais.

## Regras que continuam valendo

Os itens abaixo não mudam:

- texto e logotipos nunca entram na imagem;
- contraste de pelo menos 4,5:1;
- ritmo de layout;
- piso de leitura;
- referência pelo visual, sem copiar pessoas;
- a assinatura do deck;
- o projeto salvo não muda ao abrir;
- o orçamento de tamanho do pedido de imagem: blocos novos entram com prioridade e corte definidos, e regras e composição nunca saem.

## Verificação

1. **Testes sem crédito:** o pedido de imagem completo do deck da Apoteose antes e depois, conferido bloco a bloco (direção visual, cena, composição com o percentual certo para o layout e restrições); layouts novos nas 10 famílias e no modo livre; capturas com fotos de teste.
2. **Geração real, com o sim do João:** gerar a Apoteose com o mesmo briefing e a mesma referência e comparar lado a lado com o PDF do ChatGPT.

## Adendo — 26/11/2026: Teste 7

### A base da identidade precisa chegar ao slide e à imagem

A extração da referência oferece `ignoreFlatBorders: true` para apresentações. A opção recorta faixas lisas de mesma cor em bordas opostas antes de medir a paleta; não descarta uma área lisa em apenas um lado da arte nem uma imagem inteiramente lisa. Cada referência é recortada antes de juntar as amostras. A opção fica desligada por padrão, preservando o comportamento dos carrosséis existentes.

As cores extraídas mantêm `{ hex, weight }` até o ajuste de `deckDesign.palette` e de `visualDirection.palette`. Reduzir a lista a hex nesse caminho perde a informação necessária para distinguir a base da identidade de um detalhe pequeno. A paleta já salva no kit continua válida enquanto corresponder às mesmas referências.

`preferredReferenceBaseHex` aplica a mesma regra aos dois destinos:

- Se a base atual é preto ou branco quase neutro, e existe na referência uma cor escura saturada com peso de pelo menos 15%, essa cor pode assumir o papel de base. Havendo mais de uma, vence o maior peso, com desempate estável por hex.
- A classificação usa Lab: base neutra com cromaticidade `C* <= 12` e luminosidade `L* <= 25` ou `L* >= 85`; candidata com `L* <= 45` e `C* >= 20`.
- A base escrita explicitamente no kit tem prioridade. Uma base cromática já escolhida permanece; listas legadas sem pesos mantêm o comportamento anterior. A preferência não recolore tintas ou acentos.

No Teste 7, o preto da referência não deve apagar o índigo `#2B2158` da identidade. A asserção exige esse resultado no `deckDesign` final e no papel `base` da `visualDirection`, inclusive quando a paleta foi reutilizada do kit. O pedido de uma imagem posterior usa essa direção persistida, mantendo a relação entre a área de texto e a imagem.

### A intenção visual precisa sobreviver à renderização

A família pedida pelo roteiro passa a vincular a composição Livre, salvo correção obrigatória de ritmo ou variedade com motivo registrado. Eyebrows completados no rascunho são copiados para o slide final. A personalidade escrita em sete pares separados por vírgulas vira tabela com os mesmos sete pares, sem inventar dados. Esses contratos e os metadados de troca de família estão detalhados em [Modo livre de apresentação](modo-livre-apresentacao.md#adendo--26112026-teste-7).

O rótulo editorial derivado prioriza o tema do título antes de consultar o apoio. A presença incidental de música numa enumeração não torna essa página musical nem ocupa o rótulo da página seguinte. `O ENCONTRO` só é derivado quando encontro ou reunião aparece no título; no Teste 7, os slides 4, 5 e 6 recebem respectivamente `O ENCONTRO`, `A MÚSICA` e `O PÚBLICO`. Rótulos já escritos são preservados.

Esse acabamento entra antes dos limites e da revisão editorial: a tabela pronta é o conteúdo auditado, não o parágrafo de origem. A variante de sete pares é aceita na validação somente no Livre e aparece explicitamente nos contratos de redação e revisão. No Suíço com arte, a tabela mantém o piso de 50% da largura ao lado do título, sem atravessar sua coluna nem o grafismo reservado a partir da borda direita.

O filtro dos adornos narrativos das famílias também é usado quando o editor restaura uma composição com foto. Assim, a renderização não reintroduz `CENA` ou perde o rótulo editorial depois de uma imagem chegar. Uma foto antiga gerada por IA não substitui a decisão `photo: 'none'`; fotos enviadas pela pessoa e pedidos individuais explícitos continuam permitidos.

O fundo abstrato é uma camada própria, compartilhada pelo deck. A combinação `presentationFreeDesign.ground: 'art'` com `presentationGround: 'bg'` é válida: o primeiro escolhe a arte, e o segundo resolve as tintas sobre a base. Conferir apenas `hasImage` ou `bgImage*` verifica foto, não prova que a arte foi gerada ou desenhada. A prova usa o recurso `presentationArtImage*`, sua persistência e a camada visível. O plano normal reserva de 1 a 3 páginas elegíveis sem foto; a mesma arte disponível também pode preencher uma página cuja foto falhou.

### A arte segue a direção do projeto

`composeDeckArtImageDirection` usa a direção visual efetiva para acabamento, atmosfera, papéis de luz e sombra, grafismos e exclusões. Não acrescenta papel, grão, serigrafia, recorte orgânico ou pontos como estética fixa. `graphics: 'none'` mantém o fundo sem intervenções gráficas; uma linguagem geométrica ou orgânica só entra quando estiver descrita na direção. As exclusões também acompanham o bloco `AVOID` do pedido.

A composição continua reservando os 72% à esquerda como superfície calma para texto e mantém os grafismos permitidos próximos da borda direita, a partir de 78% da largura. A imagem continua sem pessoas e sem texto, gerada uma única vez para o deck. Sem direção ou paleta disponível, o pedido usa uma base neutra `#111111` e uma superfície uniforme; não herda o índigo da Apoteose nem ativa o acabamento fotográfico genérico.

Os prompts completos anexados são uma referência de método. Seus hex aproximados, casting conceitual e escolhas de acabamento pertencem àquele projeto; não são medições oficiais da marca nem regras globais para outras apresentações.

### Falha e recuperação fazem parte da direção de arte

Lotes de imagens respeitam páginas planejadas sem foto. Quando uma foto planejada falha sem mídia existente, a própria ação recompõe a página para texto e, se disponível, a arte do deck. O motivo fica visível no aviso com a possibilidade de tentar novamente. Uma página com posições manuais conserva essas posições.

`presentationImageFallback` guarda a composição anterior e somente as alterações necessárias à recuperação. O pedido de nova imagem conhece o tamanho e a área reservada originais. Ao receber a foto, o código restaura os campos que não foram editados pela pessoa após a falha e remove o registro transitório. Essa transição acontece na gravação da ação, inclusive quando o resultado precisa ser entregue ao projeto de origem após uma troca de projeto; não é uma correção executada ao abrir o documento.

A mesma recuperação acompanha o upload individual, preservando as edições por formato. Se uma nova tentativa falha em um slide antigo que já tinha o sinal de erro, o evento explícito autoriza o fallback; carregar o estado antigo não autoriza uma recomposição.

### Verificação do Teste 7

A prova de navegador parte do assistente vazio e da fixture crua de roteiro e redação; fotos, arte e timeout são respostas locais sem consumo de crédito. Ela deve atravessar acabamento editorial, composição, geração, falha, conferência renderizada, gravação, reabertura e recuperação. As dez páginas precisam ser capturadas e inspecionadas no tamanho de apresentação, com atenção a contraste, largura de leitura, sete pares completos, área da arte, rótulos acima do título e ausência de uma reserva vazia para foto que falhou.

Em 26/11, a suíte unitária da Frente A passou em 449 arquivos, com 9.353 casos aprovados e 6 falhas esperadas, totalizando 9.359 testes em 37,55 segundos. O resultado unitário isolado não substitui a geração completa no navegador e a inspeção das capturas. Além do Teste 7, o navegador verifica uma direção sem grafismos e sem grão: o pedido final da arte deve preservar essas decisões, sem reintroduzir os motivos fixos da Apoteose.

A validação de navegador foi concluída: três cenários focais aprovados, bateria geral com 361 aprovados e 24 ignorados por configuração, e 60 cenários aprovados com Projetos V2. As 31 capturas de antes/depois/recuperação foram inspecionadas em 1920 × 1080. Isso comprova a composição e a persistência com mídia simulada; não comprova a qualidade de imagens geradas pela SJinn nem equivalência visual ao PDF-alvo. A nova geração real continua a cargo do João, após aprovação da publicação.

## Adendo — integridade e qualidade dos prompts do Livre

Pedido de 26/11/2026 após a conclusão local das frentes A e B: aproximar a construção dos pedidos ao método dos sete prompts originais, mantendo o GPT Image 2 como modelo. A comparação dos pedidos HTTP preservados no teste social encontrou uma divergência com a intenção acima: a redução para 4.000 caracteres descartava luz, exclusões específicas e cenas vizinhas para conservar regras repetidas. Um pedido conservava apenas um fragmento do cabeçalho de luz. Os testes anteriores provaram geração, composição e persistência com IA simulada; não verificavam a sobrevivência de todas essas decisões no pedido final.

### Escopo e compatibilidade

O novo montador recebe um contrato estruturado e versionado, ativado explicitamente em `presentation_free` e `social_free`. Ausência desse contrato mantém o caminho anterior. Os 21 estilos sociais fixos, seus 63 hashes, os catálogos de texto e imagem, Criar rápido, projetos abertos, textos, fotos e edições por formato permanecem protegidos pelas regressões existentes. Não há chamada extra à IA, troca de modelo, aumento de limite, migração ou mudança de créditos.

### Escrever decisões visíveis

O roteiro descreve cada cena pelos oito campos existentes. Define uma decisão visual distintiva coerente com a função da página: assunto, ação ou gesto, expressão e olhar, ambiente e profundidade, material do figurino quando relevante, incidência da luz e enquadramento. A direção deve ser observável na imagem; adjetivos de qualidade não substituem essas escolhas. Casting, local e ação inventados para uma imagem conceitual não viram fatos do projeto. O método não fixa a estética, as cores ou os personagens da Apoteose em outros trabalhos.

### Montar sem apagar a direção

O contrato reúne direção comum, cena, composição efetiva, sujeitos, anexos e diferenças de outras cenas. Os rótulos pertencem ao montador, separados dos valores. Não emitir seção vazia, fragmento de cabeçalho ou referência a um mapa ausente. Regras gerais entram uma vez; briefing bruto e repetições cedem antes de luz, paleta, composição, identidade e exclusões. Havendo outras fotos, ao menos duas diferenças úteis de ação, ambiente ou plano são reservadas quando disponíveis. Uma ficha de sujeito não obriga que ele apareça em toda imagem.

A direção local de grafismos governa as intervenções dentro da imagem; `none` mantém a fotografia sem grafismos mesmo que a linguagem do layout use formas. A paleta efetiva do projeto governa as cores. Nas apresentações livres, a escolha final de cor do projeto tem a mesma precedência no slide e no pedido, inclusive sobre uma escolha anterior do kit.

Essa precedência final usa a composição materializada (`presentationPaletteOverrides`), não uma proposta de paleta ainda sem composição. Rascunhos legados continuam passando pelo ajuste às cores extraídas, inclusive a regressão do Teste 6 que remove o amarelo inventado fora da referência.

A composição descreve a zona real da imagem e a área efetiva do texto na vista atual. A proporção do card e a proporção de saída do provedor são conceitos separados. Direção manual e zonas editadas continuam prevalecendo conforme o contrato existente.

Quando a reserva de texto ainda não tem uma cor própria, o Livre prefere a base cromática se ela já oferece contraste de 4,5:1 com a tinta. Uma `overlayColor` salva continua governando sua superfície: esta alteração do pedido não recolore nem recompõe proteções existentes. Cenas vizinhas idênticas à atual são excluídas das instruções de variação, para não pedir simultaneamente uma ação e a sua ausência.

Se os dados essenciais não couberem no limite da rota, a montagem devolve um diagnóstico antes da chamada de imagem. Não envia silenciosamente uma cena sem luz ou uma identidade incompleta. A limitação de 4.000 caracteres é o teto configurado para a rota SJinn do aplicativo; não é apresentada como limite universal do modelo GPT Image 2.

### Prova exigida

Testes devem falhar antes da correção e depois passar. Além das unidades do contrato, o assistente executa a geração completa com IA simulada e verifica o corpo HTTP real: luz, exclusões, diversidade, ficha, anexo, geometria e orçamento. As baterias obrigatórias e os catálogos legados continuam exigidos. A comparação estética com o PDF depende de geração real autorizada; integridade do prompt não comprova, por si só, qualidade visual equivalente.

## Adendo — Apoteose 8: ler o anexo antes de escrever a direção

O Teste 8 e os novos exemplos enviados pelo João mostraram que conservar o texto do pedido não basta quando o próprio roteiro inventa uma direção que não observou. A paleta já era medida, mas o planejador não via o flyer. No caso salvo, ele pediu acabamento sem grão e cenas abstratas ou sem pessoas; uma foto planejada também se perdeu numa validação posterior.

Em nova geração de apresentação Livre com referência, uma leitura multimodal passa a anteceder o roteiro. O contrato separa evidência visual, interpretação, relação com o briefing, invariantes, variáveis, restrições e síntese operacional. A fotografia recebe essa síntese mais a cena e a composição da página. O fundo separado recebe uma derivação específica de superfície e grafismos; o montador não copia para ele a síntese fotográfica nem as observações de personagens. Instruções escritas explícitas prevalecem, inclusive quando mudam o meio ou o acabamento observado.

Essa etapa acrescenta uma chamada de visão com `glm-4.6v`, sujeita à cota de texto existente, e reutiliza o resultado válido enquanto briefing e referências corresponderem. Atualiza, portanto, a decisão anterior de montar a direção sem chamada extra. **GPT Image 2 permanece como gerador das imagens.** Regenerar uma foto de um projeto com análise válida reutiliza o registro salvo. Nenhuma geração paga integra a bateria de testes.

A leitura não é ativada nos carrosséis de estilo fixo nem nos estilos fixos da apresentação. Desde 27/11 ela vale também para o Livre social do carrossel com anexo, nos três formatos ([adendo](../engineering/apoteose8-referencia-visual.md#adendo--livre-social-do-carrossel-27112026)). Abrir documentos antigos não altera suas páginas ou suas imagens. O diagnóstico, os limites e os resultados da validação estão em [Apoteose 8: referência visual](../engineering/apoteose8-referencia-visual.md).
