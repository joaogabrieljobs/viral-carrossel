/**
 * Montagem do prompt de imagem — parte comum ao navegador e ao servidor.
 *
 * Catálogo final de 22/11/2026. O que mudou em relação à montagem anterior:
 *  - a direção de arte padrão só sai com direção estética explícita ou
 *    moodboard de estilo; painel de apresentação, referência de produto e
 *    âncora de identidade não a desligam;
 *  - o orçamento é calculado para o provedor e o modelo efetivos. Cena, regras
 *    fixas e recorte são reservados; quando o pedido não cabe, saem blocos
 *    opcionais inteiros. Nada é fatiado no fim do texto;
 *  - o servidor valida o pedido completo com o mesmo comprimento
 *    (`assertImagePromptWithinLimit`), em unidades UTF-16 como o navegador;
 *  - rota sem anexos (Z.ai, DALL·E 3) com referência exigida devolve
 *    incompatibilidade antes de qualquer chamada.
 *
 * Este módulo só conhece texto: quem monta cada bloco (ficha visual, mapa de
 * referências, estilo do projeto, enquadramento) entrega a string pronta.
 */

/** Teto do pedido completo na rota do plano (SJinn) e no DALL·E 3. */
export const SJINN_PROMPT_LIMIT = 4000;
/** Rota do agente: tema + regras fixas cabem aqui; o pedido final em 4.000. */
export const AGENT_RESERVED_LIMIT = 3600;

export const IMAGE_REFERENCE_BLOCKED_LABEL = 'Bloqueado · referência incompatível';
export const IMAGE_REFERENCE_BLOCKED_MESSAGE = 'Este gerador não aceita imagens de referência, e este pedido depende delas. Use as imagens do plano ou a OpenAI com chave própria, ou remova as referências.';

const CANVAS_PRESENTATION = 'CANVAS: Compose for the image panel on the widescreen 16:9 slide. Put the subject in the usable panel area and reserve space for editable type only where it overlaps the image.';

/**
 * Direção de arte padrão (I02), versão longa. O catálogo final trazia uma
 * versão curta; no reteste real de 22/11 as fotos saíram claras, saturadas e
 * com cara de banco de imagem. Voltam as seções da direção que estava no ar,
 * sem a que pedia tratar o tema de forma indireta (o catálogo pede a cena do
 * material) e sem citar carrossel, porque agora vale também para o painel de
 * apresentação.
 */
const DEFAULT_ART_DIRECTION_LONG = `DEFAULT ART DIRECTION (follow as far as it fits the scene; specific project, family and panel directions take priority):
GENERAL DIRECTION
Generate realistic, natural and sophisticated images that look like real photographs or carefully composed documentary scenes captured in a real moment — not artificially created. Avoid creative exaggeration, visual fantasy, gratuitous surrealism, excess elements, overly dramatic compositions or visual cliché metaphors.

AESTHETIC
Realistic, clean, contemporary, natural. Use natural or soft light, moderate contrast, sober balanced colors, real texture of environments and people, discrete cinematic composition, natural shallow depth of field, editorial premium atmosphere. Subtle film grain. Slightly desaturated muted tones. No glamorization, no heavy retouching, no studio strobes, no extreme contrast.

COMPOSITION
Leave visual breathing space for text overlay. Negative space, slightly defocused background, one clear focal element, few objects, balance between information and visual silence. Image must not compete with text.

PEOPLE (only when the scene calls for them)
Real, natural, spontaneous — never posed-model, no advertising smile. Contemporary, discrete clothing. Real skin texture with visible pores and slight imperfections, natural unposed expressions.

VISUAL QUALITY
Photorealistic, shot like 35mm film photograph at eye level using a 50mm lens, subtle film grain, natural color balance. Realistic materials, organic texture, subtle imperfections. Avoid: plasticized skin, deformed hands, malformed objects, floating elements, fake logos, excessive sharpness, evident AI aesthetic.

EXPECTED OUTPUT
A photorealistic, natural image with low saturation, moderate contrast, clean composition and generous text-friendly space. Feels real, silent and visually refined.`;

/** Textos fixos do catálogo (chaves I02, I12–I19, I22, I23, I26 e I31). */
export const IMAGE_PROMPT_TEXT = Object.freeze({
  // I02 — só sem direção estética explícita e sem moodboard de estilo.
  defaultArtDirection: DEFAULT_ART_DIRECTION_LONG,
  // Versão curta: entra quando a longa não cabe no limite da rota (ex.: plano com âncora).
  defaultArtDirectionShort: 'DEFAULT ART DIRECTION: Generate a realistic, natural image that looks like a real photograph or a documentary scene captured in a real moment. Avoid creative exaggeration, excess elements, overly dramatic compositions and visual cliché metaphors. Aesthetic: natural or soft light, moderate contrast, sober balanced colors, slightly desaturated muted tones, subtle film grain, discrete cinematic composition, natural shallow depth of field. No glamorization, no heavy retouching, no studio strobes, no extreme contrast. Composition: one clear focal element, few objects, negative space and a slightly defocused background. Leave the specified overlay area quiet; the image must not compete with text. People, only when the scene calls for them: real, natural, spontaneous, never posed-model, no advertising smile, real skin texture with slight imperfections. Avoid plasticized skin, deformed hands, malformed objects, floating elements, fake logos, excessive sharpness and evident AI aesthetic. Specific project, family and panel directions take priority over these defaults.',
  // I12 — carrossel sem mídia explícita.
  mediumCarousel: 'For a carousel with no specified medium, use editorial photography. Reserve clear space for editable type where the selected layout overlays text.',
  // I13 — apresentação sem estilo nem referência de estilo (inclui a regra de tela I15).
  mediumPresentation: `${CANVAS_PRESENTATION} Use editorial photography by default or the specified illustrative medium. Use supplied assets for actual demonstrations. Keep factual comparisons, values and diagrams out of the generated image.`,
  // I14 — carrossel com estilo ou referência; vale para qualquer proporção social.
  canvasSocial: 'CANVAS: Compose for the selected social format and its visible crop. Keep the specified overlay zone quiet and essential detail inside the protected area.',
  // I15 — apresentação com direção estética ou referência.
  canvasPresentation: CANVAS_PRESENTATION,
  // I16 — todo pedido do editor, antes do conteúdo opcional.
  hardRules: 'HARD RULES: No lettering, captions, logos or watermarks anywhere in the image. Keep factual claims, charts and interface content in editable layers. Deliver the image only. Keep the subject’s identifying geometry and materials consistent with the scene. In photographs, retain natural anatomy, skin texture and coherent lighting. Do not add people the scene does not call for.',
  // I17 — só com anexos efetivamente enviados.
  referenceRoles: 'REFERENCE ROLES: Use moodboard images for medium, palette, lighting and composition. Follow a named product or subject reference only for its assigned role. A separate identity anchor governs identity only. Create the scene in this request. Exclude lettering, logos and watermarks from every role.',
  // Spec 1.1, referência (25/11): na apresentação, a referência de estilo do
  // kit vai em todas as imagens e serve só para o visual. O texto acima (I17)
  // pedia ao moodboard também a composição; com estilo escrito o I18 não
  // entrava, e a Apoteose repetiu a pessoa da referência em 7 de 10 slides.
  referenceRolesPresentation: 'REFERENCE ROLES: Use moodboard images only for the look (medium, palette, lighting, contrast, texture), never for people, objects, framing or composition. Follow a named product or subject reference only for its assigned role. A separate identity anchor governs identity only. Create the scene in this request. Exclude lettering, logos and watermarks from every role.',
  styleReferenceLook: 'STYLE REFERENCE (moodboard): take only the visual look from the attached style reference images: medium, palette (including black and white or a limited palette), lighting, contrast, texture, colour grading and mood. Never copy their people, faces, clothing, objects, framing, composition or scene. The subject and the scene come from this slide\'s SCENE.',
  // Só sem estilo escrito, como no I18: o visual da referência manda sobre cor e luz citadas no resto.
  styleReferenceOverride: 'This look overrides any colour, light or mood mentioned elsewhere in this request.',
  styleReferenceLabeled: 'References named in the REFERENCE MAP keep their assigned role.',
  // Cenas planejadas dos outros slides do deck (roteiro v2).
  otherScenesHeader: 'OTHER SLIDES IN THIS DECK already show these scenes. Do not repeat their subject, setting or framing; propose a different scene that fits this slide, with the same look:',
  // I18 — moodboard de estilo sem direção estética escrita.
  // Reteste de 22/11: a frase curta do catálogo perdia para a luz quente da família e para as cores da ficha.
  moodboardOnly: 'STYLE REFERENCE (moodboard): the attached reference images define the look of this image. Match their medium, palette (including black and white or a limited palette), contrast, lighting and texture. This look overrides any colour, light or mood mentioned elsewhere in this request. Take only the look from the references, not their subject: create the new scene described above.',
  // I19 — cabeçalho do estilo escrito de projeto ou slide.
  styleHeader: 'PROJECT OR SLIDE STYLE: Apply the requested medium, palette, materials and lighting below. Use natural subject colours unless the project specifies otherwise.',
  // I22 — mapa dos anexos realmente enviados.
  referenceMapHeader: 'REFERENCE MAP (actual attachments, in sent order):',
  referenceMapTail: 'Use each named reference only for its assigned role. The scene direction below refers to these labels.',
  // I23 — imagem de painel de apresentação planejado.
  presentationPanel: 'PRESENTATION IMAGE PANEL: Supply an illustrative visual for this panel. Keep the important action and subject features inside its crop. Text, values and diagrams are added separately. Do not simulate product captures, charts, customer evidence, testimonials or before-and-after results.',
  // I26 — fecho do tratamento da família visual.
  treatmentTail: 'Apply this treatment to the requested scene within the specified crop. Explicit project or slide style takes precedence.',
  // Spec 1.1, entrega 1 — cabeçalho do bloco AVOID (rules de imagem do briefing e avoid do slide).
  avoidHeader: 'AVOID (from the brief and this slide plan; keep these out of the image):',
  // I31 — regras fixas da rota do agente.
  agentRules: 'Output an illustrative image for this card. Keep the subject and essential action clear in the final crop, with room around key features. Do not depict a screenshot, chart, testimonial or evidence of a real event. No lettering, captions, logos or watermarks.',
});

const ROUTES = Object.freeze({
  sjinn: Object.freeze({ promptLimit: SJINN_PROMPT_LIMIT, maxReferences: 4 }),
  openai: Object.freeze({ promptLimit: 32000, maxReferences: 4 }),
  zai: Object.freeze({ promptLimit: 32000, maxReferences: 0 }),
  mcp: Object.freeze({ promptLimit: SJINN_PROMPT_LIMIT, reservedLimit: AGENT_RESERVED_LIMIT, maxReferences: 0 }),
});

/** Limite e anexos do provedor e do modelo efetivo (muda a cada fallback). */
export function imageRouteCapabilities(route = 'openai', model = '') {
  const base = ROUTES[route] || ROUTES.openai;
  if ((ROUTES[route] ? route : 'openai') === 'openai' && String(model) === 'dall-e-3') {
    return { ...base, promptLimit: SJINN_PROMPT_LIMIT, maxReferences: 0 };
  }
  return { ...base };
}

/**
 * Validação do servidor: o pedido completo precisa caber no limite da rota.
 * Não fatia. Um pedido maior é erro de quem montou, e cortar aqui derrubaria
 * justamente o que foi reservado no navegador.
 */
export function assertImagePromptWithinLimit(prompt, limit = SJINN_PROMPT_LIMIT) {
  const texto = String(prompt ?? '');
  if (texto.length > limit) {
    throw Object.assign(new Error(`O pedido de imagem tem ${texto.length} caracteres; o limite desta rota é ${limit}.`), {
      code: 'prompt_too_long', status: 400, limit, length: texto.length,
    });
  }
  return texto;
}

const AESTHETIC_WORDS = new RegExp([
  // meio e técnica
  '\\b(?:estilo|estetic|ilustra|desenh|aquarel|pintura|pintad|colagem|render|cartoon|cartum|anime|manga|vetor|isometric|minimalis|vintage|retro|neon|pastel|monocrom|sepia|surreal|futuris|cyberpunk|fotograf|fotorreal|realis|cinematograf|xilogravura|gravura|nanquim|croqui|massinha)',
  '\\b(?:style|aesthetic|illustrat|drawing|watercolo|painting|painted|collage|vector|minimalist|monochrome|photograph|photoreal|realistic|cinematic|sketch|claymation)',
  '\\b(?:3d|p&b|flat|noir|low poly|pixel art|preto e branco|black and white|oleo sobre|oil paint|film grain|35mm|polaroid)\\b',
  // paleta, materiais e luz
  '\\b(?:paleta|palette|colorid|satura|dessatura|contraste|contrast|iluminac|lighting|sombra|shadow|textura|texture|gradiente|degrade|gradient|granulad|fosc|brilhant|glossy|matte)',
  '\\b(?:cor|cores|colou?rs?|tons de|tonalidade|tones?|luz|light)\\b',
].join('|'), 'i');

/**
 * A direção escrita no card pede estética (meio, paleta, materiais, luz) ou
 * só ação e recorte? Só a estética explícita desliga a direção de arte padrão.
 * Heurística por vocabulário, em português e inglês: quando ela não reconhece
 * um estilo, a direção segue no pedido do mesmo jeito, e a estética padrão já
 * declara que direções específicas têm prioridade.
 */
export function isAestheticDirection(text) {
  const plano = String(text || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  return !!plano.trim() && AESTHETIC_WORDS.test(plano);
}

/** I26 — tratamento da família visual, em inglês. */
export function composeFamilyTreatment(familyEnglish) {
  const texto = String(familyEnglish || '').trim();
  return texto ? `VISUAL TREATMENT: ${texto}\n${IMAGE_PROMPT_TEXT.treatmentTail}` : '';
}

const presente = (valor) => typeof valor === 'string' && valor.trim().length > 0;

/** Corta em fim de frase ou de linha; na falta, em fim de palavra. */
function cutAtBoundary(text, max) {
  const texto = String(text || '');
  if (max <= 0) return '';
  if (texto.length <= max) return texto;
  const janela = texto.slice(0, max + 1);
  let fim = -1;
  for (const match of janela.matchAll(/[.!?…;](?=\s)|\n/g)) {
    const posicao = match[0] === '\n' ? match.index : match.index + 1;
    if (posicao <= max) fim = posicao;
  }
  if (fim <= 0) fim = janela.slice(0, max).lastIndexOf(' ');
  if (fim <= 0) return '';
  return texto.slice(0, fim).trimEnd();
}

/** Mantém a primeira linha (cabeçalho) e só linhas inteiras depois dela. */
function keepWholeLines(text, max) {
  const linhas = String(text || '').split('\n');
  const mantidas = [linhas[0]];
  let tamanho = linhas[0].length;
  for (const linha of linhas.slice(1)) {
    if (tamanho + 1 + linha.length > max) break;
    mantidas.push(linha);
    tamanho += 1 + linha.length;
  }
  return mantidas.length > 1 ? mantidas.join('\n') : '';
}

/** Mantém cabeçalho e rodapé inteiros e reduz o corpo em fim de frase. */
function shrinkBody(head, body, tail, max) {
  const corpo = cutAtBoundary(body, max - head.length - tail.length);
  return corpo ? `${head}${corpo}${tail}` : '';
}

const OPTIONAL_DROP_ORDER = Object.freeze(['defaultArtDirection', 'otherScenes', 'medium', 'treatment']);
const OPTIONAL_DROP_ORDER_CAROUSEL = Object.freeze(['medium', 'defaultArtDirection', 'treatment']);
// O bloco AVOID é o último texto do usuário a ceder: só depois de estilo,
// ficha e direção do slide, e sai inteiro só depois deles.
const REQUIRED_SHRINK_ORDER = Object.freeze(['style', 'subjects', 'slideAction', 'avoid']);
const REQUIRED_DROP_ORDER = Object.freeze([
  'slideAction', 'style', 'moodboardOnly', 'subjects', 'avoid', 'framing', 'presentationPanel', 'referenceMap', 'identityAnchor', 'referenceRoles',
]);

/** Cenas dos outros slides: cabeçalho fixo e uma linha por cena; '' sem cenas. */
export function composeOtherScenesBlock(scenes) {
  const itens = (Array.isArray(scenes) ? scenes : []).filter(presente).map((texto) => texto.replace(/\s+/g, ' ').trim());
  return itens.length ? `${IMAGE_PROMPT_TEXT.otherScenesHeader}\n${[...new Set(itens)].map((texto) => `- ${texto}`).join('\n')}` : '';
}

/** Bloco AVOID: cabeçalho fixo e uma linha por item; '' sem itens. */
export function composeAvoidBlock(avoid) {
  const itens = (Array.isArray(avoid) ? avoid : [avoid]).filter(presente).map((texto) => texto.replace(/\s+/g, ' ').trim());
  return itens.length ? `${IMAGE_PROMPT_TEXT.avoidHeader}\n${[...new Set(itens)].map((texto) => `- ${texto}`).join('\n')}` : '';
}

const tamanhoTotal = (blocos) => blocos.reduce((soma, bloco) => soma + bloco.text.length, 0) + Math.max(0, blocos.length - 1) * 2;

/**
 * Monta o pedido na ordem do catálogo e aplica o orçamento da rota.
 *
 * `parts` (strings já compostas por quem é dono de cada bloco):
 *   scene, axisTags, format ('carousel' | 'presentation'), framing,
 *   referenceCount, styleMoodboard, referenceMap, identityAnchor,
 *   presentationPanel, slideAction, subjects, styleBody, familyEnglish, avoid
 *   (string ou lista: o que a imagem não pode mostrar), styleReferenceLook
 *   (apresentação com referência de estilo do kit: dela sai só o visual) e
 *   otherScenes (lista: cenas dos outros slides do deck, para não repetir).
 * `styleBody` aceita uma string ou segmentos `[estilo do projeto, direção do
 * slide]`; se precisar reduzir, o primeiro segmento cede antes dos demais.
 *
 * Devolve `{ prompt, chars, dropped, trimmed, defaultAesthetic }`.
 * `dropped` lista os blocos descartados inteiros; `trimmed`, os de texto do
 * usuário reduzidos em fim de frase ou de linha quando nem sem os opcionais
 * o pedido coube.
 */
export function buildImagePrompt(parts = {}, { route = 'openai', model = '', limit = 0 } = {}) {
  const T = IMAGE_PROMPT_TEXT;
  const caps = imageRouteCapabilities(route, model);
  const teto = limit > 0 ? limit : caps.promptLimit;
  const agente = route === 'mcp';
  const presentation = parts.format === 'presentation';
  const canvas = presentation ? T.canvasPresentation : T.canvasSocial;
  const referenceCount = Math.max(0, Number(parts.referenceCount) || 0);
  const styleSegments = (Array.isArray(parts.styleBody) ? parts.styleBody : [parts.styleBody]).filter(presente).map((texto) => texto.trim());
  const styleBody = styleSegments.join('\n\n');
  const styleMoodboard = referenceCount > 0 && parts.styleMoodboard === true;
  // Apresentação com referência de estilo: o bloco "só o visual" é fixo, com
  // ou sem estilo escrito, e reservado como as regras.
  const lookOnly = styleMoodboard && presentation && parts.styleReferenceLook === true;
  const styleReference = lookOnly ? [
    T.styleReferenceLook,
    styleBody ? '' : T.styleReferenceOverride,
    presente(parts.referenceMap) ? T.styleReferenceLabeled : '',
  ].filter(Boolean).join(' ') : '';
  const dropped = [];
  const trimmed = [];

  const regras = agente ? T.agentRules : T.hardRules;
  const framing = presente(parts.framing) ? parts.framing.trim() : '';
  const axis = presente(parts.axisTags) ? parts.axisTags.trim() : '';
  // Reserva: a cena é o único texto fixo de tamanho livre. Ela só é encurtada
  // quando sozinha, com as regras fixas, já não cabe na rota.
  const reservado = Math.min(teto, agente ? (caps.reservedLimit || teto) : teto);
  const fixosSemCena = regras.length + 2 + (!agente && framing ? framing.length + 2 : 0) + (styleReference ? styleReference.length + 2 : 0);
  const cenaMax = Math.max(0, reservado - fixosSemCena - 'SCENE: '.length - (axis ? axis.length + 1 : 0));
  let scene = String(parts.scene || '').trim();
  if (scene.length > cenaMax) {
    scene = cutAtBoundary(scene, cenaMax) || scene.slice(0, cenaMax).trimEnd();
    trimmed.push('scene');
  }

  const blocos = [];
  const add = (key, text, tier, shrink = null) => { if (presente(text)) blocos.push({ key, text, tier, shrink }); };
  add('scene', `SCENE: ${scene}${axis ? `\n${axis}` : ''}`, 'fixed');
  add('rules', regras, 'fixed');
  add('framing', framing, agente ? 'required' : 'fixed');
  if (referenceCount > 0) {
    add('referenceRoles', lookOnly ? T.referenceRolesPresentation : T.referenceRoles, 'required');
    add('referenceMap', parts.referenceMap, 'required');
    add('identityAnchor', parts.identityAnchor, 'required');
  }
  // No agente, I31 já proíbe captura, gráfico e depoimento.
  if (parts.presentationPanel && !agente) add('presentationPanel', T.presentationPanel, 'required');
  add('avoid', composeAvoidBlock(parts.avoid), 'required', keepWholeLines);
  if (presentation) add('otherScenes', composeOtherScenesBlock(parts.otherScenes), 'optional', keepWholeLines);
  add('slideAction', parts.slideAction, 'required', (texto, max) => {
    const [cabecalho, ...resto] = texto.split('\n');
    return shrinkBody(`${cabecalho}\n`, resto.join('\n'), '', max);
  });
  add('subjects', parts.subjects, 'required', keepWholeLines);
  if (styleBody) {
    add('style', `${T.styleHeader}\n${styleBody}\n${canvas}`, 'required', (_texto, max) => {
      const head = `${T.styleHeader}\n`;
      const tail = `\n${canvas}`;
      const [primeiro, ...demais] = styleSegments;
      if (demais.length) {
        // A bíblia do projeto cede primeiro; a direção deste slide fica inteira.
        const resto = demais.join('\n\n');
        const menor = cutAtBoundary(primeiro, max - head.length - tail.length - resto.length - 2);
        if (menor.includes('\n')) return `${head}${menor}\n\n${resto}${tail}`;
        if (head.length + resto.length + tail.length <= max) return `${head}${resto}${tail}`;
      }
      return shrinkBody(head, styleBody, tail, max);
    });
  } else if (styleMoodboard) {
    if (!lookOnly) add('moodboardOnly', T.moodboardOnly, 'required');
    add('medium', canvas, 'optional');
  } else if (!agente) {
    add('medium', presentation ? T.mediumPresentation : T.mediumCarousel, 'optional');
  }
  add('styleReference', styleReference, 'fixed');
  // Com moodboard de estilo, a luz da família disputaria com a referência.
  if (!styleMoodboard) add('treatment', composeFamilyTreatment(parts.familyEnglish), 'optional');
  if (!agente && !styleBody && !styleMoodboard) add('defaultArtDirection', T.defaultArtDirection, 'optional');

  let ativos = blocos;
  const remover = (key) => { ativos = ativos.filter((bloco) => bloco.key !== key); dropped.push(key); };
  // 0) A direção de arte longa cede lugar à curta antes de qualquer bloco sair.
  const arte = ativos.find((bloco) => bloco.key === 'defaultArtDirection');
  if (arte && tamanhoTotal(ativos) > teto) { arte.text = T.defaultArtDirectionShort; trimmed.push('defaultArtDirection'); }
  // 1) Blocos opcionais saem inteiros. No carrossel a frase de mídia repete o
  //    que a direção de arte já diz e sai antes dela; na apresentação ela
  //    carrega a regra de tela e fica.
  //    Bloco com redução própria (cenas dos outros slides) perde linhas
  //    inteiras antes de sair.
  for (const key of (presentation ? OPTIONAL_DROP_ORDER : OPTIONAL_DROP_ORDER_CAROUSEL)) {
    const excesso = tamanhoTotal(ativos) - teto;
    if (excesso <= 0) break;
    const bloco = ativos.find((item) => item.key === key && item.tier === 'optional');
    if (!bloco) continue;
    const menor = bloco.shrink ? bloco.shrink(bloco.text, bloco.text.length - excesso) : '';
    if (menor) { bloco.text = menor; trimmed.push(key); } else remover(key);
  }
  // 2) Texto exigido pelo usuário: reduz em fim de frase ou de linha.
  for (const key of REQUIRED_SHRINK_ORDER) {
    const excesso = tamanhoTotal(ativos) - teto;
    if (excesso <= 0) break;
    const bloco = ativos.find((item) => item.key === key && item.shrink);
    if (!bloco) continue;
    const menor = bloco.shrink(bloco.text, bloco.text.length - excesso);
    if (menor) { bloco.text = menor; trimmed.push(key); } else remover(key);
  }
  // 3) Último recurso: blocos exigidos saem inteiros; os fixos nunca.
  for (const key of REQUIRED_DROP_ORDER) {
    if (tamanhoTotal(ativos) <= teto) break;
    if (ativos.some((bloco) => bloco.key === key && bloco.tier === 'required')) remover(key);
  }

  const prompt = ativos.map((bloco) => bloco.text).join('\n\n');
  return {
    prompt,
    chars: prompt.length,
    dropped,
    trimmed,
    defaultAesthetic: ativos.some((bloco) => bloco.key === 'defaultArtDirection'),
  };
}

/**
 * Decide o pedido para a rota e o modelo efetivos: pronto, com o prompt dentro
 * do orçamento, ou bloqueado quando a rota não aceita os anexos exigidos.
 */
export function planImageRequest(parts = {}, { route = 'openai', model = '', limit = 0 } = {}) {
  const caps = imageRouteCapabilities(route, model);
  const referenceCount = Math.max(0, Number(parts.referenceCount) || 0);
  if (referenceCount > 0 && caps.maxReferences === 0) {
    return {
      status: 'blocked', code: 'reference_unsupported',
      label: IMAGE_REFERENCE_BLOCKED_LABEL, message: IMAGE_REFERENCE_BLOCKED_MESSAGE,
      prompt: '', chars: 0, dropped: [], trimmed: [], defaultAesthetic: false, route, model,
    };
  }
  return { status: 'ready', route, model, limit: limit > 0 ? limit : caps.promptLimit, ...buildImagePrompt(parts, { route, model, limit }) };
}
