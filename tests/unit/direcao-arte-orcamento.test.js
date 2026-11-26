// Direção de arte das imagens: orçamento do pedido de imagem. A direção visual
// (cabeçalho e paleta) e COMPOSITION nunca saem; o que corta primeiro são as
// cenas dos outros slides, depois o texto do usuário (estilo, ficha, direção
// do slide, AVOID), e só por último os detalhes da direção visual e a cena.
import { describe, expect, it } from 'vitest';
import { IMAGE_PROMPT_TEXT, SJINN_PROMPT_LIMIT, buildImagePrompt } from '../../shared/image-prompt.js';
import { composeVisualDirectionBlock } from '../../src/utils/visual-direction.js';

const VD = composeVisualDirectionBlock({
  palette: [{ role: 'base', hex: '#171344' }, { role: 'subject_light', hex: '#FF6A1A' }, { role: 'shadow', hex: '#B41275' }],
  finish: 'grain and screen print '.repeat(9).trim(), atmosphere: 'urban and intimate night '.repeat(7).trim(),
  graphics: 'cyan cut-paper shapes on the edge '.repeat(6).trim(), avoid: 'costumes, feathers, confetti, '.repeat(7).trim(),
});
const COMPOSITION = 'COMPOSITION (space for the slide text): Shot: close-up. Type is laid over the left 50% of the frame. Keep that area dark and quiet in #171344, with low detail and no faces, hands or key details in it. Place the subject within the right 50%.';
const brief = { query: 'woman, close-up', subject: `SUBJECT AND CASTING: ${'adult woman with sculptural glasses '.repeat(6).trim()}.`, action: `ACTION AND EXPRESSION: ${'turns her gaze left '.repeat(7).trim()}.`, light: `LIGHT, TEXTURE AND GRAPHICS OF THIS SLIDE: ${'orange light on the face, indigo shadows '.repeat(8).trim()}.` };
const parts = (extra = {}) => ({
  scene: 'woman, close-up', format: 'presentation', framing: '', referenceCount: 1, styleMoodboard: true, styleReferenceLook: true,
  presentationPanel: true, visualDirection: VD, composition: COMPOSITION, sceneBrief: brief,
  avoid: ['Não usar clichês do Carnaval'], otherScenes: Array.from({ length: 5 }, (_, i) => `other scene number ${i + 1} `.repeat(6).trim()),
  ...extra,
});

describe('orçamento com direção visual', () => {
  it('cabe: nada sai', () => {
    const result = buildImagePrompt(parts({ otherScenes: ['dancers in a club'] }), { route: 'openai' });
    expect(result.dropped).toEqual([]);
    expect(result.trimmed).toEqual([]);
  });

  it('aperto moderado: só as cenas dos outros slides perdem linhas', () => {
    const result = buildImagePrompt(parts(), { route: 'sjinn' });
    expect(result.chars).toBeLessThanOrEqual(SJINN_PROMPT_LIMIT);
    expect([...result.trimmed, ...result.dropped].every(key => key === 'otherScenes')).toBe(true);
  });

  it('aperto grande (estilo escrito enorme): estilo encurta e sai antes de tocar na direção visual; COMPOSITION e paleta ficam', () => {
    const result = buildImagePrompt(parts({ styleBody: ['Long project bible sentence. '.repeat(90).trim(), 'THIS SLIDE DIRECTION:\nkeep it bold.'] }), { route: 'sjinn' });
    expect(result.chars).toBeLessThanOrEqual(SJINN_PROMPT_LIMIT);
    expect(result.dropped).toContain('otherScenes');
    expect(result.trimmed).toContain('style');
    expect(result.prompt).toContain(COMPOSITION);
    expect(result.prompt).toContain(VD.split('\n').slice(0, 2).join('\n'));
    expect(result.dropped).not.toContain('visualDirection');
    expect(result.dropped).not.toContain('composition');
  });

  it('pior caso: tudo o que é do usuário já saiu; a direção visual perde linhas de detalhe e a luz do slide encurta, nunca a paleta', () => {
    const result = buildImagePrompt(parts({
      sceneBrief: { ...brief, subject: `SUBJECT AND CASTING: ${'x '.repeat(400).trim()}.`, light: `LIGHT, TEXTURE AND GRAPHICS OF THIS SLIDE: ${'orange light, '.repeat(90).trim()}.` },
      referenceMap: `${IMAGE_PROMPT_TEXT.referenceMapHeader}\n${'- @ref: moodboard '.repeat(40)}`,
    }), { route: 'sjinn' });
    expect(result.chars).toBeLessThanOrEqual(SJINN_PROMPT_LIMIT);
    expect(result.prompt).toContain(COMPOSITION);
    expect(result.prompt.startsWith(VD.split('\n').slice(0, 2).join('\n'))).toBe(true);
    expect(result.trimmed).toEqual(expect.arrayContaining(['sceneLight']));
  });

  it('sem direção visual, a ordem e o corte de antes continuam (COMPOSITION logo depois do enquadramento)', () => {
    const result = buildImagePrompt(parts({ visualDirection: '', sceneBrief: null, framing: 'FRAMING: keep it.' }), { route: 'openai' });
    const blocks = result.prompt.split('\n\n').map(block => block.split(':')[0]);
    expect(blocks.slice(0, 4)).toEqual(['SCENE', 'HARD RULES', 'FRAMING', 'COMPOSITION (space for the slide text)']);
    expect(result.prompt).not.toContain('FORMAT AND RESTRICTIONS');
  });
});
