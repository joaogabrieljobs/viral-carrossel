# Auditoria da Realidade — Viral. Carrossel Studio

Data: 2026-08-07 · Gerada pela Fase -1 do pipeline spec-driven-dev.

## Stack real

- **Front:** Vite 5 + React 18, Tailwind via CDN (index.html), GSAP, lucide-react, jszip.
- **Monólito:** `ViralCarrossel.jsx` (~844 KB, raiz do repo) concentra app inteiro; componentes parcialmente extraídos em `src/components/` (Paywall, LoginModal, GoogleSignInButton, OnboardingLanding, etc.).
- **Backend:** funções serverless estilo Vercel em `api/`:
  - `api/stripe/` — `checkout.js`, `confirm.js`, `portal.js`, `webhook.js`
  - `api/auth/` — `google.js`, `google/callback.js`, `session.js`, `logout.js`
  - `api/lib/` — `access.js` (cookie HMAC `vc_access`, 30 dias), `stripe.js`, `google-auth.js`, `billing-handlers.js`
  - `api/ai/compatible.js`, `api/anthropic/v1/messages.js`, `api/fetch-source.js` (proxies IA)
- **Sem banco de dados.** Fonte da verdade: cookie `vc_access` assinado + estado da assinatura no Stripe (ver `docs/STRIPE.md`).
- **Modelo de negócio:** 1 plano individual R$ 97/mês, BYOK (chave Anthropic/OpenAI do usuário).

## Deploy — DIVERGÊNCIA CRÍTICA

Dois alvos de deploy coexistem:

| Alvo | Config | Suporta `api/` (Stripe/Auth)? |
|---|---|---|
| Netlify (`viralcarrocel.netlify.app`) | `netlify.toml` | **NÃO** — só tem `anthropic-proxy.mjs` e `fetch-source.mjs` em `netlify/functions/`. Endpoints `/api/stripe/*` e `/api/auth/*` retornam o fallback SPA (index.html). |
| Vercel (`viral-carrossel.vercel.app`) | `vercel.json` + `.vercel/` | SIM — `api/` é convenção Vercel. `docs/STRIPE.md` assume Vercel. |

Consequência: paywall/login **não funcionam no deploy Netlify**. Definir produção única ou portar funções.

## Testes

- **Zero testes. Zero framework de teste** (sem vitest/jest em package.json).
- Nenhum script `test` no package.json.
- Código de pagamento e auth em produção sem nenhuma cobertura.

## Achados de segurança

1. ~~CORS refletia qualquer `Origin` com credentials~~ **CORRIGIDO 2026-08-07**: allowlist (`APP_URL` + localhost dev) em `api/lib/billing-handlers.js`.
2. ~~Cookie secret com fallback pra `STRIPE_SECRET_KEY`~~ **CORRIGIDO 2026-08-07**: `ACCESS_COOKIE_SECRET` obrigatória em `api/lib/access.js`. ⚠️ Garantir env setada na Vercel antes do deploy — sem ela, auth endpoints falham (antes caíam no fallback).
3. ~~`BILLING_DISABLED` sem guard~~ **CORRIGIDO 2026-08-07**: ignorada em `VERCEL_ENV=production` / `NODE_ENV=production`.
4. Webhook Stripe valida `stripe-signature` + exige `whsec_` — OK (verificado).

## Decisões do usuário (2026-08-07)

- **DEC-A:** Produção = **Vercel**. Netlify obsoleto para app (avaliar desativar ou manter só landing).
- **DEC-B:** Modelo continua **1 plano individual R$ 97/mês** (venda de acesso individual). "Checkout multiusuários" = **testar** N usuários simultâneos comprando/logando, não feature multi-seat.

## Documentação existente

- `docs/STRIPE.md` — fluxo billing/auth (atual, consistente com `api/`).
- `docs/SLIDE-DESIGN.md`, `DESIGN.md`, `ROADMAP.md`, `manual_conteudo_estrategico_carrosseis.md`.
- `CLAUDE.md` vazio; `AGENTS.md` 47 bytes.
- Sem `docs/product/`, `docs/engineering/`, `docs/epics/` (pipeline nasce agora).

## Código morto / risco

- `netlify/functions/` parcialmente obsoleto se produção for Vercel.
- `webTrendServer.js`, `urlSourceFetch.js` na raiz — servidores dev locais.
- Monólito de 844 KB dificulta teste unitário direto; lógica de billing do front está em `src/lib/billing.js` (testável isolada).

## Divergências doc × código

1. **Deploy duplo** (acima) — STRIPE.md diz Vercel; Netlify segue vivo e foi usado hoje para a landing.
2. STRIPE.md: "1 plano individual". Pedido atual menciona "checkout multiusuários" — **conflito de modelo** (individual × multi-seat). Precisa decisão de produto antes de qualquer PRD.
