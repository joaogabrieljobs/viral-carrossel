# Moont product assets — V3

Esta versão substitui o conjunto antigo em que cinco peças diferentes derivavam da mesma fotografia de uma pessoa diante de um monitor. Os painéis agora têm vocabulários próprios para comunicação e apresentações; as cinco capturas da interface são renderizadas pelo produto real com projetos de seis cards/slides e enquadramentos distintos.

## Fontes geradas

### `01-founder-editorial.webp`

```text
Use case: ads-marketing. Asset type: premium vertical 4:5 editorial advertising photograph for the Moont creative-platform website. Create a confident Brazilian woman founder and creative director, early 30s, warm brown skin, in a sharply tailored vermilion jacket, holding a translucent cobalt acrylic object near her face, direct eye contact, hard studio flash, deep cobalt seamless backdrop, crisp graphic shadow, with subtle controlled motion blur only in one hand. Medium close-up, slightly low camera angle, sophisticated contemporary British editorial advertising restraint, medium-format photographic texture, authentic skin and fabric. Place the subject in the upper-right half and preserve the lower-left 42 percent as darker uncluttered negative space for typography that will be added later. No computer, no desk, no phone, no monitor, no generated text, no letters, no logo, no mockup, no watermark, no extra fingers, no futuristic clichés. The image itself must contain zero typography.
```

### `02-crossing-evening.webp`

```text
Use case: productivity-visual. Asset type: premium wide 16:9 editorial photograph for a strategic presentation cover. Cinematic high-angle evening view of a large urban pedestrian crossing in São Paulo, with small groups of people moving in different directions, elegant subtle long-exposure motion trails, and one still figure in a chartreuse coat as a clear focal point. Graphite asphalt, precise geometric street markings, restrained cobalt reflections and warm tungsten light, realistic contemporary Brazil, quiet sophisticated consumer-behaviour report aesthetic, premium research publication, natural city scale. Compose the motion and focal subject mainly in the right 58 percent; leave the left 42 percent dark, calm, low-detail, and uncluttered for presentation typography that will be added later. No computer, no office, no phone close-up, no screen, no text, no letters, no numbers, no logos, no UI, no watermark, no sci-fi glow. The image itself must contain zero typography.
```

### `03-product-still-life.webp`

```text
Use case: ads-marketing. Asset type: premium vertical 4:5 editorial product photograph for a creative strategy carousel. A sculptural arrangement of three unbranded contemporary Brazilian beauty-product packages: one matte cobalt glass bottle, one translucent vermilion acrylic jar, and one slim chartreuse carton, arranged on a dark graphite stone surface with a single hard diagonal studio light and crisp long shadows. Slightly high three-quarter camera angle, refined tactile materials, restrained British editorial advertising direction, medium-format texture, sophisticated and real, generous uncluttered negative space in the lower-left area for typography to be added later. No people, no hands, no desk, no computer, no phone, no monitor, no flowers, no generated text, no letters, no labels, no logo, no watermark, no floating objects, no sci-fi glow. The packages must be completely blank and the image itself must contain zero typography.
```

Esta direção fica preservada como alternativa de fotografia de produto no banco visual. A campanha publicada usa a série contínua de `carousel-source/`, que mantém os mesmos objetos, pessoas e cores entre os cards.

## Saídas

- `public/landing/moont-v3/formats/01-comunica-panel.webp` — painel 1600 × 1000 com quatro cards e apenas uma fotografia.
- `public/landing/moont-v3/formats/02-apresenta-panel.webp` — painel 1600 × 1000 com capa fotográfica, dado e recomendação.
- `public/landing/moont-v3/product/01-interface-comunica-desktop.webp` — captura real do Studio com seis cards variados.
- `public/landing/moont-v3/product/02-interface-apresenta-desktop.webp` — captura real do Studio com seis composições de apresentação.
- `public/landing/moont-v3/product/03-interface-mobile.webp` — captura real do editor móvel em 780 × 1688, exibida em 390 × 844 CSS para telas Retina.
- `public/landing/moont-v3/product/04-interface-workflow-desktop.webp` — captura real da abertura de um projeto de apresentação usada na seção de processo.
- `public/landing/moont-v3/product/05-interface-responsive-mobile.webp` — o mesmo projeto de carrossel da captura desktop, aberto no editor móvel.
- `public/landing/moont-v3/product/06-interface-hero-desktop.webp` — recorte 1140 × 610 do quadro da campanha de beleza, com três cards completos que complementam o detalhe exibido no mobile.

## Regeneração

Com `cwebp` e o navegador Chromium do Playwright instalados, execute:

```bash
node scripts/build-moont-product-assets.mjs
```

O script abre um servidor Vite efêmero a partir deste checkout, renderiza os dois painéis, semeia projetos de demonstração no armazenamento temporário do navegador, captura o Studio e exporta todos os resultados em WebP. Para usar uma origem local que já esteja aberta, defina `MOONT_CAPTURE_BASE_URL`.
