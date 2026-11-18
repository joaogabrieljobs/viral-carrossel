# Qualidade R2 — implementação de 18/11/2026

Branch `claude/qualidade-r2`, criada a partir de `7088a34` (o commit publicado em moont.ai). **Nada foi publicado, nada foi enviado ao remoto e nenhuma imagem foi gerada.** Todos os testes usam IA simulada.

Origem: revisão independente da rodada R2 (16 modos, 15–16/11/2026) e as especificações das etapas 1 e 2, guardadas na pasta pai do repositório:

- `REVISAO-INDEPENDENTE-MOONT-18-11-2026-v2.md`
- `ESPEC-ETAPA-1-ASSINATURA-RODAPE-ALINHAMENTO.md`
- `ESPEC-ETAPA-2-TIPOGRAFIA-LEGIBILIDADE.md`

## Estado de publicação

| Item | Estado |
|---|---|
| Último deploy | `7088a34`, 15/11/2026 (`dpl_2d9CdkXcMj3v5sQZzg9GZRfZtiD7`) |
| Esta branch | Só local. Sem push, sem PR, sem deploy |
| Checkout principal (`main`) | Tem alterações não commitadas de outra sessão em 7 arquivos (enquadramento de foto). Não foram tocadas e **não estão nesta branch** |
| Validação com IA real | Nenhuma. Ver "O que não foi validado" |

## O que foi feito

### Etapa 1 — assinatura provisória, rodapé e alinhamento (completa)

Problema da R2: carrosséis sem marca saíam com `SUA MARCA`, `@seuperfil`, `#SUAHASHTAG`, `Sua editoria`, e o selo do rodapé cobria o subtítulo da capa.

- A origem do texto fica no próprio campo. Campo que ainda tem token é automático; texto digitado é da pessoa e sempre aparece. Não há filtro por valor: `tests/e2e/marca-assinatura.spec.js` digita `SUA EDITORIA` de propósito e continua passando.
- `{handle}` e `{marca}` sem valor resolvem para vazio no card. Novo token `{exemplo:TEXTO}`: aparece na miniatura do seletor, nunca no card.
- Regras por grupo: selo; cabeçalho (ano sozinho não sustenta a barra); barra de três colunas atômica.
- A composição social recebe marca e formato e já nasce acima da reserva do rodapé. Sem rodapé visível, a geometria é a de antes.
- Proteção no render para zonas gravadas que ainda colidem (projetos antigos, selo acrescentado depois). Desligada quando a pessoa editou a zona ou arrastou o elemento.
- O alinhamento vem do `slideDefaults` do preset. Exceção aprovada: coluna estreita com mais de 120 caracteres de apoio fica à esquerda.
- O selo centra na coluna de texto quando a foto é lateral. Selo do `@` sem handle não é exportado.

Arquivos: `src/utils/preset-tokens.js`, `src/utils/card-chrome.js` (novo), `src/utils/social-visual-composition.js`, `src/styles/visual-presets.jsx`, `src/utils/design-data.js`, `src/components/card/SlideCardInner.jsx`, `src/components/SidebarContent.jsx`, `src/components/panels/CardTextFontPanel.jsx`, `src/components/TemplatesModal.jsx`, `ViralCarrossel.jsx`.

### Etapa 2 — tipografia e legibilidade (completa)

Problema da R2: todos os carrosséis saíram com título, subtítulo e apoio em 100/100/100; o apoio das apresentações saía com 18 px num slide de 1920.

**Reproduzido** com IA simulada antes de corrigir (`tests/e2e/project-creation-flow.spec.js`, "geração social conserva a tipografia que a composição definiu": falhava com 100/100/100, agora passa com 76/108/140).

- Causa: um efeito regravava os nove campos de tipografia em todos os slides a cada mudança de `brand.text*`, inclusive as feitas por código. Na criação, os três tamanhos da marca iam de 100 para `undefined` e o efeito disparava.
- O efeito saiu. A tipografia da marca chega aos slides só por ação explícita (controles de "Texto nos slides", seletor de par de fontes, troca de perfil de marca, "Aplicar a todos"), na mesma gravação da marca. Só o campo alterado é propagado; tamanhos em proporção.
- Apoio no deck: a vista 16:9 multiplica os tamanhos do slide por 0,45 e limita a 52–130. O valor fixo 110 chegava à tela como 52%. A composição agora grava o valor que entrega o corpo do preset depois da conversão, nunca abaixo de 24 px.
- O carrossel gerado deixou de herdar os pisos de redução do deck.
- Aviso não bloqueante `text-below-floor` na auditoria de render do deck.
- Ação explícita "Restaurar hierarquia do estilo" para projetos já achatados. Nada é corrigido ao abrir.

Arquivos: `src/utils/brand-typography.js` (novo), `ViralCarrossel.jsx`, `src/components/SidebarContent.jsx`, `src/components/card/SlideCardInner.jsx`, `src/utils/presentation-composition.js`, `src/utils/presentation-quality.js`, `src/utils/social-visual-composition.js`.

### Etapa 3 — imagem (parte determinística)

Problema da R2: 7 de 9 carrosséis com foto contradizendo o briefing; rosto cortado; objeto mudando entre cards.

- `shared/image-aspect.js` (novo): um seletor de proporção para editor, criação e templates. Pede o formato suportado mais próximo do painel da foto e acrescenta instrução de enquadramento.
- Ficha visual (`visualBible`): o rascunho do carrossel pode devolver até quatro entidades com os atributos do material. A ficha segue em todo pedido de imagem do projeto, junto do tema, sem trocar o ramo de direção de arte. **Opcional e à prova de falha**: ausente ou malformada, a geração segue como antes.
- A luz do brief deixou de ser repetida em toda query.
- O caminho de imagem do agente passou a enviar as regras fixas (sem texto, assunto inteiro).

Arquivos: `shared/image-aspect.js`, `src/utils/visual-bible.js` (novo), `src/utils/ai-client.js`, `src/utils/generation-prompts.js`, `ViralCarrossel.jsx`, `api/lib/agent-image-generation.js`.

### Etapa 4 — só a parte de recuperação do roteiro

- Na segunda tentativa de planejamento, o pedido de recuperação mostra ao modelo os trechos reais da fonte mais próximos de cada citação reprovada. É sugestão: o validador continua exigindo cópia literal.
- A mensagem de falha passa a dizer o motivo, a partir dos códigos do diagnóstico, sem expor conteúdo.
- A prévia progressiva deixou de mostrar marcadores `**` crus.
- A legenda gerada perde a linha de rótulo entre colchetes (`[Legenda]`) quando ela vem sozinha no início.

Arquivos: `src/utils/presentation-plan-repair.js` (novo), `src/utils/presentation-planning.js`, `src/components/GenerationPreview.jsx`, `src/utils/editorial-strategy.js`.

## O que NÃO foi feito

| Item do plano | Por quê |
|---|---|
| Etapa 4: itens obrigatórios em texto visível (`mustKeep`) | Muda o contrato do roteiro, que o validador rejeita por campo desconhecido. Sem geração real não há como saber se o modelo cumpre |
| Etapa 4: conferência de força da afirmação (título do Pitch) | Depende de julgamento do modelo; precisa ser calibrada com respostas reais |
| Etapa 4: avisos de revisão com motivo e menos falsos positivos | Idem |
| Etapa 5: arquétipos de composição e dialetos de preset | Trabalho de design que precisa de decisão e revisão visual sua. Não cabe implementar sem você ver |
| Etapa 6: reteste real | Exige geração paga. Não executado |
| Zonas de foto reservadas sem foto no fluxo "texto primeiro" | Precisa definir os estados da zona (planejada, pendente, falhou) com você |
| Referência "mesmo objeto" entre imagens do projeto | Muda custo e fluxo de geração; decisão sua |
| Proporção por slide no caminho do agente | Mudaria o formato do job gravado; ficou só a regra fixa no prompt |
| Teste de navegador para os controles de tipografia da marca | A lógica tem teste unitário; a ligação com a interface não tem teste de navegador |

## O que não foi validado

1. **Prompts novos contra o modelo real.** A ficha visual acrescenta um campo ao contrato do rascunho. Se o modelo não o devolver, nada muda; se devolver algo inválido, é descartado. Não foi medido se a ficha de fato melhora as imagens.
2. **Imagens.** Nenhuma foi gerada. Proporção, enquadramento e ficha só têm teste de montagem do prompt.
3. **Exportação ZIP/PDF, mobile e Tauri** com as mudanças.
4. **Galeria antes/depois** revisada por pessoa. As capturas dos testes ficam em `test-results/` e são apagadas a cada execução.

## Riscos para revisar antes de publicar

- **Projetos antigos mudam de aparência em dois pontos, de propósito:** texto provisório vindo de token (`@seuperfil`, `SUA MARCA`) deixa de aparecer; texto sob o selo sobe no render. Texto provisório gravado como literal (`#SUAHASHTAG`) continua aparecendo: não há como distinguir do texto da pessoa.
- **Controle de tamanho da marca agora é proporcional.** Quem esperava valor absoluto usa "Aplicar tipografia a todos".
- **Apoio do deck maior** (24–28 px em vez de 18 px) em projetos novos. Decks antigos não mudam.
- **Conflito de merge provável** em `ViralCarrossel.jsx` com as alterações locais de enquadramento de foto do checkout principal (`generateSlideImageAt` e arredores). Os trechos são vizinhos, não os mesmos.
- **Divergência entre documento e código encontrada:** `docs/design-geracao-1511.md` afirma que "o rodapé tem espaço reservado" na composição social. Na versão publicada a reserva só existia no renderer legado; esta branch torna a afirmação verdadeira.

## Instabilidade já existente (não causada por esta branch)

Três testes de navegador falham de forma intermitente **também em `7088a34`**. Cada um foi repetido no commit publicado, num worktree separado, para comparar.

| Teste | Em `7088a34` | Nesta branch |
|---|---|---|
| `project-creation-flow` → "prévia mostra todos os textos durante a revisão sem salvar o rascunho incompleto" | 2 de 10 | 3 de 10 |
| `project-creation-flow` → "design recomendado fica visível, aplica o preset e mantém a narrativa escolhida" | 7 de 20 | 2 de 10 |
| `card-text-fonts` → "fonte individual preserva outros textos e cards, herança e reload a 1680px" | 3 de 60 | 5 de 50 |

### Causa dos dois primeiros: gravação antiga logo depois de gerar (confirmada)

Não é só o teste. Um diagnóstico temporário (não commitado) registrou cada gravação de `vc_library` depois de uma geração "texto primeiro" com IA simulada. O padrão se repetiu em 16 de 16 execuções:

| Momento | Cards gravados | Quem grava |
|---|---|---|
| t | 1 (rascunho inicial) | `flushPersistRef.current()` no fim da criação (`ViralCarrossel.jsx`, efeito de `creationRequestVersion`) |
| t + 30 ms | 5 | outro flush com o documento já aplicado; pelo momento, o do aviso de backup (`setTimeout(..., 0)`, só na primeira geração do navegador). Autor inferido, não rastreado |
| t + 140 ms | 1 | temporizador de 100 ms da biblioteca, com o estado que o primeiro flush devolveu |
| t + 550 ms | 5 | autosave de 400 ms do documento |

O flush "atômico" do fim da criação lê o documento **antes** de o React aplicar os slides gerados. O `flushSync` logo acima dele só confirma atualizações síncronas; o `history.set` da geração entrou na fila normal e ainda não foi renderizado quando a resposta da IA chega sem intervalo real (é o caso do fluxo "texto primeiro"). O resultado antigo é devolvido para `setLibrary`, e por cerca de meio segundo o navegador guarda o projeto com o rascunho de 1 card.

Impacto real: baixo. Fechar a aba nessa janela dispara o flush de `pagehide`, que usa o documento vivo. Só uma queda do navegador nesse meio segundo perderia a geração. **Não foi corrigido**: é o caminho de gravação de um app publicado, fora do escopo desta rodada, e a correção muda a ordem entre gravar e devolver o resultado da criação. Proposta, para decidir: fazer esse flush depois de o React aplicar o documento gerado (mesma técnica do flush do aviso de backup) e só então resolver a criação.

### Causa do terceiro: o teste confere cedo demais (hipótese forte)

O teste espera `slides[0].textFonts` ficar igual a `{ título, subtítulo }` e então lê o resto do documento salvo. Esse mesmo valor já existia num estado anterior da sequência, então a espera pode passar com uma gravação antiga, quando os passos seguintes aconteceram dentro do intervalo do autosave. As falhas observadas (fonte de texto livre ausente, fonte do segundo card ainda presente) batem com isso, e o estado na tela está correto. Não alterei o teste.

## Resultado dos testes no último commit de código (`fb8a855`)

| Suíte | Resultado |
|---|---|
| `npm test` (checagens + Vitest) | 215 arquivos, 2533 passaram, 4 falhas esperadas (`it.fails`), 0 falhas |
| `npx playwright test` (bateria completa) | 274 passaram, 16 pulados, 0 falhas, em 6,2 min |

A bateria de navegador anterior, sobre `29c3247`, teve 272 passaram e 2 falhas: os testes "design recomendado" e "fonte individual a 1680px" da tabela acima. Uma execução verde não garante a próxima enquanto as três instabilidades existirem.

## Como conferir

```bash
cd /Users/elevessy/Documents/viral-carrossel/_worktrees/moont-qualidade-r2
git log --oneline 7088a34..HEAD
npm test
npm run test:e2e
```

Para ver no navegador sem crédito: `npx playwright test tests/e2e/assinatura-sem-marca.spec.js` grava capturas dos 12 presets sociais, com e sem marca, em `test-results/`.

## Atualização de 18/11/2026 (tarde) — conferência com o João

Estado: 14 commits locais sobre `7088a34`. Nada enviado, nada publicado. Publicação em espera por decisão desta sessão, depois da avaliação visual abaixo.

### O que entrou

| Commit | O quê |
|---|---|
| `5b0fbc2` | Gravação pós-geração: o fim da criação espera o React aplicar o documento gerado antes de gravar. Teste novo falhava 6 de 6 (sequência de gravações 1, 5, 1, 5) e passa 6 de 6. |
| `5bc68be` | Teste de fonte por card espera o retrato inteiro gravado, não só o card 1. |
| `b1b5519` | Composição social v3 e correções do rodapé (detalhe abaixo). |

### Avaliação visual

O João olhou as capturas do teste de assinatura e apontou: texto colado embaixo, selo preto com texto preto, fonte serrilhada, e depois, no geral, "cards feios, cara de anos 2000; falta uso de fonte, diagramação e arquitetura".

Eu não tinha aberto as 48 capturas. O teste media texto contra ornamento, mas não media selo contra barra nem a cor do texto do selo. Depois disso as 48 foram vistas uma a uma, antes e depois da mudança.

O que a v3 muda em projeto novo:

- Título e apoio formam um bloco: caixa do título ancorada embaixo, caixa do apoio ancorada em cima (`socialZoneAnchors`).
- Escala: título de 69 a 80 px para 98 a 116 px num card de 1080 (2,8× o apoio ou mais). Na coluna estreita ao lado da foto, de 60 para 69 px (2× o apoio).
- Capa: degradê só atrás do texto no lugar do véu sobre a foto inteira, sem sombra dura, bloco colado na base.
- Seta "arraste" só na capa.

O que vale também para projeto antigo (correção de render):

- Selo e barra de três colunas empilham em vez de dividir a mesma faixa.
- Texto do selo escolhido por contraste; seta do selo visível em selo translúcido (o Reflexivo Cream publicava um círculo vazio).
- Barra do rodapé com tinta do card quando a foto não está atrás dela, e dentro da coluna de texto quando a foto é coluna lateral.
- Título sem negrito sintético em fonte de peso único (Anton).

Capturas e comparações: `/Users/elevessy/Documents/viral-carrossel/_capturas-assinatura-1811/` (`antes/`, `depois/`, três folhas `antes-depois-*.png`).

### O que a v3 não resolve

- Arquitetura continua com dois arranjos de miolo (foto em cima, foto em coluna). Não há ritmo de arquétipos (declaração só de texto, lista numerada, dado em destaque, fechamento).
- O selo "ARRASTA PRO LADO" continua com cara de botão. É assinatura de padrão; não foi redesenhado.
- Tabloid: o título do padrão pede maiúsculas e o card gerado sai em caixa mista (já era assim).
- "Fonte serrilhada": nas capturas em 2× não aparece. As primeiras eram em 1×, com o card em 360 px. Não comparei com o PNG exportado.
- Nenhuma imagem real gerada: todas as capturas usam a mesma foto de arquivo.

### Testes

- `npm test`: 2557 passaram, 4 falhas esperadas.
- Navegador, suíte completa em `b1b5519` menos os ajustes de teste: 272 passaram, 3 falharam, 16 pulados. As 3: teste de fonte por card (dois tamanhos) e conferência de composição da apresentação.
- Teste de assinatura com as verificações novas: 26 de 26.

### Instabilidade: o que mudou e o que não mudou

Medição no commit publicado, arquivo de criação repetido 20 vezes sem carga minha: "design recomendado" 3 de 20, "prévia" 4 de 20, "apresentação confere composição" 1 de 20. Esta última não estava na lista anterior; existe no commit publicado.

- Gravação antiga pós-geração: causa confirmada e corrigida (`5b0fbc2`). Prova: teste determinístico. A repetição longa (420 testes) rodou duas vezes e as duas ficaram inválidas: 8 e 55 falhas por `page.goto` sem resposta em 30 a 60 s, com a máquina em carga média 11 a 19 (Epic Games Launcher a 100% de CPU havia 12 h). Nenhuma falha de gravação antiga apareceu nelas, mas não servem como prova estatística.
- Conferência de composição da apresentação: continua instável (`renderCheckStatus` ausente ou `unavailable`). Hipótese testada e **não confirmada**: a conferência seria pulada quando os slides ainda não foram montados (`roots.length !== newSlides.length`). Reduzir a CPU do navegador em 6× e 20× não reproduziu (8 de 8 passaram). Sem correção.
- Teste de fonte por card: a corrida da leitura antiga foi removida no teste. Sob carga ainda falha em outros pontos (início não visível em 5 s depois do reload; fonte do título depois do reload). Não investigado.

### Enquadramento de foto (checkout principal)

Levantado, não juntado. São 7 arquivos, 80 linhas, último toque em 14 e 15/11, com testes próprios. Toca `ViralCarrossel.jsx` em quatro pontos de aplicação de foto; a composição v3 já grava `photoFraming: 'auto'`.

### IA real

Não validado. `.env.local` só tem token de armazenamento; não há chave de modelo nesta máquina.

### Segunda rodada visual (18/11, fim da tarde)

O João apontou, sobre a folha do Tabloid: "efeitos de sombra feios, letras muito coladas e sem qualidade". O recorte enviado era a linha ANTES da folha, mas a conferência do DEPOIS achou três coisas de verdade:

- **Letras coladas:** todo título recebia −3% de espaçamento. Bom para grotesca larga, ruim para fonte condensada (Anton, Bebas Neue, Oswald, Barlow Condensed). Agora a base depende da fonte (`src/utils/title-tracking.js`); só no renderizador de caixas, usado pelo card gerado.
- **Sombra:** o selo do rodapé perdeu a sombra projetada. O título gerado já não tinha sombra desde a v3.
- **"Sem qualidade":** as fontes dos padrões vêm da rede (Google Fonts). A captura era tirada antes de elas chegarem e registrava o card em Helvetica de reserva; aconteceu em duas folhas e numa rodada inteira em tamanho real. O teste agora só fotografa com a fonte do título e a do corpo carregadas; se não chegarem, confere a geometria e não grava captura.

Tentativa revertida: reduzir a caixa do título no card com foto em cima (16% e depois 18,5% da altura) para diminuir o vão sob título de uma linha. As duas medidas encolhiam título de duas linhas em fonte larga, porque a caixa tem margem interna. Voltou para 21,5%. Limitação que fica: título de uma linha deixa cerca de 14% de vão sob a foto.

Capturas em tamanho real de exportação (1080 × 1350): `_capturas-assinatura-1811/tamanho-real/`. Gerar de novo: `CAPTURA_ESCALA=3 npx playwright test tests/e2e/assinatura-sem-marca.spec.js`.

Não resolvido nesta rodada: no Viral Hype o selo fica centralizado enquanto o texto é alinhado à esquerda; o espaçamento por tipo de fonte não foi levado aos renderizadores antigos (card montado à mão fora da composição gerada).

### Junção do enquadramento de foto e portão final (18/11, noite)

O João respondeu "serve, próximo passo" às capturas em tamanho real.

- **Enquadramento de foto** (`7fab392`): as alterações não commitadas do checkout principal (7 arquivos, 80 linhas, de 14 e 15/11) foram copiadas para esta branch como patch e aplicaram sem conflito. O checkout principal não foi tocado e continua com as mesmas alterações soltas. **Depois que esta branch entrar em `main`, essas alterações soltas passam a ser duplicata do que já está commitado e precisam ser descartadas lá antes de atualizar o checkout.**
- `npm test`: 2562 passaram, 4 falhas esperadas.
- Navegador, suíte completa com tudo junto: 271 passaram, 4 falharam, 16 pulados, com a máquina em carga média de 22 a 38. As 4 (logout em `billing-jornadas` e `library-cloud-sync`, dois testes de logo) falharam por elemento não visível em 5 s. Os quatro arquivos repetidos duas vezes em seguida: 50 de 50 passaram.
- Teste de assinatura: 26 de 26, capturas conferidas depois da junção (recortes e fontes certos).
- Navegador, suíte completa no commit final de código (`b68af7a`): **275 passaram, 0 falharam**, 16 pulados (8,4 min).

Estado para publicar: 18 commits locais sobre `7088a34` (o último só de documentação); `origin/main` continua em `7088a34`. Nada enviado.

O que continua sem validação: nenhuma geração com IA real (texto ou imagem); exportação ZIP/PDF, celular e Tauri não conferidos à mão; três testes de navegador instáveis já existentes no commit publicado (conferência de composição da apresentação, fonte por card sob carga, e os de criação só deixam de falhar pela gravação antiga).

Como a publicação funciona neste projeto: push em `main` dispara o deploy de produção na Vercel e o CI do GitHub (unitários e navegador). Os 8 deploys anteriores foram todos por push direto em `main`. O deploy de `7088a34` fica como candidato a reversão imediata na Vercel.
