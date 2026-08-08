# Auditoria do Produto — agentes IA, prompts, ferramentas de design, navegação

**Data:** 2026-08-07 · Varredura por 4 agentes paralelos sobre `ViralCarrossel.jsx` (18.516 linhas) + `src/` + `api/`.
Complementa `docs/audit.md` (infra/billing). Linhas citadas = estado do commit desta data.

---

## 🔴 Achados críticos (ação imediata)

1. **[CORRIGIDO 2026-08-07] Gerar legenda quebrava em runtime** — `capRules` usado no prompt (`ViralCarrossel.jsx:15497`) sem nunca ser declarado → `ReferenceError` em toda geração de legenda. Fix: `buildCaptionVoiceRules(creativePreset, mode)` (builder existia órfão em `:13445`).
2. **[CORRIGIDO 2026-08-07] "Refinar todos" quebrava em runtime** — `voiceBulk` usado em `:15786` sem declaração. Fix: `buildRefineVoiceRules(creativePreset, mode)`.
3. **Proxy Anthropic aberto** — `api/anthropic/v1/messages.js` não valida sessão/assinatura e responde `Access-Control-Allow-Origin: *`; se `ANTHROPIC_API_KEY` estiver setada na Vercel, qualquer site pode consumir a chave do host. Mesmo padrão em `api/ai/compatible.js` (reflete origin + credentials). **Pendente — mesma correção de allowlist aplicada ao billing.**
4. **Status de servidor mente em produção** — `src/utils/server-status.js:11` retorna `{anthropic:true, openai:true}` incondicionalmente em prod; guards de chave ausente nunca disparam, erro só aparece como 503 tardio.

## 1. Agentes de IA (8 fluxos, sem framework de agente)

Dispatcher único `callAI` (`:2582`). Fluxos: geração principal (`handleGenerate:15130`, JSON slides+caption), pesquisa de nicho com `web_search` Anthropic (`ResearchPanel:9096`, fallback sem web com flag `degraded`), variações de gancho (`:9293`), refinar 1 slide (`:15426`), refinar todos (`:15763`), legenda (`:15480`), remix de tom (`:15748`, reusa handleGenerate), imagem (`generateDALLE:3156` + variante com referência `:3084`).

- **Provedores** (`src/config/ai-providers.js`): Anthropic (haiku-4-5/sonnet-5/opus-5), OpenAI (gpt-5.6 luna/terra/sol), Z.ai (glm), Kimi. Imagem: gpt-image-2/1.5, cogview/glm-image. Default: openai/gpt-5.6-terra.
- **Chaves BYOK**: sessionStorage por padrão, localStorage com opt-in; Anthropic via proxy com header `x-anthropic-key`; OpenAI direto do browser em prod; Z.ai/Kimi mandam chave **no body** via `/api/ai/compatible`.
- **Frágil**: cascata de modelos de imagem hardcoded fora do config (`:3064` — inclui `gpt-image-1`/`dall-e-3` inexistentes no config); parse/erro triplicado nos 3 callers; loop de fallback duplicado edits vs generations com regex divergente; proxy Anthropic implementado 3× (Vercel/Netlify/Vite); `.env.example` cita `gpt-4o` que não existe mais; falha de imagem de referência degrada silenciosamente (`:3169`).
- **Código morto**: pipeline web_trend inteiro órfão — `normalizeSlideImgMode:2826` retorna sempre `'dalle'`, matando `fetchWebTrendImage:2882`, busca Commons, `webTrendServer.js` e middleware vite.

## 2. Prompts de conteúdo (~1.100 linhas de prompt no monólito)

- **System prompt** `AI_SYSTEM_PT:2425` em 3 variantes quase idênticas (`:2441/:2493/:2547`).
- **Prompt principal**: montado em `:15224-15245` a partir de ~20 builders (`:12428-13481`) — brand, material do usuário (até 62k chars de fontes fetchadas), densidade, pacote criativo, camada de linguagem (13 ramos), regras de layout por slide (140 linhas, 6 ramos), direção de imagem, legenda (7 estruturas), ganchos (8 ramos).
- **8 modos narrativos** (`GEN_MODES:1667`): editorial, deep, pain, viral, storytelling, how_to, jornalistico, sensacionalista. **4 arquétipos** com arco pronto (`design-data.js:59`): erro_comum, tendencia, decodificacao, comportamento. **8 vozes de referência** (`:1802`). **8 composições de slide** (`slide-design-system.js:81`).
- **Marca no prompt**: só camada verbal (bio, positioning, signature, handle — `buildBrandBlock:12433`). **Paleta/fontes/cores nunca chegam à IA**; comentário em `:8390` descreve comportamento que não existe.
- **Duplicações**: proibição "Slide N/Card N" em 5 redações + sanitizador aplicado em 10 pontos; regra "imageQuery inglês 8-15 palavras" em 6 lugares; anti-guru em 7; faixas de caracteres existem como texto no prompt E como arrays em código (`:13214` vs `:12753` etc.) — duas fontes de verdade.
- **Dead code**: `buildGenerationImageLayerForCommons:13253`; manual estratégico (1.483 linhas) desacoplado do código, com cópia divergente na pasta pai; monólito legado `../ViralCarrossel.jsx` (2.575 l.) fora do build com prompts v1.

## 3. Ferramentas de designer

- **Tipografia**: 28 fontes título (`design-data.js:20`) + 20 corpo (**no monólito** `:1336` — split arbitrário); 5 pairings curados; upload de fonte própria (≤5MB); 9 eixos por marca + overrides por slide; auto-fit (`AutoFitText`, `OverflowScaler` floor 0.85); clamp anti-faux-bold (`clampTitleWeight`) — **mas `applyVisualPreset` pula o clamp** (`visual-presets.jsx:937`).
- **Cor**: 9 paletas, pickers manuais com badge WCAG, intercalar fundo, extração de cor dominante de foto (`color-extraction.js`). **Dois sistemas de contraste que não se conhecem**: `WcagBadge` (informativo) vs `cultureReadableInks:1251` (corrige tinta automaticamente) — badge pode acusar ✗ com render já corrigido.
- **Layout**: grid 3×3, 5 regiões de foto, canvas zones arrastáveis (variants classic/cover/sandwich/stat), ajuste automático (`slideAutoAdjustPatch:3976`), 6 texturas de fundo, 8 composições. `sandwichZonesByRotationIndex:4111` nunca chamada (presets de sanduíche inalcançáveis).
- **Imagem**: 4 entradas de UI mexendo nos mesmos campos `bgX/bgY/bgZoom/bgFit` (PhotoPositionModal não-destrutivo, ImageCropModal destrutivo JPEG q0.92, presets de modo, grid focal); 6 eixos de ajuste + 4 filtros.
- **12 presets visuais** (`visual-presets.jsx:283`) com preview SVG. `visualPreset` é state local **não persistido no doc** — reload perde a seleção. Mapa preset→creative duplicado em 2 arquivos (`:291` vs `slide-design-system.js:167`). Comentário em `:8690` nega exatamente o que `applyVisualStylePreset:13826` faz.
- **Export**: html2canvas scale 2 (PNG ~2160×2700), ZIP (jszip local), PDF (jsPDF, páginas JPEG q0.92), fotos limpas. **html2canvas e jsPDF vêm de CDN em runtime** (`:2609/:2670`) — export quebra offline. Fontes referenciadas em 3 formatos incompatíveis (índice em TEMPLATES / string CSS em pairings / string no brand) — inserir fonte no meio de `TITLE_FONTS` quebra templates.
- `SAFE_ZONES` (`slide-design-system.js:156`) duplica `FORMATS` e ninguém lê. `deleteBrand` usa `window.confirm` em vez do `PromptDialog` do app.

## 4. Navegação

Sem router; tudo state-in-component. Shell em 3 níveis: early-returns (landing → loading → paywall → app), `shellView` home/project (persiste `vc_shell_view`), `tab` no editor (não persiste; default `'brand'` mas primeira tab visível é `'home'`). Modos criador/diretor/studio filtram tabs (`modeRank`); 17 modais mapeados; z-index de 40 (drawer) a 12000 (login).

**Frágil:**
- **Tab órfã `'material'`** (`setTab('material'):17208`): não existe em `ALL_TABS` nem tem seção — "Ir para Material" abre sidebar vazia.
- **Tab fantasma `'slide'`** (`:15354`, pós-geração mobile): renderiza união de ~15 seções de layout+imagem+texto — **fura o gating de modo** (usuário Criador ganha ferramentas Studio).
- **`ALL_TABS` + `modeRank` duplicados** palavra por palavra (`:9772` sidebar vs `:17038` bottom bar) — divergem em silêncio.
- **Query params**: `?billing=cancel` e `?billing=restored` nunca são limpos da URL (reload re-abre paywall / re-entra no studio); `?app=1` retorna cedo e descarta `login=*`/`billing=*` combinados (retorno do portal Stripe usa `?app=1`).
- **Teclado**: deps do handler global (`:15992`) omitem `photoPositionOpen` (stale) e não incluem `modesIntroOpen`/`landing`/`paywall` — setas/Delete agem no documento por baixo de modais.
- `drawerOpen` não reseta ao trocar de view (`goAccount`, `openDoc`, `newDoc`) — drawer reaparece aberto.
- `ModesIntroModal` irrecuperável após 1ª visita (nenhum trigger manual); tour + modes-intro auto-abrem empilhados (850ms vs 600ms); tour iniciado da home aponta seletores que só existem no editor.
- Fallback dev de billing (`src/lib/billing.js:11`): falha de `/api/auth/session` em DEV retorna `active:true` — ok, mas mascarava paywall em teste local.

---

## Backlog sugerido (por prioridade)

| # | Item | Fonte | Status |
|---|---|---|---|
| 1 | Fix `capRules`/`voiceBulk` | §crítico 1-2 | ✅ 2026-08-07 |
| 2 | Allowlist CORS + gate de sessão nos proxies IA (`api/lib/cors.js`; env-key do host exige assinante) | §crítico 3 | ✅ 2026-08-07 |
| 3 | `server-status` honesto em prod (`api/status.js` novo + fetch real) | §crítico 4 | ✅ 2026-08-07 |
| 4 | Limpar query params `billing=cancel/restored` da URL | §4 | ✅ 2026-08-07 (pendente: `?app=1` ainda engole params combinados) |
| 5 | `EDITOR_TABS` fonte única; tab `'material'` → `narrativa` | §4 | ✅ 2026-08-07 (pendente: destino da tab fantasma `'slide'`) |
| 6 | `visualPreset` persistido no doc; clamp de peso no `applyVisualPreset` | §3 | ✅ 2026-08-07 |
| 7 | Bundle local de html2canvas/jsPDF (chunks lazy do Vite) | §3 | ✅ 2026-08-07 |
| 8 | Faixas com fonte única + prompts extraídos para `src/utils/generation-prompts.js` (~1.100 linhas: GEN_MODES, pacotes criativos, densidade, material, 20+ builders; `attachGenerationCanvasLayouts` ficou no monólito por acoplamento ao canvas) | §2 | ✅ 2026-08-07 |
| 9 | Código morto removido (web_trend, SAFE_ZONES, sandwich presets, builder Commons, dead statement) ✅ 2026-08-07 · monólito legado `../ViralCarrossel.jsx` fica (fora do repo git — apagar manualmente se quiser) | §1-3 | ✅ |
| 10 | Funções Netlify removidas (Netlify = só landing, DEC-A); fetch-source Vercel com allowlist; proxy dev do Vite mantido (dev-only) | §1 | ✅ 2026-08-07 |

---

## Decomposição do monólito — concluída em 2026-08-07

`ViralCarrossel.jsx`: **18.516 → 4.489 linhas (−76%)**. Restou o componente `App` (orquestração de estado e efeitos) mais um punhado de helpers de arquivo. Todo o resto virou módulo — **cada extração validada com `npm run build && npm test && npm run test:e2e` antes do commit**.

### Estrutura resultante

```
src/
├─ components/
│  ├─ card/        SlideCardInner (+ renderizadores de canvas), SlideCard,
│  │               CanvasZonesOverlay, FullscreenViewer, FullscreenImageAdjustBar,
│  │               render-primitives
│  ├─ panels/      GenerateModal (+ partes), SidebarContent, ResearchPanel,
│  │               HookVariationsModal, ExportMoreFormats, PerSlideImageRefBlock
│  ├─ ui/          primitives (Toggle/Slider/ColorRow/…), editor-chrome
│  │               (ModeSwitcher, formato, drawer mobile), font-pickers, mini-icons
│  └─ AccountHomeShell, SidebarContent, (modais que já existiam)
├─ hooks/          useHistory, usePersistedState
├─ styles/         global-style (CSS do design system), visual-presets
└─ utils/          generation-prompts, ai-client, canvas-zones, canvas-layout,
                   doc-schema, brand-visuals, image-storage, text-spans, storage,
                   export-helpers, telemetry, landing-gate, video-store, …
```

### Ferramenta: `scripts/extract-module.mjs`

Extrator AST (`@babel/parser` + `@babel/traverse`):

```bash
node scripts/extract-module.mjs <destino> <Nome...> [--component] [--dry]
```

Garantias antes de escrever: limites reais da declaração, fecho transitivo de dependências (Identifier **e JSXIdentifier**), detecção de componente por nó JSX real, preservação da forma dos imports (default/namespace/alias), reparse do monólito e do módulo, checagem de nomes órfãos. `--component` libera JSX/hooks e gera o import de React com os hooks usados.

### Três bugs que só o E2E pegou

Nenhum deles quebrava o build — todos quebravam o app em runtime:

1. **Fecho por regex** perdia dependências (`typographyPatchFromBrand`). Origem da reescrita em AST.
2. **`JSXIdentifier` não visitado**: `<ClassicCanvasInner/>` não contava como dependência, então o componente ficava para trás.
3. **Estado mutável compartilhado**: `__vcVideoUrlMap` era atribuído pelo App e lido pelo card; virar `import` o tornaria read-only. Resolvido movendo para `video-store.js` atrás de `setVideoUrlMap`/`getVideoUrl`.

**Regra que fica:** `npm run build` não valida escopo dentro de um mesmo arquivo JS. O gate real de refactor é `npm test && npm run test:e2e`.

### O que ainda pode sair do `App`

As 3.697 linhas de `App` são estado + efeitos + handlers de fluxo (geração, export, biblioteca, billing). Extrair exige converter blocos em hooks próprios (`useGeneration`, `useExport`, `useLibrary`), não mover texto — trabalho de design, não de ferramenta.
