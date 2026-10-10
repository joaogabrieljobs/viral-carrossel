# Moont — biblioteca visual V2

## Direção

A biblioteca separa três funções visuais:

1. **Retratos publicitários** criam identificação e desejo, sem interfaces inseridas nas telas.
2. **Resultados da Moont** provam repertório com carrosséis e apresentações exportados de forma limpa.
3. **Interface real** explica o produto com capturas ortogonais, nítidas e sem deformação de perspectiva.

As imagens evitam a fórmula repetida de pessoa vista por trás diante de um notebook. A variedade vem de lente, distância, luz, pose, ambiente e energia.

## Modo de geração

- Ferramenta: `image_gen`
- Modo: geração a partir de texto
- Transparência: desativada
- Acabamento: conversão para WebP em qualidade 82

## Retratos finais

### 01 — Social media strategist

Retrato frontal de uma estrategista negra em cadeira azul, flash editorial suavizado por luz natural, estúdio compacto real e espaço negativo. Sem tela visível, texto ou logotipo.

### 02 — Designer em processo

Vista totalmente superior de um designer asiático-brasileiro cercado por formas, amostras de cor, sketchbook e materiais físicos. Luz dura de estúdio e composição geométrica.

### 03 — Fundadora de marca

Plano ambiental aberto de uma fundadora latina em uma loja independente de beleza. Luz quente, arquitetura bordô e interação real com o produto.

### 04 — Médica especialista

Close de perfil com reflexo em vidro, luz clínica fria equilibrada por uma luz prática quente e sensação de autoridade tranquila.

### 05 — Creator em produção

Retrato vertical em plano baixo, flash direto e creator ajustando um rig de vídeo. O telefone fica de costas para a câmera, sem interface falsa.

### 06 — Diretora criativa em movimento

Retrato vertical urbano com flash, movimento controlado no fundo, cachecol violeta e caderno verde como acentos da marca.

### 07 — Time em crítica criativa

Cena horizontal ampla com três profissionais em posições diferentes diante de uma parede de composições abstratas. Luz natural e sombra violeta discreta.

### 08 — Fundador em operação

Plano ambiental de um fundador negro em uma pequena operação de café. Luz de fim de tarde, materiais táteis e embalagem sem marca.

## Restrições usadas nos prompts

- Sem texto legível, logotipos ou UI gerada pela IA.
- Sem pessoas segurando fotografias ou mockups.
- Sem sorriso corporativo de banco de imagens.
- Sem cenários futuristas, hologramas ou estética genérica de IA.
- Textura de pele, objetos e ambientes preservada.
- Violeta e verde ácido apenas como acentos.

## Arquivos

Os oito retratos otimizados e a contact sheet ficam em `public/landing/moont-v2/`.

## Apêndice A — prompts de geração dos retratos

Os textos abaixo foram recuperados do campo `revisedPrompt` dos eventos concluídos de `image_gen` no registro local desta conversa. Portanto, são os prompts efetivamente associados aos oito arquivos originais; não são reconstruções editoriais. Em todos os casos, o modo foi **geração a partir de texto**, com `transparent_background: false`. Os PNGs originais permanecem no diretório de imagens geradas do Codex e os arquivos finais da landing page foram convertidos para WebP com qualidade 82.

### 01 — Social media strategist

- Ferramenta: `image_gen`
- Modo: geração a partir de texto
- Proporção solicitada: paisagem 3:2
- Saída final: 1536 × 1024 px, WebP
- Transparência: desativada
- Restrições: sem sorriso de banco de imagens, ficção científica, interface flutuante, pôsteres, tipografia, logotipos ou pessoa segurando fotografia; tela visível proibida.
- Arquivo final: `public/landing/moont-v2/portraits/01-social-strategist.webp`

Prompt exato registrado:

```text
High-end British editorial advertising photograph for a contemporary creative software brand. A Black Brazilian female social media strategist, early 30s, direct confident eye contact, seated sideways on a simple cobalt chair in a real compact content workspace. Close three-quarter portrait, 50mm lens, hard on-camera flash softened by daylight, cobalt blue and acidic chartreuse accents, natural skin texture, tailored black shirt, expressive hands, subtle evidence of working life in the background such as a closed laptop and color notes but no readable text and no visible screen. Bold asymmetric composition with generous negative space. Sophisticated magazine campaign, tactile, contemporary, believable, no stock-photo smile, no sci-fi, no floating UI, no posters, no typography, no logos, no person holding a photo. Landscape 3:2.
```

### 02 — Designer em processo

- Ferramenta: `image_gen`
- Modo: geração a partir de texto
- Proporção solicitada: paisagem 3:2
- Saída final: 1536 × 1024 px, WebP
- Transparência: desativada
- Restrições: sem palavras legíveis, tela de computador, logotipos, interface falsa, escritório genérico ou estética de banco de imagens; mãos e materiais autênticos.
- Arquivo final: `public/landing/moont-v2/portraits/02-designer-overhead.webp`

Prompt exato registrado:

```text
Premium editorial campaign photograph, documentary fashion sensibility. A young Brazilian male graphic designer of East Asian heritage at a long worktable, photographed from directly overhead, arranging color swatches, a sketchbook, headphones and printed abstract shapes. His face is partially visible looking upward, candid and intelligent. Warm cream paper, deep black, ultramarine and lime accents. Strong geometric composition, real studio daylight with hard shadows, 28mm lens, fine grain, authentic hands and materials, no readable words, no computer screen, no logos, no fake UI, no generic office, no stock photography. Landscape 3:2.
```

### 03 — Fundadora de marca

- Ferramenta: `image_gen`
- Modo: geração a partir de texto
- Proporção solicitada: paisagem 3:2
- Saída final: 1536 × 1024 px, WebP
- Transparência: desativada
- Restrições: sem texto, logotipos, telas flutuantes, pessoa segurando fotografias, acabamento genérico de IA ou pose com dispositivo.
- Arquivo final: `public/landing/moont-v2/portraits/03-brand-founder-beauty.webp`

Prompt exato registrado:

```text
Sophisticated commercial portrait for a design technology brand. A Latina founder in her late 30s standing inside her small premium beauty retail space, framed through shelves in a wide environmental portrait. She is not posing with a device; she is checking a physical product label and glancing toward camera with calm authority. Low camera angle, 35mm lens, late-afternoon side light, saturated vermilion and plum color blocking, real skin and fabric texture, slight motion in background, editorial rather than corporate, luxurious but attainable, no text, no logos, no floating screens, no person holding photos, no AI gloss. Landscape 3:2.
```

### 04 — Médica especialista

- Ferramenta: `image_gen`
- Modo: geração a partir de texto
- Proporção solicitada: paisagem 3:2
- Saída final: 1536 × 1024 px, WebP
- Transparência: desativada
- Restrições: sem interface de computador, documentos legíveis, logotipos, clichê do estetoscópio, sorriso de banco de imagens ou surrealismo.
- Arquivo final: `public/landing/moont-v2/portraits/04-doctor-profile.webp`

Prompt exato registrado:

```text
Award-caliber editorial portrait of a Black Brazilian physician and educator, late 40s, in a bright modern consultation room. Tight profile close-up reflected subtly in a glass partition, calm and precise expression, white coat over contemporary dark clothing. Cool daylight with one warm practical light, restrained navy, cream and electric violet palette, 85mm lens, shallow depth of field, natural skin texture, quiet authority, medical setting recognizable but uncluttered. No computer interface, no readable documents, no logos, no stethoscope cliché, no stock-photo grin, no surrealism. Landscape 3:2.
```

### 05 — Creator em produção

- Ferramenta: `image_gen`
- Modo: geração a partir de texto
- Proporção solicitada: retrato 4:5
- Saída final: 1122 × 1402 px, WebP
- Transparência: desativada
- Restrições: tela do telefone voltada para longe da câmera; sem texto legível, logotipos, gráficos flutuantes, interface falsa, pessoa segurando fotografia, cyberpunk ou sorriso de banco de imagens.
- Arquivo final: `public/landing/moont-v2/portraits/05-creator-low-angle.webp`

Prompt exato registrado:

```text
High-energy advertising portrait for a contemporary creative software campaign. A nonbinary Brazilian content creator in their late 20s, photographed from a low angle while setting up a compact vertical video rig in a real home studio. The phone screen faces away from camera. Direct flash, deep indigo night outside the window, one acid-lime practical accent, subtle motion blur in one hand, sharp expressive face, 24mm lens, dynamic diagonal composition, fashion editorial confidence, natural skin texture. No readable text, no logos, no floating graphics, no fake interface, no person holding a photo, no cyberpunk, no stock-photo smile. Portrait 4:5.
```

### 06 — Diretora criativa em movimento

- Ferramenta: `image_gen`
- Modo: geração a partir de texto
- Proporção solicitada: retrato 4:5
- Saída final: 1122 × 1402 px, WebP
- Transparência: desativada
- Restrições: sem texto legível, logotipos, telas, interface flutuante, escritório genérico ou pessoa segurando fotografia.
- Arquivo final: `public/landing/moont-v2/portraits/06-creative-director-urban.webp`

Prompt exato registrado:

```text
Contemporary fashion-editorial portrait of a Brazilian female creative director, early 30s, walking through a graphic urban passage after a client meeting, captured mid-stride with direct flash and controlled motion blur in the background. Tight waist-up framing, 50mm lens, silver-grey architecture, violet scarf and acid-green notebook as restrained accents, self-possessed expression looking just past camera, natural skin and fabric texture. Premium advertising campaign, energetic and credible. No readable text, no logos, no screens, no floating UI, no generic office, no person holding a photograph. Portrait 4:5.
```

### 07 — Time em crítica criativa

- Ferramenta: `image_gen`
- Modo: geração a partir de texto
- Proporção solicitada: widescreen 16:9
- Saída final: 1672 × 941 px, WebP
- Transparência: desativada
- Restrições: peças impressas apenas com formas abstratas e sem texto legível; sem telas de notebook, logotipos ou sorrisos corporativos encenados.
- Arquivo final: `public/landing/moont-v2/portraits/07-team-critique.webp`

Prompt exato registrado:

```text
Wide editorial advertising photograph of a diverse three-person creative team reviewing physical campaign layouts on a wall in a sunlit shared workspace. One Black man seated in foreground, one white Brazilian woman pointing at typography, one brown nonbinary designer seen in profile. Candid critique, serious engaged expressions, different body positions, 35mm lens, asymmetrical horizontal composition, generous negative space, daylight plus a subtle violet gel shadow, print pieces contain abstract shapes only and no readable text. Premium British design magazine sensibility, realistic materials and skin, no laptop screens, no logos, no staged corporate smiles. Widescreen 16:9.
```

### 08 — Fundador em operação

- Ferramenta: `image_gen`
- Modo: geração a partir de texto
- Proporção solicitada: paisagem 3:2
- Saída final: 1536 × 1024 px, WebP
- Transparência: desativada
- Restrições: embalagem em branco; sem texto legível, logotipos, computadores, interface falsa, pessoa segurando fotografia ou estética de banco de imagens.
- Arquivo final: `public/landing/moont-v2/portraits/08-founder-coffee.webp`

Prompt exato registrado:

```text
Environmental commercial portrait of a Black Brazilian male founder in his early 40s inside a small premium coffee packaging workshop, photographed from a slightly low angle with a 28mm lens. He stands between shelves and a stainless workbench checking a blank embossed package, confident but candid, warm late-afternoon light with deep forest green and burnt orange details, mild foreground blur, real working environment, tactile materials, sophisticated independent brand campaign. No readable text, no logos, no computers, no fake UI, no person holding a photo, no stock aesthetic. Landscape 3:2.
```
