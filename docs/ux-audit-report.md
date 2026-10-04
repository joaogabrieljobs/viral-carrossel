# Auditoria de UX — Viral Carrossel Studio
04/10/2026 · 7 telas · Foco: conversão do primeiro carrossel exportável + clareza Criar rápido / organização editorial

Público inferido: criadores e social media que querem gerar e baixar carrosséis com identidade de marca, sem publicar no Instagram a partir do Viral.  
Ação principal (conversão): **gerar → revisar → exportar (PNG/legenda)** na primeira sessão.  
Fontes: screenshots live em `127.0.0.1:5173/?app=1` + árvore a11y + código das superfícies Fatia 1–3 / biblioteca.  
Design system de referência do repo: chrome Figma monocromático (`.cursor/rules/design-system.mdc`) — o produto **em runtime** usa accent magenta `#ff2d8d` e dark studio; recomendações respeitam o visual **real** e a progressive disclosure da spec, sem propor redesign genérico fora do produto.

## Resumo Executivo

O produto já comunica bem a tese das duas profundidades e a organização editorial (Biblioteca / Fila / Calendário), com microcopy forte de “não publica no Instagram”. O maior risco de conversão é a **multiplicidade de CTAs “Gerar”** e overlays de onboarding (modos + tour) que empurram a tarefa core para baixo da dobra. O maior quick win: **um único Gerar por contexto** e **esconder filtros da Biblioteca quando a aba é Fila/Calendário**.

## Top 5 por Impacto×Esforço

1. [UX-003] Unificar CTAs “Gerar” no editor (header + canvas + Home) — Alta · baixo  
2. [UX-008] Na Fila/Calendário, ocultar filtros Pastas/Status da Biblioteca — Alta · baixo  
3. [UX-001] Loading “A carregar…” sem marca/skeleton — Média · baixo  
4. [UX-005] Tour 1/7 sobrepõe Home sem foco claro na ação “Continuar no editor” — Alta · médio  
5. [UX-011] Pós-geração: 4 ações + Organizar + backup competem no Criar rápido — Média · baixo  

## Achados — Severidade Alta

```
[UX-003] P05 Editor · Hierarquia visual · Severidade: Alta
Evidência: screenshot do canvas mostra botão rosa “Gerar” no header, CTA central “Gerar carrossel com IA”, e a árvore a11y ainda lista “Gerar carrossel” na Home do Criar rápido (e28) + “Gerar carrossel com IA” (e1, e41).
Impacto: dilui a ação principal da sessão; utilizador novo não sabe se gera no canvas, no header ou na sidebar.
Recomendação: um CTA primário por superfície — no Criar rápido só “Gerar carrossel” na sidebar; no canvas vazio, um único CTA que foca o pedido ou abre a Home; header “Gerar” vira secundário ou some em appMode=criador.
Esforço: baixo
```

```
[UX-005] P04 Tour · Carga cognitiva · Severidade: Alta
Evidência: modal “1 / 7 · Bem-vindo ao Viral Carrossel” cobre o cartão “Continuar no editor” na Home; botões Pular / Voltar / Avançar.
Impacto: atrito logo após o modal de modos; a conversão (entrar no editor) fica tapada por 7 passos.
Recomendação: adiar o tour até o 1º “Gerar” ou reduzir a 3 passos com CTA “Continuar no editor” no próprio tour; default “Pular” mais visível que “Avançar” na 1ª visita.
Esforço: médio
```

```
[UX-008] P07 Fila · Clareza / Navegação · Severidade: Alta
Evidência: com a aba Fila selecionada (a11y e61), o modal ainda mostra PASTAS, busca e chips Todos/Rascunho/Pronto/Agendado/Publicado — controlos da Biblioteca.
Impacto: utilizador pensa que os filtros afetam a fila; a mensagem “Fila editorial local” compete com ruído de UI alheia; carga cognitiva alta.
Recomendação: quando `view === 'queue' | 'calendar'`, ocultar FolderOrganizer + busca + filtros de status; manter só tabs + conteúdo da vista.
Esforço: baixo
```

```
[UX-002] P02 Modos + P03 Home · Consistência · Severidade: Alta
Evidência: modal “Bem-vindo” usa labels Criar rápido / Controle profissional / Studio; Home shell ainda mostra atalho “No editor: Marca → Conteúdo → Cards → IA” (caminho antigo por abas, não pela sequência Criar rápido).
Impacto: contradiz a tese “ideia → carrossel → revisar → baixar”; reforça jargão de abas antes da 1ª geração.
Recomendação: no cartão Em edição (Criar rápido), trocar o breadcrumb para “Contexto → Pedido → Gerar → Baixar” ou omitir até haver resultado.
Esforço: baixo
```

## Achados — Severidade Média

```
[UX-001] P01 Loading · Performance percebida · Severidade: Média
Evidência: ecrã cheio preto com só “A carregar…” centrado, sem logo, skeleton ou progresso.
Impacto: primeira impressão fria; parece falha em redes lentas.
Recomendação: logo marca + skeleton da Home ou barra indeterminada; manter `font-display: swap`.
Esforço: baixo
```

```
[UX-004] P02 Modos · Hierarquia visual · Severidade: Média
Evidência: três cards densos (listas de features) + badges RECOMENDADO/ATUAL; CTA principal do modal é “Fechar”, não “Começar a criar”.
Impacto: utilizador fecha o modal sem saber o próximo passo; a escolha de profundidade não conduz à geração.
Recomendação: CTA primário “Começar no Criar rápido” que fecha e foca o pedido; “Fechar” como ghost.
Esforço: baixo
```

```
[UX-006] P03 Home · Acessibilidade / Touch · Severidade: Média
Evidência: na lista da biblioteca embutida, ícones Duplicar/Exportar/Apagar ~36×36 sem label visível; “Renomear” é link rosa de texto pequeno.
Impacto: alvos < 44×44 e ações destrutivas sem rótulo explícito no viewport mobile.
Recomendação: hit area ≥44px; “Apagar” com label ou menu “⋯”; manter ícones só com `aria-label` (já parcialmente feito no modal).
Esforço: baixo
```

```
[UX-007] P05 Editor · Consistência de cor · Severidade: Média
Evidência: accent magenta `#ff2d8d` em CTAs; ícone Configurar IA em verde sucesso; grelha de alinhamento forte no canvas.
Impacto: verde “IA” compete semanticamente com sucesso; grelha aumenta ruído no empty state.
Recomendação: Configurar IA em neutro (hairline) até haver chave OK (aí success); grelha só com toggle explícito / Studio.
Esforço: baixo
```

```
[UX-009] P06 Biblioteca · Carga cognitiva · Severidade: Média
Evidência: por cartão: pasta + data + status + 5 ícones de ação + filtros globais + pastas + busca.
Impacto: organização editorial é poderosa, mas o cartão parece um formulário; “Novo carrossel” compete com Exportar/Importar do mesmo peso visual secundário (ok), porém o cartão é denso demais para Criar rápido.
Recomendação: no appMode criador, colapsar pasta/data/status atrás de “Organizar”; no diretor, manter inline. Alinha à spec de profundidades.
Esforço: médio
```

```
[UX-011] P05 Criar rápido · Carga cognitiva · Severidade: Média
Evidência: a11y lista pós-geração: Ajustar texto, Gerar imagens, Baixar, Mais controle, Organizar para publicar, Backup JSON — mesmo com placeholder “Seu título aqui”.
Impacto: ações de “depois” aparecem antes de haver carrossel real (ou competem cedo demais); dilui “Gerar carrossel”.
Recomendação: mostrar PostGenerateActions + Organizar só quando `projectHasCarouselContent` e títulos ≠ placeholder; backup fica no rodapé Exportar.
Esforço: baixo
```

```
[UX-012] P05 Criar rápido · Clareza · Severidade: Média
Evidência: chips Lançar / Educar / Prova social / Bastidor acima do pedido; Gerar desativado até haver texto.
Impacto: bom progressive disclosure, mas chips sem estado “ativo” claro no empty e sem explicar que só preenchem o pedido.
Recomendação: ao aplicar chip, feedback toast curto (já existe em parte) + chip selected; se pedido vazio, preencher seed e focar textarea.
Esforço: baixo
```

## Achados — Severidade Baixa

```
[UX-010] P06 Biblioteca · Consistência · Severidade: Baixa
Evidência: subtítulo “1 carrosséis salvos” (plural invariável).
Impacto: polimento de confiança linguística.
Recomendação: pluralização pt-BR (`1 carrossel salvo` / `N carrosséis salvos`).
Esforço: baixo
```

```
[UX-013] P03 Home · Clareza · Severidade: Baixa
Evidência: stats PROJETOS / MARCAS / CARDS em três cartões.
Impacto: não ajudam a 1ª conversão; ocupam dobra.
Recomendação: ocultar no Criar rápido até ≥2 projetos.
Esforço: baixo
```

```
[UX-014] P07 Fila · Feedback · Severidade: Baixa
Evidência: botão “Publicado” na fila (aria-label “Marcar … como publicado”).
Impacto: rótulo curto “Publicado” parece filtro/estado, não ação (mitigado por aria-label).
Recomendação: label visível “Marcar publicado”.
Esforço: baixo
```

## Análise Transversal

### Arquitetura da informação
Três eixos bem documentados (interface × narrativa × voz) aparecem no modal de modos — bom. A Home shell ainda mistura “biblioteca embutida” com “Abrir biblioteca” (modal completo), o que duplica caminhos para o mesmo objeto (projeto).

### Consistência entre telas
Rótulos Criar rápido / Controle profissional estão alinhados na UI recente. Breadcrumb “Marca → Conteúdo → Cards → IA” e empty canvas “Crie seu carrossel viral” ainda falam a linguagem antiga/marketing, desalinhados do fluxo Criar rápido.

### Performance percebida
Loading sem skeleton ([UX-001]). Geração futura precisa manter progresso/cancelamento (já existe no motor — não reabrir como bug). Fila e biblioteca são locais/instantâneas — ponto forte.

### Jornada até a conversão (toques estimados, mobile)

| # | Passo | Risco de abandono |
|---|---|---|
| 1 | Abrir app → loading | Frieza [UX-001] |
| 2 | Modal profundidades → Fechar | Sem CTA “começar” [UX-004] |
| 3 | Tour 1/7 ou Pular | Bloqueia Home [UX-005] |
| 4 | Continuar no editor | OK |
| 5 | Preencher marca/logo/tom (opcional) + pedido | Comprido mas pulável — OK |
| 6 | Escolher entre 3 “Gerar” | Confusão [UX-003] |
| 7 | Revisar → Exportar / Organizar | Densidade pós-geração [UX-011] |

**Toques médios até export:** ~6–9 se o utilizador não se perder nos Gerar/tour. Meta de produto (3–5 min) é atingível se reduzir overlays e CTAs.

## Scorecard

| Dimensão | Nota 1–5 | Observação |
|---|---|---|
| 1. Consistência | 3 | Rótulos novos vs breadcrumbs/empty antigos |
| 2. Hierarquia visual | 2 | Vários Gerar magenta de peso igual |
| 3. Acessibilidade | 3 | Bons aria-labels no modal; alvos pequenos na Home |
| 4. Clareza | 4 | Microcopy Instagram/local storage excelente |
| 5. Carga cognitiva | 2 | Tour + modos + filtros na Fila + pós-ações cedo |
| 6. Feedback visual | 4 | Toasts, pressed states, progress na geração |
| 7. Microinterações | 3 | Scale 0.95 ok; loading inicial pobre |
| 8. Estados vazios | 3 | Canvas empty forte em marketing, fraco em Criar rápido |
| 9. Responsividade | 4 | Bottom nav + sidebar mobile legíveis |
| 10. Contraste | 3 | Magenta/branco ok; secundários cinza no limite |
| 11. Espaçamento | 3 | Escala 8px ok; cartão biblioteca denso |
| 12. Navegação | 3 | Tabs Biblioteca/Fila/Calendário claras; filtros vazam |
| 13. Performance | 4 | Local-first; falta polish no boot |

## Roadmap Sugerido

1. **Quick wins (baixo esforço)** — ✅ implementado 2026-10-04  
   - [x] [UX-003] Um Gerar por superfície no Criar rápido  
   - [x] [UX-008] Esconder filtros fora da aba Biblioteca  
   - [x] [UX-011] Pós-ações só com conteúdo real  
   - [x] [UX-001] Loading com marca  
   - [x] [UX-010] Pluralização  
   - [x] [UX-014] “Marcar publicado”

2. **Estruturais** — ✅ implementado 2026-10-04  
   - [x] [UX-005] Tour pós-primeira geração (3 passos; Pular em destaque)  
   - [x] [UX-009] Densidade da biblioteca por profundidade  
   - [x] [UX-002]/[UX-004] Alinhar Home/modos à jornada Criar rápido

3. **Polimento** — ✅ implementado 2026-10-04  
   - [x] [UX-007] IA settings neutro até configurado  
   - [x] [UX-012] Estado ativo dos chips de objetivo  
   - [x] [UX-013] Stats só com volume  
   - [x] [UX-006] Hit areas ≥44px na Home/Biblioteca
---

*Auditoria alinhada a `/ux-audit` + checks `/ui-ux-pro-max` (a11y, touch, um CTA primário) + `/frontend-design` (intencionalidade dentro do visual dark/magenta do produto, sem propor Inter→fonte “exclusiva” nem abandonar o DS existente).*
