# Apresentações: direção visual e contrato de implementação — 19/11/2026

Pedido: apresentações com qualidade de design, variação de fontes, composição, posição da foto, peso, hierarquia e espaçamento. A rodada dos 16 modos continua depois desta revisão visual.

## Diagnóstico

O catálogo já contém dez direções e fontes distintas. A adaptação do roteiro reduz essas direções a cinco famílias; dados, premium e executivo acabam próximos. Ela ainda fixa corpo, entrelinha e tracking, limita o display e usa o mesmo tratamento de evidência para todos. Mais opções no catálogo, sozinhas, não resolvem a aplicação.

## Referências e interpretação

- Duarte, Glance Test: https://www.duarte.com/resources/guides-tools/the-glance-test/ — mensagem central perceptível rapidamente; contraste, unidade e espaço com função.
- Google Fonts, combinação por construção: https://github.com/google/fonts/blob/main/cc-by-sa/knowledge/modules/choosing_type/lessons/pairing_typefaces_based_on_their_construction_using_the_font_matrix/content.md — diferenças deliberadas de desenho, mantendo compatibilidade.
- Carbon, tipografia expressiva/produtiva: https://www.carbondesignsystem.com/building-blocks/foundations/typography/style-strategies — escalas e pesos conforme o trabalho de cada texto.
- Microsoft: https://support.microsoft.com/en-US/PowerPoint/tips-for-creating-and-delivering-an-effective-presentation — leitura à distância, contraste e visual a serviço da mensagem.

Estas referências orientam critérios; as composições do Moont são implementação própria.

## Plano visual antes da implementação

| Família | Tipografia existente a preservar | Composição e assinatura |
|---|---|---|
| Executivo | Inter Tight + Inter | Título conclusivo, coluna curta de leitura e fotografia ampla; fecho em alinhamento lateral |
| Editorial | Playfair Display + Source Serif 4 | Foto na esquerda, manchete e texto em coluna; fios editoriais discretos |
| Dados | IBM Plex Sans + Plex Mono | Título compacto e evidência dominante; valores tabulares, unidades próximas |
| Suíço | Archivo + Inter | Grade assimétrica, títulos de peso alto e fotografia em módulo quadrado |
| Cinemático | Bebas Neue + Inter | Título condensado expressivo e foto larga, texto com superfície própria |
| Tipográfico | Anton + Space Grotesk | Palavra/tese dominante, contraste de escala e alternância lateral |
| Modular | Plus Jakarta Sans | Blocos agrupados em superfícies suaves; etapas com títulos claros |
| Ensaio fotográfico | Cormorant Garamond + Jost | Fotografia dominante e legenda editorial curta, sem esmagar o assunto |
| Técnico | JetBrains Mono + IBM Plex Sans | Regras de alinhamento, rótulos discretos e diagramas editáveis |
| Premium | Cormorant + Manrope | Título com contraste de desenho, ritmo amplo e evidência contida |

Crítica do plano: não acrescentar ornamento para disfarçar texto repetido. As fotos não substituem dados. Os layouts devem continuar diferentes sem depender de uma foto e respeitar ajustes manuais. Famílias condensadas mantêm peso real; parágrafos não recebem uppercase ou tracking de rótulo. Destaques servem a números, condições ou ideias concretas, nunca ao parágrafo inteiro.

## Critérios de verificação

- Mesmos textos em antes/depois; nenhuma informação apagada para caber.
- Dez famílias reconhecíveis, inclusive nas páginas de conteúdo e evidência.
- Separação geométrica de título, argumento, evidência e foto; margens consistentes.
- Contraste e tamanho de leitura preservados. Sem negrito sintético em fontes de peso único.
- Preview e exportação usam o mesmo renderer; fotos continuam proporcionais.
- Testes simulados não equivalem a qualidade aprovada por geração real.

## Implementação desta rodada

- Dez famílias reconhecidas separadamente; grade própria com e sem fotografia, por função da página.
- Corpo tipográfico e números compilados do catálogo existente. Argumentos usam a fonte de leitura; capas mantêm o desenho, o peso e o tracking da fonte display. Ajuste de título em passos menores, considerando famílias condensadas.
- Após conferir as capturas da CI, o corpo de leitura recebe peso mínimo 400; o peso leve de uma legenda fotográfica não passa automaticamente para um argumento longo. Títulos de display mantêm o peso próprio, inclusive 300/400 quando esse é o desenho da família.
- Conversão do tracking usa a mesma base da família no compilador e no renderer. Antes, a base fixa de −3 do compilador não correspondia à base +1,5 de Anton/Bebas no renderer; o espaçamento final abria 0,045 em além do previsto.
- Colunas estreitas e baixas recebem orçamento menor na redação. O texto de projetos existentes não é cortado para caber.
- Quando a revisão acrescenta um argumento completo, a diagramação é recalculada para dar largura à leitura e manter uma área separada para a foto. O primeiro E2E do commit `713e9c1` mostrou que validar o argumento maior contra a coluna estreita segurava as imagens como conteúdo pendente; o teste continua exigindo seis imagens e texto completo.
- Comparações com hierarquia de cabeçalho e primeira coluna; indicadores com valores tabulares e escala maior; etapas com agrupamento visual, sem numeração duplicada nos casos A–E.
- Regras gráficas discretas próprias das famílias; foto continua em superfície separada. Apoio em apresentação mantém opacidade plena.
- Contador da apresentação vira fólio discreto no rodapé da superfície de leitura, em vez da cápsula grande sobre a foto. Se o rodapé da marca já está ocupado, preserva a posição anterior; a opção de ocultar o contador continua valendo.
- Instruções de negrito pontual e de ritmo em todos os sete caminhos, incluindo Pitch; revisão preserva marcação interna sustentada, sem Markdown externo ao JSON.
- Novas gerações e reaplicação de preset nos decks planejados recebem a direção. Projetos salvos não são alterados em massa.

## Evidências e limites

- Testes focados de composição, tipografia, compilação e renderer: 54 aprovados; os 16 testes de direção e Pitch também passaram depois do ajuste do critério de leitura para pixels reais.
- Suíte final: 2.667 aprovados, 4 falhas esperadas, 224 arquivos. A primeira execução neste worktree expôs um vínculo de `node_modules` antigo sem PGlite e uma expectativa antiga de tamanho percentual; o vínculo passou a usar dependências com o mesmo hash de lockfile. Não se afrouxou o limite de tempo da suíte.
- Galeria independente gerada pelo renderer real, com seletor dos dez presets, cinco páginas e versões Antes/Depois: `/Users/elevessy/Documents/viral-carrossel/REDESIGN-APRESENTACOES-19-11-2026/GALERIA-APRESENTACOES.html`. Os dois arquivos JavaScript ao lado precisam permanecer juntos.
- Construção da galeria e sintaxe dos bundles verificadas. A galeria não é uma captura de navegador: a automação de abas ficou indisponível neste chat, e a tentativa de usar a janela nativa do Chrome retornou `cgWindowNotFound`. Foram conferidas capturas da CI para Executivo, Cinemático, Ensaio Fotográfico e Modular no commit 713e9c1, usando os mesmos textos e fotografia do controle. A inspeção do catálogo interativo e o reteste real dos 16 modos continuam pendentes. A CI dessa versão aprovou 301 cenários e revelou a falha do Pitch descrita acima; os ajustes posteriores exigem nova CI.
