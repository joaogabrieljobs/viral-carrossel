# Publicar modelo — diagramação e visual para outros usuários

**Status:** implementado em 2026-11-19 (seção 7), aguardando a migração 015 no banco de produção e a autorização de envio.
**Data:** 2026-11-18 · **Base:** `main` em `4257738`
**Pedido:** "um usuário pode criar um modelo de diagramação, visual e publicar para outro usuário usar."

## 1. O que existe hoje

| Tema | Como está | Onde |
|---|---|---|
| Padrão visual salvo | Objeto com marca visual (cores, fontes, tipografia, ornamentos) e padrões de card (layout, zonas, deslocamentos, sobreposição, tamanhos). Até 24 por conta. Sincroniza com a conta dentro dos metadados (limite de 512 KB para todos os metadados juntos) | `src/utils/custom-visual-presets.js`, `api/lib/library-sync-postgres.js:15-18` |
| O que o padrão captura | **Um card só** (o card ativo no momento de salvar). Não leva logo, @, nome, bio, fotos, título, texto nem legenda | `ViralCarrossel.jsx:2549-2561` |
| Vazamento possível | Alguns campos capturados são texto livre: `footerPillText`, `footerBarLeft/Center/Right`, `cultureHeaderLeft/Center/Year` (marca) e `eyebrowText`, `strikethroughText`, `afterTitleText` (card). Os padrões oficiais usam `{handle}`, `{marca}`, `{ano}`; o do usuário grava o que estiver escrito | `custom-visual-presets.js:4-37`, `src/utils/preset-tokens.js` |
| Gestão do padrão | Só salvar. Não há excluir nem renomear. O texto de ajuda diz "neste navegador", mas ele sincroniza | `SidebarContent.jsx:2258-2290` |
| Aplicar padrão | Já preserva o conteúdo do projeto de destino (título, textos, fotos, legenda) e recompõe os cards | `ViralCarrossel.jsx:1376-1408`, `src/utils/visual-scope.js:7-24` |
| Composição social | Zonas em porcentagem do card (`photo`, `title`, `subtitle`, `top`, `bottom`), quatro composições oficiais, escolhidas pelo conteúdo do card. Não age sobre padrão do usuário | `src/utils/social-visual-composition.js` |
| Compartilhar por código | Projeto inteiro, com conteúdo, por código de 8 caracteres; exige assinatura; expira em 30 dias; guarda em Redis ou arquivo, não no banco | `api/project-share.js`, `api/lib/project-share-store.js` |
| Banco | Postgres, esquema `moont`, 14 migrações. Nenhuma política de linha: só o servidor acessa. Dono dos dados é o cliente Stripe (`cus_…`) | `db/migrations/`, `api/lib/postgres-connection.js` |
| Listas do que é visual | O servidor já tem listas de campos visuais permitidos (usadas pelo agente) | `api/lib/visual-patch.js:17-55` |
| "Templates" no app | Já existe um modal "Templates": 16 arcos de conteúdo oficiais. É outra coisa; o nome colide | `src/components/TemplatesModal.jsx` |
| Funções no servidor | 33 funções em `api/` | — |

Nada de galeria, publicação ou catálogo entre usuários existe no código nem nos documentos.

## 2. Desenho recomendado

**O que é um modelo.** Nome, descrição curta, formato (4:5, 1:1, 9:16 ou 16:9), marca visual e de 1 a 10 cards-padrão, cada um com um papel: capa, conteúdo ou fechamento. Hoje o padrão salvo guarda um card só; modelo precisa do conjunto para a capa não ficar igual ao miolo.

**O que nunca entra.** Títulos, textos, legenda, fotos, vídeo, logo, @, nome, bio, tom de voz, material de apoio, fontes próprias enviadas e qualquer texto livre de rodapé ou cabeçalho. A garantia é no servidor: ele reconstrói o modelo a partir de uma lista de campos permitidos (partindo de `visual-patch.js`), em vez de tentar remover o que é proibido. Texto de ornamento só passa se for um dos marcadores `{handle}`, `{marca}`, `{ano}` ou vazio.

**Prévia.** Desenhada no navegador de quem vê, a partir do modelo, com texto fictício fixo do Moont. Nenhuma imagem do autor é guardada, então não há como a prévia carregar conteúdo de cliente.

**Aplicar.** Reaproveita o caminho atual de aplicar padrão, que já preserva o conteúdo do projeto de destino. Capa vai para o primeiro card, fechamento para o último, conteúdo se repete no meio. Aplicar é uma cópia: mudanças posteriores do autor não alteram projetos já criados.

**Banco.** Duas tabelas novas no esquema `moont`: `published_templates` (id, dono, nome, descrição, formato, conteúdo sanitizado, estado, alcance, nome de exibição do autor, usos, datas) e `published_template_reports` (denúncias). Sem políticas de linha, como o resto.

**Servidor.** Uma função só, `api/templates.js`, com listar, ler, publicar, atualizar, despublicar, registrar uso e denunciar. Segue o padrão das rotas atuais: limite de tamanho, limite de chamadas, dono vindo do cookie. Atualizar e despublicar comparam o dono no próprio `UPDATE`; modelo alheio responde 404.

**Na interface.** "Publicar como modelo" a partir do projeto aberto, com revisão do que vai e do que fica de fora antes de confirmar. "Modelos" na criação de projeto e na aba de estilo, com "Meus modelos" para editar nome, despublicar e apagar. O modal atual "Templates" passa a se chamar "Roteiros prontos" para não confundir.

## 3. Entrega em três envios

| Envio | Conteúdo | Testes |
|---|---|---|
| A — servidor | Migração, sanitização por lista permitida, `api/templates.js` | Integração com duas contas: B não atualiza, não despublica e não apaga modelo de A; publicar com conteúdo de cliente no corpo devolve modelo sem ele; limites de tamanho e de chamadas |
| B — publicar e gerir | Publicar a partir do projeto, revisão, "Meus modelos" | Navegador: publicar, renomear, despublicar |
| C — encontrar e aplicar | Galeria e link, prévia, aplicar em projeto novo e existente | Navegador com duas contas: A publica, B encontra e aplica, conteúdo de B preservado; A despublica e o modelo some para B |

## 4. Decisões do João

| # | Decisão | Recomendação | Por quê |
|---|---|---|---|
| D1 | Galeria pública ou só por link? | **Os dois**: todo modelo tem link; o autor escolhe se aparece na galeria | "Outro usuário encontra" pede galeria. O link cobre agência que quer passar modelo só para a equipe |
| D2 | Moderação antes de aparecer? | **Publica direto, com denúncia e remoção por você** | Sem foto e sem texto do autor, sobra pouco para moderar: nome, descrição e cores. Aprovação prévia cria fila que depende de você |
| D3 | Quem publica e quem usa? | **Publica: planos pagos. Usa: todos, inclusive grátis** | Publicar pago segura spam e dá benefício ao assinante. Usar no grátis enriquece o plano manual sem custo de IA |
| D4 | Fotos e textos de exemplo? | **Só estrutura; prévia com texto fictício do Moont** | É o que garante cliente fora do modelo. Exemplo do autor reabre o risco de vazamento e exige moderação de imagem |
| D5 | Atribuição ao autor? | **Sim, opcional**: nome de exibição escolhido pelo autor, nunca o e-mail | Reconhecimento incentiva publicar; anonimato continua possível |

### Respostas do João (2026-11-19)

| # | Resposta | Diferença da recomendação |
|---|---|---|
| D1 | **Só galeria pública.** Todo modelo publicado aparece para todos; não há modelo só por link | Recomendação era galeria e link |
| D2 | **Publica direto**, com denúncia e remoção pelo João | igual |
| D3 | **Todos publicam e usam, inclusive o plano grátis** | Recomendação era só pago publicar |
| D4 | **Só a estrutura**; prévia com texto fictício do Moont | igual |
| D5 | **Nome de exibição opcional**; e-mail nunca aparece | igual |

Consequências no desenho:
- Sem modelo privado por link, "Meus modelos" precisa de **despublicar** e **apagar** claros: publicar é sempre público.
- Com o grátis publicando, a galeria fica aberta a contas sem confirmação de e-mail. Entram limite por conta (sugestão: 10 modelos publicados e 5 publicações por dia), denúncia desde o primeiro dia e moderação do nome e da descrição do modelo, que é o único texto livre que vai para a galeria.
- Rota `api/templates.js` aceita sessão grátis para publicar e listar, ao contrário das rotas pagas; o teste de permissão cobre conta grátis, paga e anônima.

## 5. Riscos

- **Vazamento de cliente** é o risco central. Mitigação: lista permitida no servidor, prévia sem dado do autor e teste que publica um projeto cheio de conteúdo e confere o que saiu.
- **Fontes próprias** não viajam com o modelo; cai para a fonte do catálogo mais próxima. Precisa aparecer na revisão antes de publicar.
- **Modelo de um card só** (padrões salvos antigos) vira modelo válido, mas pobre. A publicação parte do projeto, não do padrão salvo.
- **Depende do plano grátis** se D3 liberar uso para o grátis: precisa da sessão de conta sem plano.
- **Galeria vazia no lançamento.** Sugestão: publicar os padrões oficiais como modelos do Moont no primeiro dia.

## 6. Pronto quando

Publicar, listar, aplicar e despublicar funcionam de ponta a ponta entre duas contas; nenhum dado do autor nem conteúdo de cliente está no modelo guardado; ninguém edita ou apaga modelo alheio, com teste de servidor; portão completo verde.

## 7. Implementação (2026-11-19)

| Peça | Arquivo |
|---|---|
| Modelo: montar, limpar por lista permitida, aplicar, prévia | `src/utils/published-template.js` (o servidor usa o mesmo módulo) |
| Banco | `db/migrations/015_published_templates.sql` (`published_templates`, `published_template_reports`) |
| Loja (dono conferido no SQL) | `api/lib/published-templates-store.js` |
| Rota | `api/templates.js` (exige conta; não exige assinatura) |
| Interface | `src/components/TemplateGalleryModal.jsx` (Galeria · Meus modelos · Publicar), entrada em Ajustes (Criar rápido) e em Visual |

Regras implementadas:
- O servidor reconstrói o modelo por lista permitida antes de gravar; texto livre de ornamento só passa se for marcador. Limite de 48 KB.
- Escrita compara o dono no SQL; modelo alheio responde 404. `owner_id` e contagem de denúncias nunca saem na resposta.
- Limites por conta: 10 modelos publicados e 5 publicações a cada 24 h; 10 publicações por minuto. Apagar o modelo não devolve a publicação do dia: além das linhas da tabela, um contador próprio (janela fixa de 24 h, `api/templates.js`) conta as publicações aceitas na validação.
- Denúncia: uma por conta e modelo; ninguém denuncia o próprio. Só soma para ocultar a denúncia de conta com assinatura ativa ou isenção (`api/templates.js`, `reportCountsTowardHide`); com 3 dessas o modelo sai da galeria (`status = 'hidden'`) e a autora vê "em revisão". Denúncia de conta grátis fica registrada e aparece na fila da moderação, mas não oculta o modelo. Se a consulta do plano falhar, a denúncia também fica registrada sem somar. Revisão do João: pela tabela `moont.published_template_reports` no Supabase.
- Despublicar apaga o modelo. Projetos que já o usaram não mudam (aplicar é uma cópia).
- Aplicar mantém textos, fotos, logo, nome, @ e o formato do projeto; capa no primeiro card, fechamento no último, conteúdo se repete no meio. Dá para desfazer.

Testes:
- `tests/integration/published-templates.test.js`: rota e loja reais sobre Postgres embutido (PGlite, devDependency) com a migração 015 — conteúdo do cliente fora, permissão entre contas, dono vindo da sessão, limites, denúncia, paginação. Teste de mutação: tirar `owner_id` do `DELETE` faz o teste falhar.
- `tests/unit/published-template.test.js`: montar, limpar e aplicar.
- `tests/e2e/publicar-modelo.spec.js`: conta paga publica, conta grátis encontra e aplica mantendo os próprios textos, não consegue apagar o modelo alheio, autora despublica e o modelo some; galeria em 390 px.

Para ativar em produção: aplicar `015_published_templates.sql` no Supabase "Moont Production" antes do envio. Sem a tabela, a rota responde 503 "A galeria de modelos ainda não foi ativada" e o resto do app segue normal.

## 8. Moderação (2026-11-19)

Aba **Moderação** na galeria, visível para contas listadas em `moont.template_moderators` (migração 016) e para quem tem papel sem revogação em `moont.admin_roles` (console admin, migração 018). Para as demais, a fila e a decisão respondem 404, como se não existissem.

- Fila: modelos fora da galeria primeiro, depois os denunciados; com motivo e data de cada denúncia, sem identificar quem denunciou nem a autora (só "N modelos da mesma conta" e "N já removidos/ocultos").
- Decisões: **Manter** (volta à galeria e dispensa as denúncias pendentes; elas ficam guardadas, então quem já denunciou não denuncia o mesmo modelo de novo e só denúncias de outras contas voltam a somar; migração 023), **Ocultar** (sai da galeria sem apagar; a autora vê "em revisão"), **Remover** e **Restaurar**.
- **Remover é reversível** (João, 19/11): o modelo vira `status = 'removed'`, some da galeria e dos "Meus modelos" da autora (ela não edita, não apaga, ninguém denuncia nem aplica), mas fica guardado. A moderação vê os removidos em "Removidos", com a data, e pode **Restaurar**: volta à galeria com as denúncias zeradas. Removido só aceita "restaurar"; as outras decisões respondem 409.
- Removido não conta no limite de 10 modelos da autora, mas conta no limite de 5 por dia (evita publicar e remover em ciclo).
- Cada decisão fica em `moont.template_moderation_events`.
- Incluir ou tirar moderador: `INSERT`/`DELETE` em `moont.template_moderators`, sem novo deploy. Quem recebe papel de `admin` ou `suporte` no console admin passa a moderar sem precisar entrar nessa tabela; tirar alguém de `template_moderators` não tira a moderação de quem ainda tem papel em `admin_roles`.
- Testes: `tests/integration/published-templates.test.js` (conta comum recebe 404; fila, decisões e histórico; mutação sem a checagem de moderador faz o teste falhar) e `tests/e2e/publicar-modelo.spec.js`.

Esta aba foi a primeira peça de administração dentro do app. O console admin geral veio depois: `docs/product/console-admin.md`.
