# Auditoria — Viral Carrossel Studio (código + prompts + “agentes” de IA)

## Papel
És um auditor sénior de produto de IA + engenharia frontend. A tua missão é **auditar o estado atual** do repositório Viral Carrossel: fluxos de geração, prompts, orquestração de IA, proxies/API, presets criativos e skills de agentes no repo. Não implementes fixes nesta passagem — **diagnostica com evidência (ficheiro:linha)** e prioriza.

## Contexto do produto
- App: gerador de carrosséis Instagram (Vite + React 18).
- Monólito de orquestração: `ViralCarrossel.jsx` + módulos em `src/`.
- Serverless Vercel em `api/` (auth Stripe/Google, proxies IA, SJinn imagem).
- Sem framework de agentes (LangGraph/Crew/etc.): “agentes” = **fluxos de chamada** (`callAI` / handlers) + builders de prompt.
- Produção: Vercel / `viralcarrossel.com.br`. Fonte de verdade de acesso: cookie `vc_access` + Stripe.

**Raiz do app (trabalhar daqui):**
`viral-carrossel/viral-carrossel/`  
(há pasta pai com atalhos npm — não auditar a partir da pasta errada.)

## Ordem de leitura (obrigatória)

### 0. Memória / regras do projeto
1. `CLAUDE.md`
2. `AGENTS.md`
3. `.cursor/rules/design-system.mdc`
4. `.cursor/rules/skills-bridge.mdc`

### 1. Auditorias e PRDs existentes (baseline — revalidar, não acreditar cegamente)
5. `docs/audit-produto.md` ← auditoria de 2026-08-07 (muitas linhas citadas já mudaram)
6. `docs/audit.md` (infra/billing)
7. `docs/product/PRD-planos-imagem-sjinn.md`
8. `docs/product/PRD-suite-testes-confianca.md`
9. `docs/engineering/TDD-suite-testes-confianca.md`
10. `docs/engineering/SPIKE-sjinn-image.md`
11. `docs/STRIPE.md`
12. `docs/SLIDE-DESIGN.md`
13. `docs/LANDING-COPY.md` (só se avaliar alinhamento copy ↔ produto)

### 2. Prompts & pacotes criativos (núcleo)
14. `src/utils/generation-prompts.js` (~1180 linhas) — **fonte principal de prompts**
    - `GEN_MODES`, presets criativos (`tendencia_cultura`, etc.)
    - builders: layout, imageQuery, brand, caption, refine, hooks, research bias
    - `buildCaptionVoiceRules`, `buildRefineVoiceRules`, etc.
15. `src/utils/design-data.js` — modos/arcos/vozes de referência
16. `src/utils/slide-design-system.js` — composições / tokens de layout
17. `src/styles/visual-presets.jsx` — presets visuais ↔ creativePreset
18. `src/utils/preset-tokens.js`
19. Skill cultura: `.agents/skills/carrossel-cultura/SKILL.md` + `html-template.md`

### 3. Orquestração cliente (fluxos = “agentes”)
20. `ViralCarrossel.jsx` — localizar e mapear:
    - `handleGenerate` (geração principal JSON slides+caption)
    - `refineSlide` / refine all
    - `generateCaption`
    - `generateSlideImageAt` / pipeline imagem
    - remix de tom
    - wiring de `callAI` / settings
21. `src/utils/ai-client.js` — `callAI`, fallbacks de modelo, SJinn client, compatible proxy
22. `src/config/ai-providers.js` — providers/modelos default (texto Z.ai, imagem SJinn/OpenAI/etc.)
23. `src/hooks/useAiSettings.js`
24. UI que dispara fluxos:
    - `src/components/panels/GenerateModal.jsx` (+ partes)
    - `src/components/panels/ResearchPanel.jsx`
    - `src/components/panels/HookVariationsModal.jsx` (se existir)
    - `src/components/SidebarContent.jsx` (refine, caption, imagem por slide)
    - `src/components/KeysModal.jsx`

### 4. API / segurança dos proxies IA
25. `api/ai/compatible.js` — proxy OpenAI-compatible (Z.ai etc.)
26. `api/ai/sjinn-image.js` — geração de imagem + quota
27. `api/lib/sjinn.js`
28. `api/lib/image-quota.js` + `api/lib/plans.js` + `shared/plans.js`
29. `api/lib/require-access.js` + `api/lib/access.js` + `api/lib/cors.js` + `api/lib/rate-limit.js`
30. `api/anthropic/v1/messages.js` (se ainda existir)
31. `api/status.js`
32. `vite.config.js` (proxies de dev para `/api/ai/*`)

### 5. Skills de agentes no repo (não confundir com runtime do produto)
33. `.agents/skills/carrossel-cultura/` — pacote editorial Tendência/Cultura
34. `.agents/skills/polish/`
35. `.agents/skills/influ-cinematic-landing/`
36. `.agents/skills/cinematic-ui/` — skill de layout cinematográfico (auxiliar; não é o runtime do studio)

### 6. Testes que protegem prompts/IA
37. `tests/unit/generation-prompts.test.js`
38. `tests/unit/prompt-regressao.test.js`
39. `tests/unit/image-quota.test.js`
40. `tests/e2e/ia-paineis.spec.js` (e outros e2e relevantes em `tests/e2e/`)

---

## O que auditar (checklist)

### A. Mapa de “agentes” / fluxos
Para cada fluxo, documenta:
| Fluxo | Entry (UI) | Função | Prompt builders | Provider/modelo | Endpoint | Auth/quota | Falhas conhecidas |
|---|---|---|---|---|---|---|---|
Inclui no mínimo: gerar carrossel, pesquisa nicho, variações de gancho, refinar 1, refinar todos, legenda, remix tom, imagem por slide (SJinn/OpenAI/Z.ai).

### B. Qualidade dos prompts
- Clareza, contradições, regras duplicadas vs código (ex.: faixas de caracteres no prompt **e** em arrays JS).
- `imageQuery`: idioma, comprimento, consistência entre presets (`livre` vs `tendencia_cultura`).
- Brand: o que entra no prompt (bio/tom) vs o que **não** entra (paleta/fontes) — impacto no output.
- System prompt(s): quantas variantes, drift entre elas.
- Alinhamento skill `carrossel-cultura` ↔ `creativePreset === 'tendencia_cultura'` no código.
- Riscos: prompt injection via material/fontes do user; limites de tamanho; sanitização de “Slide N”.

### C. Arquitetura / manutenção
- Acoplamento restante em `ViralCarrossel.jsx` vs `generation-prompts.js`.
- Dead code / builders órfãos / defaults desatualizados em `ai-providers.js`.
- Cascata de fallbacks de modelo (Z.ai glm-4.7…) coerente entre client e API.
- Divergência `docs/audit-produto.md` ↔ código atual (listar achados obsoletos e novos).

### D. Segurança & custo
- Proxies: gate de sessão/assinatura, CORS, rate limit, vazamento de chave host.
- BYOK vs chave de plataforma (Z.ai texto, SJinn imagem).
- Quota de imagem (Upstash/memory fallback) e caminhos de erro que engolem falha.
- OpenAI/Anthropic direto do browser vs proxy.

### E. Cobertura de testes
- O que os testes de prompt realmente travam.
- Lacunas: builders sem teste, fluxos sem e2e, regressões fáceis.

---

## Regras da auditoria
1. **Citar sempre** `path:linha` (ou intervalo) do código **atual**.
2. Separar: 🔴 crítico / 🟠 alto / 🟡 médio / 🟢 baixo / ✅ ok.
3. Separar **bug real** vs **dívida técnica** vs **doc desatualizado**.
4. Não reescrever o monólito; propor mudanças cirúrgicas.
5. Se `docs/audit-produto.md` contradisser o código, o código ganha — anota a divergência.
6. Ignorar `.agents/skills/cinematic-ui` como runtime do produto (só mencionar se houver contaminação de prompts/copy).
7. Responder em **português**.

## Formato de entrega (obrigatório)
1. **Resumo executivo** (10–15 linhas)
2. **Mapa dos fluxos/agentes** (tabela)
3. **Achados** (severidade + evidência + impacto + fix sugerido em 1–3 bullets)
4. **Matriz prompts** (builder → consumidores → riscos)
5. **Diff vs `docs/audit-produto.md`** (obsoleto / ainda válido / novo)
6. **Top 10 ações** ordenadas por ROI (segurança → correção de geração → qualidade editorial → higiene de código)
7. **Lacunas de teste** propostas (nomes de ficheiros/casos)

## Comandos úteis (se puderes correr)
```bash
cd viral-carrossel/viral-carrossel
rg -n "handleGenerate|callAI|buildCaption|buildRefine|AI_SYSTEM|tendencia_cultura|sjinn" src ViralCarrossel.jsx api
rg -n "export function|export const" src/utils/generation-prompts.js
npm test -- tests/unit/generation-prompts.test.js tests/unit/prompt-regressao.test.js
```

---

## Caminhos-chave (atalho)

Caminhos relativos à raiz do app indicada acima.

- Prompts: `src/utils/generation-prompts.js`
- Fluxos: `ViralCarrossel.jsx` + `src/utils/ai-client.js`
- Providers: `src/config/ai-providers.js`
- API IA: `api/ai/compatible.js`, `api/ai/sjinn-image.js`
- Cultura: `.agents/skills/carrossel-cultura/SKILL.md`
- Baseline antiga: `docs/audit-produto.md`
