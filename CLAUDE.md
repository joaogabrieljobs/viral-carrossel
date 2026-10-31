# Moont

## Estado conferido em 30/10/2026

- Produção web: commit `c7cad93` na Vercel; `main` e `origin/main` estavam iguais no início da revisão.
- Trabalho em revisão: PR #1 (desktop Tauri), PR #2 (login e integrações) e PR #3 (fontes/MCP). Nenhum deles estava no tronco ou em produção.
- Fontes só podem ser publicadas com licença comercial gratuita comprovada; arquivos trial, demo ou personal use não entram.
- Push autorizado para `main` inclui o deploy automático correspondente. Merge e deploy continuam dependendo da autorização dada para a entrega específica.
- Handoff completo: `docs/SESSAO-2026-10-30-REVISAO.md`.

Antes: o último estado publicado documentado no código era a correção de fotos compartilhadas de 29/10/2026.

Studio de narrativas visuais com IA para comunicação e apresentações. Vite + React 18; monólito legado `ViralCarrossel.jsx` + módulos em `src/`; serverless Vercel em `api/` (Stripe + Google OAuth + proxies IA). Produção: **Vercel** com domínio oficial **https://moont.ai** (hosts `*.vercel.app`, `www.moont.ai` e `moont.com.br` redirecionam para o oficial). `viralcarrossel.com.br` permanece ativo temporariamente para migrar dados locais salvos no navegador; não redirecionar esse host até confirmar a migração. Netlify aposentado em 2026-08-07 — só redireciona 301. O acesso usa cookie `vc_access` e Stripe; a biblioteca sincronizada usa Postgres quando `LIBRARY_SYNC_BACKEND=postgres`, mantendo dados locais no navegador. Imagens dos cards vivem em IndexedDB no browser (`src/utils/image-store.js`) e têm sincronização de mídia em nuvem quando configurada.

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
