# Console admin do Moont

Pedido do João (19/11): "crie um console admin como o MUSA e o Branddy têm". Hoje o Moont não tem console. Tudo que é operação passa por SQL direto no Supabase ou por helper rodado à mão (isenção: `docs/engineering/OPERACAO-isencao-conta.md`). A única tela com papel especial é a aba Moderação da galeria de modelos, liberada pela tabela `moont.template_moderators`.

## 1. O que aprendemos com os dois consoles

| | MUSA (Next.js) | Branddy (Expo + tRPC) |
|---|---|---|
| Endereço | `/admin`, sem link no menu; quem não é admin vê 404 | `/admin` na web e entrada escondida no app; quem não é admin vê "página não existe" |
| Quem é admin | Tabela de papéis (`admin`, `support`) mais lista de emergência em variável de ambiente | Lista de e-mails em variável de ambiente mais verificação em duas etapas obrigatória |
| Escrita | Sempre por função no banco, com trilha na mesma transação; a trilha não aceita UPDATE nem DELETE | Trilha gravada "no melhor esforço"; uma ação (pagar saque) não registra |
| Confirmação | Dois passos ("Revisar" e frase com o efeito) nas ações de dinheiro; código por e-mail nas mais sensíveis | Modal de confirmação; algumas ações alternam direto |
| Layout | Abas horizontais, cards de número, tabelas; "—" com motivo quando o número não existe | Barra lateral no navegador, cards empilhados no celular |

Levamos do MUSA: papéis no banco, escrita só com trilha na mesma transação, trilha imutável, "zero não é ausência", 404 para quem não é admin. Do Branddy: a tela funciona no celular como lista de cards, e ação contra outra conta admin é recusada.

Evitamos: trilha que pode falhar em silêncio, ação de risco sem confirmação, número inventado quando a fonte falha.

## 2. Proposta

**Endereço.** `https://moont.ai/admin`, dentro do próprio app, sem link no menu. Para quem não tem papel, a página e a API respondem como se não existissem (404). Nada do console entra no bundle de quem não é admin: a tela é carregada sob demanda só depois que o servidor confirma o papel.

**Quem entra.** Nova tabela `moont.admin_roles` (conta, papel `admin` ou `suporte`, quem concedeu, motivo, revogação). Variável `MOONT_ADMIN_ACCOUNTS` como entrada de emergência, no padrão do MUSA. Quem tem papel também modera modelos (a checagem da moderação passa a aceitar `template_moderators` ou papel de admin). Ninguém muda o próprio papel; o último admin não pode ser revogado.

**Trilha.** Tabela `moont.admin_actions` (quem, papel, ação, conta alvo, motivo obrigatório, detalhes, data), com trigger que recusa UPDATE e DELETE. Toda escrita grava a trilha na mesma transação. Abrir a ficha de uma conta também registra (leitura de dado pessoal).

**Telas da primeira entrega** (D3):

1. **Início.** Contas criadas (7 e 30 dias), assinantes por plano, contas grátis, imagens geradas no ciclo, gerações com falha, modelos denunciados. Cada número diz a fonte; se a fonte falha, mostra "—" e o motivo.
2. **Contas.** Busca por e-mail. Ficha com plano e status do Stripe, isenção ativa, uso de imagem no ciclo (do banco de cota, nunca estimado), número de projetos na nuvem, últimos eventos de cobrança, modelos publicados. Sem conteúdo de projeto.
3. **Isenções.** Lista das ativas e histórico. Conceder e revogar pela tela, usando o `grantAccountAccess`/`revokeAccountAccess` que já existem e já gravam auditoria.
4. **Moderação.** A fila de modelos que hoje está na galeria, também acessível pelo console.
5. **Saúde.** Gerações de imagem presas em "reservado", falhas recentes por motivo, últimos webhooks do Stripe recebidos, MCP/OAuth (tokens ativos).
6. **Trilha.** Últimas ações do console, com filtro por conta.

**API.** `api/admin.js` (uma rota, ação por parâmetro), sessão `vc_access` mais papel conferido no banco a cada chamada. Leitura por GET com página; escrita por POST com motivo obrigatório. Erros de banco saem genéricos.

**Visual.** Mesmo tema do Moont, com selo "Admin" no topo e abas horizontais. Tabela no computador; cards empilhados abaixo de 900 px.

## 3. Fora da primeira entrega

Reembolso e mudança de plano no Stripe (continuam no painel do Stripe), envio de e-mail em massa, ajuste manual de cota de imagem, encerrar sessões de uma conta, gráficos. Entram depois se o João pedir.

## 4. Decisões do João (19/11)

- **D1 — Segunda verificação nas ações de risco** (conceder/revogar isenção, dar ou tirar papel): **código por e-mail**, enviado ao e-mail do próprio admin, válido por 10 minutos e para uma ação só.
- **D2 — Quem tem papel no começo:** só `joaogabriel@inbrandapp.com.br`.
- **D3 — Telas da primeira entrega:** as seis.
- **D4 — Escrita na primeira entrega:** isenção e moderação, sempre com motivo, confirmação e trilha.

## 5. Como vamos saber que funciona

- Integração com PGlite: conta sem papel recebe 404 em todas as ações; papel `suporte` lê mas não concede isenção; toda escrita deixa linha em `admin_actions`; UPDATE/DELETE na trilha falham; ninguém revoga o último admin nem o próprio papel.
- E2E: admin abre `/admin`, busca uma conta, vê a ficha, concede e revoga isenção com confirmação; conta comum em `/admin` vê "página não encontrada" e o bundle do console não é baixado; 390 px sem rolagem lateral.
- Portão completo verde e capturas conferidas em tamanho real.

## 6. Implementação (19/11)

- **Banco:** `db/migrations/018_admin_console.sql` cria `moont.admin_roles` (papel `admin` ou `suporte`), `moont.admin_actions` (trilha; trigger recusa UPDATE, DELETE e TRUNCATE) e `moont.admin_challenges` (códigos por e-mail: hash do código, 10 minutos, 5 tentativas, uso único, amarrado ao pedido exato).
- **Quem entra:** `admin_roles` sem revogação, ou a lista de emergência `MOONT_ADMIN_ACCOUNTS` (ids `cus_…`). Quem tem papel também modera modelos (`published-templates-store.js`). Papel se dá por SQL nesta entrega; não há tela para isso.
- **API:** `api/admin.js` + `api/lib/admin-store.js`. Sem papel: 404 em tudo. `suporte` só lê. Conceder e revogar isenção usam `grantAccess`/`revokeAccess` com ganchos que conferem o código e gravam a trilha dentro da mesma transação. A concessão nova usa como âncora o ciclo de cota em uso pela conta (sem zerar contador).
- **Tela:** `/admin` (`src/admin/AdminEntry.jsx` confere o papel antes de baixar `src/admin/AdminConsole.jsx`). Abas Início, Contas (busca e ficha), Isenções, Moderação (a mesma fila da galeria), Saúde e Trilha. Tabela a partir de 900 px; cards no celular.
- **Testes:** `tests/integration/admin-console.test.js` (PGlite com todas as migrações) e `tests/e2e/console-admin.spec.js`.

**Para ligar em produção:** aplicar a migração 018, `INSERT INTO moont.admin_roles (owner_id, role, granted_by, reason) VALUES ('cus_VGFkzHLNfQZotl', 'admin', 'joao', 'Dono do produto, decisão D2 de 19/11')`, conferir `RESEND_API_KEY` e `AUTH_EMAIL_FROM` (os mesmos da recuperação de senha) e publicar.
