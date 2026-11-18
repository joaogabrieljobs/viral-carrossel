# Publicar modelo — diagramação e visual para outros usuários

**Status:** especificação, aguardando decisões do João (seção 4). Nada implementado. Começa depois do plano grátis.
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

**Banco.** Duas tabelas novas no esquema `moont`: `published_templates` (id, dono, nome, descrição, formato, conteúdo sanitizado, estado, alcance, nome de exibição do autor, usos, datas) e `template_reports` (denúncias). Sem políticas de linha, como o resto.

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

## 5. Riscos

- **Vazamento de cliente** é o risco central. Mitigação: lista permitida no servidor, prévia sem dado do autor e teste que publica um projeto cheio de conteúdo e confere o que saiu.
- **Fontes próprias** não viajam com o modelo; cai para a fonte do catálogo mais próxima. Precisa aparecer na revisão antes de publicar.
- **Modelo de um card só** (padrões salvos antigos) vira modelo válido, mas pobre. A publicação parte do projeto, não do padrão salvo.
- **Depende do plano grátis** se D3 liberar uso para o grátis: precisa da sessão de conta sem plano.
- **Galeria vazia no lançamento.** Sugestão: publicar os padrões oficiais como modelos do Moont no primeiro dia.

## 6. Pronto quando

Publicar, listar, aplicar e despublicar funcionam de ponta a ponta entre duas contas; nenhum dado do autor nem conteúdo de cliente está no modelo guardado; ninguém edita ou apaga modelo alheio, com teste de servidor; portão completo verde.
