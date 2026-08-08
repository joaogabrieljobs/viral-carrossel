# Spec — Task 07: e2e-skeleton-playwright

**Épico:** docs/epics/suite-testes-confianca/README.md
**Status:** Concluída

## 1. Objetivo
`npm run test:e2e` roda Playwright contra o build real (`vite preview`): landing renderiza sem erro de console (RF-01) e paywall bloqueia o studio sem assinatura (RF-15). Todas as rotas `/api/*` interceptadas (DEC-005) — `vite preview` não serve funções.

## 2. Contexto herdado
- Navegação (audit-produto §4): landing gate `?landing=1` força landing; `?app=1` pula direto (paywall se sessão inativa); build de produção tem `import.meta.env.DEV=false` → sem fallback dev de billing.
- Seletores reais: landing tem `h1` "Carrossel que prende" e CTA "Entrar no studio"; paywall é shell fullscreen com formulário de e-mail.

## 3. Arquivos a tocar
| Arquivo | Ação | O quê |
|---|---|---|
| `package.json` | editar | devDep `@playwright/test` + scripts `test:e2e`, `test:e2e:ui` |
| `playwright.config.js` | criar | webServer `npm run build && vite preview`, baseURL :4173, chromium, trace on-failure |
| `tests/e2e/helpers/api-mock.js` | criar | `mockApi(page, {session}why)` — intercepta `/api/**` |
| `tests/e2e/landing.spec.js` | criar | RF-01: landing sem erro de console; CTA visível |
| `tests/e2e/paywall.spec.js` | criar | RF-15: `?app=1` anônimo → paywall, studio inacessível |

## 6. Critérios de aceite
- [ ] CA-01: `npm run test:e2e` verde local
- [ ] CA-02: landing (`?landing=1`) renderiza h1 + CTA sem NENHUM erro de console
- [ ] CA-03: `?app=1` com sessão anônima mockada → paywall visível, editor ausente
- [ ] CA-04: nenhuma requisição escapa para rede externa (asserção de rotas intercept)

## 7. Validação
```bash
npm test && npm run test:e2e
```

## 8. Gates
- [x] Quality (inclui E2E — fecha fluxo de usuário) — [x] UX (smoke da landing) — [ ] Security N/A aqui — [ ] Performance N/A

## 9. Rollback
Revert; devDep nova sem impacto de runtime.

## 10. Fora de escopo
Jornadas de billing (08), geração/export (09), multi-context (10), CI e2e (11).
