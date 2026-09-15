# Spike SJinn — resultado (2026-09-14)

## Correção

`node --env-file=.env.local scripts/spike-sjinn-image.mjs` → **ok: true**

| Métrica | Valor |
|---|---|
| Tool | `gpt-image-2-api` |
| Aspect | `2:3` (mais próximo de 4:5 Instagram) |
| Resolution | `1K` |
| Create | 3,6 s |
| Polls | 14 × 5 s |
| **Wall total** | **81,8 s** |
| Créditos | **100** (confirmado em `query_credits_usage`) |
| Output | PNG ~2,1 MB |
| CDN URL | `edit.comfyonline.app` (não sjinn CDN directo) |

Artefacto: `qa-session/sjinn-spike/` (`report.json` + `gpt-image-2-2x3.png`)

## Implicações de engenharia

1. **`maxDuration` obrigatório** na rota Vercel (≥ 120 s) ou desenho create→poll no client/job (função default 10–60 s estoura).
2. Custo por imagem = 100 créditos SJinn (bate com a doc).
3. URL de saída é externa e pode expirar → **descarregar para b64/storage nosso** no proxy (como já fazemos no `/api/ai/compatible`).
4. Ratio nativo 4:5 **não existe** na SJinn; usar `2:3` ou `auto` + crop no studio.

## Z.ai

**Não falta no `.env` para este spike nem para imagem plataforma.**  
> Atualizado 2026-09-15: desde o commit 7f22504 o texto do plano usa **Z.ai no servidor** (`ZAI_API_KEY` via `/api/ai/compatible`, com allowlist de modelos e tectos de `max_tokens`). BYOK Z.ai continua possível em Configurações → avançado. A geração de **imagem** Z.ai por esse proxy exige chave própria (sem quota de plataforma).

## Próximo

Task 2–4 do PRD: KV quota + Stripe 4 prices + `POST /api/ai/sjinn-image` com `maxDuration ≥ 120`.
