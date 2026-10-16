# Stripe — assinatura individual Viral.

> **Estado atual (2026-09-29):** **4 planos mensais** (Essencial R$ 19,90 · Criador R$ 97 · Pro R$ 197 · Max R$ 297), com saldo de **0 · 50 · 150 · 300 imagens**, respectivamente. Texto incluso via Z.ai no servidor; chave própria opcional. Preços e quotas: `shared/plans.js`. [Spec de planos](./product/PRD-planos-imagem-sjinn.md). A landing usa a mesma configuração; o antigo anual de R$ 790 não é anunciado para estes quatro planos.

## Histórico do modelo anterior (não usar para novas ofertas)

- **1 plano:** acesso ao studio (Criador · Diretor · Studio)
- **R$ 97/mês** (criar no Dashboard Stripe em BRL)
- **BYOK:** geração usa a chave Anthropic/OpenAI do utilizador — sem limite de carrosséis no produto
- **Sem base de dados:** o cookie `vc_access` + estado live da assinatura no Stripe são a fonte da verdade

## Fluxo

1. Landing → CTA → Paywall (e-mail para **nova** assinatura) **ou** **Entrar** (e-mail + senha ou Google)
2. `POST /api/stripe/checkout` → Stripe Checkout. Um e-mail já cadastrado, com assinatura ativa **ou inativa**, exige login antes de renovar: digitá-lo no formulário nunca reutiliza o customer Stripe nem dá acesso aos projetos. Google ou senha válida produzem uma prova HttpOnly assinada por 10 minutos, vinculada ao customer original. Cadastro novo cria customer próprio e vincula apenas o checkout inicial.
3. O checkout grava um cookie HttpOnly assinado para aquela sessão, válido pelo período de pagamento (até 24 horas), e guarda o ID na aba que iniciou a compra. Sucesso → `/?billing=success` → `POST /api/stripe/confirm` → cookie `vc_access` HttpOnly após o pagamento ser confirmado no Stripe. O ID não vai na URL; sem o cookie do checkout, a confirmação é recusada.
4. `GET /api/auth/session` valida assinatura `active` / `trialing`
5. Botão **Plano** na home → Customer Portal Stripe

Checkouts iniciados antes da troca para o cookie assinado não podem usar a confirmação nova. Se o pagamento foi concluído, o assinante recupera o acesso pelo login da conta.

### Login e-mail + senha (assinantes)

O login inclui **Mostrar/Ocultar senha** e **Esqueci minha senha**. A recuperação
usa Resend e um link de uso único com validade de 30 minutos. Configuração,
contratos e testes: [Recuperação de senha](engineering/recuperacao-senha.md).

1. Landing → **Entrar** → e-mail + senha **ou** Google
2. `POST /api/auth/login` (ou `/api/auth/register`) — senha em hash scrypt no **metadata Stripe** (`vc_pw_salt` / `vc_pw_hash`)
3. Se assinatura Stripe ativa → cookie `vc_access`
4. Conta nova ou senha correta com assinatura inativa → `{ needCheckout: true }` → Paywall, com vínculo temporário ao customer dessa conta. O cadastro público não pode definir senha sobre customer Stripe preexistente sem autenticação.

Google continua disponível; o login inicia no domínio canônico configurado por `GOOGLE_REDIRECT_URI` ou `APP_URL`. O cookie de estado e o callback ficam nesse mesmo domínio.

### Login Google (opcional)

1. Landing → **Entrar** → **Continuar com Google**
2. `GET /api/auth/google` → OAuth Google → `/api/auth/google/callback`
3. Servidor exige e-mail confirmado e `sub` do Google. No primeiro acesso, vincula o customer ao `sub`, revoga sessões anteriores e remove senha criada antes da confirmação Google; uma senha nova só pode ser definida pelo fluxo de recuperação por e-mail. Logins Google posteriores preservam a senha nova.
4. Com customers Stripe duplicados, prefere o `sub` já vinculado. Sem vínculo anterior, seleciona somente se uma única conta tiver projetos na nuvem, ou, na ausência de projetos, uma única assinatura estiver ativa. Ambiguidade abre o login com orientação de recuperação; nenhuma conta é escolhida pelo acaso.
5. Se ativo → cookie `vc_access` → `/?billing=restored&login=google`. Se inativo → paywall com e-mail pré-preenchido e prova temporária vinculada ao customer selecionado. O checkout e o token carregam uma versão aleatória da identidade (`vc_identity_epoch`); provas, sessões de compra e cookies anteriores ao vínculo, logout ou redefinição de senha não podem reabrir a conta.

## Setup no Dashboard Stripe

1. Configurar os quatro planos de `shared/plans.js` no produto do studio.
2. Associar os preços mensais às variáveis `STRIPE_PRICE_ID_ESSENTIAL`, `STRIPE_PRICE_ID_CREATOR`, `STRIPE_PRICE_ID_PRO` e `STRIPE_PRICE_ID_MAX`. `STRIPE_PRICE_ID` é o fallback legado. Esta documentação não altera preços/assinaturas existentes.
3. Developers → API keys → `sk_test_…` (depois `sk_live_…`)
4. Developers → Webhooks → Add endpoint  
   URL: `https://SEU_DOMINIO/api/stripe/webhook`  
   Eventos:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
5. Settings → Billing → Customer portal → ativar cancelamento / atualização de método de pagamento

## Variáveis na Vercel

```
APP_URL=https://moont.ai
STRIPE_SECRET_KEY=sk_...
STRIPE_PRICE_ID=price_...
STRIPE_PRICE_ID_ESSENTIAL=price_...
STRIPE_PRICE_ID_CREATOR=price_...
STRIPE_PRICE_ID_PRO=price_...
STRIPE_PRICE_ID_MAX=price_...
STRIPE_WEBHOOK_SECRET=whsec_...
ACCESS_COOKIE_SECRET=<string longa aleatória>
GOOGLE_CLIENT_ID=....apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-...
# Opcional: se omitida, usa APP_URL + /api/auth/google/callback
GOOGLE_REDIRECT_URI=https://moont.ai/api/auth/google/callback
```

### Setup Google OAuth

1. [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → Create credentials → OAuth client ID → **Web application**
2. Authorized JavaScript origins: `https://moont.ai`; conservar `https://viralcarrossel.com.br` durante a migração.
3. Authorized redirect URIs: `https://moont.ai/api/auth/google/callback`; conservar `https://viralcarrossel.com.br/api/auth/google/callback` enquanto o domínio antigo estiver ativo.
4. Colar Client ID + Client Secret nas env da Vercel e redeploy

`ZAI_API_KEY` é obrigatória (texto incluso no plano). `ANTHROPIC_API_KEY` **não está configurada em produção por decisão de custo** (removida em 2026-09-15): com ela, qualquer assinante — incluindo o Essencial de R$ 19,90 — podia gastar Opus e `web_search` na conta da plataforma via `/api/anthropic/v1/messages`. Claude e a pesquisa web ao vivo são BYOK: o utilizador põe a própria chave em Configurar IA e ela viaja no header `x-anthropic-key`. `VITE_ANTHROPIC_PROXY=true` continua necessária para o BYOK passar pelo proxy e evitar CORS.

## Dev local

As rotas `/api/*` rodam na Vercel. Opções:

```bash
# A) API real local
vercel dev

# B) Abrir o studio sem pagar (só local)
BILLING_DISABLED=true
```

Com `vite` puro (sem `vercel dev`), o client em DEV faz fallback e deixa entrar se `/api/auth/session` falhar.

## Testar pagamento

Cartões de teste Stripe: https://docs.stripe.com/testing  
Ex.: `4242 4242 4242 4242`

## Rodar os testes (suite de confiança)

```bash
npm test          # unit + integração (Vitest) — billing, auth, segurança, concorrência
npm run test:e2e  # jornadas no build real (Playwright) — comprar, restaurar, negar, logout, export, 5 usuários
```

Tudo mockado (Stripe, Google, OpenAI) — nenhum teste toca rede real nem movimenta dinheiro. CI roda ambos em todo push na main (`.github/workflows/ci.yml`). Docs do pipeline: `docs/epics/suite-testes-confianca/`.
