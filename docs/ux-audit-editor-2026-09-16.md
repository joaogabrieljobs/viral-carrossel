# Auditoria de UX — Viral Carrossel Studio (editor)

2026-09-16 · 24 capturas (desktop 1440/1280/1100/900/768 + mobile 390×844) · Foco: header, tira de miniaturas, canvas, ações por card, 7 abas em 3 modos, mobile

Método: varredura Playwright do editor em produção-build (`vite preview`) com `/api` mockado — capturas em `/tmp/ui/`, medições de geometria via `getBoundingClientRect` no DOM real. Sobreposição só é reportada quando há intersecção nos **dois** eixos (medir apenas X dá falso positivo quando os controlos estão em linhas diferentes).

Estado dos achados: **corrigido neste ciclo** = já no código; os restantes são recomendação.

## Resumo Executivo

O editor está funcional e visualmente coerente, mas o topo estava literalmente quebrado: o grupo de ferramentas da direita mede 730px e transbordava sobre o CTA principal, cobrindo "Gerar com IA" em todas as larguras testadas — e os avisos (toasts) nasciam no topo-centro, tapando a tira de miniaturas e o topo do card 01. O maior risco de conversão restante é hierarquia: há 5 ou mais botões rosa primários no mesmo ecrã (Gerar com IA, Exportar, Gerar imagem ×3, Ativar composição), o que dilui a ação que gera valor. O maior quick win é a aba inicial da barra lateral — o editor abre em **Marca** (configuração), não em Home/Narrativa, onde está o trabalho.

## Top 5 por Impacto×Esforço

1. **UX-001** — sobreposição do header sobre o CTA (corrigido neste ciclo · esforço baixo)
2. **UX-002** — toasts tapando a tira de miniaturas (corrigido neste ciclo · esforço baixo)
3. **UX-004** — editor abre na aba Marca em vez de Home (esforço baixo)
4. **UX-003** — 5+ primários rosa simultâneos (esforço baixo)
5. **UX-005** — painel "Referência + direção da imagem" sempre aberto em todos os cards (esforço baixo)

## Achados — Severidade Alta

### Header

```
[UX-001] Editor · Responsividade · Severidade: Alta — CORRIGIDO NESTE CICLO
Evidência: header em grid `minmax(0,1fr) auto minmax(0,1fr)`; o grupo direito
(histórico + formato + ferramentas + perfil) mede 730px e transbordava para a
esquerda. Medido: 1440px → "Gerar com IA" × "Desfazer" 28×26px, × "Feed 4:5"
11×29px; 1280px → × "Feed 4:5" 82×29px; 1100px → 6 pares, "Gerar com IA" ×
"Quadrado" 87×29px. Visível na captura 03-editor-com-cards.png: o rótulo do CTA
aparece cortado como "Gerar co…" por baixo da pílula "Feed 4:5".
Impacto: o botão que gera o carrossel fica parcialmente incoberto e por baixo de
outro controlo — clique aterra no controlo errado. Atinge a ação de conversão.
Recomendação: coluna direita com largura de conteúdo (`auto`) em vez de `1fr`;
abaixo de 1200px histórico e formato descem para uma 2ª linha do header; abaixo
de 1000px o atalho "Projetos" do header sai (o rodapé já tem um igual).
Esforço: baixo
```
Aplicado em `ViralCarrossel.jsx:1504-1506` (`headerTight`/`headerVeryTight`), `ViralCarrossel.jsx:3089-3103` (grid e 2 linhas) e `ViralCarrossel.jsx:3230-3240` (grupo histórico+formato). Regressão coberta por `tests/e2e/header-editor.spec.js` — o teste falha com o grid antigo e passa com o novo, em 1440/1280/1100/900/768px.

```
[UX-002] Editor · Feedback visual · Severidade: Alta — CORRIGIDO NESTE CICLO
Evidência: `.toast-stack` em `position: fixed; top: 64px; left: 50%` cobria a
tira de miniaturas e o topo do card 01 (captura 03-editor-com-cards.png: dois
toasts empilhados sobre os slides 01-05).
Impacto: o utilizador perde de vista exatamente o objeto sobre o qual o aviso
fala, e a navegação entre slides fica bloqueada enquanto o toast está no ar.
Recomendação: mover a pilha para o canto inferior direito no desktop e para a
base (acima da barra de abas) no mobile.
Esforço: baixo
```
Aplicado em `src/styles/global-style.js:849-864`.

### Canvas e ações por card

```
[UX-003] Editor · Hierarquia visual · Severidade: Alta
Evidência: no mesmo ecrã (captura 03) há "Gerar com IA" (header), "Exportar"
(rodapé) e "Gerar imagem" em cada um dos 3 cards visíveis, todos no rosa
`var(--accent)` com o mesmo peso; na aba Layout soma-se "Ativar composição",
também primário de largura total.
Impacto: nenhuma ação lidera. O olhar disputa entre exportar (fim do fluxo) e
gerar (início), e "Gerar imagem" — que consome quota paga — tem o mesmo convite
visual que a ação gratuita.
Recomendação: manter só "Gerar com IA" primário; "Exportar" secundário enquanto
o projeto não tiver conteúdo; "Gerar imagem" por card em estilo ghost com ícone;
"Ativar composição" secundário (é opção avançada, não o caminho normal).
Esforço: baixo
```

```
[UX-005] Editor · Carga cognitiva · Severidade: Alta
Evidência: o painel "Referência + direção da imagem" + textarea "Prompt extra
(este slide)" está expandido debaixo de todos os cards ao mesmo tempo — 3 caixas
idênticas com o mesmo placeholder na captura 03, ocupando ~180px por card.
Impacto: duplica a altura da grelha, empurra os cards para fora do ecrã e repete
a mesma instrução 7 vezes num carrossel de 7 slides.
Recomendação: colapsar por omissão num botão "Imagem" por card; abrir só o card
em foco (o mesmo padrão do card selecionado com moldura rosa).
Esforço: baixo
```

### Barra lateral

```
[UX-004] Barra lateral · Padrões de navegação · Severidade: Alta
Evidência: `ViralCarrossel.jsx:1067` — `useState('brand')`. Ao entrar no editor a
aba ativa é "Marca" (captura 03 e 10-*-marca.png), a que trata de @username,
logo e barra editorial.
Impacto: a primeira tela do editor é configuração de identidade, não o trabalho
(tema, narrativa, texto). Quem entra para gerar precisa de 1 clique extra e de
descobrir que existem outras abas.
Recomendação: abrir em "Home" (ou "Narrativa" quando o documento já tem slides) e
guardar a última aba usada por projeto.
Esforço: baixo
```

```
[UX-006] Aba Layout · Clareza · Severidade: Alta
Evidência: captura 10-studio-layout.png — "Zonas redimensionáveis dentro do
card. Ative primeiro abaixo; depois mostre as molduras para clicar direto na área
da foto. Pino de swap troca texto/foto entre cards." O botão de ativar está
ACIMA do texto, não abaixo; e o mesmo conceito aparece com 3 nomes — "composição"
(botão), "canvas" (nota "Disponível depois de ativar o canvas") e "zonas".
Impacto: instrução aponta para o lugar errado e o utilizador não liga o aviso
"ativar o canvas" ao botão "Ativar composição". A funcionalidade mais delicada do
produto (a que move texto e foto) é a pior explicada.
Recomendação: um só termo — "composição". Texto: "Divide o card em áreas que
podes redimensionar: uma para o texto, uma para a foto. Ativa em cima para
começar." Mostrar a nota de dependência só quando estiver desativada.
Esforço: baixo
```

## Achados — Severidade Média

### Barra lateral

```
[UX-007] Barra lateral · Espaçamento · Severidade: Média
Evidência: no modo Studio as 7 abas quebram em 3 linhas (captura
10-studio-layout.png) e "Marca" fica sozinha na 3ª linha; o bloco de abas consome
~145px antes de qualquer conteúdo.
Impacto: menos de metade da altura útil sobra para os controlos; a linha órfã
lê-se como erro de layout.
Recomendação: no modo Studio agrupar em 2 linhas de 4+3 com larguras iguais, ou
converter em barra de ícones + rótulo do ativo.
Esforço: médio
```

```
[UX-013] Aba Layout · Feedback visual · Severidade: Média
Evidência: o toggle "Mostrar zonas no card" tem o mesmo aspeto ativável de
sempre, com a nota cinzenta "Disponível depois de ativar o canvas." por baixo
(captura 10-studio-layout.png).
Impacto: o utilizador clica no toggle e nada acontece — parece defeito, não
pré-requisito.
Recomendação: estado desativado explícito (opacidade + `aria-disabled` + cursor)
e mover a razão para tooltip do próprio toggle.
Esforço: baixo
```

### Header e rodapé

```
[UX-008] Header/Rodapé · Consistência · Severidade: Média
Evidência: o estado de gravação aparece 3 vezes ao mesmo tempo — texto "Salvo
agora mesmo" e botão "Salvar" no header, "✓ Salvo" no rodapé; "Projetos" aparece
2 vezes (header e rodapé). Captura 03.
Impacto: ocupa ~220px do header — a causa direta do aperto do UX-001 — e obriga a
comparar dois indicadores do mesmo facto.
Recomendação: um só indicador de gravação (rodapé, junto a Exportar) e um só
atalho "Projetos"; no header manter apenas o botão "Salvar" (⌘S).
Esforço: baixo
```

### Cards

```
[UX-012] Cards · Estados vazios · Severidade: Média
Evidência: quando a imagem do template não carrega, a caixa "Falha ao gerar —
toque para tentar de novo" é desenhada dentro da área de arte do card, no topo
(captura 03, 3 cards).
Impacto: o erro parece fazer parte do design do slide; e o aviso paralelo diz
"6 imagem(ns) do template não carregou." — linguagem técnica e com concordância
errada, num momento em que o utilizador só quer saber se pode continuar.
Recomendação: chip de erro sobreposto ao canto do card (fora da área de arte) e
copy: "6 imagens do template não carregaram. Toca em tentar de novo."
Esforço: médio
```

### Mobile

```
[UX-010] Mobile · Clareza · Severidade: Média
Evidência: captura 21-mobile-editor.png — a 2ª linha do header tem 3 botões só
com ícone (modo, biblioteca, ajustes) e o estado vazio termina em "? para ver
atalhos", um atalho de teclado, num ecrã de toque.
Impacto: gasta linha vertical com afordância impossível e deixa 3 ferramentas
sem nome — o chip de modo mostra apenas ícone + seta, sem dizer "Criador".
Recomendação: esconder a dica de atalhos abaixo de 768px e mostrar o nome do
modo no chip.
Esforço: baixo
```

## Achados — Severidade Baixa

```
[UX-014] Modal Templates · Espaçamento · Severidade: Baixa
Evidência: a última fila de cartões é cortada pela borda inferior do modal sem
qualquer indício de scroll (captura 02-modal-templates.png).
Impacto: 16 arcos disponíveis, mas parece haver 6.
Recomendação: gradiente de fade no fundo do painel e contador "16 arcos" já
existente ligado ao scroll.
Esforço: baixo
```

```
[UX-015] Cards · Acessibilidade · Severidade: Baixa
Evidência: as ações por card (expandir, grelha, descarregar) são ícones de ~13px
numa área de ~20px, no rodapé de cada card (captura 03).
Impacto: alvos abaixo do mínimo confortável; erro de clique entre ações vizinhas.
Recomendação: área clicável de 32px mantendo o ícone visual atual.
Esforço: baixo
```

```
[UX-016] Barra lateral · Clareza · Severidade: Baixa — CORRIGIDO NESTE CICLO
Evidência: "1 perfil salvos" no cartão de perfis de marca (captura 03).
Impacto: erro de concordância no primeiro bloco da aba Marca.
Recomendação: singular/plural completo.
Esforço: baixo
```
Aplicado em `src/components/SidebarContent.jsx:1729`.

## Análise Transversal

**Arquitetura da informação.** O modelo mental do utilizador é linear — tema → narrativa → visual → imagem → marca → exportar — e as abas seguem exatamente essa ordem, o que é bom. O que quebra é a entrada: abre-se no fim da lista (Marca, UX-004) e o modo (Criador/Diretor/Studio) muda a quantidade de abas sem explicar o que ganhou; em Studio aparecem Texto e Layout sem qualquer marca de "novo aqui".

**Consistência entre telas.** Cores e rótulos de secção (caps rosa) são consistentes em todas as abas. As inconsistências são de vocabulário (composição/canvas/zonas — UX-006) e de duplicação de estado (UX-008). O padrão de CTA é consistente mas excessivo: o mesmo rosa serve ação de conversão, ação destrutiva de quota e opção avançada (UX-003).

**Performance percebida.** Os pesados estão em import dinâmico (`jspdf`, `html2canvas` — `src/hooks/useExport.js:17`), o que mantém o arranque do editor em `ViralCarrossel-*.js` 451KB / 119KB gzip. Geração de texto e imagem têm estado de carregamento e toast de resultado. O que falta é otimismo de UI na aplicação de template: hoje aplica e depois avisa "6 imagens não carregaram" — o card já mostrou o erro antes do aviso (UX-012).

**Jornada da ação principal (carrossel pronto).** Da entrada no editor até exportar: 1) Gerar com IA, 2) preencher tema no wizard, 3) confirmar, 4) esperar, 5) rever cards, 6) Exportar, 7) escolher formato. São 7 toques, dos quais nenhum é desperdiçado — a jornada é curta. Os pontos de abandono prováveis são: (a) topo do editor com o CTA coberto (UX-001, corrigido); (b) aterrar em Marca e achar que é preciso configurar identidade antes de gerar (UX-004); (c) na revisão, a grelha empurrada pelos painéis de imagem sempre abertos, que faz parecer que há menos cards do que existem (UX-005).

## Scorecard

| Dimensão | Nota 1–5 | Observação |
|---|---|---|
| Consistência | 3 | Cor e rótulos coerentes; vocabulário e estado de gravação divergem (UX-006, UX-008) |
| Hierarquia visual | 2 | 5+ primários rosa no mesmo ecrã (UX-003) |
| Acessibilidade | 3 | Abas com `role=tab`, sliders com `aria-label`; alvos de 20-30px em ações por card (UX-015) |
| Clareza | 3 | Copy do editor já revista; a aba Layout continua jargão (UX-006) |
| Carga cognitiva | 2 | Painel de imagem aberto em todos os cards (UX-005) e 7 abas em 3 linhas (UX-007) |
| Feedback visual | 4 | Toasts existem para tudo; posição corrigida (UX-002) |
| Microinterações | 4 | Transições suaves no header e drawer; toasts empilham bem |
| Estados vazios | 4 | Estado vazio do editor é exemplar (captura 21); erro de imagem mal enquadrado (UX-012) |
| Responsividade | 3 | Sobreposição do header resolvida 768-1440px; entre 768-900px o header cresce para 160px |
| Contraste | 4 | Texto principal e pílulas OK; rótulos de 10px da grelha em cinza fraco |
| Espaçamento | 3 | Grelha de cards respira; header e abas apertados |
| Padrões de navegação | 3 | Ordem das abas correta, entrada errada (UX-004) |
| Performance | 4 | Pesados em import dinâmico; editor 119KB gzip |

## Roadmap Sugerido

1. **Quick wins (esforço baixo, impacto alto)** — UX-001 e UX-002 (feitos), UX-004 aba inicial, UX-003 despromover primários, UX-005 colapsar painel de imagem, UX-006 copy e termo único, UX-010 mobile, UX-016 (feito).
2. **Estruturais (exigem design/dev)** — UX-007 abas do Studio em 2 linhas, UX-008 fonte única de estado de gravação e de "Projetos", UX-012 erro de imagem como chip sobreposto, altura do header entre 768-900px.
3. **Polimento** — UX-013 estado desativado do toggle, UX-014 indício de scroll no modal, UX-015 área clicável das ações por card, rótulos de 10px da grelha de layout.

## Nota de teste

`tests/e2e/multiusuario.spec.js` falhou uma vez na suite completa (timeout de 120s) e passou em 4,5s isolado — flake de contenção de CPU com 5 contextos paralelos, não regressão desta mudança. Candidato a `test.describe.serial` ou `workers: 1` nesse ficheiro.
