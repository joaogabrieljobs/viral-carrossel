# Stripe — assinatura individual Viral.

## Modelo

- **1 plano:** acesso ao studio (Criador · Diretor · Studio)
- **R$ 97/mês** (criar no Dashboard Stripe em BRL)
- **BYOK:** geração usa a chave Anthropic/OpenAI do utilizador — sem limite de carrosséis no produto
- **Sem base de dados:** o cookie `vc_access` + estado live da assinatura no Stripe são a fonte da verdade

## Fluxo

1. Landing → CTA → Paywall (e-mail)
2. `POST /api/stripe/checkout` → Stripe Checkout
3. Sucesso → `/?billing=success&session_id=…` → `POST /api/stripe/confirm` → cookie HttpOnly
4. `GET /api/auth/session` valida assinatura `active` / `trialing`
5. Botão **Plano** na home → Customer Portal Stripe

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
```

Manter `ANTHROPIC_API_KEY` se quiseres fallback no proxy; o modelo principal continua BYOK no browser.

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
