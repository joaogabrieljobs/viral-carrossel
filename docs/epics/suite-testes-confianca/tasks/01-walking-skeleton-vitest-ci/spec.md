# Spec — Task 01: walking-skeleton-vitest-ci

**Épico:** docs/epics/suite-testes-confianca/README.md
**Status:** Concluída

## 1. Objetivo

`npm test` roda Vitest com o primeiro teste real do produto (assinatura/validação do cookie de acesso, `api/lib/access.js`) passando local e no GitHub Actions. Realiza RF-04 (parcial), DEC-001 (Vitest) e DEC-007 (CI).

## 2. Contexto herdado

- PRD RF-04: "verificação automática da emissão e validação do cookie de acesso (token válido, expirado, adulterado, ausente)" — esta task cobre válido + adulterado; expirado/ausente ficam na task 03.
- TDD §3: Vitest ambiente `node`, zero deps novas em `dependencies`. §10: segredos sintéticos, nunca ler `.env.local`.
- Código real: `api/lib/access.js` exporta `createAccessToken({customerId,email})` → `"payloadB64.sig"`, `verifyAccessToken(token)` → payload | null (HMAC sha256, `timingSafeEqual`), `getSecret()` lê `process.env.ACCESS_COOKIE_SECRET` a cada chamada e lança sem ela (fix de 2026-08-07).

## 3. Arquivos a tocar

| Arquivo | Ação | O quê | Quem consome |
|---|---|---|---|
| `package.json` | editar | devDep `vitest` + script `"test": "vitest run"` e `"test:watch": "vitest"` | npm, CI |
| `vitest.config.js` | criar | config separada (não tocar `vite.config.js`, que carrega middlewares dev); `environment: 'node'`, include `tests/**/*.test.js` | vitest |
| `tests/helpers/env.js` | criar | seta `process.env.ACCESS_COOKIE_SECRET` sintético | testes |
| `tests/integration/access.test.js` | criar | 3 testes: token válido round-trip; assinatura adulterada → null; payload adulterado → null | vitest |
| `.github/workflows/ci.yml` | criar | push/PR na main: `npm ci` → `npm test` → `npm run build` | GitHub Actions |

Descoberta: `access.js` é importado por `billing-handlers.js`, `google/callback.js`, `anthropic/v1/messages.js` — nenhum é alterado; teste importa o módulo direto.

## 3b. Modo Refactor

N/A — só adição; nenhum arquivo de produção alterado além de `package.json` (devDeps).

## 4. Plano de implementação

1. `npm i -D vitest` → lockfile atualizado.
2. `vitest.config.js` + `tests/helpers/env.js`.
3. `tests/integration/access.test.js` — importa helper antes do módulo.
4. Rodar `npm test` local → 3 verdes.
5. `.github/workflows/ci.yml` → push → Actions verde.
6. Marcar task no README do épico.

## 5. Contratos exatos

```js
// access.test.js asserta:
createAccessToken({ customerId: 'cus_teste_1', email: 'user1@teste.exemplo' })
// → string "a.b"; verifyAccessToken(token) → { customerId, email, iat }
// token com sig trocada → null · payload trocado (mesma sig) → null
```

## 6. Critérios de aceite

- [ ] CA-01: `npm test` local sai 0 com 3 testes passando
- [ ] CA-02: token assinado é verificado com os mesmos campos
- [ ] CA-03: qualquer adulteração (payload ou assinatura) → `null`, sem exceção
- [ ] CA-04: workflow Actions verde no push desta task
- [ ] CA-05: `npm run build` continua verde

## 7. Validação

```bash
npm test
npm run build
```

## 8. Gates aplicáveis

- [x] Quality Gate (sempre)
- [ ] UX Gate — N/A, sem interface
- [x] Security Gate — teste cobre primitiva de segurança (HMAC do cookie); segredo de teste sintético
- [ ] Performance Gate — N/A
- [x] Docs Gate — marcar task no README do épico

## 9. Rollback

Reverter o commit único (`git revert`); nenhum estado externo. CI novo não bloqueia nada existente além de si próprio.

## 10. Fora de escopo desta task

Testes de session/checkout/webhook (tasks 03-04), expirado/ausente (03), Playwright (07), cobertura (11). Não tocar `vite.config.js` nem código de produção.

## 11. Riscos de execução

- `access.js` usa `import crypto from 'crypto'` — Vitest node resolve nativamente; se falhar, é sinal de config errada de environment (detectar no passo 4).
- Segredo lido a cada chamada: helper deve setar env ANTES de qualquer `createAccessToken`.
