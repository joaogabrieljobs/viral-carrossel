# Stripe — assinatura individual Viral.

> **Estado atual (2026-09-29):** **4 planos mensais** (Essencial R$ 19,90 · Criador R$ 97 · Pro R$ 197 · Max R$ 297), com saldo de **0 · 50 · 150 · 300 imagens**, respectivamente. Texto incluso via Z.ai no servidor; chave própria opcional. Preços e quotas: `shared/plans.js`. [Spec de planos](./product/PRD-planos-imagem-sjinn.md). A landing usa a mesma configuração; o antigo anual de R$ 790 não é anunciado para estes quatro planos.

## Histórico do modelo anterior (não usar para novas ofertas)

- **1 plano:** acesso ao studio (Criador · Diretor · Studio)
- **R$ 97/mês** (criar no Dashboard Stripe em BRL)
- **BYOK:** geração usa a chave Anthropic/OpenAI do utilizador — sem limite de carrosséis no produto
- **Sem base de dados:** o cookie `vc_access` + estado live da assinatura no Stripe são a fonte da verdade

## Fluxo

1. Landing → CTA → Paywall (e-mail para **nova** assinatura) **ou** **Entrar** (e-mail + senha ou Google)
2. `POST /api/stripe/checkout` → Stripe Checkout (se o e-mail já tem sub ativa → `{alreadyActive, requireLogin}` **sem** cookie)
3. Sucesso → `/?billing=success&session_id=…` → `POST /api/stripe/confirm` → cookie HttpOnly
4. `GET /api/auth/session` valida assinatura `active` / `trialing`
5. Botão **Plano** na home → Customer Portal Stripe

### Login e-mail + senha (assinantes)

O login inclui **Mostrar/Ocultar senha** e **Esqueci minha senha**. A recuperação
usa Resend e um link de uso único com validade de 30 minutos. Configuração,
contratos e testes: [Recuperação de senha](engineering/recuperacao-senha.md).

1. Landing → **Entrar** → e-mail + senha **ou** Google
2. `POST /api/auth/login` (ou `/api/auth/register`) — senha em hash scrypt no **metadata Stripe** (`vc_pw_salt` / `vc_pw_hash`)
3. Se assinatura Stripe ativa → cookie `vc_access`
4. Conta nova sem plano → `{ needCheckout: true }` → Paywall

Google continua disponível; o redirect OAuth usa o **host da request** (evita mismatch com domínio customizado).

### Login Google (opcional)

1. Landing → **Entrar** → **Continuar com Google**
2. `GET /api/auth/google` → OAuth Google → `/api/auth/google/callback`
3. Servidor lê o e-mail Google, procura cliente Stripe com assinatura ativa
4. Se ativo → cookie `vc_access` → `/?billing=restored&login=google`
5. Se sem assinatura → paywall com o e-mail pré-preenchido

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
APP_URL=https://viralcarrossel.com.br
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
```

### Setup Google OAuth

1. [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → Create credentials → OAuth client ID → **Web application**
2. Authorized JavaScript origins: `https://viralcarrossel.com.br` e `https://www.viralcarrossel.com.br`
3. Authorized redirect URIs: `https://viralcarrossel.com.br/api/auth/google/callback` (e www se usares)
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
