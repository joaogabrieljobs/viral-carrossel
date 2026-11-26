# Modo livre de apresentação ("O Moont decide")

Decisões do João (25/11/2026):

- **Como cria:** a IA age como diretora de arte, escolhendo para cada página entre as composições que o app já sabe desenhar, mais variações novas. Nada de HTML livre: tudo fica editável no app e o PDF sai igual à tela.
- **Cores e fontes:** vêm do kit da marca quando existem. Sem kit, a IA propõe uma paleta e um par de fontes a partir do briefing e da referência, e mantém os dois no deck inteiro.
- **Custo:** a direção de arte vem dentro do roteiro, sem pedido extra à IA e sem uso a mais da cota.
- **Fora deste ciclo:** carrossel. O Criar rápido continua com o estilo sugerido pela rota.

## O que a pessoa vê

No seletor de estilo da apresentação (assistente de criação, GenerateModal e Gerar de novo), o primeiro cartão é **"Livre: o Moont decide"**. Com ele, cada página tem a sua composição. Variam:

- o fundo: claro, superfície, escuro, cor de destaque, foto inteira ou arte abstrata da identidade;
- a cor do texto;
- o tamanho da foto: sem foto, pequena, metade ou tela cheia;
- o bloco: tabela, métricas, passos, citação, número grande ou ícones;
- a família de layout: as 10 famílias servem de biblioteca.

O deck mantém uma paleta e um par de fontes, para não virar colagem. Depois de gerar, a pessoa edita como em qualquer apresentação. Trocar para um preset comum recompõe o deck como hoje.

## Contrato de dados

O roteiro ganha a versão 3, que só vale com o modo livre. O v2 continua igual para os outros presets.

`deckDesign`, uma vez por deck:

- `palette`: `bg`, `surface`, `ink`, `muted`, `accent`, `accent2`, `inverse` e `inverseInk`, todos em hex.
- `fonts`: `display` e `text`, só da biblioteca local de 20 fontes (`presentation-font-manifest.js`).
- `mood`: uma frase que guia a foto.
- Com kit: as cores e fontes do kit substituem as propostas. A IA só completa o que faltar.

`design`, por slide (enums fechados):

- `family`: uma das 10 famílias, de onde vem a geometria.
- `ground`: `bg`, `surface`, `inverse`, `accent`, `photo` ou `art`.
- `photo`: `none`, `small`, `half` ou `full`. Com `none`, a geração automática não pede foto para aquela página. A arte de fundo é um recurso separado, compartilhado pelo deck.
- `block`: `none`, `comparison`, `metrics`, `steps`, `quote`, `bignumber` ou `icons`.
- `emphasis`: até 3 trechos do texto que saem em negrito com a cor de destaque (`**…**`).
- `icons`: até 4 nomes de uma lista fechada de ícones lucide, só quando `block` é `icons`.

## Regras garantidas em código, não pela IA

Valor fora do enum, hex inválido ou fonte fora da biblioteca: o código corrige para o valor mais próximo permitido. Não há novo pedido à IA.

1. **Contraste:** texto e fundo com contraste mínimo de 4,5:1. A tinta é recalculada pelo fundo, como `groundInks`.
2. **Ritmo:** nunca 3 páginas seguidas com a mesma geometria. Nunca 2 seguidas com a mesma família e o mesmo tipo de página. O deck usa pelo menos 3 fundos diferentes e pelo menos 3 tamanhos de foto diferentes, quando o roteiro tem páginas suficientes.
3. **Leitura:** valem os mesmos pisos de hoje: 25 px nas colunas, apoio que ocupa a coluna e zonas seguras.
4. **Bloco sem dado:** um bloco que o roteiro não sustenta cai para `none`. Exemplos: tabela sem evidência, número grande sem número no material.
5. **Capa e fecho** continuam com o papel e a referência do kit (referência em todas as imagens, só pelo visual).
6. **Projeto salvo** não é recomposto ao abrir.
7. **Sem roteiro v3:** trocar para o modo livre num deck já existente usa um **diretor de arte determinístico** em código. Ele aplica as mesmas regras, sem IA e sem custo.

## Renderização

- **Família por slide:** a família passa a ser entrada da composição (`slide.presentationDesignFamily`). Hoje ela vem do preset do deck.
- **Fundo e destaque por slide:** vêm da paleta do deck (`paletteOverrides` com `deckDesign`), não de `brand.accent`. `customBg` é gravado por slide.
- **Ritmo:** compara geometrias entre famílias.
- **Blocos novos:** `quote`, `bignumber` e `icons`, os ícones como SVG inline que o html2canvas captura. Eles entram em `normalizePresentationBlocks`, `hasBlocks` e nas auditorias de exportação.
- **Foto:** a direção de foto do deck usa `deckDesign.mood` e a paleta, não a luz de uma família.

## Fases

1. **Base:** preset virtual `presentation_free`; família, fundo e paleta por slide; diretor determinístico; validador. Testes com o deck Apoteose.
2. **Roteiro v3** com `deckDesign` e `design`, pedido e reparo, e o cartão no seletor.
3. **Blocos novos:** citação, número grande e ícones.
4. **Conferência:** visual e de navegador (10 páginas, Automático e Pitch, com e sem kit), PDF, e só então o pedido de publicação.

## Fora de escopo

Carrossel, Criar rápido, editor visual de "trocar layout desta página" e auditoria de imagem.

## Adendo — 26/11/2026: Teste 7

Este adendo registra a correção da geração completa do Teste 7 da Apoteose. O contrato vale desde o roteiro até o slide final, a renderização e o projeto salvo. Um campo correto no roteiro ou no resultado de uma função isolada não comprova que a página chegou correta ao editor.

### Direção de arte e texto final

- **Família vinculante:** quando `design.family` é válida, a composição usa essa família. A preferência por limitar o número de famílias do deck não pode trocar silenciosamente a escolha. Se uma regra obrigatória de ritmo ou variedade impedir a família pedida, a troca fica em `presentationFreeDesignOverride`, com `fromFamily`, `toFamily` e `reason` (`rhythm_family_kind`, `rhythm_geometry` ou `rhythm_variety`). O preset virtual Livre é aplicado antes de compor a geometria, inclusive quando o slide veio de um preset comum.
- **Eyebrow no slide final:** `finishFreeDraft` mantém o rótulo escrito e completa os vazios das páginas após a capa, usando tema ou função editorial, sem acrescentar fatos. A derivação procura primeiro o tema do título e só depois o apoio, para uma menção incidental a música não consumir o rótulo da página musical. `O ENCONTRO` exige encontro ou reunião no título. No Teste 7, a sequência é `O ENCONTRO` no slide 4, `A MÚSICA` no 5 e `O PÚBLICO` no 6. A montagem do documento copia o resultado para `slide.eyebrow`; o campo não pode se perder entre o rascunho e a composição. Uma restauração de foto também preserva o lugar desse rótulo.
- **Personalidade em sete pares:** a comparação é extraída do texto existente, inclusive listas em minúsculas após dois-pontos e pares separados por vírgulas ou ponto e vírgula. Uma vírgula só separa linhas quando o trecho seguinte começa outro par reconhecível. A variante Livre `comparison/pairs` aceita de 3 a 7 pares; não cria conteúdo para cumprir `design.block`. A introdução e o restante do apoio vão para as notas do apresentador. Outros blocos já escritos são preservados. Ao sair do Livre, o limite comum de 5 linhas continua valendo e os pares excedentes voltam ao apoio.
- **Sem rótulos narrativos da família:** `freeNeutralChrome` remove `CENA`, `FIG.`, `TAB.`, `NOTA`, `FIM`, `§` e os adornos numéricos próprios das famílias. O filtro vale tanto na composição inicial quanto em `restorePresentationPhotoComposition`; não basta que o objeto salvo esteja limpo se a renderização recria o adorno. O fólio normal do deck continua disponível.

O acabamento Livre acontece após a redação e **antes de calcular os limites do texto e pedir a revisão editorial**. O revisor recebe os sete pares como tabela, com o apoio já vazio, evitando uma infração sobre o parágrafo que deixou de existir. A validação de escrita e revisão conserva `variant: 'pairs'` somente com `freeDesign: true`; continua exigindo duas colunas, ressalvas iniciadas por “sem” e no máximo sete linhas. Comparações comuns mantêm o teto de cinco. Excesso legítimo em outro slide continua sujeito ao reparo editorial.

Na composição Suíça com arte, o título continua na coluna esquerda e a tabela usa pelo menos 50% da largura, ao lado dele, até o limite de 72% reservado ao texto. Alargar a tabela para a margem esquerda cobria o título. O ajuste conserva a família e a separação entre título, tabela e grafismo; não relaxa a auditoria de sobreposição.

A base de cor segue o contrato do [adendo de direção de arte](direcao-de-arte-imagens.md#adendo--26112026-teste-7): preservação dos pesos da referência, preferência condicional por uma cor escura saturada e prioridade para a base explícita do kit.

### Arte, foto e falha de geração

O diretor reserva de 1 a 3 páginas elegíveis sem foto para a arte da identidade, quando o conteúdo oferece essas páginas. Uma única arte é gerada e reaproveitada; a ausência do arquivo usa a cor base. `presentationFreeDesign.ground: 'art'` decide a camada de arte, enquanto `presentationGround: 'bg'` pode continuar escolhendo as tintas e os adornos da base. Esses dois campos têm funções diferentes. A verificação precisa conferir também o recurso `presentationArtImage*` e a camada desenhada, não apenas o enum do roteiro.

`photo: 'none'` vale para a geração inicial e para os lotes de imagens pendentes, mesmo quando sobrou uma consulta de imagem no slide. Um recurso antigo com `bgImageSource: 'ai'` não reabre sozinho uma área de foto nesse slide. Fotos enviadas, editadas ou de procedência desconhecida continuam visíveis. A ação individual de pedir uma foto pode mudar essa intenção e registra `presentationPhotoRequested: true`.

Quando uma foto planejada falha e não existe mídia no slide, a ação aplica uma composição legível sem foto e guarda `presentationImageFallback`, com o motivo, o desenho original e os campos de composição alterados. Uma arte já disponível no deck pode ser reutilizada. Texto, blocos e mídia não entram no registro das alterações de composição. Slides com posição manual preservam seu layout e recebem somente o registro da falha.

A nova tentativa usa a composição original para orientar a imagem. Quando a foto chega, a recuperação restaura apenas os campos que continuam iguais ao estado automático após a falha: ajustes feitos pela pessoa depois da falha prevalecem. O aviso e o estado de erro acompanham o resultado da ação. Se a pessoa trocou de projeto durante a geração, a mídia e a recuperação são gravadas no projeto de origem, desde que o alvo continue válido. O registro da falha também é salvo; abrir um projeto não dispara essa recomposição.

A importação individual também grava a recuperação junto da troca de mídia, antes de salvar; não depende de uma futura edição nem somente da vista derivada. Os ajustes por formato são mantidos. Uma nova tentativa que falha em um slide legado já marcado com erro pode aplicar o fallback por um evento explícito de falha. A simples reabertura do mesmo slide continua sem recomposição.

### Prova exigida

Os testes unitários da Frente A foram executados em 26/11: 449 arquivos, 9.353 casos aprovados e 6 falhas esperadas, totalizando 9.359 testes em 37,55 segundos. Isso não substitui a prova de navegador.

O teste de geração completa deve abrir o assistente, receber respostas cruas de roteiro e redação da fixture do Teste 7, percorrer o caminho real de montagem, gerar fotos e arte com respostas locais e simular uma falha de foto. Deve conferir o documento final local e remoto, o DOM e as capturas das dez páginas; reabrir o projeto sem alterações; e recuperar a foto pela ação do aviso. Nenhum slide final previamente composto deve ser injetado. A inspeção visual deve confirmar o índigo da identidade, os rótulos editoriais, os sete pares legíveis, a ausência de `CENA`, a arte visível e o slide de falha sem um painel vazio.

**Situação desta revisão:** a geração completa passou nos três cenários do Teste 7 e nos fluxos de persistência legados e V2. A bateria geral terminou com 361 aprovados e 24 ignorados por configuração; a bateria V2, com os cinco arquivos obrigatórios mais o Teste 7, passou nos 60 cenários. As verificações estáticas e o build passaram. As 31 capturas de antes, depois e recuperação foram abertas no tamanho nativo de 1920 × 1080; fotos e arte são ativos de teste. A comparação com o PDF-alvo registra diferenças de tipografia, escala e distribuição que ainda permanecem. Não houve geração paga nem publicação em produção; enviar para a main continua dependendo da aprovação explícita do João.
