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

/** Textos fixos do catálogo (chaves I02, I12–I19, I22, I23, I26 e I31). */
export const IMAGE_PROMPT_TEXT = Object.freeze({
  // I02 — só sem direção estética explícita e sem moodboard de estilo.
  defaultArtDirection: 'DEFAULT ART DIRECTION: Use an editorial photograph with natural materials, believable anatomy and coherent light. Choose the angle and depth of field that make the subject and action legible. Keep one focal point, control distractions and leave the specified overlay area quiet. Avoid stock metaphors and staged reactions. For photography, retain natural skin, hands, texture and object geometry. Specific project, family and panel directions take priority over these defaults.',
  // I12 — carrossel sem mídia explícita.
  mediumCarousel: 'For a carousel with no specified medium, use editorial photography. Reserve clear space for editable type where the selected layout overlays text.',
  // I13 — apresentação sem estilo nem referência de estilo (inclui a regra de tela I15).
  mediumPresentation: `${CANVAS_PRESENTATION} Use editorial photography by default or the specified illustrative medium. Use supplied assets for actual demonstrations. Keep factual comparisons, values and diagrams out of the generated image.`,
  // I14 — carrossel com estilo ou referência; vale para qualquer proporção social.
  canvasSocial: 'CANVAS: Compose for the selected social format and its visible crop. Keep the specified overlay zone quiet and essential detail inside the protected area.',
  // I15 — apresentação com direção estética ou referência.
  canvasPresentation: CANVAS_PRESENTATION,
  // I16 — todo pedido do editor, antes do conteúdo opcional.
  hardRules: 'HARD RULES: No lettering, captions, logos or watermarks anywhere in the image. Keep factual claims, charts and interface content in editable layers. Deliver the image only. Keep the subject’s identifying geometry and materials consistent with the scene. In photographs, retain natural anatomy, skin texture and coherent lighting.',
  // I17 — só com anexos efetivamente enviados.
  referenceRoles: 'REFERENCE ROLES: Use moodboard images for medium, palette, lighting and composition. Follow a named product or subject reference only for its assigned role. A separate identity anchor governs identity only. Create the scene in this request. Exclude lettering, logos and watermarks from every role.',
  // I18 — moodboard de estilo sem direção estética escrita.
  moodboardOnly: 'Match the visual medium, palette, materials and composition of the attached references in a new scene aligned with this card.',
  // I19 — cabeçalho do estilo escrito de projeto ou slide.
  styleHeader: 'PROJECT OR SLIDE STYLE: Apply the requested medium, palette, materials and lighting below. Use natural subject colours unless the project specifies otherwise.',
  // I22 — mapa dos anexos realmente enviados.
  referenceMapHeader: 'REFERENCE MAP (actual attachments, in sent order):',
  referenceMapTail: 'Use each named reference only for its assigned role. The scene direction below refers to these labels.',
  // I23 — imagem de painel de apresentação planejado.
  presentationPanel: 'PRESENTATION IMAGE PANEL: Supply an illustrative visual for this panel. Keep the important action and subject features inside its crop. Text, values and diagrams are added separately. Do not simulate product captures, charts, customer evidence, testimonials or before-and-after results.',
  // I26 — fecho do tratamento da família visual.
  treatmentTail: 'Apply this treatment to the requested scene within the specified crop. Explicit project or slide style takes precedence.',
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

const OPTIONAL_DROP_ORDER = Object.freeze(['defaultArtDirection', 'medium', 'treatment']);
const REQUIRED_SHRINK_ORDER = Object.freeze(['style', 'subjects', 'slideAction']);
const REQUIRED_DROP_ORDER = Object.freeze([
  'slideAction', 'style', 'moodboardOnly', 'subjects', 'framing', 'presentationPanel', 'referenceMap', 'identityAnchor', 'referenceRoles',
]);

const tamanhoTotal = (blocos) => blocos.reduce((soma, bloco) => soma + bloco.text.length, 0) + Math.max(0, blocos.length - 1) * 2;

/**
 * Monta o pedido na ordem do catálogo e aplica o orçamento da rota.
 *
 * `parts` (strings já compostas por quem é dono de cada bloco):
 *   scene, axisTags, format ('carousel' | 'presentation'), framing,
 *   referenceCount, styleMoodboard, referenceMap, identityAnchor,
 *   presentationPanel, slideAction, subjects, styleBody, familyEnglish.
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
  const dropped = [];
  const trimmed = [];

  const regras = agente ? T.agentRules : T.hardRules;
  const framing = presente(parts.framing) ? parts.framing.trim() : '';
  const axis = presente(parts.axisTags) ? parts.axisTags.trim() : '';
  // Reserva: a cena é o único texto fixo de tamanho livre. Ela só é encurtada
  // quando sozinha, com as regras fixas, já não cabe na rota.
  const reservado = Math.min(teto, agente ? (caps.reservedLimit || teto) : teto);
  const fixosSemCena = regras.length + 2 + (!agente && framing ? framing.length + 2 : 0);
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
    add('referenceRoles', T.referenceRoles, 'required');
    add('referenceMap', parts.referenceMap, 'required');
    add('identityAnchor', parts.identityAnchor, 'required');
  }
  // No agente, I31 já proíbe captura, gráfico e depoimento.
  if (parts.presentationPanel && !agente) add('presentationPanel', T.presentationPanel, 'required');
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
    add('moodboardOnly', T.moodboardOnly, 'required');
    add('medium', canvas, 'optional');
  } else if (!agente) {
    add('medium', presentation ? T.mediumPresentation : T.mediumCarousel, 'optional');
  }
  add('treatment', composeFamilyTreatment(parts.familyEnglish), 'optional');
  if (!agente && !styleBody && !styleMoodboard) add('defaultArtDirection', T.defaultArtDirection, 'optional');

  let ativos = blocos;
  const remover = (key) => { ativos = ativos.filter((bloco) => bloco.key !== key); dropped.push(key); };
  // 1) Blocos opcionais saem inteiros, do mais genérico para o mais específico.
  for (const key of OPTIONAL_DROP_ORDER) {
    if (tamanhoTotal(ativos) <= teto) break;
    if (ativos.some((bloco) => bloco.key === key && bloco.tier === 'optional')) remover(key);
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
