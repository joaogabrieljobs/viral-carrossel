# Viral. Carrossel Studio

Gerador de carrosséis Instagram com IA. Vite + React 18; monólito `ViralCarrossel.jsx` + módulos em `src/`; serverless Vercel em `api/` (Stripe + Google OAuth + proxies IA). Produção: **Vercel** com domínio oficial **https://viralcarrossel.com.br** (hosts `*.vercel.app` redirecionam para o oficial). Netlify aposentado em 2026-08-07 — só redireciona 301. Sem banco de utilizadores — cookie `vc_access` + Stripe são a fonte da verdade de acesso e também da quota mensal de imagens (contador em `customer.metadata`, ver `api/lib/quota-stripe-store.js`); Upstash Redis é opcional e, quando configurado, assume a contagem por ser atómico. Imagens dos cards vivem em IndexedDB no browser (`src/utils/image-store.js`), não no localStorage.

## Documentos de contexto (spec-driven)

- Uso atual: **docs/product/guia-projetos-geracao.md** (contexto, escopo, modos, remix, cancelamento, logo e backup)
- Tese de produto (duas profundidades): **docs/product/duas-profundidades-criacao.md** (Criar rápido × Controle profissional; Fatias 0–3)
- Organização editorial: **docs/product/organizacao-calendario.md** (pastas, estados, data da pauta, calendário local e regras de backup)
- Contratos atuais: **docs/engineering/controles-geracao-projeto.md** · docs/engineering/referencias-imagem-plano.md · docs/engineering/recuperacao-senha.md
- Landing: **docs/LANDING-COPY.md**; preços/quotas vêm de `shared/plans.js`, texto incluso e chave própria opcional.
- Auditorias históricas: docs/audit.md (2026-08-07) · docs/audit-produto.md (2026-08-07) · docs/audit-ia-2026-09-15.md. Achados e linhas retratam a versão auditada; consultar revisões posteriores e o código atual antes de reutilizá-los.
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
