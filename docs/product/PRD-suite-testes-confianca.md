# PRD — Suite de Testes de Confiança (produto, auth, segurança, pagamento, checkout multiusuário)

**Status:** Rascunho
**Autor:** João Gabriel (via pipeline spec-driven-dev)
**Data:** 2026-08-07 | **Última revisão:** 2026-08-07
**Auditoria de referência:** docs/audit.md

## 1. Problema

O Viral. vai começar a **vender acesso** (plano individual R$ 97/mês via Stripe). Hoje o repositório tem **zero testes e zero framework de teste** (audit.md), incluindo os fluxos que tocam dinheiro e acesso de clientes:

- Checkout, confirmação de pagamento e restauração de assinatura
- Login Google e sessão por cookie assinado
- Paywall que decide quem entra no studio
- O produto em si (geração de carrossel, editor, export) — a razão da compra

Qualquer regressão nesses fluxos = perda direta de receita ou cliente pagante bloqueado, descoberta só em produção por reclamação. Correções de segurança recentes (CORS allowlist, cookie secret, guard de `BILLING_DISABLED` — audit.md) foram feitas **sem rede de proteção** que impeça reintrodução do problema.

## 2. Público-alvo

- **Primário (indireto):** assinantes pagantes do Viral. — criadores de conteúdo que pagam R$ 97/mês e não podem encontrar paywall quebrado, checkout que falha ou studio inacessível.
- **Secundário (direto):** o mantenedor do produto (solo dev + agentes de IA), que precisa de sinal automático de "posso publicar" a cada deploy.

## 3. Objetivos de negócio

- **OB-01:** Nenhum cliente pagante perde acesso por regressão não detectada nos fluxos de billing/auth.
- **OB-02:** Deploy com confiança: um comando responde "o produto, o pagamento e o login funcionam?" antes de publicar.
- **OB-03:** Suportar venda simultânea a vários usuários sem colisão de sessão/acesso (cada cookie corresponde ao cliente certo).
- **OB-04:** Segurança contínua: os 3 achados corrigidos na auditoria não regridem.

## 4. Métricas de sucesso

| Métrica | Baseline | Meta | Prazo |
|---|---|---|---|
| Cobertura dos fluxos críticos de billing/auth (checkout, confirm, session, webhook, logout, Google) | 0% | 100% dos fluxos com pelo menos 1 teste de integração | fim do épico |
| Testes E2E dos caminhos de compra e entrada no studio | 0 | ≥ 4 jornadas (comprar, restaurar, negar sem assinatura, logout) | fim do épico |
| Teste multiusuário simultâneo (N sessões concorrentes) | inexistente | cenário com ≥ 5 usuários paralelos passando | fim do épico |
| Regressões de segurança (CORS, cookie secret, BILLING_DISABLED) | sem proteção | 1 teste dedicado por achado, falhando se reintroduzido | fim do épico |
| Comando único de validação pré-deploy | inexistente | `npm test` verde obrigatório antes de publicar | fim do épico |

## 5. Requisitos funcionais

Convenção: "verificação automática" = teste executável por comando, sem intervenção manual.

**Produto (o que o cliente compra)**
- **RF-01:** Verificação automática de que o app carrega e a landing renderiza sem erro de console.
- **RF-02:** Verificação automática do fluxo mínimo do produto: entrar no studio, criar/editar um carrossel e exportar arquivo válido (PNG/PDF/ZIP).
- **RF-03:** Verificação automática das utilidades puras já existentes (`src/utils/*`, `src/lib/billing.js`): parsing, formatos, migração de schema, helpers de marca.

**Auth**
- **RF-04:** Verificação automática da emissão e validação do cookie de acesso (token válido, expirado, adulterado, ausente).
- **RF-05:** Verificação automática do fluxo Google OAuth (redirect, callback com state válido/inválido, assinante ativo vs sem assinatura).
- **RF-06:** Verificação automática de logout (cookie limpo, sessão volta a anônima).

**Pagamento**
- **RF-07:** Verificação automática do checkout: e-mail válido/inválido, cliente novo vs existente, assinatura já ativa (restauração).
- **RF-08:** Verificação automática da confirmação (`confirm`): sessão paga, não paga, inválida, sem cliente.
- **RF-09:** Verificação automática do webhook Stripe: evento assinado corretamente processa; assinatura inválida é rejeitada.
- **RF-10:** Verificação automática do Customer Portal: exige sessão válida; nega anônimo.

**Checkout multiusuário**
- **RF-11:** Verificação automática de N usuários simultâneos (≥ 5) comprando/entrando ao mesmo tempo: cada um recebe cookie do próprio `customerId`, sem vazamento cruzado de sessão ou e-mail.

**Segurança**
- **RF-12:** Verificação automática de que origin fora da allowlist não recebe `Access-Control-Allow-Origin` com credentials nos endpoints de billing.
- **RF-13:** Verificação automática de que ausência de `ACCESS_COOKIE_SECRET` falha de forma explícita (sem fallback silencioso).
- **RF-14:** Verificação automática de que `BILLING_DISABLED=true` não libera acesso quando ambiente é produção.
- **RF-15:** Verificação automática de que o paywall bloqueia acesso ao studio sem assinatura ativa (na UI e na API).

## 6. Requisitos não-funcionais (linguagem de negócio)

- **RNF-01:** A suíte completa roda em minutos, não horas — rápida o bastante pra rodar antes de todo deploy.
- **RNF-02:** Testes de pagamento não movimentam dinheiro real nem dependem de conta Stripe de produção (modo teste/simulação).
- **RNF-03:** Qualquer falha aponta com clareza qual fluxo de negócio quebrou (nome do teste legível em português).
- **RNF-04:** A suíte roda no ambiente local do mantenedor e em automação (CI) sem passos manuais.
- **RNF-05:** Dados pessoais usados em teste são fictícios (LGPD — nenhum e-mail/cliente real).

## 7. Fora de escopo

- Feature multi-seat/times (modelo continua 1 plano individual — DEC-B do audit).
- Migração do deploy Netlify → Vercel (decisão DEC-A registrada; execução é tarefa própria fora deste épico).
- Refatoração do monólito `ViralCarrossel.jsx` (testa-se pelas bordas: UI via E2E, lógica via módulos extraídos existentes).
- Testes de carga/performance (stress) além do cenário de concorrência funcional do RF-11.
- Cobertura de geração por IA com chaves reais (BYOK) — mockar provedores; qualidade do conteúdo gerado não é objeto desta suíte.

## 8. Riscos e premissas

- **Premissa:** Produção é Vercel; funções `api/` são o contrato a testar (DEC-A).
- **Premissa:** Stripe possui modo de teste/mocks suficientes para simular assinatura ativa, cancelada e webhook assinado.
- **Risco:** Monólito de 844 KB dificulta teste unitário direto da UI. | Mitigação: E2E pelo navegador para jornadas; unitário só em módulos já extraídos.
- **Risco:** Testes E2E de checkout dependem de redirect externo (Stripe Checkout). | Mitigação: interceptar/mocar na fronteira; testar contrato da API separado da jornada visual.
- **Risco:** Suíte lenta vira suíte ignorada. | Mitigação: RNF-01 como critério de aceite do épico.

## 9. Perguntas em aberto

- CI: existe preferência de plataforma (GitHub Actions é o default natural do repo no GitHub)?
- O fluxo Google OAuth em E2E real exige conta de teste Google — aceitável cobrir só por integração mockada? (proposta: sim)
