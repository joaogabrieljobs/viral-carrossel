# Viral. Carrossel Studio

Gerador de carrosséis Instagram com IA. Vite + React 18; monólito `ViralCarrossel.jsx` + módulos em `src/`; serverless Vercel em `api/` (Stripe + Google OAuth + proxies IA). Produção: **Vercel**. Sem banco — cookie `vc_access` + Stripe são a fonte da verdade.

## Documentos de contexto (spec-driven)

- Auditorias: docs/audit.md (infra/billing) · docs/audit-produto.md (agentes IA, prompts, design, navegação + backlog)
- PRD: docs/product/PRD-suite-testes-confianca.md
- TDD: docs/engineering/TDD-suite-testes-confianca.md
- Épicos e specs: docs/epics/
- Billing/auth: docs/STRIPE.md

Regra: antes de implementar qualquer task, leia a spec correspondente e os documentos acima. Divergência entre código e documento → parar e reportar.
