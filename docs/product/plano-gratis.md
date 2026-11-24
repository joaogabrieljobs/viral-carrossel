# Plano grátis — criar à mão, sem IA e sem imagem gerada

**Status:** implementado no branch `claude/free-modelos-mobile` em 2026-11-18, aguardando autorização de envio. Decisões D1–D6 respondidas "tudo como recomendado" (seção 4). O que foi feito e o que ficou de fora: seção 7.
**Data:** 2026-11-18 · **Base:** `main` em `4257738`
**Pedido:** "vamos criar o plano free, onde não tem IA nem imagens. você faz na mão as criações. se precisar fazer IA ou foto levamos para página de assinatura."

## 1. O que existe hoje

| Tema | Como está | Onde |
|---|---|---|
| Entrada no editor | Um único portão: sem assinatura ativa, a tela é a de planos | `ViralCarrossel.jsx:7426` (`paywallOpen \|\| !accessActive`) |
| Conta sem assinatura | Já existe. Cadastro cria a conta e manda escolher plano; login com senha certa e sem plano responde 402 `needCheckout`. Em nenhum dos dois casos o cookie de sessão `vc_access` é emitido | `api/auth/register.js`, `api/auth/login.js:76-89`, `api/auth/google/callback.js:155-174` |
| Sessão | `GET /api/auth/session` já separa três estados: `anonymous`, `inactive` (tem e-mail, não tem plano) e ativo | `api/lib/billing-handlers.js:59-166` |
| IA no servidor | Toda rota de IA confere a assinatura a cada chamada, independente do cookie: `ai/compatible`, `ai/ocr`, `ai/sjinn-image`, `anthropic/v1/messages`, `fetch-source`. Sem sessão 401, sem plano 402 | `api/lib/require-access.js` |
| Nuvem no servidor | Projetos, biblioteca, metadados da conta e compartilhamento por código também exigem assinatura | `api/projects.js`, `api/library-sync.js`, `api/account-library-meta.js`, `api/project-share.js` |
| Agentes (ChatGPT/Codex) | Exigem assinatura | `api/oauth/authorize.js`, `api/agent-access.js`, `api/lib/agent-token-store.js` |
| IA no cliente | Passa por poucas funções: `callAI`, `callAIwithSearch`, `generateDALLE*`, `generateZaiImage` (`src/utils/ai-client.js`), leitura de carrossel por imagem (`src/utils/carousel-ocr.js`) e importação por link | 11 arquivos chamam essas funções |
| Chave própria | Com chave própria de imagem, o navegador pode falar direto com o provedor, sem passar pelo servidor do Moont | `src/utils/ai-client.js`, `KeysModal.jsx` |
| Criar sem IA | Já existe: "Quer começar do zero? … Ir para o editor" abre projeto com um card vazio | `CreateProjectFlow.jsx:334`, `ViralCarrossel.jsx:6205` |
| Editor vazio | A tela vazia é um campo "Descreva a ideia" com botão de gerar. Não há caminho manual visível ali | `ViralCarrossel.jsx:7906+` |
| Dados no navegador | Projetos ficam no navegador, separados por conta. **Login explícito num navegador sem dono apaga os dados locais antes de carregar a conta** | `src/utils/account-data-owner.js:154-165` |
| Plano mais barato | Essencial R$ 19,90: texto com IA incluso, imagem só por upload, nuvem inclusa | `shared/plans.js` |
| Marca d'água | Não existe na exportação | — |

Consequência prática: o servidor já recusa IA para quem não paga. O trabalho é deixar a conta sem plano entrar no editor, tirar a IA do caminho dela na interface e levar à assinatura sem perder o projeto.

## 2. Desenho recomendado

1. **Grátis é uma conta sem plano, não um quinto plano Stripe.** `vc_access` passa a ser emitido também para conta sem assinatura (cadastro, login por senha, Google). `active` continua significando "pagou". A sessão ganha `plan: 'free'`. Nenhuma rota de IA ou de nuvem muda: continuam respondendo 402.
2. **`shared/plans.js` ganha `FREE_PLAN` fora de `PLAN_ORDER`.** `PLAN_ORDER` valida o plano no checkout e nas concessões manuais; "free" ali viraria um plano comprável sem preço.
3. **Cliente:** quem tem conta entra no editor (`active` ou `plan === 'free'`). A tela de planos deixa de ser parede e vira destino de upgrade.
4. **Um guardião de recurso pago no cliente.** Cada botão de IA ou de imagem gerada abre a página de assinatura antes de chamar qualquer coisa. Como rede de segurança, as funções de `ai-client.js` recusam a chamada no plano grátis com erro `plan_required`, que a interface converte na mesma página. Isso cobre também a chave própria, que o servidor não enxerga.
5. **Voltar ao mesmo projeto.** Antes de ir ao Stripe, o cliente grava qual projeto e card estavam abertos. Na volta (`?billing=success`) o dono dos dados locais é o mesmo e-mail, então a biblioteca fica intacta e o projeto reabre. O caso "biblioteca local cheia, nuvem vazia" já é tratado em `useAccess.js:564` (preserva o local e oferece enviar à conta).
6. **Onde ficam os projetos do grátis:** só no aparelho, com aviso permanente e o backup em arquivo que já existe. Ao assinar, o envio para a conta usa o caminho de sincronização atual.
7. **Editor vazio no grátis:** a tela "Descreva a ideia" troca o campo de pedido por "Escrever o primeiro card", com a IA como convite secundário.

### Pontos de IA e imagem que passam a abrir a assinatura

Gerar (cabeçalho e assistente de criação) · Organizar este card · Gerar com Comunica/Apresenta · variações de gancho · série · pesquisa · tom de voz da marca · revisão editorial · gerar legenda · gerar imagem (card, lote, referência) · ler carrossel por imagem · importar de link · Configurar IA (chave própria) · conectar ChatGPT/Codex · compartilhar por código · sincronizar na nuvem.

### Fica liberado

Criar em branco, textos, layout, zonas, tipografia, cores, padrões visuais oficiais e salvos, marca e logo, upload de fotos próprias (pendente D2), enquadramento de foto, exportar PNG/ZIP/PDF, backup em arquivo.

## 3. Entrega em três envios

| Envio | Conteúdo | Testes |
|---|---|---|
| A — servidor | Sessão para conta sem plano em cadastro, login e Google; `plan: 'free'` na sessão; `FREE_PLAN` | Integração: os três caminhos emitem cookie; com esse cookie, cada rota de IA, nuvem e agente responde 402; logout e troca de identidade continuam revogando |
| B — editor | Entrada sem plano; guardião de recurso pago; página de assinatura como destino; retorno ao projeto; limite de projetos; aviso "só neste aparelho"; editor vazio manual | Navegador: conta grátis cria, edita e exporta; cada ponto de IA abre a assinatura; ida e volta do checkout reabre o mesmo projeto e card; em 390 px |
| C — comunicação | Plano grátis na landing, na tela de planos e no FAQ | Navegador: landing e planos mostram o grátis; textos vêm de `shared/plans.js` |

Testes existentes que mudam de expectativa: `tests/e2e/paywall.spec.js` ("anônimo em ?app=1 vê paywall" continua valendo para anônimo, se D1 for conta obrigatória), `tests/e2e/billing-jornadas.spec.js` (CA-03 e o login sem assinatura), `tests/integration/auth.test.js` (login sem plano hoje espera 402).

## 4. Decisões do João

| # | Decisão | Recomendação | Por quê |
|---|---|---|---|
| D1 | Grátis exige conta ou funciona anônimo? | **Exige conta** (e-mail e senha ou Google) | Hoje o login apaga dados locais sem dono. Anônimo exigiria regra nova de adoção de rascunho na parte mais sensível do app (isolamento entre contas). Com conta, o rascunho já pertence ao e-mail e sobrevive ao upgrade sem código novo. Também dá o e-mail para reconverter |
| D2 | Upload de foto própria no grátis? | **Liberado** | O Essencial já vende "imagens só por upload"; "sem imagens" lido como "sem imagem gerada". Sem foto, o carrossel manual fica só tipográfico |
| D3 | Limite de projetos | **3 projetos** | Dá para experimentar de verdade e cria motivo de upgrade sem IA. Sem limite, o grátis substitui o Essencial para quem escreve à mão |
| D4 | Exportação | **Qualidade cheia, sem marca d'água, nesta primeira versão** | Marca d'água mexe na exportação, que acabou de passar por rodada de qualidade e é sensível a fontes no CI. Sugiro medir conversão primeiro e tratar selo "feito no Moont" como segunda fase |
| D5 | Projetos do grátis | **Só no aparelho**, com aviso e backup em arquivo | Nuvem tem custo por conta (banco e arquivos) e hoje é benefício pago. Risco assumido: limpar o navegador perde os projetos |
| D6 | Chave própria de IA no grátis | **Bloqueada** | Mantém a regra simples ("grátis é manual"). Limite honesto: é bloqueio de interface; o servidor não vê chamadas diretas ao provedor |

## 5. Riscos

- **Cadastro por senha não confirma o e-mail.** Cada conta grátis cria um cliente no Stripe. Há limite de 10 cadastros por minuto por origem; se virar alvo de abuso, o próximo passo é confirmar e-mail (o envio por Resend já existe na recuperação de senha).
- **Emitir sessão para conta sem plano** amplia quem carrega `vc_access`. Levantei todos os leitores do cookie: os que dão acesso a dado ou custo conferem a assinatura à parte. O envio A inclui teste por rota para travar isso.
- **Projetos só no aparelho** geram suporte ("sumiu meu projeto"). Mitigação: aviso fixo e backup em um toque.
- **Essencial perde espaço** se o grátis for generoso demais. D3 e D5 são os freios.

## 6. Pronto quando

Conta sem assinatura cria, edita e exporta um carrossel manual; todo ponto de IA ou imagem gerada abre a assinatura e, após assinar, volta ao mesmo projeto e card; o servidor responde 402 em toda rota de IA para essa conta; testes de integração e de navegador cobrem os dois lados; portão completo verde.

## 7. Implementação (2026-11-18)

### Servidor

- `shared/plans.js`: `FREE_PLAN` e `FREE_PROJECT_LIMIT` (3), fora de `PLAN_ORDER`.
- `api/auth/register.js`, `api/auth/login.js`, `api/auth/google/callback.js`: emitem `vc_access` para conta sem assinatura. O Google passa a criar a conta na primeira entrada (antes devolvia `?login=no_subscription`).
- `api/lib/billing-handlers.js`: a sessão de conta sem assinatura responde `{ active: false, free: true, tier: 'free', plan, customerId }`.
- Nenhuma rota de IA, nuvem ou agente foi alterada.

### Editor

- `src/utils/free-plan.js`: sessão grátis, portão de recurso pago, limite, retorno ao projeto e preservação de rascunhos.
- `src/hooks/useAccess.js`, `src/utils/account-data-owner.js`: conta grátis entra no editor e tem dono de dados local (duas contas grátis no mesmo navegador não se misturam).
- `ViralCarrossel.jsx`: `openUpgrade` é o caminho único para os planos; abrir, excluir, salvar e sair funcionam localmente mesmo com projetos V2 ligado.
- `src/utils/ai-client.js`, `carousel-ocr.js`, `generation-prompts.js`: recusam a chamada no grátis antes de qualquer rede.
- Planos, landing, perfil, uso, assistente de criação, indicador de gravação, equipe e agentes reconhecem o plano grátis.

### Testes

| Onde | O que prova |
|---|---|
| `tests/integration/plano-gratis.test.js` | 16 rotas pagas respondem 402 para a sessão grátis e 401 sem sessão; nenhum provedor é chamado; `free` não é comprável; cadastro e login entram no grátis |
| `tests/integration/auth.test.js` | Expectativas antigas de login sem assinatura atualizadas; login pausado durante vínculo Google não deixa sessão utilizável |
| `tests/unit/free-plan.test.js` | Portão, limite, retorno, preservação de rascunhos; com chave própria gravada, texto, imagem e leitura de imagem não chegam à rede |
| `tests/e2e/plano-gratis.spec.js` | Criar, editar e exportar PNG; cada ponto de IA abre os planos e volta ao projeto; assinar e voltar ao mesmo card; limite de 3; ex-assinante não perde o que fez no grátis; perfil e uso; 390×844 |

A produção roda com projetos V2 ligado (conferido no bundle público em 2026-11-18). Desde 24/11/2026 o job `e2e` do CI roda a suíte inteira sem a flag e, em seguida, o passo "E2E Projetos V2 (modo de produção)", que refaz o build com `VITE_PROJECTS_V2=true` e roda os arquivos com caminho próprio nesse modo, entre eles o do plano grátis. Para repetir à mão: `VITE_PROJECTS_V2=true CI=1 npx playwright test tests/e2e/plano-gratis.spec.js`.

### Achado durante a implementação: ex-assinante

Quem já teve projetos na conta, usa o grátis e reassina teria a lista local substituída pela biblioteca da nuvem. A solução guarda desde quando a conta usa o grátis neste navegador (`vc_free_plan_since`, que acompanha o cofre local no logout) e, ao assinar, devolve à biblioteca o que foi mexido desde então: projeto ausente volta como estava; projeto que existe na conta com conteúdo diferente e mais antigo volta como cópia "(feito no grátis)". Nada é sobrescrito.

### Fica para depois

- **Confirmar e-mail no cadastro por senha.** Continua sem confirmação; cada cadastro cria um cliente no Stripe.
- **Importar backup com vários projetos** pode passar de 3: o limite barra só quando a conta já está em 3.
- **Tela vazia "Descreva a ideia"** não foi redesenhada: no grátis a criação cai direto no editor com um card vazio, então a tela não aparece no caminho normal. Um projeto antigo vazio ainda a mostra, e o botão de gerar dali leva aos planos.
- **Marca d'água** e **nuvem para o grátis**: fora desta versão (D4 e D5).
- **Não validado com conta real nem com Stripe real.** Tudo simulado; o primeiro cadastro grátis em produção é o teste de verdade.
