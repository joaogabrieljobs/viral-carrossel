import { describe, expect, it } from 'vitest';
import { buildImagePrompt, imageRouteCapabilities, planImageRequest } from '../../shared/image-prompt.js';

// Dados representativos dos pedidos HTTP do head-6: a ficha e a âncora
// ocupavam o orçamento junto de políticas repetidas, derrubando luz e cenas.
const visual = {
  palette: [
    { role: 'base', hex: '#2B2158' }, { role: 'subject_light', hex: '#F8701E' },
    { role: 'shadow', hex: '#2B2158' }, { role: 'graphic', hex: '#28B2D4' }, { role: 'accent', hex: '#F8701E' },
  ],
  finish: 'Grão fino de filme editorial noturno, textura sutil de impressão offset, realismo contemporâneo com pós-tratamento de campanha publicitária.',
  atmosphere: 'Noite urbana brasileira intensa, calor tropical sob luz neon, energia de festa que ainda não começou mas já é inevitável.',
  graphics: 'Blocos geométricos sobrepostos em magenta e ciano, recortes tipográficos, linhas finas de blueprint editorial, sobreposição de cor translúcida.',
  avoid: 'No clichê Carnaval imagery: no feathers, sequins, confetti, samba costumes, masks or literal fantasy; no real celebrities, no visible logos or text, no stereotypes.',
};
const scenes = [
  { subject: 'The recurring fictional woman convidada in the project subject sheet', wardrobe: 'Terracotta shirt and dark trousers', action: 'Arriving at the party and looking toward the entrance', expression: 'Natural and relaxed', setting: 'An urban event entrance in São Paulo at night', light: 'Warm orange subject light, deep indigo shadows, subtle cyan accents', graphics: 'No graphics or text inside the photograph', shot: 'Medium portrait, person to the right, quiet left and lower areas for type' },
  { subject: 'The recurring fictional woman convidada in the project subject sheet', wardrobe: 'Terracotta shirt and dark trousers', action: 'Greeting friends in a candid conversation', expression: 'Natural and relaxed', setting: 'A contemporary urban party lounge', light: 'Warm orange subject light, deep indigo shadows, subtle cyan accents', graphics: 'No graphics or text inside the photograph', shot: 'Waist-up candid group, recurring woman visible, quiet adjacent area' },
  { subject: 'The recurring fictional woman convidada in the project subject sheet', wardrobe: 'Terracotta shirt and dark trousers', action: 'Enjoying the music with friends in a candid moment', expression: 'Natural and relaxed', setting: 'A contemporary dance floor with restrained warm and cyan light', light: 'Warm orange subject light, deep indigo shadows, subtle cyan accents', graphics: 'No graphics or text inside the photograph', shot: 'Candid three-quarter portrait, face and hands clear, quiet upper area' },
];
const subjects = "PROJECT SUBJECTS: Match each appearing subject's description and exclusions exactly across images. This slide's scene controls action, pose, setting and who appears. Add no conflicting attributes or unrequested subjects.\n- convidada: A fictional adult woman with short dark hair, wearing a terracotta shirt and dark trousers, with no branded clothing. Exclude: Celebrity resemblance, costume, branded clothing, hair or outfit changes.";
const identityAnchor = 'IDENTITY ANCHOR: The last attached image is the identity reference for the recurring person assigned to this scene. Match visible facial features, hair, skin tone and build. Use the project subject sheet for specified wardrobe. Use only the requested scene for action, pose, framing, setting and objects. Match neither the background nor the pose of the anchor unless the current scene calls for it.';
const composition = 'COMPOSITION (social card 1080 × 1350, 4:5; protected top 8.5% and bottom 8.5%): The visible photo panel starts at 0% from the left and 0% from the top, covering 100% of the card width and 40.08% of its height. Text sits outside that panel. Fill its crop with the subject, keeping faces, hands and key details away from the crop edges. Do not reserve an invented widescreen text column inside the photo.';
const sceneQuery = scene => Object.values(scene).join(', ');
const visualText = value => `VISUAL DIRECTION (shared by every image of this deck):\nPalette: base colour, the dominant field #2B2158; light on the subject #F8701E; shadows #2B2158; graphic interventions #28B2D4; small accents #F8701E.\nFinish: ${value.finish}\nAtmosphere: ${value.atmosphere}\nGraphics: ${value.graphics}\nDeck exclusions: ${value.avoid}\nColour, light and finish stay; faces, scenes, wardrobe and framing vary.`;
function partsFor(index = 1, kind = 'social_free') {
  const scene = { ...scenes[index] };
  const variation = scenes.map((item, i) => ({ index: [0, 2, 5][i], action: item.action, setting: item.setting, shot: item.shot })).filter((_item, i) => i !== index);
  return {
    format: kind === 'social_free' ? 'carousel' : 'presentation', socialFree: kind === 'social_free',
    scene: sceneQuery(scene), visualDirection: visualText(visual), composition, subjects, identityAnchor,
    sceneBrief: { query: sceneQuery(scene), subject: `SUBJECT AND CASTING: ${scene.subject}. Wardrobe: ${scene.wardrobe}. Setting: ${scene.setting}.`, action: `ACTION AND EXPRESSION: ${scene.action}; expression: ${scene.expression}.`, light: `LIGHT, TEXTURE AND GRAPHICS OF THIS SLIDE: ${scene.light}. Graphics on this slide: ${scene.graphics}.` },
    referenceCount: 2, styleMoodboard: true, styleReferenceLook: true,
    styleBody: ['PROJECT VISUAL STYLE BIBLE:\n' + 'Material de briefing e instruções editoriais já representadas no roteiro. '.repeat(45)],
    avoid: ['No confetti, feathers, costumes or carnival masks', 'No lettering, logos or watermarks'],
    otherScenes: variation.map(item => `${scene.subject}, ${scene.wardrobe}, ${item.action}, ${item.setting}`),
    directedPrompt: { version: 2, kind, visual: { ...visual }, scene, variation,
      references: [{ label: '', role: 'moodboard' }, { label: 'convidada', role: 'identity' }] },
  };
}
const normalize = text => String(text).replace(/\s+/g, ' ').trim().toLowerCase();

describe('Contrato de imagem dirigido v2', () => {
  it.each([0, 1, 2])('conserva luz, exclusões, ficha, âncora e duas cenas no pedido da foto %i', index => {
    const parts = partsFor(index);
    const result = planImageRequest(parts, { route: 'sjinn', model: 'gpt-image-2' });
    expect(result.status).toBe('ready');
    expect(result.chars).toBe(result.prompt.length);
    expect(result.chars).toBeLessThanOrEqual(4000);
    for (const value of [parts.directedPrompt.scene.action, parts.directedPrompt.scene.setting, parts.directedPrompt.scene.shot,
      parts.directedPrompt.scene.light, visual.finish, visual.atmosphere, visual.avoid, ...parts.avoid, composition, subjects, identityAnchor]) expect(result.prompt).toContain(value);
    for (const other of parts.directedPrompt.variation) for (const key of ['action', 'setting', 'shot']) expect(normalize(result.prompt)).toContain(normalize(other[key]));
    for (const item of visual.palette) expect(result.prompt).toContain(item.hex);
    expect(result.prompt).not.toContain('PROJECT VISUAL STYLE BIBLE:');
    expect(result.prompt).not.toMatch(/LIGHT, TEXTURE AND GRAPHICS OF THIS(?:\n|$)/);
    expect(result.diagnostics).toMatchObject({ contractVersion: 2, essentialComplete: true, missingRequired: [] });
  });

  it.each(['social_free', 'presentation_free'])('a mesma proteção do núcleo vale para %s', kind => {
    const parts = partsFor(1, kind);
    if (kind === 'presentation_free') parts.composition = 'COMPOSITION: Image panel 1920 × 1080, 16:9. Keep the left 52% calm in #2B2158; place the person to the right.';
    const result = planImageRequest(parts, { route: 'sjinn' });
    expect(result.status).toBe('ready');
    expect(result.prompt).toContain(parts.composition);
    expect(result.prompt).toContain(parts.directedPrompt.scene.light);
    expect(result.prompt).toContain(subjects);
    expect(result.prompt).toContain(identityAnchor);
    expect(result.prompt).not.toContain('never a real person');
    expect(result.prompt).not.toContain('Colour, light and finish stay; faces, scenes, wardrobe and framing vary.');
    expect(result.chars).toBeLessThanOrEqual(4000);
  });

  it('a consulta manual fica literal e não recebe ação, luz ou plano de câmera antigos', () => {
    const parts = partsFor(1);
    parts.scene = 'A cobalt glass bottle on a white stone pedestal, hard side light, no people. 🟦';
    parts.directedPrompt.variation = [];
    const result = planImageRequest(parts, { route: 'sjinn' });
    expect(result.status).toBe('ready');
    expect(result.prompt).toContain(parts.scene);
    for (const key of ['action', 'light', 'shot', 'setting']) expect(result.prompt).not.toContain(parts.directedPrompt.scene[key]);
    expect(result.prompt).toContain(visual.avoid);
    expect(result.prompt).toContain(composition);
  });

  it('a direção local de grafismos substitui a global sem descartar a exclusão do projeto', () => {
    const parts = partsFor();
    const result = planImageRequest(parts, { route: 'sjinn' });
    expect(result.prompt).toContain(parts.directedPrompt.scene.graphics);
    expect(result.prompt).not.toContain(visual.graphics);
    expect(result.prompt).toContain(visual.avoid);
  });

  it('none global veta grafismos locais positivos', () => {
    const parts = partsFor();
    parts.directedPrompt.visual.graphics = 'none';
    parts.directedPrompt.scene.graphics = 'Add distinctive gold ribbons around the subject.';
    parts.scene = parts.sceneBrief.query = sceneQuery(parts.directedPrompt.scene);
    const result = planImageRequest(parts, { route: 'sjinn' });
    expect(result.prompt).toContain('No graphic interventions');
    expect(result.prompt).not.toContain(parts.directedPrompt.scene.graphics);
    expect(result.prompt).not.toContain(visual.graphics);
    expect(result.prompt).toContain(visual.avoid);
  });

  it('conserva o anexo por papel e índice, sem citar mapa ausente nem repetir políticas', () => {
    const parts = partsFor();
    const result = planImageRequest(parts, { route: 'sjinn' });
    expect(result.prompt).toContain('REFERENCE ROLES: Use moodboard images only for the look');
    expect(result.prompt).toContain('never for people, objects, framing or composition');
    expect(result.prompt).toMatch(/1[^\n]*moodboard/i);
    expect(result.prompt).toMatch(/2[^\n]*identity[^\n]*convidada/i);
    expect(result.prompt).not.toContain('REFERENCE MAP');
    expect(result.prompt).not.toContain('STYLE REFERENCE (moodboard):');
    expect(result.prompt).not.toContain('FORMAT AND RESTRICTIONS:');
  });

  it('um mapa explícito e a instrução de ação do card permanecem literais', () => {
    const parts = partsFor();
    parts.referenceMap = 'REFERENCE MAP (actual attachments, in sent order):\n1 @look: moodboard only.\n2 @convidada: identity only.';
    parts.slideAction = 'SLIDE DIRECTION:\nKeep @convidada seated at the table, looking off-camera.';
    const result = planImageRequest(parts, { route: 'sjinn' });
    expect(result.status).toBe('ready');
    expect(result.prompt).toContain(parts.referenceMap);
    expect(result.prompt).toContain(parts.slideAction);
    expect(result.prompt).toContain(parts.directedPrompt.scene.light);
  });

  it('a intervenção manual é essencial e não repete os wrappers conhecidos', () => {
    const parts = partsFor();
    const manual = 'Use a matte cyan duotone and keep @convidada looking toward the door.';
    const map = 'REFERENCE MAP (actual attachments, in sent order):\n@convidada = image 2 (identity)\nUse each named reference only for its assigned role. The scene direction below refers to these labels.';
    parts.directedPrompt.manualDirection = manual;
    parts.referenceMap = `${map}\n${manual}`;
    parts.slideAction = `THIS SLIDE DIRECTION:\n${manual}`;
    parts.styleBody.push(`THIS SLIDE DIRECTION:\n${manual}`);
    const result = planImageRequest(parts, { route: 'sjinn' });
    expect(result.status).toBe('ready');
    expect(result.prompt.split(manual)).toHaveLength(2);
    expect(result.prompt).toContain(map);
    expect(result.prompt).toContain(parts.directedPrompt.scene.light);
    expect(result.prompt).toContain(subjects);
  });

  it('a direção manual longa também bloqueia em vez de desaparecer', () => {
    const parts = partsFor();
    parts.directedPrompt.manualDirection = 'An explicit user instruction that must not be dropped. '.repeat(40);
    const result = planImageRequest(parts, { route: 'sjinn' });
    expect(result).toMatchObject({ status: 'blocked', code: 'prompt_core_too_long' });
    expect(result.diagnostics.sectionChars.manualDirection).toBeGreaterThan(2000);
  });

  it('distingue a proporção gerada do card sem inventar OUTPUT quando ausente', () => {
    const parts = partsFor();
    const result = planImageRequest({ ...parts, outputAspectRatio: '2:3' }, { route: 'sjinn' });
    expect(result.prompt).toContain('OUTPUT: 2:3');
    expect(result.prompt).toContain('1080 × 1350, 4:5');
    expect(planImageRequest(parts, { route: 'sjinn' }).prompt).not.toContain('OUTPUT:');
  });

  it('preserva as decisões explícitas dos controles de imagem', () => {
    const parts = partsFor();
    parts.axisTags = 'Camera: low angle. Colour: cobalt blue. Medium: collage with paper texture.';
    const result = planImageRequest(parts, { route: 'sjinn' });
    expect(result.status).toBe('ready');
    expect(result.prompt).toContain(parts.axisTags);
    expect(result.diagnostics.sectionChars.axisTags).toBe(parts.axisTags.length);
  });

  it('não emite um estilo formado somente por cabeçalhos conhecidos', () => {
    const parts = partsFor();
    parts.styleBody = ['PROJECT VISUAL STYLE BIBLE:'];
    const result = planImageRequest(parts, { route: 'openai', model: 'gpt-image-2' });
    expect(result.prompt).not.toContain('PROJECT VISUAL STYLE BIBLE:');
    expect(result.prompt).not.toContain('PROJECT STYLE (written');
  });

  it('estilo opcional extenso cede antes de qualquer dado essencial', () => {
    const parts = partsFor();
    parts.styleBody = ['Unnecessary contextual prose. '.repeat(800)];
    const result = planImageRequest(parts, { route: 'sjinn' });
    expect(result.status).toBe('ready');
    expect(result.prompt).toContain(parts.directedPrompt.scene.light);
    expect(result.prompt).toContain(parts.avoid[0]);
    expect(result.prompt).toContain(subjects);
    expect(result.prompt).toContain(identityAnchor);
    expect(result.prompt).toContain(parts.directedPrompt.variation[1].action);
    expect(result.chars).toBeLessThanOrEqual(4000);
  });

  it('núcleo impossível é bloqueado com diagnóstico sem pedido parcialmente utilizável', () => {
    const parts = partsFor();
    parts.subjects = `PROJECT SUBJECTS:\n${'Every identity detail must remain literal. '.repeat(150)}`;
    const result = planImageRequest(parts, { route: 'sjinn' });
    expect(result).toMatchObject({ status: 'blocked', code: 'prompt_core_too_long', prompt: '', chars: 0 });
    expect(result.diagnostics).toMatchObject({ contractVersion: 2, essentialComplete: false });
    expect(result.diagnostics.coreChars).toBeGreaterThan(4000);
    expect(result.diagnostics.missingRequired).toContain('budget');
  });

  it('calcula o mesmo núcleo para cada teto real, sem confundir UTF-16 com bytes', () => {
    const parts = partsFor();
    parts.subjects = `PROJECT SUBJECTS:\n${'🟣'.repeat(2200)}`;
    const small = planImageRequest(parts, { route: 'sjinn' });
    const large = planImageRequest(parts, { route: 'openai', model: 'gpt-image-2' });
    expect(small.code).toBe('prompt_core_too_long');
    expect(large.status).toBe('ready');
    expect(large.prompt).toContain(parts.subjects);
    expect(large.chars).toBe(large.prompt.length);
    expect(large.chars).toBeLessThanOrEqual(32000);
    expect(imageRouteCapabilities('sjinn').promptLimit).toBe(4000);
    expect(imageRouteCapabilities('openai', 'gpt-image-2').promptLimit).toBe(32000);
  });

  it('rota sem anexos continua bloqueada antes da montagem', () => {
    expect(planImageRequest(partsFor(), { route: 'openai', model: 'dall-e-3' })).toMatchObject({ status: 'blocked', code: 'reference_unsupported', prompt: '' });
    expect(planImageRequest(partsFor(), { route: 'zai' })).toMatchObject({ status: 'blocked', code: 'reference_unsupported', prompt: '' });
  });

  it.each([undefined, false, { version: 1, kind: 'social_free' }, { version: 2, kind: 'catalog' }])('sem contrato v2 válido mantém o caminho anterior: %j', directedPrompt => {
    const legacy = { format: 'carousel', scene: 'A ceramic artist shaping a bowl in a workshop.', styleBody: 'Natural editorial photography.', referenceCount: 1, styleMoodboard: true };
    expect(buildImagePrompt({ ...legacy, directedPrompt }, { route: 'sjinn' })).toEqual(buildImagePrompt(legacy, { route: 'sjinn' }));
  });
});
