/**
 * Compilador opt-in do Livre. O contrato tipado evita repetir a cena inteira
 * e as regras de referência em vários blocos. Só estilo contextual e cenas
 * vizinhas além das duas primeiras cedem espaço; nenhum dado do núcleo é
 * cortado para caber. O comprimento usa UTF-16, como as rotas de imagem.
 */
const text = value => typeof value === 'string' ? value.trim() : '';
const normalizedQuery = value => text(value).replace(/\s+/g, ' ').toLowerCase();
const hasText = value => !!text(value);
const join = sections => sections.map(section => section.text).join('\n\n');

const PALETTE_ROLES = Object.freeze({
  base: 'base colour, the dominant field',
  subject_light: 'light on the subject',
  shadow: 'shadows',
  graphic: 'graphic interventions',
  accent: 'small accents',
});
const REFERENCE_ROLES = new Set(['moodboard', 'subject', 'identity']);
const LOOK_POLICY = 'Use moodboard images only for the look (medium, palette, light, contrast, texture), never for people, objects, framing or composition.';
const RULES = 'HARD RULES: No lettering, captions, logos or watermarks. Keep text, charts and interfaces in editable layers; do not fabricate screenshots, testimonials or before-and-after evidence. Depict only the requested subjects, with coherent anatomy and materials. Deliver only the image.';
const MAP_TAIL = 'Use each named reference only for its assigned role. The scene direction below refers to these labels.';
const VARIATION_HEADER = 'OTHER SLIDES (avoid repeating their action, setting or shot; keep shared identity):';

export function isDirectedImagePrompt(value) {
  return !!value && value.version === 2 && (value.kind === 'social_free' || value.kind === 'presentation_free');
}

/** Remove só o wrapper conhecido cuja instrução inteira já está protegida. */
function withoutDuplicateManual(value, manual, { map = false } = {}) {
  const source = text(value);
  if (!manual) return source;
  if (source === manual) return '';
  for (const label of ['THIS SLIDE DIRECTION:', 'SLIDE DIRECTION:']) {
    if (source === `${label}\n${manual}`) return '';
    const suffix = `\n\n${label}\n${manual}`;
    if (source.startsWith('PROJECT VISUAL STYLE BIBLE:') && source.endsWith(suffix)) return source.slice(0, -suffix.length).trimEnd();
  }
  if (map && source.startsWith('REFERENCE MAP (actual attachments, in sent order):') && source.endsWith(`${MAP_TAIL}\n${manual}`)) {
    return source.slice(0, -(manual.length + 1)).trimEnd();
  }
  return source;
}

function styleSegments(value, manual) {
  return (Array.isArray(value) ? value : [value])
    .map(segment => withoutDuplicateManual(segment, manual))
    .map(segment => segment.replace(/^PROJECT VISUAL STYLE BIBLE:\s*/, '').trim())
    .filter(hasText);
}

function visualBlock(visual) {
  const palette = (Array.isArray(visual.palette) ? visual.palette : [])
    .filter(item => hasText(item?.hex))
    .map(item => `${PALETTE_ROLES[item.role] || text(item.role) || 'colour'} ${text(item.hex)}`);
  const lines = [
    palette.length ? `Palette: ${palette.join('; ')}.` : '',
    hasText(visual.finish) ? `Finish: ${text(visual.finish)}` : '',
    hasText(visual.atmosphere) ? `Atmosphere: ${text(visual.atmosphere)}` : '',
  ].filter(Boolean);
  return lines.length ? `VISUAL DIRECTION:\n${lines.join('\n')}` : '';
}

function effectiveGraphics(visual, scene) {
  const global = text(visual.graphics);
  // Uma ausência global explícita veta intervenções locais; nos demais
  // casos, a decisão específica da cena substitui a decisão geral.
  if (global.replace(/[.\s]+$/, '').toLowerCase() === 'none') return 'No graphic interventions.';
  const local = text(scene?.graphics);
  if (local.replace(/[.\s]+$/, '').toLowerCase() === 'none') return 'No graphic interventions.';
  return local || global;
}

function referenceBlock(parts, contract, count) {
  if (!count) return '';
  const references = (Array.isArray(contract.references) ? contract.references : []).slice(0, count);
  const policies = [];
  if (parts.styleMoodboard === true || references.some(ref => ref?.role === 'moodboard')) policies.push(LOOK_POLICY);
  if (references.some(ref => ref?.role === 'subject')) policies.push('Subject references govern only their assigned subject.');
  if (references.some(ref => ref?.role === 'identity') && !hasText(parts.identityAnchor)) policies.push('Identity references govern identity only.');
  const roles = references.map((ref, index) => REFERENCE_ROLES.has(ref?.role)
    ? `${index + 1}: ${ref.role}${hasText(ref.label) ? ` @${text(ref.label).replace(/^@/, '')}` : ''}.` : '').filter(Boolean);
  const content = [policies.join(' '), ...roles].filter(Boolean).join('\n');
  return content ? `REFERENCE ROLES: ${content}` : '';
}

function variationRows(value) {
  const seen = new Set();
  return (Array.isArray(value) ? value : []).map(item => {
    const fields = ['action', 'setting', 'shot'].map(key => text(item?.[key]));
    const key = JSON.stringify(fields);
    if (!fields.some(Boolean) || seen.has(key)) return null;
    seen.add(key);
    const number = Number.isInteger(item?.index) && item.index >= 0 ? `#${item.index + 1}: ` : '';
    return { text: `- ${number}${fields.filter(Boolean).join('; ')}`, complete: fields.every(Boolean) };
  }).filter(Boolean);
}

function avoidBlock(visualAvoid, slideAvoid) {
  const values = [visualAvoid, ...(Array.isArray(slideAvoid) ? slideAvoid : [slideAvoid])].map(text).filter(Boolean);
  const unique = [...new Set(values)];
  return unique.length ? `AVOID:\n${unique.map(value => `- ${value}`).join('\n')}` : '';
}

/**
 * `essentialComplete` significa que todos os dados fornecidos ao núcleo
 * foram conservados; não presume que o roteiro preencheu campos ausentes.
 * COMPOSITION é literal e governa as áreas efetivas. O plano da câmera só
 * entra se o pedido ainda corresponde à cena estruturada.
 */
export function buildDirectedImagePrompt(parts = {}, { limit = 4000 } = {}) {
  const contract = parts.directedPrompt;
  const visual = contract.visual && typeof contract.visual === 'object' ? contract.visual : {};
  const matchesScene = hasText(parts.sceneBrief?.query)
    && normalizedQuery(parts.sceneBrief.query) === normalizedQuery(parts.scene);
  const scene = matchesScene && contract.scene && typeof contract.scene === 'object' ? contract.scene : null;
  const manual = text(contract.manualDirection);
  const count = Math.max(0, Number(parts.referenceCount) || 0);
  const sections = [];
  const add = (key, value) => { if (hasText(value)) sections.push({ key, text: text(value) }); };

  add('visualDirection', visualBlock(visual));
  if (scene) {
    const subject = [text(scene.subject), hasText(scene.wardrobe) ? `Wardrobe: ${text(scene.wardrobe)}` : '', hasText(scene.setting) ? `Setting: ${text(scene.setting)}` : ''].filter(Boolean).join('. ');
    const action = [text(scene.action), hasText(scene.expression) ? `Expression: ${text(scene.expression)}` : ''].filter(Boolean).join('; ');
    add('sceneSubject', subject ? `SUBJECT AND CASTING: ${subject}` : '');
    add('sceneAction', action ? `ACTION AND EXPRESSION: ${action}` : '');
    add('sceneShot', hasText(scene.shot) ? `SHOT: ${text(scene.shot)}` : '');
  } else {
    add('scene', hasText(parts.scene) ? `SCENE: ${text(parts.scene)}` : '');
  }
  add('axisTags', parts.axisTags);
  add('composition', parts.composition);
  if (hasText(parts.composition)) add('compositionPriority', 'COMPOSITION governs subject placement and clear areas, ahead of SHOT.');
  else add('framing', parts.framing);
  add('sceneLight', hasText(scene?.light) ? `LIGHT: ${text(scene.light)}` : '');
  const graphics = effectiveGraphics(visual, scene);
  add('graphics', graphics ? `GRAPHICS: ${graphics}` : '');
  add('subjects', parts.subjects);
  if (count) add('identityAnchor', parts.identityAnchor);
  add('manualDirection', manual ? `MANUAL DIRECTION (explicit user instruction):\n${manual}` : '');
  add('slideAction', withoutDuplicateManual(parts.slideAction, manual));
  add('referenceRoles', referenceBlock(parts, contract, count));
  if (count) add('referenceMap', withoutDuplicateManual(parts.referenceMap, manual, { map: true }));

  // Duas cenas completas têm prioridade sobre entradas parciais. As demais
  // são opcionais, sempre em linhas inteiras e sem repetir a ficha pessoal.
  const rows = variationRows(contract.variation);
  const ordered = [...rows.filter(row => row.complete), ...rows.filter(row => !row.complete)];
  const requiredRows = ordered.slice(0, 2);
  const extraRows = ordered.slice(2);
  add('variation', requiredRows.length ? `${VARIATION_HEADER}\n${requiredRows.map(row => row.text).join('\n')}` : '');
  add('avoid', avoidBlock(visual.avoid, parts.avoid));
  const aspect = text(parts.outputAspectRatio);
  add('output', /^\d+(?:\.\d+)?:\d+(?:\.\d+)?$/.test(aspect)
    ? `OUTPUT: ${aspect}${hasText(parts.composition) ? '; final card and crop follow COMPOSITION' : ''}.` : '');
  add('rules', RULES);

  const coreChars = join(sections).length;
  const styles = styleSegments(parts.styleBody, manual);
  const dropped = [];
  const trimmed = [];
  const diagnostics = {
    contractVersion: 2, essentialComplete: coreChars <= limit,
    coreChars, sectionChars: Object.fromEntries(sections.map(section => [section.key, section.text.length])),
    missingRequired: coreChars <= limit ? [] : ['budget'], omittedOptional: dropped,
    sceneSource: scene ? 'plan' : 'query', variationAvailable: rows.length, variationRetained: requiredRows.length,
  };
  if (coreChars > limit) return {
    status: 'blocked', code: 'prompt_core_too_long',
    label: 'Bloqueado · direção de imagem extensa',
    message: `O núcleo do pedido de imagem tem ${coreChars} caracteres; esta rota aceita ${limit}. Reduza a direção ou use uma rota com maior capacidade.`,
    prompt: '', chars: 0, dropped, trimmed, defaultAesthetic: false, diagnostics,
  };

  const variations = sections.find(section => section.key === 'variation');
  for (const [index, row] of extraRows.entries()) {
    if (join(sections).length + 1 + row.text.length <= limit) {
      variations.text += `\n${row.text}`;
      diagnostics.variationRetained += 1;
    } else dropped.push(`variation:${index + 3}`);
  }

  // O contexto bruto é o primeiro conteúdo a ceder: só segmentos inteiros
  // cabem no espaço restante, sem deixar um cabeçalho órfão. Na ausência do
  // novo manualDirection, o último segmento continua tendo prioridade.
  const styleHeader = 'PROJECT STYLE (VISUAL DIRECTION and manual direction take priority):';
  const retainedStyles = [];
  for (const segment of [...styles].reverse()) {
    const body = [segment, ...retainedStyles].join('\n\n');
    if (join(sections).length + 2 + styleHeader.length + 1 + body.length <= limit) retainedStyles.unshift(segment);
  }
  if (retainedStyles.length) add('style', `${styleHeader}\n${retainedStyles.join('\n\n')}`);
  if (retainedStyles.length < styles.length) {
    if (retainedStyles.length) trimmed.push('style');
    else dropped.push('style');
  }
  diagnostics.sectionChars = Object.fromEntries(sections.map(section => [section.key, section.text.length]));
  const prompt = join(sections);
  return { prompt, chars: prompt.length, dropped, trimmed, defaultAesthetic: false, diagnostics };
}
