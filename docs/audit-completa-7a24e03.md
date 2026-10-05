# Auditoria completa — Viral Carrossel

**Commit:** `7a24e03` (`feat: improve direct card editing controls`)  
**Data:** 2026-10-04  
**Método:** skill `auditoria-completa-app` · snapshot `git archive` + worktree detach  
**Artefactos:** `/Users/elevessy/Documents/viral-carrossel-audit-7a24e03/`

---

## 1. Resumo para decisão

| Frente | P0 | P1 | P2 | P3 | Falsos / N/A |
|---|---:|---:|---:|---:|---|
| Backend | 0 | 0 | 3 | 2 | 1 (desenho) |
| Frontend lógica | 0 | 3 | 3 | 9 | 0 |
| Web produto | 0 | 2* | 2 | 3 | 8 conformes |
| UX | 0 | 0 | 1 | 0 | 2 falsos |
| Métricas/planos | 0 | 0 | 0 | 0 | 6 conformes |
| **Total confirmado/parcial** | **0** | **5** | **9** | **13** | — |

\*WEB-001/006 reclassificados P1 condicionais (`APP_URL` ausente). WEB-013 rebaixado a P2 (endpoint bootstrap com `BOOTSTRAP_SECRET`).

### Top prioridades

1. **FE-001/002/003 (P1)** — Logout limpa cookie mas **não** limpa `localStorage` / IndexedDB / chaves BYOK → próximo utilizador no mesmo browser herda biblioteca, marcas e chaves.
2. **WEB-001/006 (P1 condicional)** — `getAppUrl` cai para `x-forwarded-host` se `APP_URL` vazio → open redirect em checkout/OAuth.
3. **BE-001 (P2)** — Quota Stripe read-modify-write sem atomicidade (sem Upstash).
4. **BE-003 (P2)** — Cache 15s de assinatura após cancelamento.
5. **UX-003R (P2 parcial)** — Em Criar rápido, header «Assistente IA» ainda abre o modal em paralelo à sidebar.

### Positivos a preservar

- Gate `requireActiveSubscription` nos proxies IA / fetch-source / OCR / SJinn.
- Anthropic **sem** chave de plataforma (BYOK).
- Quota com Stripe metadata + teto degradado 25 (remediação H5).
- Cookie `vc_access` HttpOnly + HMAC + revogação por `vc_session_revoked_before`.
- Telemetria sem conteúdo de prompt; planos/preços alinhados a `shared/plans.js`.
- Sem `dangerouslySetInnerHTML` / `document.write`.
- Unitários **454/454**; build OK.

---

## 2. Cobertura real

| Nível | Ficheiros |
|---|---:|
| integral (API/auth/billing) | 39 |
| logica_integral (cliente) | 121 |
| estrutura | 127 |
| triagem (testes) | 112 |
| excluído (assets/skills) | 39 |
| **Total git ls-files** | **438** |

**Comandos:** `npm ci`, `vitest run` (454 pass), `npm run build`, `npm audit` (8 advisories, todos toolchain/dev).  
**Não executado:** pagamento Stripe real; suite e2e completa nesta sessão (inventário + amostragem de specs); Postgres (inexistente — catálogo adaptado a Stripe/Redis).

---

## 3. Achados (só CONFIRMADO/PARCIAL após Fase 7)

### P1

| ID | Título |
|---|---|
| FE-001 | Logout não limpa localStorage/IndexedDB |
| FE-002 | Persistência sem partição por conta |
| FE-003 | Chaves BYOK sobrevivem ao logout |
| WEB-001 | `getAppUrl` via headers se `APP_URL` vazio |
| WEB-006 | Checkout success/cancel usam `getAppUrl` |

### P2 (selecção)

| ID | Título |
|---|---|
| BE-001 | Lost update no contador Stripe de imagens |
| BE-003 | Cache 15s pós-cancelamento |
| BE-005 | Fallback memória cap 25 se Stripe falhar |
| FE-004 | Perfil criador permanece após logout |
| FE-010 | Export silencia slides sem blob |
| FE-012 | Avatar base64 pressiona quota localStorage |
| WEB-002 | BYOK em localStorage (opt-in XSS) |
| WEB-013 | `set-password` devolve password + sem rate limit (só bootstrap) |
| UX-003R | Header Assistente IA compete com Criar rápido |

### P3 / informativos

Rate limit em memória (BE-004), webhook só log (BE-002 desenho), alerts nativos, contraste hero, etc. — ver `verificacao/vereditos.md`.

### Rejeitados na verificação

| ID | Veredito |
|---|---|
| UX-005R | FALSO — tour já tem 3 passos |
| UX-006R | FALSO — hit areas já 44×44 |

---

## 4. Plano por canal

| Canal | Acções |
|---|---|
| **web (cliente)** | Em `handleLogout`: limpar chaves `SK.*` + IndexedDB; opcional prefixo por `customerId`. Header Criar rápido → focar sidebar. |
| **servidor** | Fail-hard se `APP_URL` vazio em produção; allowlist hosts. Rate limit Redis. Invalidar cache de access no cancel. Fail-closed quota se Stripe down. Optimistic lock Stripe ou exigir Upstash. |
| **SQL** | N/A (sem Postgres). |
| **build loja** | N/A (web). |

---

## 5. Monitoramento

| Sinal | Fonte | Frequência | Limiar | Acção |
|---|---|---|---|---|
| Quota degradada (memória) | logs `[image-quota]` | contínuo | qualquer em prod | alert + restaurar Upstash/Stripe |
| Webhook 400/500 | Stripe dashboard | diário | >1% | revisar secret/body |
| 402 após cancel | logs require-access | semanal | uso >15s pós-cancel | reduzir TTL |

---

## 6. Limites

- Sem exploração live de pagamento.
- Banco = Stripe/Redis; `escrita-cliente.sql` da skill não aplicável.
- Frentes UX/métricas/web/FE por subagentes; BE escrito no orquestrador e verificado por evidência directa.
- npm audit high = vite/browserslist (dev), não API prod.

---

## 7. Fontes

- `preservacao/registro.md`
- `cobertura/cobertura.csv`
- `automatico/fase2-resumo.json`, `vitest.json`
- `banco/escrita-sensivel.rg.txt`
- `frentes/*-achados.md`
- `jornada/estado.md`
- `verificacao/vereditos.{md,json}`
- `consolidacao/achados.json`

---

## 8. Regressão sugerida (Fase 8)

1. E2E: logout → `localStorage` sem `vc_library` / sem `vc_ai_keys`; IndexedDB apagado.
2. Unit: `getAppUrl` lança em `VERCEL_ENV=production` sem `APP_URL`.
3. Integração: 2× `stripeQuotaConsume` paralelo (já parcial em `quota-stripe.test.js`) — assert desvio ≤1.
4. Integração: após invalidar cache, cancel → 402 imediato em proxy.
5. Manter e2e billing CA-04 + password-recovery.

---

## 9. Remediação (pós-auditoria)

Corrigido no working tree após o relatório (commit de remediação pendente):

| Prioridade | IDs | Estado |
|---|---|---|
| P1 | FE-001/002/003, WEB-001/006 | ✅ logout limpa dados; `getAppUrl` fail-hard |
| P2 | BE-001/003/005, RL billing, payload.n, FE-010/012, UX-003R, WEB-013 | ✅ |
| P3 | FE-006/007/013/015, WEB-004/010, BE-TIMING, BE-CORS, BE-004, FE-011/014 | ✅ |
| Mantido | WEB-002 (BYOK opt-in), BE-002 (webhook desenho) | intencional |

Worktree de evidência: `/Users/elevessy/Documents/viral-carrossel-audit-7a24e03/`.

---

## Adenda — backend tardio ([Audit backend](b5cad272-ee02-4e38-b41c-9291fe3d400b))

O agente de backend concluiu depois da consolidação. Verificação adversarial rápida dos IDs extra:

| ID externo | Veredito | Prioridade | Nota |
|---|---|---|---|
| confirm/session/portal s/ rate limit | CONFIRMADO | P2 | Só `checkout` tem `consumeRateLimit` (`billing-handlers.js:125-127`); `handleConfirm`/`handlePortal`/`handleSession` não |
| `set-password` secret `!==` | CONFIRMADO | P3 | `set-password.js:31` compara secret com `!==` (não `timingSafeEqual`); já exige `BOOTSTRAP_SECRET` |
| `compatible.js` não bloqueia `n` | CONFIRMADO | P2 | Com chave plataforma (`!userKey`) há allowlist de modelo/tokens (`compatible.js:99-112`) mas `payload.n` não é sanitizado → risco de fan-out de custo em chat |
| CORS `localhost` em prod | CONFIRMADO | P3 | `cors.js:10-11` inclui localhost na allowlist sempre; impacto baixo (Origin real do site canónico não é localhost) |

Contagens actualizadas se se incluírem estes: **+3 P2, +2 P3** no backend (sem alterar o Top P1).
