# Apoteose 8: regressão de composição e leitura da referência

Revisão iniciada em 26/11/2026, sobre a versão publicada `7cc11069ee16f1ecc853047ab54728b35fe4ed31`. Esta entrega corrige a geração Livre da apresentação e incorpora a leitura visual solicitada pelo João. O modelo que gera as imagens continua sendo o GPT Image 2, pelo transporte existente. Não é uma correção retroativa dos pixels já gerados.

## Evidência e limites do diagnóstico

Foram usados o projeto Apoteose 8 salvo, as capturas enviadas, o briefing original e os sete exemplos com seus prompts de direção visual. A fixture sanitizada está em `tests/fixtures/apoteose-teste8.json`.

A versão salva contém nove páginas e um plano de dez posições. A página de personalidade, posição original 7, já não está no documento. O teste reconstrói seu conteúdo editorial a partir do título e da introdução visíveis na captura, mais os sete pares literais do material original. Ele não recupera nem injeta o canvas apagado. As nove demais páginas usam os campos de redação observados, sem offsets, canvas ou mídia pronta. A procedência consta em `tests/e2e/helpers/apoteose-teste8-harness.js`.

O banco conserva a cena planejada e a direção visual, mas não o corpo HTTP final enviado naquela geração. Portanto, as causas abaixo distinguem o que está salvo, o que o código reproduz e o que ainda depende de uma nova geração real.

## Causas encontradas

| Sintoma | Evidência | Correção |
|---|---|---|
| Fotografia perdeu protagonismo | O plano pedia abstrações ou ambientes sem pessoas na capa, conceito, música e fecho. A direção comum também proibia grão, embora o pedido escrito só solicitasse fidelidade ao flyer. | Leitura multimodal do anexo antes do roteiro, com evidência separada da interpretação; cenas concretas e cobertura de imagem orientadas pela intenção do briefing. |
| Foto da música desapareceu | O plano previa `small + icons`; o documento final tinha `imageQuery` vazia e `photo:none`. O validador zerava a consulta de toda página com bloco nativo. | Em Livre, o validador preserva a foto explicitamente planejada com uma cena; o Modular oferece uma composição de ícones e foto sem sobreposição. |
| Foto do público virou detalhe | O plano previa `half`; uma heurística de texto longo reduzia a imagem para 26% × 50%, ou 13% da página. | A composição mede o texto com a fonte do deck e conserva a escala pedida quando ela cabe. |
| Tabela de personalidade cortada e exportação bloqueada | Os sete pares ocupavam mais altura que a reserva de dados. O erro de exportação impedia baixar conteúdo cortado. | Composição e renderer compartilham as métricas da tabela; a reserva cresce dentro da área segura, sem excluir linhas nem reduzir a fonte para esconder o problema. |
| Texto pequeno em áreas disponíveis | O teto de crescimento do apoio era 32px mesmo quando havia espaço para leitura maior. | O Livre pode crescer o apoio até 40px, conforme a fonte, as quebras e a área real; a linha complementar acompanha essa escala. |
| Frase da capa invisível no rascunho ainda sem foto | O texto estava salvo e renderizado, mas o fallback do corpo era branco sobre fundo branco, com contraste 1:1. O mesmo defeito já existe em `c188ac7`. | O corpo passa pela proteção de contraste que o renderer já aplicava ao título e ao apoio quando a composição espera uma foto ausente. Texto e geometria salvos permanecem intactos. |

A foto da música expôs duas etapas distintas. A unidade do compositor inicialmente passou, mas o navegador ainda não fazia o pedido de imagem. A geração completa revelou a limpeza posterior em `validateCarouselDraft`; o novo teste de redação atravessa essa validação antes de conferir a composição. Essa falha não foi resolvida relaxando a expectativa do navegador.

A inspeção nativa do rascunho também encontrou uma frase invisível que os testes de persistência não detectavam. O teste SSR registrou três falhas antes da correção de contraste e conserva os caminhos com foto, com tinta já legível e com composição legada. O navegador passou a conferir a cor efetiva, a superfície, a opacidade, os glifos e os limites do texto, além de sua presença no documento.

## Como a referência passa a orientar a geração

### Paleta medida e leitura visual têm funções distintas

`reference-palette.js` continua estimando a paleta por amostragem e agrupamento dos pixels, com cores e pesos. Ele preserva a preferência pela base cromática e a prioridade das cores escritas no kit; não fornece cores oficiais da marca. Um hexadecimal não descreve fotografia, expressão, tecido, iluminação ou textura.

A nova leitura recebe os anexos e o briefing. Produz um contrato validado em estrutura, campos obrigatórios e limites; a precisão da leitura continua sendo inferência do modelo. O contrato contém:

- evidências observáveis: meio, paleta e seus papéis, sujeitos, luz, acabamento, grafismos, hierarquia, espaço livre e tipografia;
- interpretação de atmosfera, identificada como interpretação;
- relação com o briefing, separando recursos sustentados e propostas novas;
- invariantes, variáveis, restrições e composição;
- uma síntese operacional em inglês para os pedidos de imagem;
- quando aplicável, uma derivação de superfície e grafismos para o fundo abstrato separado.

Os códigos estimados visualmente não substituem os valores medidos. Casting, local e gesto concebidos para uma imagem não viram fatos sobre o projeto. A observação do flyer permanece intacta se o usuário pedir outra superfície: uma referência pode conter grão e a criação nova pedir fundo liso.

### Ordem e custo

Em nova geração de **apresentação Livre com referência**, a ordem é: ler a referência, planejar, redigir e revisar, compor, gerar as imagens e conferir o resultado renderizado. O roteiro recebe a análise validada; a redação recebe o plano sem repetir o texto completo da leitura visual.

A leitura exige uma chamada de visão separada quando não há cache compatível, com `glm-4.6v`, via `/api/ai/compatible`, usando o controle de acesso e a cota de texto já existentes. Isso atualiza o contrato anterior de direção escrita sem chamada adicional: a antiga etapa não via os anexos. A implementação não altera o modelo de imagem, os créditos de cada foto nem o crédito da arte compartilhada. Nenhuma chamada paga foi feita na validação desta entrega.

O transporte é restrito a uma instrução e uma mensagem com até quatro referências PNG/JPEG, preparadas como cópias completas de até 1.600px de lado e 360.000 caracteres cada. Os originais do kit permanecem intactos. Há limite próprio de texto e saída, uma tentativa de upstream com prazo de 90 segundos e um limite de 110 segundos no cliente. Referência ausente, ilegível ou análise incompleta interrompe a geração antes das imagens; não há preenchimento silencioso por uma descrição inventada.

### Pedido de foto e pedido de fundo

O pedido de foto combina a síntese visual comum com a cena de cada página, sua luz, ação, expressão, enquadramento e a composição efetiva. O flyer continua anexado como referência de linguagem. A direção manual explícita continua prioritária. O texto, os dados e os logotipos permanecem editáveis, fora da imagem gerada.

A arte compartilhada recebe `direction.background`, a derivação de superfície e linguagem gráfica. O montador não copia para ela as evidências de sujeitos nem a síntese fotográfica. A resposta simulada foi conferida nesse caminho; não existe uma validação semântica capaz de garantir que o modelo jamais escreva uma descrição imprópria dentro do campo de fundo. O pedido mantém as regras de fundo abstrato sem pessoas, a reserva de texto e as restrições globais explícitas do projeto, sem reintroduzir proibições estéticas inventadas pelo antigo planejamento.

O montador conserva o teto de 4.000 caracteres do transporte de imagem do app. Se as decisões essenciais não couberem, devolve o diagnóstico antes do pedido; não envia uma cena truncada.

### Persistência e recuperação

A análise pertence ao conjunto ordenado de referências, à direção escrita e ao contexto. O registro guarda hashes dos bytes originais, identificadores e a análise normalizada, sem duplicar os anexos. Uma nova análise, o empacotamento e a hidratação conferem os bytes disponíveis. Durante a geração, uma referência legada pode migrar de bytes inline para IndexedDB antes de receber o identificador canônico da nuvem; o vínculo assíncrono confere os originais atuais antes de gravar o resultado ou abrir o rascunho. Após a espera, o app revalida projeto, proprietário, sessão e kit.

Reabrir o projeto e regenerar uma foto reutiliza a leitura persistida correspondente ao plano. Repetir uma geração com briefing ou referência diferentes exige uma leitura nova. A recuperação de um lote interrompido conserva o registro quando o kit corresponde àquele resultado. A regeneração individual usa um guard síncrono e confia nos identificadores que a UI renova ao substituir a referência; ela não relê os pixels a cada foto. Adulterar manualmente o IndexedDB, mantendo todos os identificadores, fica fora dessa garantia isolada.

## Compatibilidade

A ativação da leitura está restrita à nova geração de apresentação Livre com anexo e, desde 27/11, à nova geração Livre social do carrossel com anexo (adendo abaixo). O remix, os carrosséis de estilo fixo, os presets fixos e o Criar rápido seguem seus contratos existentes. Abrir um projeto salvo não recompõe suas páginas. A validação de blocos só preserva foto no novo caso explícito Livre; o comportamento dos estilos fixos permanece protegido.

Os catálogos de composição, texto e imagem não devem ser atualizados para acomodar uma regressão. A tabela mantém 28px nas células e 24px nos cabeçalhos; as mudanças de escala acontecem ao compor o Livre, não ao renderizar indistintamente documentos antigos.

## Validação

O teste `apoteose-teste8-geracao-real.spec.js` começa em uma conta vazia e usa o assistente público. Ele recebe roteiro e redação crus, simula a leitura visual e as imagens, confere os pedidos HTTP, salva, reabre, mede o DOM, captura dez páginas em 1920 × 1080 e exporta um PDF real. Há também um caso de cancelamento após o primeiro lote e recuperação do rascunho. Ele reproduz o plano salvo e comprova as cinco fotos previstas e sua integração; não demonstra que o planejador real escolherá novas cenas melhores nem que a leitura real descreverá corretamente o flyer. A regressão do Teste 7 continua cobrindo timeout de imagem, recuperação, tabela, arte e uma direção explícita sem grão nem grafismos.

### Resultados e evidências

| Verificação | Resultado |
|---|---|
| Vitest completo, incluindo os novos contratos de visão, cache, transporte e contraste | 480 arquivos; 9.805 testes aprovados e seis falhas esperadas declaradas na suíte; 47,11s. |
| Análise estática | 285 arquivos sem identificador indefinido; props consistentes em 171 componentes; nenhum botão de ícone sem rótulo no verificador estático. |
| Projetos V2 no modo de produção, acrescido de Testes 7/8 e Livre social | 68 cenários aprovados, sem repetição automática; 3,8min. Inclui salvamento, recuperação, concorrência entre abas e geração completa. |
| Execução geral após a última correção | 369 cenários aprovados, 24 ignorados por configuração, nenhuma falha e nenhuma repetição automática; 12,9min. A primeira rodada teve três falhas no oracle de referência do Teste 7, descritas abaixo e resolvidas nesta execução final. |
| Teste 8 no navegador | Dez páginas renderizadas, cinco fotos previstas chegando ao HTTP, PDF real de dez páginas, salvamento/reabertura/regeneração e recuperação de lote cancelado. Uma leitura visual por geração; regenerar a foto reutiliza a análise persistida. |
| Geometria medida do Teste 8 | Foto do público ocupa 30,78% da página, ante 13% no documento observado. Foto da música ocupa 13,61%, sem interseção com os ícones. Sete pares completos, células a 28px e cabeçalhos a 24px. |
| Contraste real do rascunho reaberto | Corpo preto sobre branco: 21:1, opacidade 1, glifos presentes, sem corte pela zona ou pelo card. |
| Inspeção visual nativa | Teste 7: 41 PNGs de 1920 × 1080, com 14 imagens distintas abertas individualmente e 27 duplicatas verificadas por SHA. Teste 8 V2: 13 PNGs; sete diferentes abertos individualmente e seis idênticos aos já inspecionados. Teste 8 legado final: 13 PNGs; seis diferentes abertos e sete idênticos ao V2. Nenhuma imagem pendente. |

As três falhas da primeira execução geral eram 14 asserções do mesmo oracle por cenário: ele reconhecia somente a frase antiga da política de referências. Os prompts HTTP continham a regra nova completa. O parser foi corrigido por TDD — 11 falhas e cinco aprovações antes, 16 aprovações depois — e exige todas as cláusulas sobre identidade, cena, direção escrita, meio e composição. Ele também rejeita políticas duplicadas. As verificações de papéis, mapa, anexos, ordem e bytes foram preservadas; os três cenários passaram tanto no gate V2 quanto na execução geral final.

O TDD também registrou os defeitos de geometria, a limpeza indevida da foto após o planejamento e a perda do registro visual durante a migração de referências. A bateria final inclui esses casos. No contraste, os três casos inicialmente vermelhos passaram e os três controles de compatibilidade continuaram aprovados; as regressões de contraste cobriram 175 testes. Esses números focais não devem ser somados ao total da suíte completa.

Os três catálogos de composição, texto e imagem permanecem idênticos por SHA256 tanto a `7cc1106` quanto a `c188ac7`. A compatibilidade dos quatro prompts de apresentação fixa também está protegida por hashes. Os testes simulados comprovam integração, geometria, conteúdo e persistência. A equivalência artística com as sete imagens fornecidas depende de uma geração real posterior, autorizada pelo João, com o mesmo briefing e o mesmo flyer. O cenário sem grafismos verifica a instrução no HTTP; seus pixels são uma arte local simulada e não comprovam obediência estética do gerador real.

### Reprodução

Os comandos abaixo usam APIs simuladas. O servidor do Playwright roda na porta 4173, com uma única instância por vez.

```bash
npm test
npm run check:a11y
CI=1 VITE_PROJECTS_V2=false npx playwright test --retries=0
CI=1 VITE_PROJECTS_V2=true npx playwright test \
  tests/e2e/projects-v2.spec.js \
  tests/e2e/projects-v2-outbox-fallback.spec.js \
  tests/e2e/save-after-deploy.spec.js \
  tests/e2e/plano-gratis.spec.js \
  tests/e2e/project-creation-flow.spec.js \
  tests/e2e/modo-livre-geracao-real.spec.js \
  tests/e2e/apoteose-teste8-geracao-real.spec.js \
  tests/e2e/social-free-geracao-real.spec.js --retries=0
```

A configuração do navegador executa o build antes dos testes. Para conservar as capturas do Teste 7 fora da saída padrão, definir `QA_PHASE` e `QA_OUTPUT_DIR`; o Teste 8 sempre conserva suas capturas em `testInfo.outputPath`, ou no destino indicado por `QA_TESTE8_OUTPUT_DIR`. Os registros de inspeção desta entrega são `revisao-nativa-a7.json` e `revisao-visual-comparada.json`, junto das capturas da rodada V2. O último inclui os hashes atuais/anteriores e a medição de contraste do rascunho.

A revisão legada final está em `revisao-visual-legado-final.json`: todos os campos editoriais dos dez slides são iguais aos do V2 e a prova do corpo no DOM confirma novamente contraste 21:1, opacidade 1 e ausência de corte. A comparação de PNGs conserva as diferenças reais de pixels, sem normalizar ou retocar as capturas para torná-las iguais.

### Avaliação após a publicação

A próxima geração real deve usar o mesmo material e o mesmo flyer para permitir comparação. Conferir a qualidade das cenas e das pessoas, o tratamento de pele/tecido/grão, a proporção de fotografia e grafismos e o espaço de texto em cada imagem. Conferir também se as fotos planejadas estão presentes e se a apresentação exporta inteira. A análise de referência e as decisões de cena do modelo real ainda não foram exercitadas com cobrança nesta entrega. As imagens e composições já gravadas na Apoteose 8 não são substituídas ao abrir o projeto.

## Entrega e publicação

O ramo de entrega é `codex/apoteose8-regression-fixes`, descendente de `7cc11069ee16f1ecc853047ab54728b35fe4ed31`. O bundle incremental permite importar o ramo sem mudar o checkout atual. Antes de publicar, conferir o bundle e se a main remota ainda é ancestral do ramo; o envio deve ser fast-forward, sem `--force`. Mudanças locais no checkout não precisam ser descartadas para importar ou enviar o ramo.

Push na main depende da aprovação explícita para este envio, conforme o handoff fornecido pelo João. A publicação automática só pode ser considerada concluída após conferir os três jobs do CI e a Vercel apontando para o mesmo commit. Não há deploy manual, escrita no banco, geração paga ou leitura de segredos nesta entrega.

## Adendo — Livre social do carrossel (27/11/2026)

A mesma leitura passou a valer para o carrossel no modo **Livre: o Moont decide** (`social_free`), nos formatos Feed 4:5, Quadrado 1:1 e Stories 9:16. O ramo é `claude/livre-social-referencia`, a partir de `389b7af`.

- **Quando lê:** nova geração Livre social com anexo no kit (`readsReferenceVisuals`, `src/utils/reference-visual-scope.js`). Uma chamada `glm-4.6v` via `/api/ai/compatible`, com o mesmo contrato, transporte, limites, cache por SHA dos bytes e erros. A aplicação enviada descreve o formato real (por exemplo, `Carrossel social 9:16, 1080 × 1920`); trocar o formato muda o contexto do cache e pede outra leitura. Remix, estilos fixos e Criar rápido não leem.
- **Roteiro:** a análise validada entra como dados no contrato `buildSocialFreePrompt`, na mesma redação do roteiro social; a revisão não a repete. Sem leitura válida, o contrato social fica byte a byte igual ao anterior.
- **Plano:** `normalizeSocialFreePlan` guarda a análise normalizada em `doc.socialPlan.referenceVisualAnalysis` (não em cada card). O kit guarda o registro com os hashes, como na apresentação.
- **Foto:** síntese + cena + composição pelas zonas reais do card no formato (`COMPOSITION (social card 1080 × H, razão…)`), política de referência analisada e restrições da leitura no AVOID. Como na apresentação, `visualDirection.finish`, `atmosphere` e `avoid` do roteiro saem do pedido quando há leitura; as exclusões de cada card permanecem.
- **Arte:** `direction.background` (superfície e grafismos), sem a síntese fotográfica, com a composição da arte compartilhada do formato.
- **Reabrir e regenerar:** `referenceVisualAnalysisForSavedPlan(doc.socialPlan, kit)` reutiliza a leitura persistida, sem nova chamada.
- **Erro:** leitura incompleta ou ilegível interrompe antes do roteiro e das imagens.

O Livre social não tem recuperação de lote cancelado como a apresentação; esse caminho não foi criado aqui. Os catálogos `image-prompt-catalogo-final.json` e `prompts-carrossel-catalogo-2211.json` e a linha de base de composição do carrossel ficaram idênticos.
