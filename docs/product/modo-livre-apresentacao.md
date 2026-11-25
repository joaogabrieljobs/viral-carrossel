# Modo livre de apresentação ("O Moont decide")

Decisões do João (25/11/2026):

- **Como cria:** a IA age como diretora de arte, escolhendo para cada página entre as composições que o app já sabe desenhar, mais variações novas. Nada de HTML livre: tudo fica editável no app e o PDF sai igual à tela.
- **Cores e fontes:** vêm do kit da marca quando existem. Sem kit, a IA propõe uma paleta e um par de fontes a partir do briefing e da referência, e mantém os dois no deck inteiro.
- **Custo:** a direção de arte vem dentro do roteiro, sem pedido extra à IA e sem uso a mais da cota.
- **Fora deste ciclo:** carrossel. O Criar rápido continua com o estilo sugerido pela rota.

## O que a pessoa vê

No seletor de estilo da apresentação (assistente de criação, GenerateModal e Gerar de novo), o primeiro cartão é **"Livre: o Moont decide"**. Com ele, cada página tem a sua composição. Variam:

- o fundo: claro, superfície, escuro, cor de destaque ou foto inteira;
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
- `ground`: `bg`, `surface`, `inverse`, `accent` ou `photo`.
- `photo`: `none`, `small`, `half` ou `full`. Com `none`, nenhuma imagem é gerada naquela página.
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
