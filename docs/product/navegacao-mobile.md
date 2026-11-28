# Navegação no celular — menos coisa na tela, card primeiro

**Status:** primeira parte implementada em 2026-11-19, a pedido do João ("deixar no mobile o card grande na tela; jogue as coisas pra cima e aperte o espaço; ao abrir caixa de edição, um preview do card em miniatura"). O resto da proposta (barra inferior única, menu "⋯" do card) segue aguardando aprovação.

### Feito em 2026-11-19

| Medida em 390×844 (feed 4:5) | Antes | Depois |
|---|---|---|
| Início do card | y=352 | y=193 |
| Tamanho do card | 330×413 | 366×458 |
| Alvos de toque abaixo de 44 px na primeira dobra | 30 | 22 |
| Stories com contexto ativo | card cortado embaixo | card inteiro (254×451) |
| Painel de edição aberto | card cortado pelo painel | miniatura do card inteiro acima do painel |

- Topo em duas linhas finas: projetos · nome e gravação · Gerar · perfil; depois modo, biblioteca, IA e formato (só a proporção: 4:5, 1:1, 9:16, 16:9). Saíram a logo e "Sem cliente definido".
- Faixa "Contexto ON" em uma linha, só informativa (27/11/2026: o desfazer dela saiu; era o mesmo histórico do botão da fila).
- Desfazer e refazer ficam à direita da fila de miniaturas dos cards (23/11/2026). Desde 27/11 o desfazer é um botão só, escrito "Desfazer", com 44 px e estado desabilitado tracejado ("Nada para desfazer"); o Refazer fica ao lado, em ícone de 44 px. O mesmo componente (`HistoryButtons`) é o do topo no desktop. As duas linhas do topo não têm folga a 360 px; com o painel aberto a fila some e o aviso da ação traz o próprio botão "Desfazer", que usa o mesmo histórico.
- Barra de zoom e "Card 1/5" saíram do celular: troca de card pela fila e pelo deslize, zoom pela pinça; o indicador "Ajustar · N%" aparece só fora de 100%.
- Pinça sobre texto ou sobre a foto selecionada (27/11/2026, confirmado com o João: a barra fica fora): é só zoom da tela. O arrasto que o primeiro dedo começou é cancelado quando o segundo chega e o elemento volta à posição do início do gesto. Teste: `tests/e2e/pinca-nao-move-texto.spec.js`.
- O card ocupa a largura e, em formato alto, cabe na altura livre.
- Foto no card (27/11/2026): tocar seleciona sem abrir o painel (o painel encolhia o card). Com a foto selecionada, um dedo move a moldura, as alças mudam o tamanho e o duplo toque entra no recorte (um dedo enquadra, a pinça dá zoom na foto, não na tela). Fora do recorte, a pinça continua sendo o zoom da tela. Testes: `tests/e2e/foto-moldura-toque.spec.js` e `tests/e2e/foto-moldura-recorte.spec.js`.
- Com o painel aberto, a área acima dele mostra o card em miniatura, que acompanha a edição; tocar nela fecha o painel.
- Tabela, métricas e passos do slide (28/11/2026): no celular um toque na célula entra na edição e abre o teclado; com mouse continua o duplo clique. O duplo toque do iPhone não chega como duplo clique. Teste: `tests/e2e/tabela-toque-edita.spec.js`.
- Card no iPhone e no iPad (28/11/2026): reduzido com `transform`, não com `zoom`. Com `zoom` o iOS aumentava sozinho a letra do texto corrido (subtítulo e tabela saíam maiores e cortados na tela, diferentes do arquivo, e a célula em edição crescia mais). Regra em `src/utils/preview-scale.js`; conferido no Safari do Simulador iOS.
- Celular deitado (27/11/2026; altura até 500 px e largura maior que a altura, ex.: 844×390 e 932×430): o topo vira uma linha com Gerar, Desfazer, Refazer, formato e "Ferramentas"; faixa de contexto, abas, miniaturas e Exportar ficam atrás de "Ferramentas" (abre e recolhe). O card cabe inteiro na altura livre. Teste: `tests/e2e/celular-deitado.spec.js`.
- Testes: `tests/e2e/navegacao-mobile.spec.js`. Capturas: `docs/mobile-nav/depois/` e `docs/mobile-nav/antes-depois-*.png` (agora com o app real, não a maquete).
**Data:** 2026-11-18 · **Base:** `main` em `4257738`
**Pedido:** "vamos melhorar a navegação mobile, tá muito cheio de coisas e confuso, difícil de usar."

## 1. Inventário (capturas reais, 390×844)

Roteiro: `tests/e2e/inventario-mobile.spec.js` (fora do portão; roda com `MOONT_INVENTARIO=1`). Capturas e medidas em `docs/mobile-nav/antes/`. Projeto de teste com 5 cards (texto sem sombra, como os cards criados pelo app), conta do plano Criador, `/api` simulado.

| Tela | Alvos de toque visíveis | Abaixo de 44 px | Card |
|---|---|---|---|
| Início da conta | 9 | 0 | — |
| Editor, Criar rápido | 39 | 30 | 330×413, começa em y=352 |
| Editor, Controle profissional | 43 | 30 | 330×413, começa em y=314 |
| Painel Ajustes aberto | 55 | 31 | coberto em parte pelo painel |
| Painel Texto (profissional) | 51 | 33 | coberto em parte pelo painel |
| Menu Exportar | 47 | 30 | — |

Rolagem horizontal da página: nenhuma nas 12 telas.

### O que empilha acima do card (Criar rápido)

| Faixa | y (px) | Conteúdo |
|---|---|---|
| 1 | 12–52 | Casa · logo · Gerar · Perfil |
| 2 | 56–108 | Nome do projeto · "Sem cliente definido" · estado de gravação |
| 3 | 118–158 | Modo · Biblioteca · Configurar IA |
| 4 | 172–204 | Feed · Quadrado · Stories · Apresentação |
| 5 | 229–285 | Miniaturas + adicionar |
| 6 | 298–342 | Card anterior · Card 1/5 · próximo · zoom − 100% + · tela cheia |

São 352 px, 42% da altura, antes do card. O card cabe inteiro na primeira dobra, mas ocupa 41% da área da tela.

### Repetições

- **Ir aos projetos, 4 vezes:** casa no cabeçalho, livro "Abrir biblioteca", aba Início da barra, "Projetos" no rodapé do painel.
- **Exportar, 2 vezes:** barra inferior e rodapé do painel.
- **Estado de gravação, 2 vezes:** faixa 2 e rodapé do painel.
- **Trocar de card, 2 vezes:** miniaturas e "Card 1/5" com setas.
- **Abas, 2 vezes:** a barra inferior abre um painel que tem outra fileira de abas (2 no Criar rápido; 6 em grade 3×2 no profissional).
- **A barra inferior muda com o modo:** Início · Ajustes no Criar rápido; Narrativa · Texto · Imagem · Mais no profissional.

### Ocupam lugar fixo e são de uso raro

Formato (faixa 4), zoom (metade da faixa 6; a pinça já funciona), modo, Configurar IA, e a barra de seis ícones de 36 px abaixo do card no profissional (tela cheia, legenda, excluir, baixar, grade, qualidade).

### Alvos pequenos

Formato 85×32 · modo 52×34 · botões do cabeçalho 40×40 · ações do card 36×36 · aumentar e diminuir caixa de texto 26×26.

## 2. Proposta

Antes e depois, lado a lado: `docs/mobile-nav/antes-depois-primeira-dobra.png` e `docs/mobile-nav/antes-depois-editar-texto.png`. O "depois" é maquete (`docs/mobile-nav/proposta/maquete.html`), não o app.

1. **Uma faixa de 56 px no topo:** voltar aos projetos · nome do projeto · Exportar. Exportar é a ação principal e aparece uma vez.
2. **O nome do projeto abre a folha "Projeto":** renomear, cliente, formato, modo, Configurar IA, gravação e backup. O que hoje são as faixas 2, 3 e 4 vira uma folha aberta sob demanda. Estado de gravação fica como ponto e palavra sob o nome; aviso de pendência continua visível quando houver.
3. **Card logo abaixo, maior:** começa em y=68 e passa de 330×413 para 362×452.
4. **Miniaturas abaixo do card.** Somem "Card 1/5" e as setas: troca-se de card deslizando ou tocando na miniatura. Zoom fica na pinça; um botão "ajustar à tela" aparece só quando o zoom não está ajustado.
5. **Ações do card num "⋯"** no canto do card: tela cheia, legenda, duplicar, excluir, baixar, grade.
6. **Barra inferior fixa, igual nos dois modos:** Texto · Estilo · Imagem · Criar com IA · Mais. O modo muda o que os painéis mostram, não a navegação.
7. **Painel sem segunda fileira de abas e sem rodapé repetido:** título, fechar e o conteúdo. O card encolhe para continuar inteiro acima do painel.
8. **Todo alvo com 44 px ou mais.**

| Medida | Antes | Depois |
|---|---|---|
| Faixas acima do card | 6 | 1 |
| Início do card | y=352 | y=68 |
| Tamanho do card | 330×413 | 362×452 |
| Alvos na primeira dobra | 39 | cerca de 16 |
| Alvos abaixo de 44 px | 30 | 0 |
| Lugares para exportar | 2 | 1 |

### Ligação com o plano grátis

"Criar com IA" é o ponto único que leva à assinatura no grátis. Vale decidir junto: o item continua na barra para o grátis (convite permanente) ou some.

## 3. Entrega em três envios

| Envio | Conteúdo |
|---|---|
| A | Topo de uma faixa, folha "Projeto", card e miniaturas na nova ordem |
| B | Barra inferior única e painéis sem abas repetidas |
| C | Menu "⋯" do card, zoom sob demanda, alvos de 44 px no que sobrar |

Cada envio com antes e depois em capturas reais, conferidas em tamanho cheio. O roteiro de inventário vira teste de regressão em 390 px: sem rolagem horizontal, alvos de 44 px ou mais, card na primeira dobra, e os quatro fluxos (abrir, editar texto, trocar estilo, exportar).

## 4. Decisão do João

Aprovar a proposta visual antes da implementação. Pontos em que a escolha é sua:

| # | Ponto | Recomendação |
|---|---|---|
| D1 | Formato, modo e Configurar IA saem da tela e vão para a folha "Projeto" | Sim; são trocas raras |
| D2 | A mesma barra inferior nos dois modos | Sim; hoje ela muda e desorienta |
| D3 | "Criar com IA" na barra, com Exportar no topo | Sim; alternativa é IA no topo e Exportar na barra |
| D4 | Tirar zoom e setas de card da tela | Sim; pinça e deslize cobrem |

## 5. Riscos

- O cabeçalho e a barra vivem no monólito `ViralCarrossel.jsx` (linhas 7609–7800 e 8669–8728) e muitos testes de navegador dependem dos nomes atuais dos botões. Renomear quebra testes; o plano é manter os nomes acessíveis onde der e atualizar os testes no mesmo envio.
- O tour de primeira visita aponta para elementos que mudam de lugar.
- A maquete usa fonte do sistema e não reproduz o card real; serve para decidir a estrutura, não o acabamento.
- Não capturei iPhone real nem Safari; as capturas são do Chromium em 390×844 com toque emulado.

## 6. Pronto quando

Abrir projeto, editar texto, trocar estilo e exportar cabem sem rolagem horizontal, com alvos de toque de 44 px ou mais; o card aparece na primeira dobra; há testes de navegador em 390 px; portão completo verde.
