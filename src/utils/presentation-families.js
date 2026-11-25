import { wcagContrast } from './wcag.js';
/**
 * Biblioteca de direção de arte do Moont — fonte única de verdade.
 *
 * Dez famílias, seis funções de página (capa, abertura de seção, conteúdo,
 * fotografia com argumento, evidência, encerramento) e dois formatos
 * (apresentação 16:9 e carrossel 4:5). O modelo escolhe a função da página;
 * nunca coordenadas, cores ou CSS.
 *
 * Este módulo é puro (sem React, sem DOM). É consumido por:
 *  - presentation-art-direction.js / presentation-composition.js (zonas e tipo);
 *  - PresentationArtChrome.jsx via presentation-chrome.js (linguagem gráfica);
 *  - PresentationBlocks.jsx (tratamento de tabela, métricas e etapas);
 *  - presentation-format.js (recomposição 4:5);
 *  - scripts/build-template-gallery.mjs (galeria de revisão).
 * Por isso a galeria e o aplicativo desenham a mesma geometria.
 *
 * Unidades: caixas em % do canvas; tamanhos de fonte em px na largura de
 * referência do formato (1920 no 16:9, 1080 no 4:5). O renderer converte.
 */

export const FAMILY_KEYS = Object.freeze([
  'editorial', 'executive', 'swiss', 'cinematic', 'luxury',
  'typographic', 'cultural', 'technical', 'photo', 'modular',
]);

export const PAGE_KINDS = Object.freeze(['cover', 'divider', 'content', 'demo', 'data', 'closing']);

/**
 * Modo livre (docs/product/modo-livre-apresentacao.md): preset virtual em que
 * cada página escolhe a família, o fundo e o tamanho da foto, com a paleta e o
 * par de fontes do deck. Definido aqui porque este módulo não depende de nada.
 */
export const FREE_PRESENTATION_PRESET_ID = 'presentation_free';

export const FORMAT_SPECS = Object.freeze({
  '16:9': { w: 1920, h: 1080 },
  '4:5': { w: 1080, h: 1350 },
  '1:1': { w: 1080, h: 1080 },
  '9:16': { w: 1080, h: 1920 },
});

const z = (x, y, w, h) => ({ x, y, w, h });

/* ------------------------------------------------------------------------ */
/* Tokens de família                                                        */
/* ------------------------------------------------------------------------ */

const font = (family, generic, weights, extra = {}) => ({ family, css: `"${family}", ${generic}`, weights, ...extra });

export const PRESENTATION_FAMILIES = Object.freeze({
  editorial: {
    key: 'editorial',
    patternId: 'pds.editorial-magazine',
    runtimeId: 'presentation_editorial_magazine',
    label: 'Editorial contemporâneo',
    intent: 'Revista de cultura: serifa expressiva, colunas, fios finos e fotografia com legenda.',
    fonts: {
      display: font('Fraunces', 'Georgia, serif', [300, 400, 600], { weight: 380, widthFactor: 0.5, tracking: -2.2, italicAccent: true }),
      text: font('Source Serif 4', 'serif', [400, 600], { weight: 400, tracking: 0 }),
      numeric: 'display', label: 'text',
    },
    palette: {
      bg: '#F3EEE6', surface: '#EAE3D7', ink: '#1B1916', muted: '#5C554D',
      accent: '#A8321E', accent2: '#1B1916', accent3: '#C9BBA4', rule: '#1B1916',
      inverse: '#1B1916', inverseInk: '#F3EEE6', inverseMuted: '#BDB3A5',
    },
    photo: {
      filter: 'saturate(0.9) contrast(1.03) sepia(0.06)', radius: 0,
      direction: 'Luz natural lateral, sombras macias e tons de papel e terra no ambiente. Posicione o assunto no terço que o recorte permitir e preserve o espaço necessário ao texto.',
      directionEn: 'Use natural side light, soft shadows and paper or earth tones in the surroundings. Place the subject on a third when the image panel allows and leave the actual text area quiet.',
    },
    type: { titleLeading: 1.0, bodyLeading: 1.48, bodyCase: 'normal', tightCovers: true },
    graphic: 'Fio fino no topo como cabeçalho de revista, fio vertical entre colunas, numeral em itálico na abertura de seção, aspas de abertura nas citações.',
  },
  executive: {
    key: 'executive',
    patternId: 'pds.executive-minimal',
    runtimeId: 'presentation_executive_minimal',
    label: 'Executivo sofisticado',
    intent: 'Sala de conselho: títulos-conclusão, grade rigorosa, um ponto de cor e dados legíveis a distância.',
    fonts: {
      display: font('Inter Tight', 'sans-serif', [500, 600, 700], { weight: 600, widthFactor: 0.52, tracking: -2.4 }),
      text: font('Inter', 'sans-serif', [400, 500, 600], { weight: 400, tracking: -0.4 }),
      numeric: 'display', label: 'text',
    },
    palette: {
      bg: '#F7F7F5', surface: '#FFFFFF', ink: '#101418', muted: '#4B525C',
      accent: '#1F4FD8', accent2: '#101418', accent3: '#D5D8DD', rule: '#C9CDD3',
      inverse: '#0F1A2E', inverseInk: '#F7F7F5', inverseMuted: '#A9B2C3',
    },
    photo: {
      filter: 'saturate(0.85) contrast(1.03)', radius: 0,
      direction: 'Luz de janela difusa, paleta fria e neutra, linhas retas e enquadramento sóbrio do assunto do slide.',
      directionEn: 'Use diffused window light and cool neutral surroundings. Frame the supplied subject with restrained straight lines and purposeful detail, avoiding posed stock photography.',
    },
    type: { titleLeading: 1.06, bodyLeading: 1.45, bodyCase: 'normal', tightCovers: true },
    graphic: 'Barra de acento curta acima do título, fio de rodapé, números tabulares e fundo escuro nas aberturas de seção e na decisão final.',
  },
  swiss: {
    key: 'swiss',
    patternId: 'pds.swiss-grid',
    runtimeId: 'presentation_swiss_grid',
    label: 'Suíço contemporâneo',
    intent: 'Grade assimétrica de 12 colunas, contraste extremo de escala, vermelho como gesto e espaço vazio estrutural.',
    fonts: {
      display: font('Archivo', 'sans-serif', [400, 700, 800], { weight: 800, widthFactor: 0.6, tracking: -4.2 }),
      text: font('Archivo', 'sans-serif', [400, 500], { weight: 400, tracking: -0.6 }),
      numeric: 'display', label: 'text',
    },
    palette: {
      bg: '#FFFFFF', surface: '#F1F1EF', ink: '#0A0A0A', muted: '#55554F',
      accent: '#E3001B', accent2: '#0A0A0A', accent3: '#DADAD5', rule: '#0A0A0A',
      inverse: '#E3001B', inverseInk: '#FFFFFF', inverseMuted: '#FFD9DD',
    },
    photo: {
      filter: 'grayscale(1) contrast(1.12)', radius: 0,
      direction: 'Organize o assunto com geometria frontal ou a 90°, sombras definidas e fundo simples para o tratamento em preto e branco. Preserve o recorte do módulo ativo.',
      directionEn: 'Use frontal or overhead geometry, defined shadows and a plain background that reads well after the monochrome filter. Compose for the actual grid module.',
    },
    // Suíço trabalha com polaridade: título no alto, apoio ancorado na grade.
    type: { titleLeading: 0.98, bodyLeading: 1.4, bodyCase: 'normal', stack: 'fixed' },
    graphic: 'Numeral gigante de índice, fio grosso vertical, bloco vermelho que ocupa colunas inteiras e linhas de grade quase invisíveis.',
  },
  cinematic: {
    key: 'cinematic',
    patternId: 'pds.cinematic',
    runtimeId: 'presentation_cinematic',
    label: 'Cinemático',
    intent: 'Sequência de cenas: fotografia de ponta a ponta, títulos condensados, faixas de letterbox e pausas em preto.',
    fonts: {
      display: font('Barlow Condensed', 'Arial Narrow, sans-serif', [500, 600], { weight: 600, widthFactor: 0.47, tracking: 1.2, case: 'upper' }),
      text: font('Barlow', 'Arial, sans-serif', [400, 500], { weight: 400, tracking: 0 }),
      numeric: 'display', label: 'display',
    },
    palette: {
      bg: '#0B0B0C', surface: '#151517', ink: '#F2EFE9', muted: '#A39E95',
      accent: '#E8B04A', accent2: '#F2EFE9', accent3: '#2A2A2D', rule: '#3A3A3E',
      inverse: '#000000', inverseInk: '#F2EFE9', inverseMuted: '#8E8A83',
    },
    photo: {
      filter: 'contrast(1.08) saturate(0.82) brightness(0.92)', radius: 0,
      direction: 'Use profundidade, luz prática e contraste de cinema no painel do slide. Preserve o horário e o sujeito fornecidos e a área destinada ao título.',
      directionEn: 'Use cinematic depth, motivated light and controlled contrast. Preserve the supplied subject and setting within the actual panel. Keep title space clear without adding letterbox bars or changing the output ratio.',
    },
    type: { titleLeading: 0.98, bodyLeading: 1.5, bodyCase: 'normal' },
    graphic: 'Faixas de letterbox, timecode e número de cena em condensada, cartela preta centrada nas aberturas de seção.',
  },
  luxury: {
    key: 'luxury',
    patternId: 'pds.premium-dark',
    runtimeId: 'presentation_premium_dark',
    label: 'Luxo discreto',
    intent: 'Poucos elementos, serifa de alto contraste, tons profundos alternados com linho natural e muito silêncio.',
    fonts: {
      display: font('Bodoni Moda', 'Didot, serif', [400, 500], { weight: 400, widthFactor: 0.52, tracking: -1.2, italicAccent: true }),
      text: font('Jost', 'sans-serif', [400, 500], { weight: 400, tracking: 0.4 }),
      numeric: 'display', label: 'text',
    },
    palette: {
      bg: '#15120F', surface: '#1E1A16', ink: '#EDE6DA', muted: '#A99F91',
      accent: '#C2A878', accent2: '#EDE6DA', accent3: '#3A332B', rule: '#5A5044',
      inverse: '#E8E1D5', inverseInk: '#1E1A16', inverseMuted: '#6B6255',
    },
    photo: {
      filter: 'saturate(0.72) contrast(1.06) brightness(0.94)', radius: 0,
      direction: 'Luz rasante suave em uma fonte, sombras delicadas e espaço ao redor da forma. Valorize o acabamento informado do objeto.',
      directionEn: 'Use one soft raking light, gentle shadow and ample space around the form. Reveal the actual finish of the specified subject and keep product features intact within the crop.',
    },
    type: { titleLeading: 1.04, bodyLeading: 1.6, bodyCase: 'normal', tightCovers: true },
    graphic: 'Fio fino dourado, monograma de numeração em itálico, margens largas, centralização apenas em capa e encerramento.',
  },
  typographic: {
    key: 'typographic',
    patternId: 'pds.typographic-bold',
    runtimeId: 'presentation_typographic_bold',
    label: 'Tipográfico expressivo',
    intent: 'A palavra é a imagem: escala extrema, quebras desenhadas, fundos chapados que alternam papel, tinta e laranja.',
    fonts: {
      display: font('Anton', 'sans-serif', [400], { weight: 400, widthFactor: 0.5, tracking: 0.4, case: 'upper' }),
      text: font('Space Grotesk', 'sans-serif', [400, 500, 700], { weight: 400, tracking: -0.6 }),
      numeric: 'display', label: 'text',
    },
    palette: {
      bg: '#ECE9E0', surface: '#E1DDD1', ink: '#111111', muted: '#4A4740',
      accent: '#E44318', accent2: '#111111', accent3: '#CFC9BA', rule: '#111111',
      inverse: '#111111', inverseInk: '#ECE9E0', inverseMuted: '#A6A196',
    },
    photo: {
      filter: 'grayscale(1) contrast(1.25) brightness(1.02)', radius: 0,
      direction: 'Trate a imagem como uma pequena pontuação visual, com detalhe gráfico, contraste monocromático e recorte limpo. A tipografia é inserida pelo app.',
      directionEn: 'Use a small, sharply cropped monochrome detail as visual punctuation in the designated module. Emphasize texture, contour and contrast. Keep letters and printed copy out of the generated image.',
    },
    // Anton: maiúscula acentuada (É, Á, Ô) sobe 110% do corpo. Com 1,03 o acento
    // da linha seguinte tocava o pé da anterior (medido no navegador).
    type: { titleLeading: 1.15, bodyLeading: 1.42, bodyCase: 'normal' },
    graphic: 'Palavra dominante, fio grosso, seta tipográfica e alternância de fundos chapados entre as páginas.',
  },
  cultural: {
    key: 'cultural',
    patternId: 'pds.data-first',
    runtimeId: 'presentation_data_first',
    label: 'Cultural e artístico',
    intent: 'Colagem controlada: recortes, blocos de cor deslocados, fita adesiva e formas simples — sempre com uma área limpa para ler.',
    fonts: {
      display: font('Syne', 'Arial, sans-serif', [600, 700, 800], { weight: 700, widthFactor: 0.64, tracking: -2.6 }),
      text: font('DM Sans', 'Arial, sans-serif', [400, 500, 700], { weight: 400, tracking: -0.2 }),
      numeric: 'display', label: 'text',
    },
    palette: {
      bg: '#EFE7DA', surface: '#E5DACA', ink: '#1C1A17', muted: '#575148',
      accent: '#2B4BFF', accent2: '#FF6B4A', accent3: '#F2C14E', rule: '#1C1A17',
      inverse: '#2B4BFF', inverseInk: '#F7F2EA', inverseMuted: '#C8D1FF',
    },
    photo: {
      filter: 'grayscale(1) contrast(1.18) brightness(1.03)', radius: 0,
      direction: 'Contorno limpo e textura de papel ou tinta, com leitura em preto e branco para sobreposição posterior de cor. Use apenas o sujeito indicado.',
      directionEn: 'Use clean contours and tactile paper or ink textures on the specified subject. Compose for a monochrome image with a later colour overlay. Keep poster lettering and invented works or performances out of the scene.',
    },
    type: { titleLeading: 0.98, bodyLeading: 1.45, bodyCase: 'normal' },
    graphic: 'Bloco de cor deslocado atrás da foto, faixa de cor multiplicada sobre a imagem, fita adesiva, círculo e semicírculo como pontuação.',
  },
  technical: {
    key: 'technical',
    patternId: 'pds.technical-blueprint',
    runtimeId: 'presentation_technical_blueprint',
    label: 'Técnico e tecnológico',
    intent: 'Prancha técnica: grade visível, cotas, rótulos monoespaçados, números tabulares e diagramas editáveis.',
    fonts: {
      display: font('IBM Plex Sans', 'sans-serif', [400, 500, 600], { weight: 500, widthFactor: 0.54, tracking: -2 }),
      text: font('IBM Plex Sans', 'sans-serif', [400, 500], { weight: 400, tracking: -0.2 }),
      mono: font('IBM Plex Mono', 'monospace', [400, 500], { weight: 400, tracking: 0 }),
      numeric: 'mono', label: 'mono',
    },
    palette: {
      bg: '#0E1217', surface: '#151B22', ink: '#E8ECF1', muted: '#8A94A3',
      accent: '#5CE1A5', accent2: '#6FA8FF', accent3: '#26303B', rule: '#2E3946',
      inverse: '#E8ECF1', inverseInk: '#0E1217', inverseMuted: '#4D5866',
    },
    photo: {
      filter: 'grayscale(0.55) contrast(1.12) brightness(0.88)', radius: 0,
      direction: 'Macro técnico com foco preciso, luz fria e fundo escuro. Detalhes de equipamento apenas se a cena os solicitar. Dados, telas reais e marcas gráficas ficam fora da imagem gerada.',
      directionEn: 'Use a precise technical macro, cool light and a dark background. Show only the supplied physical subject or detail. Keep labels, crop marks, interfaces and technical data out of the generated image.',
    },
    type: { titleLeading: 1.05, bodyLeading: 1.5, bodyCase: 'normal', tightCovers: true },
    graphic: 'Grade de 12 colunas visível, marcas de corte nas figuras, rótulos FIG./§ em mono, linha de cota e ponto de status verde.',
  },
  photo: {
    key: 'photo',
    patternId: 'pds.photo-essay',
    runtimeId: 'presentation_photo_essay',
    label: 'Fotográfico e humano',
    intent: 'Ensaio fotográfico: imagem protagonista, retratos e detalhes, legendas e respiro entre fotos e texto.',
    fonts: {
      display: font('Instrument Serif', 'Georgia, serif', [400], { weight: 400, widthFactor: 0.44, tracking: -1.4, italicAccent: true }),
      text: font('Instrument Sans', 'Arial, sans-serif', [400, 500, 600], { weight: 400, tracking: -0.2 }),
      numeric: 'display', label: 'text',
    },
    palette: {
      bg: '#FAF7F2', surface: '#F0EAE1', ink: '#1E1B18', muted: '#675F57',
      accent: '#8A5A3B', accent2: '#1E1B18', accent3: '#D9CFC2', rule: '#CFC5B8',
      inverse: '#1E1B18', inverseInk: '#FAF7F2', inverseMuted: '#B7AEA4',
    },
    photo: {
      filter: 'saturate(1.02) contrast(1.02) sepia(0.04)', radius: 0,
      direction: 'Luz de janela, cor quente e textura natural. Mostre a ação ou o detalhe de ofício descrito e mantenha mãos e rosto relevantes dentro do recorte.',
      directionEn: 'Use natural window light, warm restrained colour and realistic textures. For a person called for by the scene, keep the relevant face or hand movement inside the crop and leave room in the direction of the gaze.',
    },
    type: { titleLeading: 1.02, bodyLeading: 1.5, bodyCase: 'normal' },
    graphic: 'Passe-partout branco, legenda numerada sob a foto, díptico de imagens e intervalo escuro entre capítulos.',
  },
  modular: {
    key: 'modular',
    patternId: 'pds.modular-cards',
    runtimeId: 'presentation_modular_cards',
    label: 'Modular contemporâneo',
    intent: 'Superfícies organizadas: cartões, etapas, comparações e hierarquia clara sobre um fundo neutro.',
    fonts: {
      display: font('Plus Jakarta Sans', 'sans-serif', [500, 700, 800], { weight: 700, widthFactor: 0.58, tracking: -2.6 }),
      text: font('Plus Jakarta Sans', 'sans-serif', [400, 500, 600], { weight: 400, tracking: -0.3 }),
      numeric: 'display', label: 'text',
    },
    palette: {
      bg: '#ECEEF2', surface: '#FFFFFF', ink: '#12161C', muted: '#525B68',
      accent: '#5B4BFF', accent2: '#12161C', accent3: '#D9DCF8', rule: '#D3D7DE',
      inverse: '#5B4BFF', inverseInk: '#FFFFFF', inverseMuted: '#DCD8FF',
    },
    photo: {
      filter: 'saturate(0.95) contrast(1.02)', radius: 28,
      direction: 'Luz clara e uniforme, fundo organizado e assunto longe dos cantos arredondados do módulo.',
      directionEn: 'Use even bright light, clean colour and an orderly background. Keep the essential subject away from rounded module corners. Include only objects called for by the slide.',
    },
    type: { titleLeading: 1.06, bodyLeading: 1.5, bodyCase: 'normal', tightCovers: true },
    graphic: 'Cartões brancos com cantos de 28 px, etiqueta numerada em pílula, blocos agrupados e uma superfície de cor por sequência.',
  },
});

/* ------------------------------------------------------------------------ */
/* Layouts                                                                  */
/* ------------------------------------------------------------------------ */
/*
 * Cada função recebe { photo, structured, portrait } e devolve:
 *   ground   — 'bg' | 'surface' | 'inverse' | 'accent'
 *   title, subtitle, photo?, evidence?   — caixas em %
 *   titlePx, bodyPx (px na largura do formato), titleItalic?
 *   align, anchors { title, subtitle } ('start'|'center'|'end')
 *   scrim    — texto sobre foto: { mode: 'scrim'|'top'|'flat', amount }
 *   chrome   — dispositivos gráficos declarativos (presentation-chrome.js)
 */

const L = (spec) => ({ align: 'left', anchors: { title: 'start', subtitle: 'start' }, chrome: [], ...spec });

// Dispositivos de chrome (todas as coordenadas em %).
const rule = (x, y, w, h, color = 'rule', extra = {}) => ({ t: 'rule', x, y, w, h, color, ...extra });
const block = (x, y, w, h, color, extra = {}) => ({ t: 'block', x, y, w, h, color, ...extra });
const label = (x, y, w, text, extra = {}) => ({ t: 'text', x, y, w, text, role: 'label', size: 22, color: 'muted', ...extra });
const numeral = (x, y, w, text, size, extra = {}) => ({ t: 'text', x, y, w, text, role: 'numeric', size, color: 'accent', ...extra });

/* 1 — Editorial ---------------------------------------------------------- */
function editorial(kind, { photo, structured, portrait }) {
  if (portrait) {
    const top = [rule(7, 5.5, 86, 0.08, 'ink'), label(7, 6.4, 60, '{kicker}', { size: 22, italic: true })];
    if (kind === 'cover') return photo
      ? L({ photo: z(0, 0, 100, 55), title: z(7, 59, 86, 27), subtitle: z(7, 87, 72, 9), titlePx: 92, bodyPx: 30, chrome: [rule(7, 57.5, 86, 0.08, 'ink'), rule(7, 86.2, 10, 0.25, 'accent', { follow: 'subtitle' })] })
      : L({ title: z(7, 16, 86, 50), subtitle: z(7, 72, 70, 18), titlePx: 118, bodyPx: 32, chrome: [...top, rule(7, 69.5, 86, 0.08, 'ink')] });
    if (kind === 'divider') return L({ title: z(7, 42, 86, 30), subtitle: z(7, 74, 72, 16), titlePx: 84, bodyPx: 30,
      chrome: [...top, numeral(6, 11, 60, '{section}', 300, { role: 'display', italic: true, leading: 0.9 })] });
    if (kind === 'demo') return photo
      ? L({ photo: z(0, 0, 100, 60), title: z(7, 64, 86, 17), subtitle: z(7, 82, 86, 13), titlePx: 60, bodyPx: 28, chrome: [label(7, 60.6, 86, '{caption}', { size: 23, italic: true })] })
      : L({ title: z(10, 22, 82, 46), subtitle: z(10, 72, 72, 18), titlePx: 80, bodyPx: 30, titleItalic: true,
        chrome: [numeral(6, 8, 30, '“', 280, { role: 'display', leading: 1 })] });
    if (kind === 'data') return L({ title: z(7, 10, 86, 15), subtitle: z(7, 26, 86, 11), evidence: z(7, 40, 86, 51), photo: !structured && photo ? z(7, 40, 86, 51) : undefined, titlePx: 58, bodyPx: 28, chrome: top });
    if (kind === 'closing') return photo
      ? L({ photo: z(7, 9, 40, 30), title: z(7, 44, 86, 28), subtitle: z(7, 74, 72, 18), titlePx: 84, bodyPx: 30, chrome: [rule(7, 92, 86, 0.08, 'ink')] })
      : L({ title: z(7, 26, 86, 34), subtitle: z(7, 64, 72, 22), titlePx: 92, bodyPx: 30, chrome: [...top, rule(7, 92, 86, 0.08, 'ink')] });
    return photo
      ? L({ photo: z(7, 9, 86, 38), title: z(7, 50, 86, 18), subtitle: z(7, 70, 86, 24), titlePx: 62, bodyPx: 29, chrome: [label(7, 47.4, 86, '{caption}', { size: 23, italic: true })] })
      : L({ title: z(7, 11, 86, 28), subtitle: z(7, 45, 86, 47), titlePx: 76, bodyPx: 31, chrome: [...top, rule(7, 42, 20, 0.25, 'accent', { follow: 'subtitle' })] });
  }
  const head = [rule(5, 10.4, 90, 0.1, 'ink'), label(5, 6.4, 60, '{kicker}', { size: 22, italic: true })];
  if (kind === 'cover') return photo
    ? L({ photo: z(48, 0, 52, 100), title: z(5, 22, 39, 50), subtitle: z(5, 76, 35, 15), titlePx: 118, bodyPx: 30,
      chrome: [rule(5, 10.4, 39, 0.1, 'ink'), label(5, 6.4, 39, '{kicker}', { size: 22, italic: true }), rule(5, 73.6, 8, 0.4, 'accent', { follow: 'subtitle' })] })
    : L({ title: z(5, 18, 74, 50), subtitle: z(55, 74, 38, 18), titlePx: 150, bodyPx: 32,
      chrome: [...head, rule(5, 70.6, 90, 0.1, 'ink')] });
  if (kind === 'divider') return photo
    ? L({ photo: z(70, 0, 30, 100), title: z(34, 24, 32, 44), subtitle: z(34, 70, 32, 20), titlePx: 80, bodyPx: 29,
      chrome: [numeral(4, 12, 28, '{section}', 320, { role: 'display', italic: true, leading: 0.9 })] })
    : L({ title: z(36, 22, 56, 40), subtitle: z(36, 66, 42, 22), titlePx: 96, bodyPx: 30,
      chrome: [...head, numeral(4, 14, 30, '{section}', 340, { role: 'display', italic: true, leading: 0.9 })] });
  if (kind === 'demo') return photo
    ? L({ photo: z(0, 0, 60, 100), title: z(64, 14, 31, 40), subtitle: z(64, 57, 31, 33), titlePx: 64, bodyPx: 28,
      chrome: [rule(64, 10.4, 31, 0.1, 'ink'), label(64, 92, 31, '{caption}', { size: 22, italic: true })] })
    : L({ title: z(10, 18, 80, 50), subtitle: z(10, 73, 46, 19), titlePx: 92, bodyPx: 30, titleItalic: true,
      chrome: [numeral(4.5, 6, 10, '“', 300, { role: 'display', leading: 1 }), rule(10, 70.5, 8, 0.4, 'accent', { follow: 'subtitle' })] });
  if (kind === 'data') return L({ title: z(5, 13, 62, 19), subtitle: z(5, 37, 27, 52), evidence: z(37, 37, 58, 52),
    photo: !structured && photo ? z(37, 30, 58, 60) : undefined, titlePx: 60, bodyPx: 28,
    chrome: [...head, rule(34.5, 37, 0.06, 52, 'ink', { follow: 'subtitle' })] });
  if (kind === 'closing') return photo
    ? L({ photo: z(66, 14, 29, 64), title: z(5, 26, 54, 38), subtitle: z(5, 68, 40, 20), titlePx: 92, bodyPx: 30,
      chrome: [...head, rule(5, 90, 90, 0.1, 'ink')] })
    : L({ title: z(5, 26, 66, 38), subtitle: z(5, 68, 44, 20), titlePx: 100, bodyPx: 30, chrome: [...head, rule(5, 90, 90, 0.1, 'ink')] });
  return photo
    ? L({ photo: z(62, 15, 33, 70), title: z(5, 15, 52, 28), subtitle: z(5, 47, 44, 43), titlePx: 70, bodyPx: 30,
      chrome: [...head, label(62, 87, 33, '{caption}', { size: 22, italic: true })] })
    : L({ title: z(5, 15, 34, 58), subtitle: z(45, 16, 46, 72), titlePx: 78, bodyPx: 31,
      chrome: [...head, rule(42, 16, 0.06, 72, 'ink')] });
}

/* 2 — Executivo ---------------------------------------------------------- */
function executive(kind, { photo, structured, portrait }) {
  const bar = (x, y) => block(x, y, portrait ? 7 : 3.4, portrait ? 0.4 : 0.6, 'accent');
  if (portrait) {
    const foot = [rule(7, 93.5, 86, 0.08, 'rule')];
    if (kind === 'cover') return photo
      ? L({ ground: 'inverse', photo: z(0, 0, 100, 52), title: z(7, 58, 86, 26), subtitle: z(7, 85, 80, 9), titlePx: 84, bodyPx: 30, chrome: [bar(7, 56)] })
      : L({ ground: 'inverse', title: z(7, 30, 86, 36), subtitle: z(7, 70, 80, 16), titlePx: 96, bodyPx: 32, chrome: [bar(7, 27)] });
    if (kind === 'divider' || kind === 'closing') return L({ ground: 'inverse', title: z(7, 34, 86, 32), subtitle: z(7, 70, 80, 18), photo: photo && kind === 'closing' ? z(0, 0, 100, 26) : undefined, titlePx: 80, bodyPx: 30,
      chrome: [bar(7, 31), label(7, 26.5, 60, '{section}', { role: 'numeric', size: 28, color: 'accent' })] });
    if (kind === 'data') return L({ title: z(7, 8, 86, 17), subtitle: z(7, 26, 86, 11), evidence: z(7, 40, 86, 50), photo: !structured && photo ? z(7, 40, 86, 50) : undefined, titlePx: 56, bodyPx: 28, chrome: [bar(7, 6.2), ...foot] });
    if (kind === 'demo' && photo) return L({ photo: z(0, 0, 100, 50), title: z(7, 55, 86, 18), subtitle: z(7, 74, 86, 18), titlePx: 58, bodyPx: 29, chrome: [bar(7, 53), ...foot] });
    return photo
      ? L({ title: z(7, 9, 86, 20), subtitle: z(7, 31, 86, 26), photo: z(7, 60, 86, 30), titlePx: 60, bodyPx: 29, chrome: [bar(7, 7), ...foot] })
      : L({ title: z(7, 11, 86, 26), subtitle: z(7, 41, 86, 48), titlePx: 70, bodyPx: 31, chrome: [bar(7, 8.5), ...foot] });
  }
  const foot = [rule(6, 91.5, 88, 0.1, 'rule')];
  if (kind === 'cover') return photo
    ? L({ photo: z(58, 0, 42, 100), title: z(6, 26, 46, 40), subtitle: z(6, 70, 40, 18), titlePx: 96, bodyPx: 30, chrome: [bar(6, 22.5), ...[rule(6, 91.5, 46, 0.1, 'rule')]] })
    : L({ ground: 'inverse', title: z(6, 28, 70, 38), subtitle: z(6, 70, 52, 18), titlePx: 112, bodyPx: 32, chrome: [bar(6, 24.5)] });
  if (kind === 'divider') return L({ ground: 'inverse', title: z(30, 30, 62, 34), subtitle: z(30, 68, 52, 20), photo: photo ? z(0, 0, 24, 100) : undefined, titlePx: 84, bodyPx: 30,
    chrome: [bar(30, 26.5), label(photo ? 30 : 6, photo ? 18 : 30, 20, '{section}', { role: 'numeric', size: photo ? 30 : 120, color: 'accent', leading: 1 })] });
  if (kind === 'demo') return photo
    ? L({ photo: z(42, 12, 52, 76), title: z(6, 15, 32, 34), subtitle: z(6, 53, 32, 35), titlePx: 60, bodyPx: 28, chrome: [bar(6, 11.5), ...foot] })
    : L({ title: z(6, 15, 70, 30), subtitle: z(6, 50, 54, 38), titlePx: 80, bodyPx: 31, chrome: [bar(6, 11.5), ...foot] });
  if (kind === 'data') return L({ title: z(6, 14, 70, 18), subtitle: z(6, 34, 70, 9), evidence: z(6, 46, 88, 42),
    photo: !structured && photo ? z(6, 46, 88, 42) : undefined, titlePx: 60, bodyPx: 28, chrome: [bar(6, 10.5), ...foot] });
  if (kind === 'closing') return L({ ground: 'inverse', title: z(6, 24, 58, 40), subtitle: z(6, 68, 48, 20), photo: photo ? z(70, 0, 30, 100) : undefined, titlePx: 92, bodyPx: 30, chrome: [bar(6, 20.5)] });
  return photo
    ? L({ photo: z(64, 0, 36, 100), title: z(6, 15, 52, 28), subtitle: z(6, 47, 46, 40), titlePx: 66, bodyPx: 30, chrome: [bar(6, 11.5), rule(6, 91.5, 52, 0.1, 'rule')] })
    : L({ title: z(6, 15, 62, 28), subtitle: z(6, 47, 52, 41), titlePx: 72, bodyPx: 31, chrome: [bar(6, 11.5), ...foot, rule(66, 47, 0.06, 41, 'rule')] });
}

/* 3 — Suíço --------------------------------------------------------------- */
function swiss(kind, { photo, structured, portrait }) {
  const grid = (cols) => ({ t: 'grid', cols, margin: portrait ? 7 : 4, color: 'accent3', opacity: 0.55 });
  if (portrait) {
    if (kind === 'cover') return L({ title: z(7, 52, 86, 30), subtitle: z(51, 84, 42, 11), photo: photo ? z(7, 7, 54, 40) : undefined, titlePx: 120, bodyPx: 28,
      chrome: [grid(6), block(photo ? 65 : 7, 7, photo ? 28 : 40, photo ? 40 : 30, 'accent'), numeral(7, 84, 40, '{index}', 64, { color: 'ink', role: 'display' })] });
    if (kind === 'divider') return L({ ground: 'accent', title: z(7, 52, 86, 28), subtitle: z(7, 82, 70, 12), titlePx: 100, bodyPx: 28,
      chrome: [numeral(5, 2, 90, '{section}', 520, { color: 'inverseInk', role: 'display', leading: 0.82 })] });
    if (kind === 'data') return L({ title: z(7, 7, 86, 16), subtitle: z(7, 24, 56, 12), evidence: z(7, 40, 86, 52), photo: !structured && photo ? z(7, 40, 86, 52) : undefined, titlePx: 64, bodyPx: 27,
      chrome: [grid(6), rule(7, 38, 86, 0.5, 'ink')] });
    if (kind === 'demo' && photo) return L({ photo: z(7, 7, 86, 58), title: z(7, 68, 56, 22), subtitle: z(66, 68, 27, 26), titlePx: 62, bodyPx: 25, chrome: [grid(6), block(7, 66.5, 28, 0.6, 'accent')], stack: 'fixed' });
    if (kind === 'closing') return L({ title: z(7, 40, 86, 30), subtitle: z(51, 74, 42, 18), titlePx: 100, bodyPx: 28, photo: photo ? z(7, 7, 40, 28) : undefined, chrome: [grid(6), block(51, 7, 42, 28, 'accent')] });
    return L({ title: z(7, 8, 86, 24), subtitle: z(37, photo ? 66 : 40, 56, photo ? 28 : 50), photo: photo ? z(7, 36, 56, 26) : undefined, titlePx: 70, bodyPx: 28,
      chrome: [grid(6), numeral(7, photo ? 66 : 40, 26, '{index}', 120, { role: 'display' })] });
  }
  if (kind === 'cover') return L({ title: z(4, 46, 70, 38), subtitle: z(77, 66, 19, 22), photo: photo ? z(60, 9, 36, 34) : undefined, titlePx: 168, bodyPx: 26,
    chrome: [grid(12), block(photo ? 44 : 60, 9, photo ? 14 : 36, photo ? 34 : 34, 'accent'), numeral(4, 9, 20, '{index}', 40, { color: 'ink', role: 'display' })] });
  if (kind === 'divider') return L({ ground: 'accent', title: z(52, 50, 44, 30), subtitle: z(52, 82, 36, 12), photo: photo ? z(52, 9, 22, 34) : undefined, titlePx: 92, bodyPx: 26,
    chrome: [numeral(2, -4, 48, '{section}', 760, { color: 'inverseInk', role: 'display', leading: 0.82 })] });
  if (kind === 'demo') return photo
    ? L({ photo: z(4, 9, 58, 82), title: z(66, 9, 30, 40), subtitle: z(66, 64, 26, 27), titlePx: 70, bodyPx: 26, chrome: [grid(12), block(66, 58, 8, 1, 'accent', { follow: 'subtitle' })] })
    : L({ title: z(4, 9, 66, 54), subtitle: z(74, 66, 22, 25), titlePx: 128, bodyPx: 26, chrome: [grid(12), block(74, 9, 22, 22, 'accent')] });
  if (kind === 'data') return L({ title: z(4, 9, 23, 50), subtitle: z(4, 66, 22, 25), evidence: z(30, 9, 66, 82),
    photo: !structured && photo ? z(30, 9, 66, 82) : undefined, titlePx: 58, bodyPx: 25, stack: 'fixed',
    chrome: [grid(12), rule(27.5, 9, 0.3, 82, 'ink')] });
  if (kind === 'closing') return L({ title: z(4, 36, 62, 36), subtitle: z(70, 60, 26, 22), photo: photo ? z(70, 9, 26, 44) : undefined, titlePx: 120, bodyPx: 26,
    chrome: [grid(12), block(4, 9, 30, 2, 'accent')] });
  return L({ title: z(4, 9, 56, 34), subtitle: z(38, photo ? 52 : 52, photo ? 24 : 40, 38), photo: photo ? z(66, 9, 30, 82) : undefined, titlePx: 84, bodyPx: 27,
    chrome: [grid(12), numeral(4, 52, 24, '{index}', 220, { role: 'display', leading: 0.85 })] });
}

/* 4 — Cinemático ----------------------------------------------------------- */
function cinematic(kind, { photo, structured, portrait }) {
  const scrim = { mode: 'scrim', amount: 62 };
  const tc = (x, y, w, extra = {}) => label(x, y, w, 'CENA {index}', { role: 'label', size: portrait ? 24 : 24, color: 'accent', tracking: 14, ...extra });
  if (portrait) {
    if (kind === 'cover') return photo
      ? L({ photo: z(0, 0, 100, 100), title: z(7, 60, 86, 24), subtitle: z(7, 84, 80, 10), titlePx: 128, bodyPx: 28, scrim, anchors: { title: 'end', subtitle: 'start' } })
      : L({ title: z(7, 40, 86, 26), subtitle: z(7, 68, 80, 14), titlePx: 140, bodyPx: 30, chrome: [tc(7, 34, 60)] });
    if (kind === 'divider') return L({ ground: 'inverse', title: z(10, 40, 80, 20), subtitle: z(15, 61, 70, 12), titlePx: 92, bodyPx: 27, align: 'center', chrome: [tc(10, 35, 80, { align: 'center' })] });
    if (kind === 'data') return L({ title: z(7, 8, 86, 15), subtitle: z(7, 24, 86, 12), evidence: z(7, 39, 86, 52), photo: !structured && photo ? z(0, 39, 100, 52) : undefined, titlePx: 72, bodyPx: 27, chrome: [tc(7, 4.5, 60)] });
    if (photo) return L({ photo: z(0, 0, 100, 100), title: z(7, kind === 'closing' ? 56 : 62, 86, 20), subtitle: z(7, kind === 'closing' ? 77 : 82, 82, 13), titlePx: 92, bodyPx: 27, scrim, anchors: { title: 'end', subtitle: 'start' } });
    return L({ title: z(7, 22, 86, 30), subtitle: z(7, 56, 80, 32), titlePx: 100, bodyPx: 30, chrome: [tc(7, 16, 60)] });
  }
  const bars = [block(0, 0, 100, 9, 'inverse', { z: 'over' }), block(0, 91, 100, 9, 'inverse', { z: 'over' })];
  if (kind === 'cover') return photo
    ? L({ photo: z(0, 0, 100, 100), title: z(6, 46, 60, 30), subtitle: z(6, 77, 44, 11), titlePx: 176, bodyPx: 28, scrim, anchors: { title: 'end', subtitle: 'start' },
      chrome: [...bars, tc(6, 4.2, 30, { z: 'over' })] })
    : L({ title: z(6, 34, 74, 34), subtitle: z(6, 70, 46, 16), titlePx: 176, bodyPx: 30, chrome: [tc(6, 28, 30), rule(6, 91, 88, 0.1, 'rule')] });
  if (kind === 'divider') return L({ ground: 'inverse', title: z(15, 36, 70, 22), subtitle: z(25, 60, 50, 16), titlePx: 104, bodyPx: 28, align: 'center',
    chrome: [tc(15, 30, 70, { align: 'center' })] });
  if (kind === 'data') return L({ title: z(6, 12, 54, 18), subtitle: z(6, 33, 30, 52), evidence: z(40, 33, 54, 54),
    photo: !structured && photo ? z(40, 12, 54, 76) : undefined, titlePx: 84, bodyPx: 27, chrome: [tc(6, 7.5, 30)] });
  if (kind === 'closing') return photo
    ? L({ photo: z(0, 0, 56, 100), title: z(62, 24, 32, 36), subtitle: z(62, 63, 32, 24), titlePx: 92, bodyPx: 28, chrome: [tc(62, 18, 30)] })
    : L({ title: z(15, 30, 70, 30), subtitle: z(25, 63, 50, 18), titlePx: 128, bodyPx: 29, align: 'center', chrome: [tc(15, 24, 70, { align: 'center' })] });
  if (kind === 'demo' && photo) return L({ photo: z(0, 0, 100, 100), title: z(6, 52, 50, 22), subtitle: z(6, 75, 40, 13), titlePx: 104, bodyPx: 27, scrim, anchors: { title: 'end', subtitle: 'start' },
    chrome: [...bars, tc(6, 4.2, 30, { z: 'over' })] });
  return photo
    ? L({ photo: z(40, 0, 60, 100), title: z(6, 18, 30, 36), subtitle: z(6, 58, 30, 30), titlePx: 92, bodyPx: 28, chrome: [tc(6, 12.5, 30)] })
    : L({ title: z(6, 18, 44, 50), subtitle: z(56, 30, 36, 50), titlePx: 120, bodyPx: 30, chrome: [tc(6, 12.5, 30), rule(53, 30, 0.08, 50, 'accent')] });
}

/* 5 — Luxo discreto -------------------------------------------------------- */
function luxury(kind, { photo, structured, portrait }) {
  const mono = (x, y, w, align = 'left') => numeral(x, y, w, '{section}', portrait ? 30 : 30, { role: 'display', italic: true, align, color: 'accent' });
  const hair = (x, y, w) => rule(x, y, w, 0.08, 'accent');
  if (portrait) {
    if (kind === 'cover') return L({ title: z(10, photo ? 66 : 38, 80, 18), subtitle: z(18, photo ? 85 : 62, 64, 10), photo: photo ? z(18, 9, 64, 52) : undefined, titlePx: 92, bodyPx: 26, align: 'center',
      chrome: [hair(44, photo ? 64 : 34, 12)] });
    if (kind === 'divider') return L({ ground: 'inverse', title: z(10, 40, 80, 20), subtitle: z(18, 62, 64, 14), titlePx: 80, bodyPx: 26, align: 'center', chrome: [mono(10, 32, 80, 'center')] });
    if (kind === 'data') return L({ title: z(10, 9, 80, 15), subtitle: z(10, 25, 80, 12), evidence: z(10, 40, 80, 50), photo: !structured && photo ? z(10, 40, 80, 50) : undefined, titlePx: 60, bodyPx: 26, chrome: [hair(10, 7, 10)] });
    if (kind === 'closing') return L({ title: z(10, photo ? 58 : 38, 80, 18), subtitle: z(18, photo ? 78 : 60, 64, 12), photo: photo ? z(30, 12, 40, 40) : undefined, titlePx: 80, bodyPx: 26, align: 'center', chrome: [hair(44, photo ? 56 : 34, 12)] });
    return L({ ground: kind === 'demo' ? 'inverse' : 'bg', title: z(10, photo ? 60 : 16, 80, 18), subtitle: z(10, photo ? 79 : 42, 80, photo ? 15 : 44), photo: photo ? z(10, 8, 80, 48) : undefined, titlePx: 64, bodyPx: 27, chrome: [hair(10, photo ? 58 : 13, 10)] });
  }
  if (kind === 'cover') return photo
    ? L({ photo: z(55, 12, 33, 76), title: z(9, 30, 40, 32), subtitle: z(9, 66, 34, 16), titlePx: 104, bodyPx: 26, chrome: [hair(9, 26, 6), label(9, 88, 30, '{kicker}', { size: 18, tracking: 22, case: 'upper' })] })
    : L({ title: z(15, 32, 70, 26), subtitle: z(28, 62, 44, 14), titlePx: 120, bodyPx: 26, align: 'center', chrome: [hair(47, 27, 6)] });
  if (kind === 'divider') return photo
    ? L({ ground: 'inverse', title: z(38, 40, 54, 20), subtitle: z(42, 62, 46, 14), photo: z(0, 0, 30, 100), titlePx: 88, bodyPx: 26, align: 'center', chrome: [mono(38, 31, 54, 'center')] })
    : L({ ground: 'inverse', title: z(20, 40, 60, 20), subtitle: z(28, 62, 44, 14), titlePx: 88, bodyPx: 26, align: 'center', chrome: [mono(20, 31, 60, 'center')] });
  if (kind === 'demo') return photo
    ? L({ ground: 'inverse', photo: z(9, 12, 42, 76), title: z(58, 24, 33, 30), subtitle: z(58, 58, 30, 26), titlePx: 70, bodyPx: 26, chrome: [hair(58, 20, 6)] })
    : L({ ground: 'inverse', title: z(14, 24, 72, 32), subtitle: z(26, 62, 48, 18), titlePx: 92, bodyPx: 27, align: 'center', titleItalic: true, chrome: [hair(47, 19, 6)] });
  if (kind === 'data') return L({ title: z(9, 13, 52, 18), subtitle: z(9, 34, 26, 48), evidence: z(40, 34, 51, 52),
    photo: !structured && photo ? z(40, 20, 51, 66) : undefined, titlePx: 66, bodyPx: 26, chrome: [hair(9, 10, 6)] });
  if (kind === 'closing') return photo
    ? L({ photo: z(9, 12, 30, 76), title: z(46, 32, 45, 26), subtitle: z(46, 62, 36, 18), titlePx: 92, bodyPx: 26, chrome: [hair(46, 28, 6)] })
    : L({ title: z(15, 34, 70, 24), subtitle: z(28, 62, 44, 16), titlePx: 104, bodyPx: 26, align: 'center', chrome: [hair(47, 29, 6)] });
  return photo
    ? L({ photo: z(55, 12, 36, 76), title: z(9, 20, 38, 30), subtitle: z(9, 55, 34, 32), titlePx: 70, bodyPx: 27, chrome: [hair(9, 16, 6)] })
    : L({ title: z(9, 20, 38, 50), subtitle: z(53, 22, 36, 60), titlePx: 80, bodyPx: 27, chrome: [hair(9, 16, 6), rule(49, 22, 0.06, 60, 'rule')] });
}

/* 6 — Tipográfico expressivo ---------------------------------------------- */
function typographic(kind, { photo, structured, portrait }) {
  const arrow = (x, y, size, color = 'accent') => numeral(x, y, 20, '→', size, { role: 'text', color });
  if (portrait) {
    if (kind === 'cover') return L({ ground: 'inverse', title: z(6, 8, 88, 66), subtitle: z(6, 78, 64, 15), photo: photo ? z(72, 78, 22, 15) : undefined, titlePx: 210, bodyPx: 29, chrome: [rule(6, 76, 88, 0.5, 'accent')] });
    if (kind === 'divider') return L({ ground: 'accent', title: z(6, 30, 88, 44), subtitle: z(6, 78, 70, 14), titlePx: 190, bodyPx: 29, chrome: [numeral(6, 9, 50, '{section}', 150, { color: 'inverseInk', role: 'display' })] });
    if (kind === 'data') return L({ title: z(6, 6, 88, 22), subtitle: z(6, 29, 88, 10), evidence: z(6, 42, 88, 50), photo: !structured && photo ? z(6, 42, 88, 50) : undefined, titlePx: 110, bodyPx: 27, chrome: [rule(6, 40, 88, 0.5, 'ink')] });
    if (kind === 'closing') return L({ ground: 'inverse', title: z(6, 18, 88, 52), subtitle: z(6, 74, 70, 16), titlePx: 190, bodyPx: 29, chrome: [arrow(78, 74, 120)] });
    return L({ title: z(6, 7, 88, 46), subtitle: z(6, photo ? 58 : 60, photo ? 56 : 80, photo ? 34 : 32), photo: photo ? z(66, 58, 28, 34) : undefined, titlePx: 160, bodyPx: 29, chrome: [rule(6, 55.5, 88, 0.5, 'ink')] });
  }
  if (kind === 'cover') return L({ ground: 'inverse', title: z(4, 8, 74, 76), subtitle: z(80, 62, 16, 26), photo: photo ? z(80, 8, 16, 46) : undefined, titlePx: 250, bodyPx: 26,
    chrome: [rule(78.2, 8, 0.25, 80, 'accent')] });
  if (kind === 'divider') return L({ ground: 'accent', title: z(4, 34, 92, 46), subtitle: z(60, 82, 34, 12), titlePx: 220, bodyPx: 27,
    chrome: [numeral(4, 9, 30, '{section}', 150, { color: 'inverseInk', role: 'display' })] });
  if (kind === 'demo') return photo
    ? L({ title: z(4, 9, 58, 76), subtitle: z(66, 60, 30, 28), photo: z(66, 9, 30, 46), titlePx: 170, bodyPx: 27, chrome: [arrow(4, 84, 90)] })
    : L({ ground: 'surface', title: z(4, 9, 92, 62), subtitle: z(50, 74, 44, 18), titlePx: 200, bodyPx: 28, chrome: [arrow(4, 76, 120)] });
  if (kind === 'data') return L({ title: z(4, 8, 54, 30), subtitle: z(62, 12, 34, 24), evidence: z(4, 44, 92, 46),
    photo: !structured && photo ? z(4, 44, 92, 46) : undefined, titlePx: 130, bodyPx: 27, chrome: [rule(4, 41, 92, 0.6, 'ink', { follow: 'subtitle' })] });
  if (kind === 'closing') return L({ ground: 'inverse', title: z(4, 12, 80, 64), subtitle: z(4, 80, 46, 12), titlePx: 220, bodyPx: 28, chrome: [arrow(84, 60, 200)] });
  return photo
    ? L({ title: z(4, 9, 60, 54), subtitle: z(4, 68, 44, 24), photo: z(70, 26, 26, 64), titlePx: 150, bodyPx: 28, chrome: [rule(4, 65.5, 60, 0.5, 'ink', { follow: 'subtitle' })] })
    : L({ title: z(4, 9, 70, 54), subtitle: z(46, 68, 46, 24), titlePx: 170, bodyPx: 28, chrome: [rule(4, 65.5, 92, 0.5, 'ink', { follow: 'subtitle' }), { ...arrow(4, 68, 90), follow: 'subtitle' }] });
}

/* 7 — Cultural e artístico ------------------------------------------------- */
function cultural(kind, { photo, structured, portrait }) {
  const tape = (x, y, w, rot) => block(x, y, w, portrait ? 2.4 : 3.6, 'accent3', { rotate: rot, opacity: 0.88, z: 'over' });
  const circle = (x, y, d, color) => ({ t: 'circle', x, y, d, color });
  const offset = (r, dx, dy, color) => block(r.x + dx, r.y + dy, r.w, r.h, color);
  // Faixa de cor multiplicada na base da foto: o rosto e as mãos, em geral
  // no terço superior/central, ficam limpos.
  const tint = (r, color) => block(r.x, r.y + r.h * 0.74, r.w, r.h * 0.26, color, { z: 'over', blend: 'multiply', opacity: 0.88 });
  if (portrait) {
    if (kind === 'cover') {
      const p = z(16, 8, 70, 50);
      return L({ photo: photo ? p : undefined, title: z(7, 62, 86, 24), subtitle: z(7, 87, 70, 9), titlePx: 104, bodyPx: 28,
        chrome: photo ? [offset(p, -5, 4, 'accent'), tint(p, 'accent2'), tape(60, 6.5, 22, -8), circle(72, 50, 20, 'accent3')] : [circle(50, 6, 50, 'accent2'), block(7, 34, 50, 22, 'accent')] });
    }
    if (kind === 'divider') return L({ ground: 'inverse', title: z(7, 46, 86, 30), subtitle: z(7, 78, 70, 14), titlePx: 110, bodyPx: 28,
      chrome: [circle(48, 6, 46, 'accent2'), numeral(10, 12, 40, '{section}', 160, { color: 'inverseInk', role: 'display' })] });
    if (kind === 'data') return L({ title: z(7, 8, 86, 16), subtitle: z(7, 25, 86, 11), evidence: z(7, 39, 86, 52), photo: !structured && photo ? z(7, 39, 86, 52) : undefined, titlePx: 66, bodyPx: 27, chrome: [circle(80, 3, 14, 'accent2')] });
    if (photo) { const p = z(12, 8, 76, 46); return L({ photo: p, title: z(7, 60, 86, 18), subtitle: z(7, 79, 86, 15), titlePx: 70, bodyPx: 28,
      chrome: [offset(p, 4, 3, kind === 'closing' ? 'accent2' : 'accent'), tape(8, 6, 22, -10)] }); }
    return L({ title: z(7, 10, 86, 34), subtitle: z(7, 50, 70, 40), titlePx: 92, bodyPx: 29, chrome: [circle(72, 62, 30, 'accent3'), block(7, 46, 30, 1.2, 'accent2')] });
  }
  if (kind === 'cover') {
    const p = z(52, 12, 38, 72);
    return photo
      ? L({ photo: p, title: z(5, 18, 44, 52), subtitle: z(5, 74, 36, 16), titlePx: 128, bodyPx: 28,
        chrome: [offset(p, 3.5, 5, 'accent'), tint(p, 'accent2'), tape(70, 8.5, 14, -6), circle(84, 66, 14, 'accent3')] })
      : L({ title: z(5, 18, 60, 52), subtitle: z(5, 74, 40, 16), titlePx: 150, bodyPx: 28, chrome: [circle(66, 14, 34, 'accent2'), block(72, 52, 22, 36, 'accent'), tape(64, 50, 14, 8)] });
  }
  if (kind === 'divider') return L({ ground: 'inverse', title: z(40, 36, 54, 34), subtitle: z(40, 72, 40, 16), photo: photo ? z(6, 14, 28, 72) : undefined, titlePx: 110, bodyPx: 28,
    chrome: photo ? [block(9, 18, 28, 72, 'accent2'), numeral(40, 16, 30, '{section}', 120, { color: 'accent3', role: 'display' })]
      : [circle(4, 16, 32, 'accent2'), numeral(10, 30, 26, '{section}', 160, { color: 'inverseInk', role: 'display' })] });
  if (kind === 'demo') {
    const p = z(6, 12, 48, 76);
    return photo
      ? L({ photo: p, title: z(62, 14, 32, 40), subtitle: z(62, 58, 30, 30), titlePx: 76, bodyPx: 27,
        chrome: [offset(p, 3, 4, 'accent3'), tint(p, 'accent'), tape(40, 9, 14, 7), circle(88, 78, 10, 'accent2')] })
      : L({ title: z(6, 16, 62, 52), subtitle: z(6, 72, 46, 18), titlePx: 120, bodyPx: 28, chrome: [circle(70, 10, 30, 'accent3'), block(76, 50, 18, 36, 'accent2')] });
  }
  if (kind === 'data') return L({ title: z(6, 11, 56, 20), subtitle: z(6, 35, 26, 50), evidence: z(36, 35, 58, 54),
    photo: !structured && photo ? z(36, 20, 58, 66) : undefined, titlePx: 70, bodyPx: 27, chrome: [circle(86, 4, 9, 'accent2'), block(6, 32, 12, 1.4, 'accent')] });
  if (kind === 'closing') return L({ title: z(6, 24, 56, 40), subtitle: z(6, 68, 42, 20), photo: photo ? z(66, 16, 28, 64) : undefined, titlePx: 110, bodyPx: 28,
    chrome: photo ? [block(68.5, 20, 28, 64, 'accent2'), tape(74, 12, 14, -5)] : [circle(64, 12, 36, 'accent'), circle(80, 56, 16, 'accent3')] });
  const p = z(60, 12, 34, 74);
  return photo
    ? L({ photo: p, title: z(6, 14, 48, 32), subtitle: z(6, 52, 44, 36), titlePx: 82, bodyPx: 28,
      chrome: [offset(p, -3, 4, 'accent3'), tape(64, 8, 14, -6)] })
    : L({ title: z(6, 14, 50, 50), subtitle: z(60, 28, 34, 56), titlePx: 96, bodyPx: 28, chrome: [block(56, 24, 0.8, 64, 'accent2'), circle(86, 6, 10, 'accent')] });
}

/* 8 — Técnico -------------------------------------------------------------- */
function technical(kind, { photo, structured, portrait }) {
  const grid = (cols) => ({ t: 'grid', cols, margin: portrait ? 6 : 4, color: 'rule', opacity: 0.55, rows: true });
  const tag = (x, y, w, text) => label(x, y, w, text, { role: 'label', size: portrait ? 23 : 22, color: 'accent', tracking: 6 });
  const crop = (r) => ({ t: 'crop', ...r, color: 'accent' });
  const dot = (x, y) => ({ t: 'circle', x, y, d: portrait ? 1.6 : 0.9, color: 'accent' });
  if (portrait) {
    if (kind === 'cover') return L({ title: z(6, 50, 88, 28), subtitle: z(6, 80, 80, 12), photo: photo ? z(6, 9, 88, 36) : undefined, titlePx: 92, bodyPx: 27,
      chrome: [grid(6), tag(6, 46.5, 60, '§{index} · {kicker?}'), ...(photo ? [crop(z(6, 9, 88, 36))] : []), dot(6, 6)] });
    if (kind === 'data') return L({ title: z(6, 8, 88, 15), subtitle: z(6, 24, 88, 11), evidence: z(6, 39, 88, 53), photo: !structured && photo ? z(6, 39, 88, 53) : undefined, titlePx: 58, bodyPx: 26, chrome: [grid(6), tag(6, 5, 60, 'TAB. {index}')] });
    if (kind === 'divider' || kind === 'closing') return L({ title: z(6, 40, 88, 26), subtitle: z(6, 68, 80, 18), titlePx: 84, bodyPx: 27, chrome: [grid(6), tag(6, 36, 60, kind === 'closing' ? 'FIM · {index}' : '§{section}'), rule(6, 34, 88, 0.08, 'accent')] });
    return L({ title: z(6, 8, 88, 18), subtitle: z(6, photo ? 70 : 30, 88, photo ? 24 : 58), photo: photo ? z(6, 29, 88, 38) : undefined, titlePx: 64, bodyPx: 27,
      chrome: [grid(6), tag(6, 5, 60, photo ? 'FIG. {index}' : '§{index}'), ...(photo ? [crop(z(6, 29, 88, 38))] : [])] });
  }
  if (kind === 'cover') return photo
    ? L({ photo: z(54, 12, 42, 76), title: z(4, 34, 46, 34), subtitle: z(4, 70, 40, 16), titlePx: 100, bodyPx: 27,
      chrome: [grid(12), crop(z(54, 12, 42, 76)), tag(4, 28, 40, '§{index} · {kicker?}'), tag(54, 90, 30, 'FIG. 0{index}'), dot(4, 8.5)] })
    : L({ title: z(4, 34, 70, 34), subtitle: z(4, 70, 46, 16), titlePx: 120, bodyPx: 27, chrome: [grid(12), tag(4, 28, 40, '§{index} · {kicker?}'), dot(4, 8.5)] });
  if (kind === 'divider') return L({ title: z(29, 38, 62, 26), subtitle: z(29, 66, 46, 18), photo: photo ? z(4, 12, 21, 76) : undefined, titlePx: 92, bodyPx: 27,
    chrome: [grid(12), numeral(photo ? 29 : 4, photo ? 18 : 38, 24, '§{section}', photo ? 60 : 150, { role: 'numeric', color: 'accent' }), rule(29, 36, 62, 0.1, 'accent')] });
  if (kind === 'demo') return photo
    ? L({ photo: z(4, 12, 58, 76), title: z(67, 15, 29, 34), subtitle: z(67, 52, 29, 36), titlePx: 60, bodyPx: 26,
      chrome: [grid(12), crop(z(4, 12, 58, 76)), tag(4, 90, 40, 'FIG. {index}'), tag(67, 11, 29, 'NOTA'), { t: 'dim', x: 4, y: 8, w: 58, color: 'muted' }] })
    : L({ title: z(4, 15, 62, 30), subtitle: z(4, 50, 52, 38), titlePx: 80, bodyPx: 28, chrome: [grid(12), tag(4, 11, 40, '§{index}'), rule(4, 47, 62, 0.1, 'accent', { follow: 'subtitle' })] });
  if (kind === 'data') return L({ title: z(4, 12, 56, 18), subtitle: z(4, 33, 24, 54), evidence: z(32, 33, 64, 55),
    photo: !structured && photo ? z(32, 33, 64, 55) : undefined, titlePx: 62, bodyPx: 25, chrome: [grid(12), tag(4, 8, 40, 'TAB. {index}')] });
  if (kind === 'closing') return L({ title: z(4, 30, 62, 30), subtitle: z(4, 64, 46, 20), photo: photo ? z(70, 12, 26, 76) : undefined, titlePx: 92, bodyPx: 27,
    chrome: [grid(12), tag(4, 25, 40, 'FIM · {index}'), dot(4, 8.5)] });
  return photo
    ? L({ photo: z(58, 12, 38, 76), title: z(4, 15, 48, 28), subtitle: z(4, 48, 46, 40), titlePx: 70, bodyPx: 27, chrome: [grid(12), crop(z(58, 12, 38, 76)), tag(4, 11, 40, '§{index}'), tag(58, 90, 30, 'FIG. {index}')] })
    : L({ title: z(4, 15, 62, 28), subtitle: z(4, 48, 56, 40), titlePx: 76, bodyPx: 28, chrome: [grid(12), tag(4, 11, 40, '§{index}')] });
}

/* 9 — Fotográfico e humano ------------------------------------------------- */
function photoFamily(kind, { photo, structured, portrait }) {
  const cap = (x, y, w) => label(x, y, w, '{caption}', { size: portrait ? 24 : 22 });
  const scrim = { mode: 'scrim', amount: 58 };
  if (portrait) {
    if (kind === 'cover') return photo
      ? L({ photo: z(0, 0, 100, 100), title: z(7, 64, 86, 22), subtitle: z(7, 86, 80, 9), titlePx: 112, bodyPx: 28, scrim, anchors: { title: 'end', subtitle: 'start' }, inkOnPhoto: true })
      : L({ title: z(7, 30, 86, 36), subtitle: z(7, 70, 74, 18), titlePx: 120, bodyPx: 30 });
    if (kind === 'divider') return L({ ground: 'inverse', title: z(10, 40, 80, 22), subtitle: z(16, 64, 68, 14), titlePx: 92, bodyPx: 28, align: 'center', titleItalic: true });
    if (kind === 'data') return L({ title: z(7, 8, 86, 15), subtitle: z(7, 24, 86, 12), evidence: z(7, 39, 86, 52), photo: !structured && photo ? z(7, 39, 86, 52) : undefined, titlePx: 62, bodyPx: 27 });
    if (photo) return L({ photo: z(5, 4, 90, 58), title: z(7, 66, 86, 16), subtitle: z(7, 82, 86, 13), titlePx: 66, bodyPx: 28, chrome: [cap(5, 62.6, 90)] });
    return L({ title: z(7, 12, 86, 32), subtitle: z(7, 50, 80, 40), titlePx: 92, bodyPx: 30 });
  }
  if (kind === 'cover') return photo
    ? L({ photo: z(0, 0, 100, 100), title: z(5, 52, 56, 30), subtitle: z(5, 82, 44, 11), titlePx: 140, bodyPx: 28, scrim, anchors: { title: 'end', subtitle: 'start' }, inkOnPhoto: true })
    : L({ title: z(10, 26, 80, 36), subtitle: z(30, 66, 40, 16), titlePx: 150, bodyPx: 30, align: 'center' });
  if (kind === 'divider') return photo
    ? L({ ground: 'inverse', title: z(38, 38, 56, 22), subtitle: z(44, 62, 44, 16), photo: z(0, 0, 32, 100), titlePx: 104, bodyPx: 28, align: 'center', titleItalic: true })
    : L({ ground: 'inverse', title: z(18, 38, 64, 22), subtitle: z(28, 62, 44, 16), titlePx: 104, bodyPx: 28, align: 'center', titleItalic: true });
  if (kind === 'demo') return photo
    ? L({ photo: z(3, 5, 62, 84), title: z(69, 18, 27, 36), subtitle: z(69, 58, 27, 30), titlePx: 70, bodyPx: 27, chrome: [cap(3, 91, 62)] })
    : L({ title: z(12, 22, 76, 40), subtitle: z(30, 66, 40, 20), titlePx: 110, bodyPx: 29, align: 'center', titleItalic: true });
  if (kind === 'data') return L({ title: z(5, 12, 60, 18), subtitle: z(5, 34, 28, 52), evidence: z(38, 34, 57, 54),
    photo: !structured && photo ? z(38, 10, 57, 80) : undefined, titlePx: 70, bodyPx: 27 });
  if (kind === 'closing') return photo
    ? L({ photo: z(50, 0, 50, 100), title: z(5, 30, 40, 34), subtitle: z(5, 67, 38, 20), titlePx: 100, bodyPx: 28 })
    : L({ title: z(12, 30, 76, 32), subtitle: z(28, 66, 44, 18), titlePx: 120, bodyPx: 29, align: 'center' });
  return photo
    ? L({ photo: z(42, 5, 55, 84), title: z(5, 18, 32, 34), subtitle: z(5, 56, 32, 32), titlePx: 76, bodyPx: 28, chrome: [cap(42, 91, 55)] })
    : L({ title: z(8, 18, 40, 52), subtitle: z(54, 26, 36, 52), titlePx: 92, bodyPx: 29 });
}

/* 10 — Modular ------------------------------------------------------------- */
function modular(kind, { photo, structured, portrait }) {
  const card = (r, color = 'surface') => block(r.x, r.y, r.w, r.h, color, { radius: portrait ? 28 : 28 });
  const pill = (x, y, text) => ({ t: 'pill', x, y, text, color: 'accent', ink: 'inverseInk', size: portrait ? 24 : 23 });
  const pad = (r, p = 2.4) => z(r.x + p, r.y + p * 1.6, r.w - p * 2, r.h - p * 3.2);
  if (portrait) {
    if (kind === 'cover') { const c = z(5, 46, 90, 48); return L({ title: pad(z(5, 46, 90, 30), 4), subtitle: pad(z(5, 76, 90, 18), 4), photo: photo ? z(5, 5, 90, 39) : undefined, titlePx: 92, bodyPx: 28, chrome: [card(c), pill(9, 50, '{kicker}')] }); }
    if (kind === 'divider') return L({ ground: 'inverse', title: z(8, 40, 84, 24), subtitle: z(8, 66, 80, 16), titlePx: 92, bodyPx: 28, chrome: [card(z(8, 26, 20, 10), 'accent3'), numeral(8, 27.6, 20, '{section}', 64, { color: 'accent', align: 'center' })] });
    if (kind === 'data') return L({ title: z(6, 7, 88, 15), subtitle: z(6, 23, 88, 11), evidence: z(6, 38, 88, 56), photo: !structured && photo ? z(6, 38, 88, 56) : undefined, titlePx: 60, bodyPx: 27 });
    if (photo) {
      const c = z(5, 66, 90, 29);
      return L({ title: z(5, 7, 90, 20), photo: z(5, 29, 90, 35), subtitle: pad(c, 4), titlePx: 64, bodyPx: 28, stack: 'fixed', chrome: [card(c), pill(5, 3.4, '{index}')] });
    }
    const c = z(5, 34, 90, 36);
    return L({ title: z(5, 8, 90, 23), subtitle: pad(c, 4), titlePx: 70, bodyPx: 29, stack: 'fixed',
      chrome: [card(c), card(z(5, 73, 42, 22), 'accent3'), numeral(5, 77.5, 42, '{index}', 150, { align: 'center', color: 'accent', role: 'display' }), card(z(51, 73, 44, 22), 'accent')] });
  }
  if (kind === 'cover') {
    const c = z(4, 8, 52, 84);
    return L({ title: pad(z(4, 18, 52, 48), 3), subtitle: pad(z(4, 66, 52, 26), 3), photo: photo ? z(58, 8, 38, 84) : undefined, titlePx: 100, bodyPx: 28,
      chrome: [card(c), pill(7, 14, '{kicker}'), ...(photo ? [] : [card(z(58, 8, 38, 40), 'accent'), card(z(58, 50, 38, 42), 'accent3')])] });
  }
  if (kind === 'divider') return L({ ground: 'inverse', title: z(30, 34, 62, 30), subtitle: z(30, 66, 50, 18), photo: photo ? z(4, 10, 22, 80) : undefined, titlePx: 96, bodyPx: 28,
    chrome: [card(z(photo ? 30 : 8, photo ? 18 : 34, photo ? 10 : 18, photo ? 12 : 30), 'accent3'), numeral(photo ? 30 : 8, photo ? 19.5 : 40, photo ? 10 : 18, '{section}', photo ? 54 : 120, { color: 'accent', align: 'center' })] });
  if (kind === 'demo') {
    const c = z(54, 10, 42, 80);
    return photo
      ? L({ photo: z(4, 10, 48, 80), title: pad(z(54, 10, 42, 40), 3), subtitle: pad(z(54, 50, 42, 40), 3), titlePx: 62, bodyPx: 27, chrome: [card(c)] })
      : L({ title: z(4, 12, 46, 40), subtitle: pad(c, 3), titlePx: 76, bodyPx: 28, chrome: [card(c), pill(4, 8, '{index}')] });
  }
  if (kind === 'data') return L({ title: z(4, 10, 62, 18), subtitle: z(70, 12, 26, 18), evidence: z(4, 36, 92, 56),
    photo: !structured && photo ? z(4, 36, 92, 56) : undefined, titlePx: 62, bodyPx: 25, chrome: [pill(4, 6.5, '{index}')] });
  if (kind === 'closing') {
    const c = z(4, 10, photo ? 52 : 92, 80);
    return L({ title: pad(z(4, 18, photo ? 52 : 70, 40), 3), subtitle: pad(z(4, 58, photo ? 52 : 60, 30), 3), photo: photo ? z(58, 10, 38, 80) : undefined, titlePx: 92, bodyPx: 28, chrome: [card(c), pill(7, 14, '{kicker}')] });
  }
  if (photo) {
    const c = z(4, 40, 50, 52);
    return L({ title: z(4, 12, 50, 24), subtitle: pad(c, 3), photo: z(56, 10, 40, 82), titlePx: 66, bodyPx: 28, stack: 'fixed', chrome: [card(c), pill(4, 6.5, '{index}')] });
  }
  const c = z(4, 40, 60, 52);
  return L({ title: z(4, 12, 70, 24), subtitle: pad(c, 3), titlePx: 70, bodyPx: 29, stack: 'fixed',
    chrome: [card(c), card(z(66, 40, 30, 52), 'accent3', { follow: 'subtitle' }), numeral(66, 47, 30, '{index}', 200, { align: 'center', color: 'accent', role: 'display', follow: 'subtitle' })] });
}

const LAYOUT_FUNCTIONS = {
  editorial, executive, swiss, cinematic, luxury,
  typographic, cultural, technical, photo: photoFamily, modular,
};

/* ------------------------------------------------------------------------ */
/* API pública                                                              */
/* ------------------------------------------------------------------------ */

/** Mapeia ids de preset/padrão (inclusive legados) para a família. */
export function familyFromPresetId(id = '') {
  const value = String(id);
  for (const [pattern, family] of [
    [/photo.essay/, 'photo'], [/editorial.magazine/, 'editorial'],
    [/typographic.bold/, 'typographic'], [/cinematic/, 'cinematic'],
    // O slot `data-first` passa a abrigar a família cultural. Projetos salvos
    // continuam abrindo com o mesmo id; a evidência ganhou tratamento próprio
    // em todas as famílias, então dados não dependem mais de uma família só.
    [/data.first|cultural/, 'cultural'], [/swiss.grid/, 'swiss'],
    [/modular.cards/, 'modular'], [/technical.blueprint/, 'technical'],
    [/premium.dark|luxury/, 'luxury'],
  ]) if (pattern.test(value)) return family;
  return 'executive';
}

/** Normaliza nomes antigos usados em slides salvos ('premium', 'data'). */
export function normalizeFamilyKey(key) {
  if (key === 'premium') return 'luxury';
  if (key === 'data') return 'cultural';
  return FAMILY_KEYS.includes(key) ? key : 'executive';
}

export function familySpec(key) {
  return PRESENTATION_FAMILIES[normalizeFamilyKey(key)];
}

/** Fonte CSS para um papel tipográfico ('display' | 'text' | 'numeric' | 'label'). */
export function familyFont(key, role = 'text') {
  const fonts = familySpec(key).fonts;
  const resolved = typeof fonts[role] === 'string' ? fonts[fonts[role]] : fonts[role];
  return resolved || fonts.text;
}

/** Cores de tinta para o fundo da página. */
/**
 * Reteste 22/11 (WebExpresso, marca própria): barra do título, números dos
 * passos e o fundo invertido do fecho saíam na cor da família (azul,
 * azul-marinho). Marca com destaque próprio sobrepõe o destaque e o fundo
 * invertido (o tom mais escuro da marca).
 */
const isHexColor = value => /^#[0-9a-f]{6}$/i.test(String(value || '').trim());
export function brandPaletteOverrides(key, brand = {}) {
  const p = familySpec(key).palette;
  const accent = isHexColor(brand?.accent) ? brand.accent.trim() : '';
  if (!accent || accent.toLowerCase() === String(p.accent || '').toLowerCase()) return {};
  const darkest = [brand.bg, brand.titleColor].filter(isHexColor)
    .sort((a, b) => wcagContrast(b, '#FFFFFF') - wcagContrast(a, '#FFFFFF'))[0];
  return darkest ? { accent, inverse: darkest.trim() } : { accent };
}

/**
 * Paleta que o renderer usa para o slide. Página do modo livre grava a paleta
 * do deck (`presentationPaletteOverrides`); as demais seguem o destaque da marca.
 */
export function slidePaletteOverrides(slide, key, brand = {}) {
  const own = slide?.presentationPaletteOverrides;
  if (own && typeof own === 'object' && !Array.isArray(own)) return own;
  return brandPaletteOverrides(key, brand);
}

export function groundInks(key, ground = 'bg', overrides = {}) {
  const p = { ...familySpec(key).palette, ...(overrides || {}) };
  const raw = ground === 'inverse' ? { bg: p.inverse, ink: p.inverseInk, muted: p.inverseMuted }
    : ground === 'accent' ? { bg: p.accent, ink: p.inverseInk || '#FFFFFF', muted: p.inverseMuted || p.inverseInk }
      : ground === 'surface' ? { bg: p.surface, ink: p.ink, muted: p.muted }
        : { bg: p.bg, ink: p.ink, muted: p.muted };
  // Texto da página precisa ler no fundo da página (>= 4,5). Paletas de acento
  // (vermelho suíço, laranja tipográfico, dourado do cinema) não garantiam
  // isso para a tinta nem para o apoio (MF-08). Cai para a tinta da família
  // que lê melhor e, se nenhuma ler, para preto ou branco.
  const ink = readableOn(raw.bg, [raw.ink, p.ink, p.inverseInk]);
  const muted = readableOn(raw.bg, [raw.muted, ink]);
  return { bg: raw.bg, ink, muted };
}

function readableOn(bg, candidates) {
  for (const color of candidates) if (color && bg && wcagContrast(color, bg) >= 4.5) return color;
  if (!bg) return candidates[0];
  return wcagContrast('#000000', bg) >= wcagContrast('#FFFFFF', bg) ? '#000000' : '#FFFFFF';
}

/**
 * Layout completo de uma página.
 * @param {string} key família
 * @param {string} kind cover|divider|content|demo|data|closing
 * @param {{format?: '16:9'|'4:5'|'1:1'|'9:16', photo?: boolean, structured?: boolean}} options
 */
export function familyLayout(key, kind, { format = '16:9', photo = false, structured = false, title = '', reading = 0 } = {}) {
  const family = normalizeFamilyKey(key);
  const safeKind = PAGE_KINDS.includes(kind) ? kind : 'content';
  const portrait = format !== '16:9';
  // Evidência estruturada é um quadro editável, não fotografia.
  const usePhoto = !!photo && !(structured && safeKind === 'data');
  let raw = LAYOUT_FUNCTIONS[family](safeKind, { photo: usePhoto, structured, portrait });
  // O quadrado tem menos altura útil que o feed: mantém a composição da
  // família com hierarquia própria, sem comprimir o slide 16:9 como bitmap.
  if (format === '1:1') raw = { ...raw, titlePx: Math.max(56, raw.titlePx * .82), bodyPx: Math.max(25, raw.bodyPx * .9),
    // Círculos medem pela largura: no quadrado (altura 1080 em vez de 1350)
    // desceriam sobre o título; o diâmetro acompanha a altura útil.
    chrome: (raw.chrome || []).map(c => c.size ? { ...c, size: c.size * .82 }
      : c.t === 'circle' ? { ...c, d: Math.round(c.d * .8 * 100) / 100 } : c) };
  const ground = raw.ground || 'bg';
  const result = {
    family, kind: safeKind, format, ground,
    ...raw,
    // Página de evidência sem quadro: a foto ocupa a área da evidência, nunca
    // a área de título ou de leitura.
    photo: raw.photo && usePhoto ? (safeKind === 'data' && raw.evidence ? { ...raw.evidence } : raw.photo) : null,
    evidence: safeKind === 'data' && structured ? raw.evidence || null : null,
    inks: groundInks(family, raw.inkOnPhoto ? 'inverse' : ground),
  };
  // Página de evidência sem quadro nem foto: a leitura desce até o fim da
  // área de evidência, com largura de coluna confortável (no máximo 62%),
  // em vez de deixar um vazio acidental.
  if (safeKind === 'data' && !structured && !result.photo && raw.evidence) {
    const s = raw.subtitle, e = raw.evidence;
    const sideBySide = e.x >= s.x + s.w;
    result.subtitle = sideBySide
      ? { x: s.x, y: s.y, w: Math.min(portrait ? 86 : 62, e.x + e.w - s.x), h: Math.max(s.h, e.y + e.h - s.y) }
      : s.x > e.x + 10
        // Apoio à direita do título: ocupa a área de evidência, abaixo.
        ? { x: e.x, y: e.y, w: Math.min(portrait ? 86 : 62, e.w), h: e.h }
        : { x: s.x, y: s.y, w: Math.min(portrait ? 86 : 62, Math.max(s.w, e.w)), h: e.y + e.h - s.y };
  }
  // Argumento longo (ex.: revisão editorial que completa o raciocínio) numa
  // coluna estreita ao lado da foto: a página é recomposta com leitura larga
  // e foto estreita, em vez de esmagar o texto ou cortá-lo.
  if (reading > 300 && !structured && (result.subtitle.w < (portrait ? 80 : 50)
    || result.subtitle.w * result.subtitle.h < (portrait ? 2000 : 2500) || result.bodyPx < 30)) {
    return socialSafeArea(keepRulesOffText(longReadingLayout(result, portrait)));
  }
  return socialSafeArea(keepRulesOffText(tightenStack(result, title)));
}

/**
 * Fios são separadores: nunca atravessam texto. Quando a pilha título → apoio
 * sobe (tightenStack) ou a leitura ocupa a área de uma evidência ausente, um
 * fio fixo pode ficar dentro da zona de texto. O horizontal passa para o vão
 * logo acima do apoio (ou do quadro); o vertical termina antes do texto. Se não houver vão,
 * o fio sai — nunca o texto.
 */
function keepRulesOffText(layout) {
  const texts = [layout.title, layout.subtitle, layout.evidence].filter(Boolean);
  if (!texts.length || !layout.chrome?.length) return layout;
  const gap = layout.format === '16:9' ? 4.2 : 2.6;
  const xIn = (c, r) => Math.min(c.x + c.w, r.x + r.w) - Math.max(c.x, r.x) > 0.3;
  const yIn = (c, r) => Math.min(c.y + c.h, r.y + r.h) - Math.max(c.y, r.y) > 0.05;
  // Tolerância de 1%: a borda da zona é respiro/padding, não tinta.
  const deep = (c, r) => c.y + c.h > r.y + 1 && c.y < r.y + r.h - 1;
  let changed = false;
  const chrome = layout.chrome.flatMap((c) => {
    if (c.t !== 'rule' || c.w == null || c.h == null) return [c];
    const hits = texts.filter((r) => xIn(c, r) && yIn(c, r) && deep(c, r));
    if (!hits.length) return [c];
    changed = true;
    const horizontal = c.w >= c.h;
    if (horizontal) {
      if (hits.includes(layout.title) || hits.length > 1) return [];
      const s = hits[0];
      const y = s.y - gap / 2 - c.h / 2;
      const blocked = texts.some((r) => r !== s && xIn(c, r) && y < r.y + r.h && y + c.h > r.y);
      return blocked || y < 0 ? [] : [{ ...c, y: Math.round(y * 100) / 100 }];
    }
    const end = Math.min(...hits.map((r) => r.y)) - gap / 2;
    return end - c.y >= 8 ? [{ ...c, h: Math.round((end - c.y) * 100) / 100 }] : [];
  });
  return changed ? { ...layout, chrome } : layout;
}

/** Stories: texto e quadros entre 14% e 82%; fotos de sangria ficam inteiras. */
function socialSafeArea(layout) {
  if (layout.format !== '9:16') return layout;
  const y = value => 14 + value * .68;
  const zone = r => r ? { ...r, y: y(r.y), h: r.h * .68 } : r;
  const bleed = layout.photo?.x === 0 && layout.photo?.y === 0 && layout.photo?.w === 100 && layout.photo?.h === 100;
  const topBleed = layout.photo?.x === 0 && layout.photo?.y === 0 && layout.photo?.w === 100;
  return { ...layout, title: zone(layout.title), subtitle: zone(layout.subtitle), evidence: zone(layout.evidence),
    photo: bleed ? layout.photo : topBleed ? { ...layout.photo, y: 0, h: y(layout.photo.h) } : zone(layout.photo),
    chrome: (layout.chrome || []).map(c => c.y == null ? c : { ...c, y: y(c.y), ...(c.h == null ? {} : { h: c.h * .68 }) }) };
}

/** Estimativa de linhas por quebra gulosa de palavras (respeita \n). */
export function estimateTitleLines(text, widthPx, sizePx, widthFactor = 0.55, upper = false) {
  const capacity = Math.max(1, widthPx / (sizePx * widthFactor * (upper ? 1.08 : 1)));
  return String(text || '').split('\n').reduce((total, paragraph) => {
    let lines = 1; let used = 0;
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const n = [...word].length;
      if (used && used + 1 + n > capacity) { lines += 1; used = n; } else used += (used ? 1 : 0) + n;
    }
    return total + lines;
  }, 0);
}

const overlapX = (a, b) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);

/**
 * Aperta a pilha título → apoio quando o título real ocupa menos linhas que a
 * zona prevê: o apoio sobe para perto do título e ganha a altura liberada.
 * Evita o vazio acidental entre os dois sem reduzir o título.
 */
function tightenStack(result, title) {
  if (!title || result.stack === 'fixed' || PRESENTATION_FAMILIES[result.family].type.stack === 'fixed' || result.anchors?.title !== 'start') return result;
  // Capa e abertura trabalham com polaridade intencional; só apertam quando
  // a família pede (stack: 'tight').
  if ((result.kind === 'cover' || result.kind === 'divider') && result.stack !== 'tight' && !PRESENTATION_FAMILIES[result.family].type.tightCovers) return result;
  const t = result.title;
  if (!t) return result;
  const isBelow = (r) => r && r.y >= t.y + t.h - 0.5 && overlapX(t, r) > Math.min(t.w, r.w) * 0.4;
  const stacked = ['subtitle', 'evidence', 'photo'].map((k) => result[k]).filter(isBelow);
  // (as coordenadas de `top` também valem para elementos ao lado do título)
  if (!stacked.length) return result;
  const ref = FORMAT_SPECS[result.format];
  const spec = PRESENTATION_FAMILIES[result.family];
  const d = spec.fonts.display;
  const lines = estimateTitleLines(title, (t.w / 100) * ref.w - 24, result.titlePx, d.widthFactor || 0.55, d.case === 'upper');
  // O renderer reserva tinta acima/abaixo da linha e padding da zona. A
  // estimativa precisa incluir os dois; caso contrário aperta demais títulos
  // curtos e o autofit chega ao piso por alguns pixels de descendente.
  const breathing = Math.max(20, result.titlePx * .44 + ref.h * .012);
  const usableHeight = ref.h * (result.format === '9:16' ? .68 : 1);
  const needed = ((lines * result.titlePx * spec.type.titleLeading + breathing) / usableHeight) * 100;
  if (needed >= t.h - 1) return result;
  const gap = result.format === '16:9' ? 4.2 : 2.6;
  const top = Math.min(...stacked.map((r) => r.y));
  const movers = stacked.filter((r) => Math.abs(r.y - top) < 0.6);
  // Barreira: nada sobe por cima de outro elemento que está ao lado do título.
  const others = ['subtitle', 'evidence', 'photo'].map((k) => result[k]).filter((r) => r && !movers.includes(r));
  const barrier = Math.max(0, ...others.filter((o) => movers.some((m) => overlapX(o, m) > 0) && o.y < top).map((o) => o.y + o.h + gap));
  const delta = Math.max(0, top - Math.max(t.y + needed + gap, barrier));
  if (delta < 1) return result;
  // Só a primeira linha da pilha sobe e cresce (mantém a base); o que vem
  // abaixo dela não se move — evita invadir a foto ou o quadro seguinte.
  // Elementos lado a lado na mesma altura (apoio + evidência) sobem juntos.
  const shift = (r) => (r && Math.abs(r.y - top) < 0.6 && r.y >= t.y + t.h - 0.5 ? { ...r, y: r.y - delta, h: r.h + delta } : r);
  return {
    ...result,
    title: { ...t, h: Math.round((needed + 0.5) * 100) / 100 },
    subtitle: shift(result.subtitle),
    evidence: shift(result.evidence),
    photo: shift(result.photo),
    chrome: (result.chrome || []).map((c) => (c.follow === 'subtitle' && result.subtitle && Math.abs(result.subtitle.y - top) < 0.6 ? { ...c, y: c.y - delta } : c)),
    tightened: delta,
  };
}

function longReadingLayout(result, portrait) {
  const m = Math.max(4, Math.min(result.title.x, 8));
  const photoLeft = result.photo && result.photo.x + result.photo.w / 2 < 50;
  const reading = { ...result, longReading: true, scrim: null, inkOnPhoto: false,
    inks: groundInks(result.family, result.ground), bodyPx: Math.max(30, result.bodyPx) };
  const keep = (result.chrome || []).filter((c) => c.t === 'grid' || (c.t === 'rule' && c.y < 12) || (c.t === 'text' && c.y < 9));
  if (!result.photo) return { ...reading, chrome: keep,
    title: { x: m, y: portrait ? 8 : 13, w: 100 - m * 2, h: portrait ? 20 : 23 },
    subtitle: { x: m, y: portrait ? 34 : 42, w: portrait ? 100 - m * 2 : 72, h: portrait ? 58 : 49 } };
  if (portrait) {
    return { ...reading, chrome: keep,
      title: { x: m, y: 8, w: 100 - m * 2, h: 16 }, photo: { x: m, y: 26, w: 100 - m * 2, h: 20 },
      subtitle: { x: m, y: 49, w: 100 - m * 2, h: 45 } };
  }
  return { ...reading, chrome: keep,
    title: { x: m, y: 13, w: 100 - m * 2, h: 23 },
    subtitle: { x: photoLeft ? 39 : m, y: 42, w: 55, h: 49 },
    photo: { x: photoLeft ? m : 100 - m - 26, y: 40, w: 26, h: 50 } };
}

/**
 * Direção fotográfica da família: português para o modelo de texto, inglês
 * para o gerador de imagem. Aceita a chave da família, um nome antigo
 * ('premium', 'data') ou o id do preset/padrão, como o prompt de texto.
 */
export function presentationPhotoDirection(familyKey, lang = 'pt') {
  if (!familyKey) return '';
  const key = FAMILY_KEYS.includes(familyKey) || ['premium', 'data'].includes(familyKey)
    ? normalizeFamilyKey(familyKey) : familyFromPresetId(familyKey);
  const photo = PRESENTATION_FAMILIES[key].photo;
  return (lang === 'en' ? photo.directionEn : photo.direction) || '';
}

/** Filtro CSS padrão da família; ajustes manuais da foto têm prioridade. */
export function familyPhotoFilter(key) {
  return familySpec(key).photo.filter || '';
}

/**
 * Descrição das colunas de evidência (spec 1.1, entrega 4). A QA mediu no
 * Cinemático, a 1920 px, a linha de descrição das métricas com ~21 px e
 * contraste ~4,0 para 1: o menor texto do deck e o único abaixo de 4,5.
 *
 * Piso de tamanho: 25 px, o menor corpo de leitura que alguma família já usa
 * no 16:9 (apoio do Suíço na página de dados). Nenhuma família passa a ter
 * texto corrido menor que o que a biblioteca já desenha.
 */
export const EVIDENCE_DETAIL_MIN_PX = 25;
export const EVIDENCE_DETAIL_MIN_CONTRAST = 4.5;

const hexRgb = (value) => {
  const m = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(String(value || '').trim());
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1];
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
};

/**
 * Tinta da descrição: a da coluna, atenuada pela opacidade da família só até
 * onde ainda lê (>= 4,5 sobre a superfície). Devolve cor sólida, sem
 * opacidade, para a prévia e o arquivo medirem a mesma coisa. Cor fora de hex
 * (gradiente, rgba) não é medida: fica a atenuação de antes.
 */
export function evidenceDetailInk(ink, surface, opacity = 1) {
  const fg = hexRgb(ink);
  const bg = hexRgb(surface);
  if (!fg || !bg) return { color: ink, opacity };
  const mix = (t) => '#' + fg.map((c, i) => Math.round(c * t + bg[i] * (1 - t)).toString(16).padStart(2, '0')).join('');
  for (let t = Math.min(1, Math.max(0, Number(opacity) || 0)); t < 1; t = Math.round((t + 0.01) * 100) / 100) {
    if (wcagContrast(mix(t), surface) >= EVIDENCE_DETAIL_MIN_CONTRAST) return { color: mix(t), opacity: 1 };
  }
  if (wcagContrast(mix(1), surface) >= EVIDENCE_DETAIL_MIN_CONTRAST) return { color: mix(1), opacity: 1 };
  return { color: readableOn(surface, [ink]), opacity: 1 };
}

/** Tratamento de evidência (tabela, métricas e etapas) por família. */
export function familyEvidenceStyle(key, overrides = null) {
  const family = normalizeFamilyKey(key);
  // Paleta do deck no modo livre: tinta, apoio, fio e superfície também mudam.
  // O destaque continua no caminho de sempre (evidenceStyleForBrand).
  const own = overrides && typeof overrides === 'object' && overrides.ink && overrides.surface
    ? { ink: overrides.ink, muted: overrides.muted, rule: overrides.rule, surface: overrides.surface }
    : {};
  const p = { ...familySpec(family).palette, ...Object.fromEntries(Object.entries(own).filter(([, v]) => v)) };
  const base = {
    headerRule: 2, headerColor: p.ink, ruleColor: p.rule, zebra: 'rgba(127,127,127,0.06)',
    panel: false, panelColor: p.surface, radius: 0, metricRule: 2, metricRuleColor: p.accent,
    numberRole: 'numeric', headerCase: 'normal', headerTracking: 0, headerRole: 'text', stepMarker: 'number',
    accent: p.accent, ink: p.ink, muted: p.muted,
    // Descrição sob o rótulo da métrica e explicação da etapa: atenuadas para
    // hierarquia, nunca abaixo do piso de tamanho nem de 4,5 para 1.
    detailPx: EVIDENCE_DETAIL_MIN_PX, detailOpacity: 0.75, stepBodyOpacity: 0.82,
  };
  return {
    editorial: { ...base, zebra: 'transparent', headerRule: 1, metricRuleColor: p.ink, stepMarker: 'roman' },
    executive: { ...base, metricRule: 4, zebra: 'rgba(16,20,24,0.035)' },
    swiss: { ...base, headerRule: 6, metricRule: 10, zebra: 'transparent', metricRuleColor: p.ink },
    cinematic: { ...base, zebra: 'rgba(255,255,255,0.04)', ruleColor: '#3A3A3E', headerRole: 'display', headerCase: 'upper', headerTracking: 0.08 },
    luxury: { ...base, headerRule: 1, metricRule: 1, zebra: 'transparent', ruleColor: p.rule, stepMarker: 'roman' },
    typographic: { ...base, headerRule: 6, metricRule: 8, zebra: 'transparent', metricRuleColor: p.accent, headerRole: 'display', headerCase: 'upper' },
    cultural: { ...base, panel: true, panelColor: own.surface ? p.surface : '#F7F2EA', radius: 0, metricRuleColor: p.accent2, zebra: 'transparent', offsetShadow: p.accent },
    technical: { ...base, headerRole: 'label', headerCase: 'upper', headerTracking: 0.06, zebra: 'rgba(92,225,165,0.04)', ruleColor: p.rule, metricRuleColor: p.accent, stepMarker: 'code' },
    photo: { ...base, zebra: 'transparent', headerRule: 1, metricRule: 1, metricRuleColor: p.ink },
    modular: { ...base, panel: true, panelColor: p.surface, radius: 22, zebra: 'transparent', metricRule: 0, stepMarker: 'pill' },
  }[family];
}

/** Conversões para os campos do renderer atual (SlideCardInner). */
export function rendererTitleSizePercent(px, format = '16:9') {
  const { w } = FORMAT_SPECS[format] || FORMAT_SPECS['16:9'];
  return Math.round((px / (w * 0.084)) * 1000) / 10;
}
export function rendererSubtitleSizePercent(px, format = '16:9') {
  const { w } = FORMAT_SPECS[format] || FORMAT_SPECS['16:9'];
  // Arredondar para baixo faria o piso de 30 px virar 29,998 px no renderer.
  return Math.ceil((px / (w * 0.028)) * 1000) / 10;
}

/** Lista de famílias tipográficas usadas, para carregamento e registro. */
export function libraryFontFamilies() {
  const names = new Set();
  for (const key of FAMILY_KEYS) {
    for (const value of Object.values(PRESENTATION_FAMILIES[key].fonts)) {
      if (value && typeof value === 'object') names.add(value.family);
    }
  }
  return [...names];
}
