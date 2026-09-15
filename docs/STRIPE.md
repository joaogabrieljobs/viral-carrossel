# Stripe — assinatura individual Viral.

> **Atualização de produto (2026-09-14):** o modelo passa a **4 planos** (Essencial R$ 19,90 · Criador R$ 97 · Pro R$ 197 · Max R$ 297), com **imagens inclusas via SJinn** nos tiers pagos e quota mensal. Texto incluso via Z.ai no servidor (`ZAI_API_KEY`, proxy `/api/ai/compatible` com allowlist de modelos); BYOK (Anthropic/OpenAI/Kimi/Z.ai próprio) continua opcional. Spec completa: [`docs/product/PRD-planos-imagem-sjinn.md`](./product/PRD-planos-imagem-sjinn.md). A secção abaixo descreve o modelo **legado** ainda em produção até o épico ser implementado.

## Modelo (legado — 1 plano)

- **1 plano:** acesso ao studio (Criador · Diretor · Studio)
- **R$ 97/mês** (criar no Dashboard Stripe em BRL)
- **BYOK:** geração usa a chave Anthropic/OpenAI do utilizador — sem limite de carrosséis no produto
- **Sem base de dados:** o cookie `vc_access` + estado live da assinatura no Stripe são a fonte da verdade

## Fluxo

1. Landing → CTA → Paywall (e-mail para **nova** assinatura) **ou** **Entrar** (só Google)
2. `POST /api/stripe/checkout` → Stripe Checkout (se o e-mail já tem sub ativa → `{alreadyActive, requireLogin}` **sem** cookie)
3. Sucesso → `/?billing=success&session_id=…` → `POST /api/stripe/confirm` → cookie HttpOnly
4. `GET /api/auth/session` valida assinatura `active` / `trialing`
5. Botão **Plano** na home → Customer Portal Stripe

### Login e-mail + senha (assinantes)

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

1. Criar produto **Viral. Studio**
2. Preço recorrente: **BRL 97,00 / mês** → copiar `price_…`
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
APP_URL=https://viral-carrossel.vercel.app
STRIPE_SECRET_KEY=sk_...
STRIPE_PRICE_ID=price_...
STRIPE_WEBHOOK_SECRET=whsec_...
ACCESS_COOKIE_SECRET=<string longa aleatória>
GOOGLE_CLIENT_ID=....apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-...
```

### Setup Google OAuth

1. [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → Create credentials → OAuth client ID → **Web application**
2. Authorized JavaScript origins: `https://viral-carrossel.vercel.app` (e domínio custom se houver)
3. Authorized redirect URIs: `https://viral-carrossel.vercel.app/api/auth/google/callback`
4. Colar Client ID + Client Secret nas env da Vercel e redeploy

`ZAI_API_KEY` é obrigatória (texto incluso no plano). `ANTHROPIC_API_KEY` é opcional — fallback no proxy `/api/anthropic/v1/messages` para assinantes sem chave própria (o cliente actual só chama esse proxy com chave própria).

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
