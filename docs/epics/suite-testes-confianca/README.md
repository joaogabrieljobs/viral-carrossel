# Épico — Suite de Testes de Confiança

**TDD de origem:** docs/engineering/TDD-suite-testes-confianca.md
**PRD:** docs/product/PRD-suite-testes-confianca.md · **Auditorias:** docs/audit.md, docs/audit-produto.md
**Objetivo do épico:** um comando responde "produto, login e pagamento funcionam?" antes de todo deploy, incluindo N usuários simultâneos.

## Tasks (slices verticais)

| ID | Task | Entrega verificável | RF / DEC | Depende de | Status |
|---|---|---|---|---|---|
| 01 | walking-skeleton-vitest-ci | `npm test` roda Vitest com 1 teste real de `api/lib/access.js` (token válido + adulterado) passando local e no GitHub Actions | RF-04 (parcial) · DEC-001, DEC-007 | — | ✅ 2026-08-07 |
| 02 | unit-utils-puros | Testes de `src/utils/*` (parsers, formats, schema-migration, brand-helpers, hooks-library, wcag, slide-design-system) + `src/lib/billing.js` | RF-03 | 01 | ✅ 2026-08-07 |
| 03 | integracao-auth | `session`, `logout`, `access.js` completo (expirado/ausente), Google OAuth mockado (state inválido, assinante, sem sub) via req/res fake | RF-04, RF-05, RF-06 · DEC-003 | 01 | ✅ 2026-08-07 |
| 04 | integracao-stripe | `checkout` (e-mail inválido/novo/já ativo), `confirm` (paga/não paga/inválida), `portal` (401/ok), `webhook` (assinatura válida/inválida) com `vi.mock('stripe')` | RF-07..RF-10 · DEC-002 | 01 | ✅ 2026-08-07 |
| 05 | seguranca-regressao | Origin fora da allowlist sem ACAO; `getSecret()` sem env → throw; `BILLING_DISABLED` ignorada em prod; proxy Anthropic anônimo → 401 | RF-12..RF-14 · DEC-005 | 03 | ✅ 2026-08-07 |
| 06 | concorrencia-multiusuario | 5× `checkout→confirm→session` em `Promise.all`; cada resposta com cookie do próprio `customerId`, zero vazamento cruzado | RF-11 · DEC-004 | 03, 04 | ✅ 2026-08-07 |
| 07 | e2e-skeleton-playwright | `npm run test:e2e` roda Playwright contra `vite preview`; landing renderiza sem erro de console; paywall bloqueia studio com `/api` mockado | RF-01, RF-15 · DEC-003, DEC-005 | 01 | ✅ 2026-08-07 |
| 08 | e2e-jornadas-billing | Jornadas: comprar (checkout mockado → `?billing=success` → studio), restaurar, negar sem assinatura, logout | RF-07 (jornada), RF-15 | 07 | ⬜ |
| 09 | e2e-produto-export | Gerar carrossel com IA mockada (regressão `capRules`/`voiceBulk`), editar e exportar PNG + ZIP válidos | RF-02 | 07 | ⬜ |
| 10 | e2e-multiusuario | 5 browser contexts paralelos comprando/entrando; sessões isoladas na UI | RF-11 · DEC-004 | 08 | ⬜ |
| 11 | fechamento-ci-cobertura | Reporter junit + traces como artifacts; checklist de cobertura dos fluxos críticos = 100%; docs atualizados (STRIPE.md ganha seção "rodar testes") | OB-02, OB-04 · DEC-007 | 02..10 | ⬜ |

## Ordem sugerida e paralelismo

- Sequencial: 01 → resto.
- Após 01: **02 ∥ 03 ∥ 04 ∥ 07** (quatro frentes independentes).
- Após 03: 05. Após 03+04: 06. Após 07: 08 ∥ 09. Após 08: 10.
- 11 fecha o épico.

## Definição de pronto do épico

- [ ] `npm test` verde cobre 100% dos fluxos de billing/auth listados no TDD §5 (métrica PRD §4)
- [ ] ≥ 4 jornadas E2E passando (comprar, restaurar, negar, logout)
- [ ] Cenário multiusuário ≥ 5 paralelos passando em integração E em E2E
- [ ] 1 teste de regressão por achado de segurança corrigido (CORS, cookie secret, BILLING_DISABLED, proxy IA)
- [ ] CI verde obrigatório em push na main
- [ ] Suíte unit+integração termina em < 2 min local (RNF-01)
- [ ] Nenhum teste toca rede externa nem dados pessoais reais (RNF-02/05)
