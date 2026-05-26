# Roadmap — Viral Carrossel

> Melhorias pendentes, agrupadas por categoria com custo-benefício honesto.
> Use isso como referência pra retomar quando quiser.
>
> Última atualização: 2026-05-24
> Último commit em produção: `f300510`

---

## 🔴 Refactor & arquitetura (sessão dedicada)

### R1. Quebrar `ViralCarrossel.jsx` (17k+ linhas → módulos)
- **O quê**: extrair `SlideCardInner` (~600 linhas), `ClassicCanvasInner`, `FullscreenViewer`, `LibraryModal`, `GenerateModal` pra arquivos próprios em `src/components/`
- **Por quê**: a cada nova feature, o risco de regressão sobe. Manutenção difícil. Já temos `/utils` e `/components` com 7 módulos pequenos extraídos — falta o que importa.
- **Custo**: 4-6h. Precisa rodar regression testing visual (Playwright + screenshot diff seria ideal).
- **Bloqueador**: nenhum, só tempo.

### R2. Race condition residual no `useHistory`
- **O quê**: StrictMode guard adicionado (Bloco A), mas a estrutura de `past.current.push(prev)` dentro de setState updater ainda tem risco em casos extremos de batched updates.
- **Por quê**: undo/redo pode pular passos em fluxos com múltiplos setStates síncronos.
- **Custo**: 1-2h com reproduzir + corrigir + testar. Precisa testes específicos.
- **Bloqueador**: precisa reproduzir o bug — atualmente é teórico.

### R3. Schema versioning com migrations reais
- **O quê**: infraestrutura está pronta (`SCHEMA_VERSION = 1`, `SCHEMA_MIGRATIONS`), mas nenhuma migration de campo legacy foi escrita.
- **Por quê**: quando você quiser remover/renomear um campo do slide (ex: `refImage` → `referenceImage`), o framework garante que projetos antigos no localStorage continuem abrindo.
- **Custo**: 30 min por migration concreta quando precisar.
- **Bloqueador**: ainda não houve necessidade real.

---

## 🟡 Lazy-loading & performance (sessão de 3-4h)

### P1. Extrair modais grandes pra lazy chunks
- **O quê**: `GenerateModal` (656 linhas), `FullscreenViewer` (547), `LibraryModal` (335), `BrandsModal`, `PhotoPositionModal` viram arquivos próprios + `React.lazy()` + `Suspense`.
- **Por quê**: hoje todos vêm no bundle inicial. Lazy reduz ~50-80KB gzip do app code.
- **Custo**: 3-4h. Cada modal precisa receber utils via props (toast, downloadBlob, etc.).
- **Recomendação**: fazer **junto com R1** — refactor já requer extrair os componentes.

### P2. Memoização agressiva de `SlideCard`
- **O quê**: `React.memo(SlideCard, customCompare)` com deep compare em campos críticos (title, subtitle, bgImage, videoId, destaqueSpans).
- **Por quê**: hoje a cada keystroke no título, **todos os 6 SlideCards re-renderizam**. Em carrossel grande mobile é perceptível.
- **Custo**: 1-2h + profiling com React DevTools antes/depois pra medir ganho real.
- **Bloqueador**: sem profiling, é otimização cega — pode quebrar coisas (memo errado = stale render).

### P3. Virtualização da biblioteca
- **O quê**: usar `react-window` ou `react-virtuoso` na `LibraryModal` quando há 20+ projetos.
- **Por quê**: hoje renderiza todos os cards sempre. Com 50+ projetos vira lag.
- **Custo**: 1h.
- **Quando**: só vale quando user real tiver muitos projetos. Hoje é YAGNI.

---

## 🟢 Features de produto (alto valor, sessão dedicada cada)

### F1. **A/B Multivariant Generator** completo
- **O quê**: botão "🎲 Gerar 3 variações" → 3 chamadas paralelas com tones diferentes → modal com thumbnails lado-a-lado → user escolhe e refina.
- **Por quê**: feature "wow" que diferencia de Canva/templates estáticos. Já temos o **Remix de tom** que faz 50% — falta a UI de comparação paralela.
- **Custo**: 6-8h. Orquestração assíncrona + modal de seleção + thumbnail rendering rápido.
- **ROI**: alto se você posicionar como diferencial de marketing ("AI que te dá 3 caminhos").

### F2. **Hooks library com AI re-rank**
- **O quê**: quando você gera carrossel, Claude olha seus `hookLibrary` salvos e usa-os como referência de tom + estilo.
- **Por quê**: feedback loop. Quanto mais você usa, mais "no seu jeito" os hooks ficam.
- **Custo**: 2h. Só injetar hooks salvos no prompt do Claude.
- **ROI**: alto — diferencial de retenção, vira moat.

### F3. **Templates community-shared**
- **O quê**: galeria pública de templates feitos por outros users (curado ou aberto). Vira loop de aquisição.
- **Por quê**: features sociais reduzem CAC. User vê template viral, copia, customiza.
- **Custo**: 3-5 dias. Backend (Supabase tabela pública) + UI browse + apply + curadoria.
- **Bloqueador**: precisa decidir modelo (curado pelo admin vs aberto) e moderação.

### F4. **Compartilhar carrossel como link público**
- **O quê**: botão "Compartilhar" gera URL `viral.app/c/abc123` que abre preview pra mostrar pra cliente sem login.
- **Por quê**: workflow real do criador — manda link pro cliente aprovar antes de publicar no IG.
- **Custo**: 2-3 dias. Backend (Supabase ou Netlify Edge function) + URL routing + preview mode.
- **ROI**: alto pra users B2B (agências, freelas).

### F5. **Account + cloud sync**
- **O quê**: login email/Google via Supabase. Projetos sincronizam entre dispositivos. Resolve "perdi tudo ao limpar browser".
- **Por quê**: passo necessário pra monetização + retenção pesada.
- **Custo**: 1 dia inteiro. Setup Supabase + auth UI + RLS policies + migration localStorage→cloud com fallback.
- **Bloqueador**: precisa decidir se quer monetizar antes (sem motivo pra login se app é free e local serve).

### F6. **Variações automáticas com seleção visual** (variante mais leve do F1)
- **O quê**: mesmo do F1 mas em escala menor: 2 variações (não 3), apresentação em modal simples (não dual canvas).
- **Custo**: 3-4h.
- **Bom MVP de F1** se ainda não quer comprometer 8h.

---

## 🟡 Polish UX (quick wins individuais)

### U1. Generate modal em **steps** (passo 1: tema, passo 2: avançado)
- **O quê**: hoje o modal tem 20+ sliders/painéis num scroll vertical longo. Intimidador na primeira visita.
- **Custo**: 2-3h. Refactor estrutural do modal.
- **ROI**: melhora taxa de conversão "abriu modal → gerou carrossel" (data via Plausible).

### U2. Mobile drawer melhorado
- **O quê**: drawer atual é apertado. Reorganizar conteúdo, agrupar melhor por contexto.
- **Custo**: 1-2h.
- **ROI**: usuário mobile é grande fatia, hoje é segunda-classe.

### U3. **Custom confirmation modal** (substitui `window.confirm`)
- **O quê**: hoje `deleteSlide` e `deleteBrand` usam `window.confirm()` nativo do browser (feio, fora da identidade visual).
- **Custo**: 1h. Componente `ConfirmDialog` reusable + hook `useConfirm()`.
- **ROI**: visual mais polido.

### U4. **Reduzir overload do Generate Modal**
- 20+ sliders + 4 painéis hoje
- Esconder "Direção da imagem" em accordion fechado
- Esconder "Pacote criativo" em accordion fechado
- Default visível: só topic + count + preset + botão Gerar
- **Custo**: 1-2h.

### U5. **High contrast mode**
- **O quê**: detectar `prefers-contrast: more` e aplicar tema com bordas mais grossas, fontes mais bold.
- **Por quê**: acessibilidade pra baixa visão (já fizemos reduced-motion).
- **Custo**: 2-3h.
- **ROI**: nicho, mas marketing de acessibilidade.

---

## 🔵 Integrações externas (alto risco/recompensa)

### I1. **Tavily integration pra pesquisa web**
- **O quê**: substitui ou complementa o `callAIwithSearch` (que usa Claude com web_search caro). Tavily é mais barato + estruturado + retorna imagens contextuais.
- **Por quê**: economiza ~50% no custo de pesquisa de nicho + estrutura JSON é mais previsível.
- **Custo**: 1-2h. Já planejado, ficou pra depois.

### I2. **Notion / Linear / Google Docs importer**
- **O quê**: URL + token → puxa página, extrai texto, joga em "Material" do gerador.
- **Por quê**: elimina copy-paste, perde menos contexto, integra workflow real.
- **Custo**: 3-5h por integração + OAuth setup.
- **ROI**: feature B2B forte.

### I3. **Buffer / Meta Graph API publishing**
- **O quê**: agendar/publicar carrossel direto no Instagram do app.
- **Por quê**: fecha o loop "criei → preciso baixar → preciso abrir app → preciso agendar".
- **Custo**: 1 semana + OAuth + aprovação Meta (lento).
- **Bloqueador**: Meta exige business verification.

### I4. **Unsplash / Pexels API** pra fotos stock
- **O quê**: quando user não gera com DALLE, alternativa é buscar foto stock por palavra-chave.
- **Por quê**: barato, sem rate-limit OpenAI, fotos profissionais.
- **Custo**: 2h. API keys já estão no `.env.example`.
- **Quick win pequeno**.

---

## 🟣 Export & vídeo (continuação do que ficou)

### V1. Render de vídeo em **ClassicCanvasInner** (cover/encerramento)
- **O quê**: hoje vídeo só funciona em sandwich layout. Capa e encerramento ainda renderizam `<img>` mesmo se slide tem `videoId`.
- **Custo**: 1-2h.

### V2. **MP4 export com texto queimado em cima** (ffmpeg.wasm)
- **O quê**: pipeline canvas + MediaRecorder → encoded MP4. Ou ffmpeg.wasm pra precisão.
- **Por quê**: hoje user precisa combinar texto+vídeo no CapCut. Se exporta MP4 pronto, fluxo end-to-end fecha.
- **Custo**: 6-8h. Bundle +30MB (lazy via dynamic import).
- **Bloqueador**: Safari iOS tem suporte parcial. Decisão de produto: é diferencial ou é overkill?

### V3. **Stories format** (9:16) com vídeo
- **O quê**: novo aspect ratio 9:16, render diferente, export especial.
- **Custo**: 4-5h.
- **ROI**: nicho de criadores de Stories vs Feed.

---

## 🟢 Bugs pequenos & cleanup

### B1. Emojis residuais no código
- `⊕` no array `LAYOUTS` (label de mini-ícone de alinhamento) — mexer afeta todo o sistema de seletores. **Não vale**.

### B2. Touch targets em alguns lugares ainda <44px
- O `vc-icon-btn` (36×36 min) cobriu modais e action icons dos cards (32×32).
- Faltam: alguns botões internos de painéis específicos da sidebar (provavelmente OK desktop, marginal mobile).
- **Custo**: 30 min de auditoria.

### B3. Validação WCAG runtime nos toasts
- `WcagBadge` funciona no editor de cores, mas nas cores do TOAST/BADGES não há check.
- **Custo**: 1h.

### B4. `loading="lazy"` em algumas imagens da home
- Apesar dos slides serem data URLs (não funciona lazy), thumbnails da Library podem se beneficiar.
- **Custo**: 30 min.

---

## ✅ Já está pronto (referência — não precisa fazer)

Pra não confundir, tudo abaixo **já está em produção**:

- Botão "?" + atalhos + tour reativável
- Undo/Redo visíveis no header
- Export/Import JSON completo do projeto
- Lazy-load via manualChunks (vendor isolado, app -27% gzip)
- Confirmation em deleteSlide, deleteBrand, deleteDoc
- Empty state da biblioteca
- Auto-save indicator no header ("Salvo há X")
- Onboarding hint no primeiro slide
- Tab "IA" → "Refinar"
- Dropdown "Mais formatos" (ZIP/PDF/Fotos limpas)
- Vídeo: importar + render + export raw
- IndexedDB pra vídeos
- Plausible analytics com tracking custom
- WCAG focus-visible global + reduced-motion
- Toast aria-live por severidade
- useScrollLock nos 5 modais grandes
- A11Y: ícones lucide em todos os botões antes com emoji
- WcagBadge no editor de cores da marca
- AutoFitText + OverflowScaler pra texto adaptar tamanho
- Hooks Library (save + sugestão por nicho)
- Remix com tom alternativo (Analítico/Provocador/Leve)
- Paleta adaptativa (cor dominante da foto como accent)
- Schema versioning (infraestrutura)
- Cross-tab sync no usePersistedState
- StrictMode guard no useHistory
- Selector de modelo Claude (Sonnet × Opus)
- Chave Anthropic configurável via UI (proxy aceita x-anthropic-key)
- Toggle "manter chave salva" (sessionStorage vs localStorage)
- Botões: tela cheia + editar foto + grade abaixo dos cards
- Filtros pré-configurados de imagem (Neutro/Editorial/Vintage/P&B)
- Badge "✨ IA" em fotos geradas
- 2 botões de geração: "texto + imagem" e "só texto"
- Modal de chaves redesenhado (cards lado a lado)
- Auto-apply tipografia da marca em todos slides
- Cache no-store em index.html (evita stale chunk)

---

## 🎯 Recomendação de ordem (se for retomar)

| Sessão | Itens | Duração |
|--------|-------|---------|
| **Curta** | U3 + U4 + I1 + I4 | ~2h |
| **Média** | F2 (hooks AI re-rank) + V1 (vídeo em cover) + B3 | ~4h |
| **Longa** | R1 + P1 juntos — refactor + lazy load real dos modais | ~1 dia |
| **Sprint produto** | F1 (A/B Multivariant) + F5 (cloud sync) + F4 (link público) | ~1 semana |

---

## 💭 Decisão estratégica pendente

**Monetizar ou não?**

- Se **sim**: F5 (account + cloud) é pré-requisito. Depois F4 (link público pra clientes) + F1 (A/B) viram features pagas.
- Se **não**: foca em F1 + F2 + I1 + I4 — diferencial de produto sem complexidade de billing.

A decisão impacta tudo: arquitetura backend, modelo de retenção, pricing, marketing.

---

## 📞 Como retomar

Quando quiser voltar:

1. Verifica o último commit em produção (`git log --oneline -1` no projeto)
2. Pega este `ROADMAP.md` como referência
3. Indica qual sessão (curta/média/longa/produto) ou item específico
4. A gente roda
