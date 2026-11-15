# Operação de isenção de acesso por conta

A isenção concede acesso ao Moont por uma concessão privada vinculada ao UUID da conta. Ela mantém um plano explícito e sua quota finita. O plano `creator` inclui 50 imagens por ciclo mensal; isenção não significa imagens ilimitadas.

O vínculo usado na consulta é `moont.account_stripe_customers`, com `verified_at` preenchido e o customer exato da conta autenticada. E-mail não é chave de autorização e não une contas duplicadas. Cookies, epochs, escopos MCP e isolamento de projetos continuam sendo verificados.

## Configuração e ativação

| Configuração | Função |
| --- | --- |
| `ACCOUNT_ENTITLEMENTS_BACKEND=postgres` | Ativa a consulta das concessões privadas. A flag não concede acesso por si só. |
| `ACCOUNT_IDENTITY_BACKEND=postgres` | Backend de identidade utilizado no rollout; manter os vínculos verificados existentes. |
| `DATABASE_URL` ou `POSTGRES_URL` | Conexão privada já configurada no servidor. Credenciais não entram em exemplos, relatórios ou commits. |

Com a flag de entitlements ausente, o acesso continua seguindo a assinatura Stripe. Com a flag ligada, a fonte de concessões é consultada antes do Stripe; erro nessa leitura resulta em indisponibilidade, sem presumir acesso ativo nem cair silenciosamente no caminho pago.

Ordem operacional: **migração 014 → concessão auditada → flag e deploy → verificação**.

1. Aplicar a [migração 014](../../db/migrations/014_account_access_grants.sql) no banco de destino, depois das migrações anteriores. Verificar as duas tabelas privadas, RLS, revogação de privilégios de `PUBLIC`/`anon`/`authenticated`, FK composta da auditoria e trigger que impede alteração ou exclusão dos eventos.
2. Identificar a conta autorizada pelo UUID e pelo vínculo de customer verificado. Conferir a quota do ciclo atual para o mesmo customer, incluindo `period_start_sec` e o uso já registrado. Não selecionar o dono apenas pelo e-mail.
3. Criar a concessão com o helper administrativo do código revisado, numa execução privada de servidor. Registrar plano, início, validade opcional, âncora de quota, chave de idempotência, responsável e motivo. A inserção da concessão e do evento deve ocorrer na mesma transação.
4. Configurar `ACCOUNT_ENTITLEMENTS_BACKEND=postgres` no ambiente correto e publicar a versão que contém resolver, consumidores e UI. A migração e a concessão devem existir antes de uma instância começar a ler a nova fonte.
5. Confirmar o acesso pela sessão autenticada e pelos consumidores relevantes, além da integridade dos registros no banco. A criação da concessão não emite cookie nem token MCP.

O código pode ser publicado previamente com a flag ausente, mas a concessão só passa a participar do acesso quando a flag estiver presente na instância em execução. Alterações de ambiente exigem o procedimento de deploy do provedor.

## Concessão e idempotência

O módulo [account-entitlements.js](../../api/lib/account-entitlements.js) exporta `grantAccountAccess` e `revokeAccountAccess`. São helpers administrativos internos; não há endpoint público para conceder ou revogar isenção.

Exemplo de formato, com valores fornecidos por um contexto administrativo privado:

```js
import { grantAccountAccess } from './api/lib/account-entitlements.js';

const result = await grantAccountAccess({
  accountId: verifiedAccountId,
  tier: 'creator',
  startsAtSec: approvedStartSec,
  expiresAtSec: null,
  quotaAnchorSec: existingQuotaPeriodStartSec,
  requestId: stableGrantRequestId,
  actor: operatorReference,
  reason: authorizationReference,
});
```

`startsAtSec` e `quotaAnchorSec` são segundos UTC inteiros e explícitos. `expiresAtSec` pode ser omitido ou `null`; quando informado, deve ser posterior ao início. A âncora não pode ser posterior ao início da concessão.

A chave `requestId` deve ser estável entre tentativas da mesma operação. Repetir a concessão com o mesmo payload retorna `replayed: true` sem outra concessão ou outro evento. Alterar conta, plano, datas, âncora, responsável ou motivo com a mesma chave causa conflito. Uma chave já usada para revogação também não pode ser reutilizada para conceder acesso.

O helper bloqueia a conta durante a transação e recusa concessões com períodos sobrepostos ainda não revogados. Repetir uma concessão antiga que já foi revogada apenas devolve o registro anterior; não a reativa. Uma nova concessão exige nova chave e autorização correspondente.

## Preservação da quota

A quota continua usando o customer original e o início do ciclo como chave. Para uma conta com consumo existente, usar como `quotaAnchorSec` o `period_start_sec` confirmado do ciclo atual. Não usar o instante da concessão como nova âncora, não zerar contadores e não criar créditos compensatórios para ativar a isenção.

Se o ciclo não puder ser confirmado, resolver essa ausência antes da concessão. A quantidade de imagens restantes deve vir do armazenamento de quota; falta de leitura não representa saldo cheio.

A recorrência da isenção é mensal em UTC e preserva dia e horário da âncora. Em mês curto, o limite é o último dia daquele mês, voltando ao dia original no seguinte: uma âncora sintética em 31 de janeiro passa pelo último dia de fevereiro e depois por 31 de março. A mesma função calcula o período mostrado na sessão e usado pela geração no editor e no MCP.

O início da concessão controla quando ela vale; a âncora controla o ciclo de quota. Esses valores podem ser diferentes para preservar um ciclo já iniciado. O uso e as reservas existentes daquele ciclo permanecem válidos.

## Auditoria e revogação

`moont.account_access_grants` guarda a concessão e seu estado de revogação. `moont.account_access_grant_events` guarda eventos `granted` e `revoked`, com responsável, motivo, chave idempotente e vínculo composto com a concessão e a conta. A tabela de eventos rejeita `UPDATE`, `DELETE` e `TRUNCATE`.

O helper grava a mudança e seu evento na mesma transação. Se o evento falhar, a operação inteira deve ser revertida. Esses helpers são o caminho normal de administração; acesso SQL privilegiado não deve alterar concessões sem a transação e o evento equivalentes.

```js
import { revokeAccountAccess } from './api/lib/account-entitlements.js';

await revokeAccountAccess({
  accountId: verifiedAccountId,
  grantId: existingGrantId,
  requestId: stableRevocationRequestId,
  actor: operatorReference,
  reason: revocationReference,
});
```

A revogação exige o par exato de conta e concessão. O replay da mesma revogação é idempotente; outra chave contra uma concessão já revogada não cria outra revogação. Não excluir a concessão ou a auditoria para retirar acesso.

Com o backend ligado, os gates HTTP e MCP consultam o acesso novamente por requisição; o cache pago de 45 segundos do MCP não é utilizado. Uma concessão revogada, expirada ou ainda não iniciada deixa de conceder acesso. Se a conta ainda tiver assinatura Stripe ativa, o caminho pago poderá continuar autorizando-a. A revogação da isenção não revoga cookies, tokens ou uma assinatura paga.

## Contrato e verificação

Uma sessão com isenção válida retorna `active: true`, `accessSource: 'exempt'`, `billingExempt: true`, `status: 'exempt'` e o tier explícito. `customerId` e e-mail continuam representando a mesma identidade autenticada. `currentPeriodStart`/`currentPeriodEnd` e `quotaPeriodStart`/`quotaPeriodEnd` descrevem o ciclo de quota confirmado.

O caminho pago usa `accessSource: 'stripe'` e `billingExempt: false`. O resolver só inclui um objeto `subscription` quando recebeu uma assinatura real do Stripe; esse objeto não é fabricado para isenções.

Verificar após a ativação:

- Sessão da conta autorizada indica isenção, plano correto e uso já consumido preservado; conta diferente não recebe a concessão.
- Login por senha e Google, gates de projetos/proxies, OAuth e MCP continuam exigindo identidade e permissões válidas.
- Editor e MCP usam o mesmo customer, ciclo e limite de imagens; saldo esgotado continua bloqueando novas gerações.
- Checkout autenticado da conta isenta reconhece o acesso existente sem iniciar uma nova assinatura.
- Consulta indisponível retorna falha fechada; isenção não é deduzida de dados em cache da UI.
- Repetição de `requestId` não duplica concessão, evento ou saldo. Revogação e expiração deixam de autorizar pela isenção.

Os testes sintéticos de referência são [account-entitlements.test.js](../../tests/unit/account-entitlements.test.js) e [account-exemption.test.js](../../tests/integration/account-exemption.test.js). Os testes com mocks não substituem a verificação das constraints, privilégios, atomicidade e append-only no banco de destino. Não registrar dados de usuários ou segredos nos artefatos versionados dessa verificação.

## Relação com cobrança e reversão

A isenção altera o direito de acesso no Moont. Ela não cancela assinatura Stripe, não altera preços ou produtos, não perdoa faturas, não emite reembolso e não marca cobranças como pagas. Qualquer ação financeira necessária é uma operação separada, com sua própria autorização e verificação. `findActiveSubscription` e os fluxos do portal e de confirmação de pagamento continuam tratando somente objetos reais do Stripe.

Para remover a isenção de uma conta, usar revogação auditada. Retirar a flag desliga a leitura de concessões para todas as contas daquele ambiente e faz o acesso voltar ao caminho Stripe; isso é reversão de rollout, não revogação individual. A reversão não apaga registros, eventos ou consumo de quota. Uma versão antiga do servidor também pode ignorar concessões, portanto verificar o impacto sobre contas isentas antes de reverter o código.
