# Template HTML estático — referência (Pacote Tendência/Cultura / brandsdecoded)

Este ficheiro substitui `${CLAUDE_SKILL_DIR}/html-template.md` **neste repositório**.

## Quando usar

- **Fluxo fora da app**: gerar um `.html` único com slides em `.slide` (ou equivalente) para captura com Puppeteer/playwright.
- **Dentro da app Viral Carrossel**: não é obrigatório — a UI e export PNG/PDF vivem em `ViralCarrossel.jsx`. Alinhe **copy e arco** a esta skill; tokens visuais à `DESIGN.md` e a `.cursor/rules/design-system.mdc`.

## Estrutura mínima sugerida

- Um container por slide, classe ex.: `.slide`, dimensão alvo **1080×1350** (ou escala CSS com `transform` para captura).
- **Header** em todos: subtítulo de marca · `@handle` · pill `N/Total` · opcional ano `AAAA //`.
- **Capa (S1)**: imagem full-bleed; headline com mix branco + cor de acento.
- **Slides 2–9**: parágrafo único; primeira frase = gancho; sem título H separado.
- **Fundos**: classe ou data-attribute `theme-light` / `theme-dark` / `theme-brand` conforme regras da skill (S6 = marca, sem imagem).
- **Accent**: no máximo um `<span class="accent">` por slide; S6 sem accent.
- **Tipografia referência original**: Playfair corpo slides 2–9; Inter bold capa/header — na app, mapear para fontes escolhidas na Marca.
- **Texto em fundos escuros**: creme ~`#F2EDE4` (na app, respeitar contraste dos tokens).

## Checklist (igual à Fase 4 da skill)

- [ ] Header em todos os slides (subtítulo | @handle | pill N/9)
- [ ] Pill com contraste legível por tipo de fundo
- [ ] S6 sem imagem e sem accent
- [ ] Accent em S2, S4, S8 no mínimo
- [ ] Fundos escuros sem branco puro no texto
- [ ] Collab na capa se aplicável

## Export PNG (fora da app)

Viewport 1080px, `deviceScaleFactor: 2`, selecionar cada `.slide`, nomes `Slide_01.png` …
