# Spec — Task 08: e2e-jornadas-billing

**Épico:** docs/epics/suite-testes-confianca/README.md
**Status:** Concluída

## 1. Objetivo
4 jornadas E2E de billing (RF-07 jornada, RF-15): comprar, restaurar, negar, logout — contra o build real com `/api` interceptado.

## 2. Contexto herdado
- Boot effect processa `?billing=success&session_id` → confirm → studio; `?billing=cancel` → paywall (task de navegação corrigiu limpeza da URL).
- Paywall: submit → `startCheckout` → `window.location.href = data.url` → truque E2E: mock devolve URL same-origin `/?billing=success&session_id=cs_e2e` simulando a volta do Stripe.
- **Divergência achada e corrigida nesta task:** `logoutAccess()` existia sem nenhuma UI — botão "Sair da conta" adicionado ao card Assinatura do `AccountProfile` (prop `onLogout`, thread App → AccountHomeShell → AccountProfile). Sem isso a jornada de logout era intestável.

## 3. Arquivos a tocar
| Arquivo | Ação | O quê |
|---|---|---|
| `src/components/AccountProfile.jsx` | editar | prop `onLogout` + botão "Sair da conta" |
| `ViralCarrossel.jsx` | editar | `handleLogout` (logoutAccess + reload) + threading da prop |
| `tests/e2e/billing-jornadas.spec.js` | criar | 4 jornadas |

## 3b. Modo Refactor
- **Current:** endpoint + client de logout órfãos, sem trigger de UI.
- **Desired:** botão no perfil → `POST /api/auth/logout` → reload → paywall.
- **Gap:** só UI. **Migration:** aditivo, sem dado.

## 6. Critérios de aceite
- [ ] CA-01 comprar: paywall → e-mail → assinar → volta `?billing=success` → confirm chamado → studio aberto
- [ ] CA-02 restaurar: `?billing=restored&login=google` com sessão ativa → studio direto
- [ ] CA-03 negar: `?billing=cancel` anônimo → paywall (e URL limpa de `billing`)
- [ ] CA-04 logout: perfil → "Sair da conta" → `POST /api/auth/logout` disparado → volta pro gate sem sessão

## 7. Validação
```bash
npm test && npm run test:e2e && npm run build
```

## 8. Gates
- [x] Quality — [x] UX (botão novo segue padrão dos botões do card) — [x] Security (logout de verdade encerra sessão server-side) — [ ] Performance N/A

## 9. Rollback
Revert único; botão é aditivo.

## 10. Fora de escopo
Multi-context (10), portal Stripe real.
