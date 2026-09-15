# Viral. Carrossel Studio

Gerador de carrosséis Instagram com IA. Vite + React 18; monólito `ViralCarrossel.jsx` + módulos em `src/`; serverless Vercel em `api/` (Stripe + Google OAuth + proxies IA). Produção: **Vercel** (`viral-carrossel.vercel.app`). Netlify aposentado em 2026-08-07 — só redireciona 301. Sem banco de utilizadores — cookie `vc_access` + Stripe são a fonte da verdade de acesso; Upstash Redis só guarda a quota mensal de imagens SJinn (`api/lib/image-quota.js`).

## Documentos de contexto (spec-driven)

- Auditorias: docs/audit.md (infra/billing) · docs/audit-produto.md (2026-08-07, histórico) · **docs/audit-ia-2026-09-15.md** (prompts, fluxos IA, proxies, testes — baseline actual)
- PRD: docs/product/PRD-suite-testes-confianca.md
- TDD: docs/engineering/TDD-suite-testes-confianca.md
- Épicos e specs: docs/epics/
- Billing/auth: docs/STRIPE.md

Regra: antes de implementar qualquer task, leia a spec correspondente e os documentos acima. Divergência entre código e documento → parar e reportar.

## Onde rodar os comandos

O repositório é aninhado: o app vive em `viral-carrossel/viral-carrossel/`. A pasta pai tem um `package.json` só com atalhos que fazem `cd` para cá. Rodar `npm run <script>` da pasta errada dá `Missing script`.

## Testes

- `npm test` — unit + integração (Vitest, `tests/unit` + `tests/integration`)
- `npm run test:e2e` — Playwright contra `vite preview` (`tests/e2e`), `/api` sempre mockado
- CI obrigatório verde antes de considerar deploy OK (2 jobs: test + e2e)
