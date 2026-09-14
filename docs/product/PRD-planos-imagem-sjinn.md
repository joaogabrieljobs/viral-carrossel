# PRD — Planos com imagem inclusa (SJinn) + Essencial sem imagem

**Status:** Decisões fechadas (pronto para épico/tasks)
**Autor:** João Gabriel (via sessão de produto)
**Data:** 2026-09-14
**Substitui (parcial):** modelo “1 plano R$ 97 + BYOK total” em `docs/STRIPE.md` e `docs/audit.md` DEC-B — no que toca a **imagem**. Texto continua BYOK.

## 1. Problema

Hoje o assinante paga R$ 97 e ainda tem de configurar chave de API para gerar imagens. Isso gera fricção no onboarding, suporte e abandono pós-pagamento. Queremos **imagens inclusas nos planos pagos**, com **limite por tier**, e um plano barato **sem** geração de imagem pela plataforma.

## 2. Decisões fechadas (LOCKED)

| ID | Decisão |
|---|---|
| D-01 | **Só imagem** via plataforma (SJinn → GPT Image 2). **Texto continua BYOK.** |
| D-02 | Quatro planos: **Essencial · Criador · Pro · Max**. |
| D-03 | Preços mensais: **R$ 19,90 · R$ 97 · R$ 197 · R$ 297**. |
| D-04 | Quotas SJinn/mês: **0 · 50 · 150 · 300** imagens. |
| D-05 | Reset de quota no ciclo da assinatura Stripe (`current_period_start` → fim do período). |
| D-06 | **BYOK imagem** fica como recurso **avançado em Configurações** (escape). Não aparece no CTA principal de gerar imagem. |
| D-07 | Essencial: botão gerar imagem → upgrade para Criador+; não pede chave no fluxo principal. |
| D-08 | Se BYOK imagem estiver activo: gera pela chave do user, **não consome** quota SJinn; badge discreto “chave própria”. |
| D-09 | Introduzir persistência mínima de quota (KV/Redis — ex. Upstash). O princípio “sem banco” deixa de aplicar a **créditos de imagem**. |
| D-10 | Chave SJinn **só no servidor** (`SJINN_API_KEY`). Nunca no browser. |

## 3. Grelha de planos

| Plano | Preço/mês | Imagens SJinn | Texto | Imagem plataforma | Escape BYOK imagem |
|---|---|---|---|---|---|
| **Essencial** | R$ 19,90 | 0 | BYOK | Não (só upload) | Sim, em Configurações |
| **Criador** | R$ 97 | 50 | BYOK | Sim (SJinn) | Sim, em Configurações |
| **Pro** | R$ 197 | 150 | BYOK | Sim (SJinn) | Sim, em Configurações |
| **Max** | R$ 297 | 300 | BYOK | Sim (SJinn) | Sim, em Configurações |

Anual: manter lógica de ~2 meses grátis por tier (preços anuais a definir no Stripe Dashboard).

Pack avulso de imagens = **fora do MVP** (fase 2).

## 4. Objetivos de negócio

- **OB-01:** Reduzir fricção pós-pagamento para quem quer imagens sem configurar OpenAI.
- **OB-02:** Oferecer entrada barata (R$ 19,90) para quem só precisa do studio + upload.
- **OB-03:** Proteger margem com quotas rígidas e chave SJinn no servidor.
- **OB-04:** Manter power users com BYOK imagem em Configurações, sem poluir o fluxo principal.

## 5. UX — anti-confusão (BYOK)

### Fluxo principal (editor)

- **Essencial, sem BYOK:** CTA de gerar imagem explica que imagens inclusas começam no Criador + botão upgrade. Não menciona “cole sua chave”.
- **Criador/Pro/Max:** CTA usa SJinn; mostra `usadas / limite` do mês.
- **Quota esgotada:** upgrade de plano ou “volta no próximo ciclo”. Não empurra BYOK como primeira saída.

### Configurações (avançado)

- Secção: **“Usar minha chave de imagem (avançado)”**.
- Copy obrigatória: *consome a tua conta OpenAI/Z.ai; não gasta os créditos do plano.*
- Opt-in explícito (toggle) + campos de chave já existentes (KeysModal / equivalente).
- Com toggle ON: badge discreto no UI de geração (“chave própria”).

## 6. Arquitectura (MVP)

```
Browser ──cookie vc_access──▶ POST /api/ai/sjinn-image
                                 ├─ requireActiveSubscription + tier
                                 ├─ se mode=platform: consumeQuota(customerId) atómico
                                 ├─ SJINN create_tool_task + poll
                                 └─ devolve imagem (b64/url)

Browser (BYOK avançado) ──fluxo actual──▶ OpenAI/Z.ai (chave do user)
```

- Metadata Stripe por Price: `tier=essential|creator|pro|max`, `image_quota=0|50|150|300`.
- Sessão/API de billing expõe: `tier`, `imageQuota`, `imageUsed`, `imageRemaining`.
- Storage quota: chave tipo `quota:{customerId}:{periodStart}` → contador.

## 7. Requisitos funcionais

- **RF-01:** Checkout Stripe com escolha de um dos 4 planos.
- **RF-02:** Portal do cliente permite upgrade/downgrade entre tiers (quando Stripe Portal estiver configurado).
- **RF-03:** Proxy SJinn autentica assinante, respeita quota, nunca expoe `SJINN_API_KEY`.
- **RF-04:** Contador de imagens visível nos planos com quota > 0.
- **RF-05:** Essencial bloqueia geração plataforma; upgrade path claro.
- **RF-06:** Toggle BYOK imagem em Configurações com copy anti-confusão.
- **RF-07:** Com BYOK ON, geração não decrementa quota SJinn.
- **RF-08:** Texto continua a exigir chave do user (inalterado no MVP).
- **RF-09:** Landing + Paywall + FAQ reflectem 4 planos e a regra texto BYOK / imagem inclusa.
- **RF-10:** Testes: quota (0 → bloqueio), consumo atómico, BYOK não consome, acesso sem assinatura 401/402.

## 8. Fora de escopo (MVP)

- Texto pago pela plataforma
- Packs avulsos de imagens
- Multi-seat / times
- Vídeo SJinn
- Garantia de latência SJinn / SLA de terceiros

## 9. Riscos

| Risco | Mitigação |
|---|---|
| Margem destruída por power user | Quotas + sem pack no MVP |
| Confusão BYOK vs créditos | BYOK só em Configurações + copy + badge |
| SJinn async / timeout Vercel | Polling com timeout; possível fila fase 2 |
| Referências precisam URL pública | Upload temporário ou adaptar pipeline actual |
| Downgrade a meio do ciclo | Política: quota do novo tier a partir do próximo período *ou* min(used, newQuota) — decidir na task Stripe |

## 10. Métricas de sucesso

| Métrica | Meta (30–60 dias pós-launch) |
|---|---|
| % novos assinantes que geram ≥1 imagem SJinn sem abrir Configurações | ≥ 70% dos Criador+ |
| % Essencial que activam BYOK imagem | baixo (< 15%) — se alto, copy ainda confusa |
| Custo SJinn / receita de planos com imagem | < 35% |
| Tickets “como coloco chave OpenAI só para imagem” | queda vs baseline actual |

## 11. Tasks do épico (ordem)

1. **Spike SJinn** — 1 imagem 4:5, latência, custo real, formato de referência  
2. **KV/Redis quota** — schema + consume atómico + testes  
3. **Stripe 4 prices** — products/prices BRL + metadata tier/quota  
4. **API `/api/ai/sjinn-image`** — auth + quota + proxy + poll  
5. **Session/billing** — expor tier e saldo ao client  
6. **UI editor** — contador, bloqueio Essencial, upgrade  
7. **Configurações** — toggle BYOK imagem + copy anti-confusão  
8. **Paywall + landing + FAQ** — 4 planos, nova narrativa  
9. **Testes** — unit/integration/e2e dos caminhos de quota e checkout multi-price  
10. **Soft launch** — limites conservadores, monitorar custo SJinn  

## 12. Próximo passo de engenharia

**Task 1 (spike)** — ✅ feito (`docs/engineering/SPIKE-sjinn-image.md`, ~82s, 100 créditos)

**Implementado no código (2026-09-14):**
- `shared/plans.js` + `api/lib/plans.js` (4 tiers)
- `api/lib/image-quota.js` (memória + Upstash REST)
- `api/ai/sjinn-image.js` (`maxDuration: 120`)
- Session/checkout com `tier` + `imageQuota`
- Client: geração plataforma por defeito; BYOK em KeysModal avançado
- Paywall com escolha de plano

**Ainda operacional (humano / dashboard):**
1. Criar 4 prices no Stripe e preencher `STRIPE_PRICE_ID_*`
2. `SJINN_API_KEY` + (prod) Upstash na Vercel
3. Soft launch + monitorar custo
4. Landing/FAQ copy (ainda legado BYOK-puro)
