---
name: influ-cinematic-landing
description: Landing page cinematográfica para plataformas de criadores/influencers — onboarding editorial, hero com stage de carrosséis, montagem de features e CTA para o produto. Use quando pedirem landing de onboarding, página inicial viral, influ cinematic landing, ou primeira visita estilo editorial para Instagram/creator tools.
---

# Influ Cinematic Landing

Landing de onboarding para ferramentas de criadores — traduz linguagem cinematográfica (via `cinematic-ui`) para o nicho influencer/editorial, alinhada ao **Narrative OS** do Viral Carrossel.

## Quando usar

- Primeira visita à plataforma (onboarding full-screen antes do app).
- Pedidos de "landing cinematográfica", "página de entrada influencer", "onboard visual".
- Substituir hero genérico SaaS por **stage editorial** (cartões de carrossel como protagonistas).

## Gramática visual (fixa para este produto)

| Token | Uso |
|-------|-----|
| `--bg-primary` / glass | Fundo escuro charcoal + camadas blur |
| `--accent-primary` (#ff2d8d) | CTAs, realces, glow ambiente |
| `--accent-violet` | Segundo halo atmosférico |
| `--font-display` / `--font-mono` | Headlines Inter 600; eyebrows mono uppercase |
| `--radius-pill` | Botões primários |
| `--radius-lg` | Cartões utilitários |

**Composição hero:** Pattern S (Split Showcase) — copy à esquerda, **stage de slides flutuantes** à direita (mín. 3 elementos visuais além do texto).

**Arco narrativo (5 beats):**

1. **Cold Open** — headline de impacto + stage visual
2. **Tutorial** — 3 passos numerados (tema → IA → export)
3. **Montage** — faixa de capacidades (templates, marca, pesquisa nicho)
4. **Encounter** — modos Criador / Diretor / Studio (1 linha cada)
5. **Promise** — CTA único "Entrar no studio"

## Anti-padrões

- ❌ Hero centrado só com gradiente e parágrafo
- ❌ Expor metadados de workflow (director, chapter, etc.) na UI
- ❌ Mais de 2× `fadeUp` por página
- ❌ Card grid 2×2 genérico como composição principal
- ❌ Ignorar `prefers-reduced-motion`

## Implementação neste repo

- Componente: `src/components/OnboardingLanding.jsx`
- Chave localStorage: `vc_landing_done` (`SK.landingDone` em `ViralCarrossel.jsx`)
- Ao concluir: gravar flag → mostrar `AccountHomeShell` → `ModesIntroModal` → tour opcional

## Referências cruzadas

- Base cinematográfica: `.agents/skills/cinematic-ui/SKILL.md`
- Design system app: `DESIGN.md`, `.cursor/rules/design-system.mdc`
- Onboarding pós-landing: `ModesIntroModal`, `OnboardingTour` em `ViralCarrossel.jsx`
