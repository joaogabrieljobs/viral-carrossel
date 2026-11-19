# Biblioteca de templates 2.0 — direção de arte, implementação e crítica

Data: 19/11/2026. Base: recorte do commit `9131b79` (PR #6).

## O que mudou

A rodada anterior tinha dez IDs no catálogo, mas o renderer aplicava quase a mesma
composição a todos: título no alto à esquerda, foto num retângulo à direita, corpo
em Inter pequeno, fios discretos. As famílias se diferenciavam por cor e fonte do título.

A biblioteca 2.0 troca isso por **um módulo único de direção de arte**
(`src/utils/presentation-families.js`) que define, para cada família:

- tipografia de título, leitura e números (máx. duas famílias por página — testado);
- paleta com chão claro, de superfície, invertido e de acento, usados para dar ritmo;
- seis layouts próprios (capa, abertura de seção, conteúdo, foto com argumento,
  evidência, encerramento), cada um com variante **com e sem foto** e **com quadro**;
- geometria própria para **4:5** (recomposição, não redução);
- linguagem gráfica declarativa (fios, numerais, grade, letterbox, colagem, marcas de
  corte, cartões, pílulas) renderizada por `presentation-chrome.js`;
- tratamento fotográfico (filtro CSS de lista fechada, raio) e direção de imagem;
- tratamento de evidência (tabela, métricas, etapas) por família.

O app e a galeria usam **o mesmo módulo**: a galeria importa `familyLayout`,
`chromeElements` e `familyEvidenceStyle` e é empacotada com esbuild.

## As dez famílias

| # | Família | Títulos | Leitura | Assinatura |
|---|---|---|---|---|
| 1 | Editorial contemporâneo | Fraunces 380 | Source Serif 4 | fio de cabeçalho, fio entre colunas, numeral itálico, aspas, legenda |
| 2 | Executivo sofisticado | Inter Tight 600 | Inter | barra de acento, rodapé, chão escuro em seção e decisão |
| 3 | Suíço contemporâneo | Archivo 800 | Archivo | grade 12 col., numeral gigante, bloco vermelho, P&B |
| 4 | Cinemático | Barlow Condensed 600 caixa alta | Barlow | sangria total, letterbox, “CENA 0X”, cartela preta |
| 5 | Luxo discreto | Bodoni Moda | Jost | fio dourado, numeral itálico, alternância escuro/linho, centralização só em capa/fecho |
| 6 | Tipográfico expressivo | Anton | Space Grotesk | palavra dominante, quebras desenhadas, chão tinta/papel/laranja, seta |
| 7 | Cultural e artístico | Syne | DM Sans | bloco de cor deslocado, faixa multiplicada, fita, círculos |
| 8 | Técnico e tecnológico | IBM Plex Sans | IBM Plex Sans + Mono (rótulos/números) | grade visível, marcas de corte, FIG./TAB./§, cota |
| 9 | Fotográfico e humano | Instrument Serif | Instrument Sans | foto protagonista, legendas, intervalo escuro em itálico |
| 10 | Modular contemporâneo | Plus Jakarta Sans 700 | Plus Jakarta Sans | cartões 28 px, pílula numerada, superfície de acento |

O slot `pds.data-first` passou a abrigar a família **Cultural e artística** (o ID
de runtime `presentation_data_first` foi mantido para não quebrar projetos salvos).
Dados deixaram de depender de uma família: todas têm página de evidência própria.
Aliases `data`/`dados` agora apontam para o Técnico e `report` para o Executivo.

## Regras de composição implementadas

- **Pilha título → apoio ajustada ao título real** (`tightenStack`): quando o título
  ocupa menos linhas que a zona prevê, o apoio sobe e ganha a altura liberada. Corrige
  o vazio acidental que aparecia entre título curto e texto. Suíço e capas de
  famílias com polaridade intencional (Cultural, Tipográfico, Cinemático) ficam fora.
- **Barreira**: nada sobe por cima de um elemento ao lado do título.
- **Argumento longo** (> 300 caracteres) ao lado de foto estreita: recomposição com
  leitura larga e foto estreita (preserva o comportamento da rodada anterior).
- **Evidência sem quadro**: foto ocupa a área da evidência; sem foto, a leitura desce
  até o fim da área, com medida máxima de 62%.
- **Texto sobre foto** só com scrim (Cinemático e capas do Fotográfico); demais
  famílias têm superfícies separadas. Testado em 1.443 combinações.
- **Ajustes manuais**: ajuste de foto da pessoa vence o filtro da família; offsets e
  fontes escolhidas por card (`textFonts`) não são sobrescritos; o chrome é gravado
  resolvido na composição, então não se move se o título for editado.

## Arquivos

Novos: `src/utils/presentation-families.js`, `src/utils/presentation-chrome.js`,
`src/utils/presentation-font-manifest.js`, `scripts/build-template-gallery.mjs`,
`scripts/template-gallery/*`, `scripts/sync-design-system-from-families.mjs`,
`docs/presentation/template-gallery-content.json`, `tests/unit/presentation-families.test.js`.

Alterados: `presentation-art-direction.js` (delegação), `presentation-composition.js`
(`familyPresentationFields`, overrides v3), `presentation-format.js` (4:5 por família),
`PresentationArtChrome.jsx`, `PresentationBlocks.jsx`, `SlideCardInner.jsx` (filtro da
família, raio da foto, índice do chrome, fólio), `presentation-presets.jsx` (aliases),
`presentation.js` (direção fotográfica no prompt de imagem, parâmetro opcional),
catálogo JSON 2.0.0 + compilado, allowlist do compilador, teste legado ajustado.

## Como aplicar

```bash
git checkout -b design/biblioteca-templates-2
git apply --3way biblioteca-templates-2.patch      # a partir da raiz do repositório
npm run build:presentation-design-system           # regenera o .generated.js
npx vitest run tests/unit/presentation-families.test.js tests/unit/presentation-art-direction.test.js tests/unit/presentation-composition.test.js
```

1. **Fontes**: adicione `PRESENTATION_FONTS_CSS_URL` (de `presentation-font-manifest.js`)
   ao carregamento de fontes do Studio e da exportação, ou sirva os TTF localmente com os
   `@font-face` de `FONT_FACES`. Sem isso o navegador cai no fallback.
2. **Direção fotográfica**: passe o 4º argumento `familyKey` em
   `buildPresentationImageRules(pathId, topic, projectDirection, familyKey)` onde o prompt
   de imagem é montado (o chamador não está no recorte).
3. **Galeria**: `node scripts/build-template-gallery.mjs --fonts <pasta TTF> --images <selection.json> --before <capturas antigas> --out <saída>` (requer `esbuild`).
4. Rode a suíte completa e os E2E de exportação; atualize snapshots visuais.

## Crítica final por família

- **Editorial**: personalidade forte (serifa óptica, colunas, fios). Título rápido. Ponto
  fraco: conteúdo sem foto com argumento curto deixa a metade inferior vazia — é o vazio
  de revista, mas pede um parágrafo maior ou uma citação.
- **Executivo**: a mais contida e a menos diferente do Moont atual por definição.
  Ganhou ritmo (seção e decisão em fundo escuro), barra de acento e métricas grandes.
  Fraco: depende da qualidade da foto corporativa.
- **Suíço**: o mais reconhecível; aguenta título longo (grade absorve). Fraco: corpo
  25 px em coluna estreita é o limite mínimo de leitura em projeção.
- **Cinemático**: ótimo ritmo cena/pausa. Fraco: exige fotografia escura de boa
  resolução; com foto clara o scrim escurece demais.
- **Luxo**: elegante, alternância escuro/linho funciona. Fraco: Bodoni em corpo pequeno
  perde finos — por isso títulos nunca abaixo de 56 px.
- **Tipográfico**: o mais marcante sem foto. Corrigido: acentos do Anton colidiam com a
  linha anterior (entrelinha 0,90 → 1,03). Fraco: títulos acima de ~60 caracteres
  perdem impacto — a revisão editorial deve encurtar.
- **Cultural**: colagem com leitura preservada. Corrigido: faixa de cor cobria rostos
  (passou para a base da foto). Fraco: com fotos coloridas o P&B forçado pode não servir;
  é o tratamento da família, ajustável por foto.
- **Técnico**: grade, marcas de corte e mono dão prancha técnica real. Corrigido:
  quadros vazios que pareciam placeholder de imagem foram removidos.
- **Fotográfico**: foto protagonista com legenda. Fraco: proximidade com o Editorial nas
  páginas sem foto (ambos serifados); a diferença está no ritmo de imagem e no intervalo escuro.
- **Modular**: cartões e etapas claros. Corrigido: cartão vazio grande e pílula duplicada.
  Fraco: cartão alto com texto curto ainda sobra espaço.

## Limitações

- O recorte não é executável inteiro (faltam `formats.js`, `doc-schema.js`, `format-view.js`,
  loader de fontes). Rodaram: 1.443 casos geométricos + 11 de integração (composição 16:9,
  recomposição 4:5, chrome e blocos via React SSR) com um stub de `formats.js`. Os testes
  legados de `presentation-art-direction` e `presentation-composition` foram ajustados mas
  **não executados** (dependem de arquivos fora do recorte).
- A galeria é um renderer de referência em DOM que usa os mesmos módulos de geometria,
  tipo, chrome e evidência; o `SlideCardInner` real não foi renderizado em navegador.
  Diferenças possíveis: paddings internos do renderer, OverflowScaler e o fólio.
- Fotografias de acervos CC0/PD (~1000 px): suficientes para revisão, não para exportação
  em 1920 px com sangria. Não demonstram a fidelidade do prompt de imagem.
- Projetos salvos não migram em massa; ganham a 2.0 ao reaplicar o preset.
