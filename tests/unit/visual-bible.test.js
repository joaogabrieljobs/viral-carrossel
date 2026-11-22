import { describe, it, expect } from 'vitest';
import {
  buildVisualBiblePromptRules, composeSceneDirection, composeSubjectsDirection,
  normalizeVisualBible, VISUAL_BIBLE_MAX_ENTITIES,
} from '../../src/utils/visual-bible.js';

const raul = { id: 'Raul', en: 'adult man wearing a plain olive-green shirt with no pattern, seated on a simple wooden chair', never: 'flash, reflectors, objects on the wall' };
const cenario = { id: 'cenário', en: 'plain sand-colored wall with a single window on the man\'s left as the only light source', never: '' };

describe('ficha visual — forma segura ou nada', () => {
  it('normaliza id, texto e descarta o que não serve', () => {
    const r = normalizeVisualBible({ entities: [raul, cenario, { id: 'x', en: 'curto' }, null, 'texto', { id: 'raul', en: raul.en }] });
    expect(r.entities.map((e) => e.id)).toEqual(['raul', 'cenario']);
    expect(r.entities[0].never).toBe('flash, reflectors, objects on the wall');
    expect(r.entities[1].never).toBe('');
  });

  it('ausente, vazia ou inválida vira null — a geração segue como antes', () => {
    for (const raw of [undefined, null, {}, { entities: [] }, { entities: 'x' }, 'texto', { entities: [{ id: '', en: raul.en }] }]) {
      expect(normalizeVisualBible(raw)).toBeNull();
    }
  });

  it('limita quantidade e tamanho; remove quebras e caracteres de controle', () => {
    const muitas = Array.from({ length: 9 }, (_, i) => ({ id: `e${i}`, en: `${'descricao longa '.repeat(40)}\n\u0000fim` }));
    const r = normalizeVisualBible({ entities: muitas });
    expect(r.entities).toHaveLength(VISUAL_BIBLE_MAX_ENTITIES);
    for (const e of r.entities) {
      expect(e.en.length).toBeLessThanOrEqual(400);
      expect(e.en).not.toMatch(/[\n\u0000]/);
    }
  });
});

describe('ficha visual — o que chega ao gerador de imagem', () => {
  it('descreve cada entidade com seus atributos e o que nunca deve aparecer', () => {
    const texto = composeSubjectsDirection({ entities: [raul, cenario] });
    expect(texto).toMatch(/^PROJECT SUBJECTS/);
    expect(texto).toContain('- raul: adult man wearing a plain olive-green shirt');
    expect(texto).toContain('Exclude: flash, reflectors, objects on the wall.');
    expect(texto).toContain('These descriptions fix appearance only');
    expect(texto.length).toBeLessThanOrEqual(1600);
  });

  it('sem ficha não acrescenta nada', () => {
    expect(composeSubjectsDirection(null)).toBe('');
    expect(composeSubjectsDirection({ entities: [] })).toBe('');
  });

  it('a direção de cena junta ficha e enquadramento do painel', () => {
    const coluna = { canvas: { applied: true, zones: { photo: { x: 0, y: 0, w: 46, h: 100 } } } };
    const texto = composeSceneDirection({ visualBible: { entities: [raul] }, slide: coluna, fmt: 'carrossel' });
    expect(texto).toMatch(/^FRAMING: Compose for the final visible image panel[\s\S]*PROJECT SUBJECTS — /);
    expect(texto).toMatch(/central vertical third/);
    // Sem ficha ainda há enquadramento.
    expect(composeSceneDirection({ slide: {}, fmt: 'carrossel' })).toMatch(/^FRAMING: /);
  });
});

describe('ficha visual — instrução ao modelo de texto', () => {
  it('pede atributos do material e proíbe inventar', () => {
    const regras = buildVisualBiblePromptRules();
    expect(regras).toContain('visualBible');
    expect(regras).toMatch(/Preserve cor, material, forma, quantidade e roupa quando conhecidos/);
    expect(regras).toMatch(/Não deduza idade, etnia, marca, cargo, acessório, emoção ou aparência/);
    expect(regras).toMatch(/"visualBible": \{"entities": \[\]\}/);
  });
});

import { buildGenerationImageLayer, buildGenerationJsonContract } from '../../src/utils/generation-prompts.js';
import { validateCarouselDraft } from '../../src/utils/editorial-review.js';

describe('ficha visual — pedida só onde a imagem ilustra o material', () => {
  it('carrossel recebe as regras e o campo no contrato', () => {
    expect(buildGenerationImageLayer('livre', 'retrato', '', '')).toContain('visualBible — ficha de continuidade do carrossel');
    expect(buildGenerationImageLayer('livre', 'retrato', '', '', true)).toContain('visualBible — ficha de continuidade do carrossel');
    const contrato = buildGenerationJsonContract('livre', '1_2', 5);
    expect(contrato).toContain('"visualBible":{"entities":[{"id":"","en":"","never":""}]}');
  });

  it('Cultura e apresentação continuam sem a ficha', () => {
    expect(buildGenerationImageLayer('tendencia_cultura', 'tema', '', '')).not.toContain('visualBible');
    expect(buildGenerationImageLayer('apresentacao', 'tema', '', '')).not.toContain('visualBible');
    expect(buildGenerationJsonContract('tendencia_cultura', '1_2', 5)).not.toContain('visualBible');
    expect(buildGenerationJsonContract('apresentacao', '1_2', 5)).not.toContain('visualBible');
  });

  it('a regra de luz do brief deixou de ser repetida em toda query', () => {
    const regras = buildGenerationImageLayer('livre', 'pausa na cidade', '', '', true);
    // Catálogo de imagem 22/11: a luz acompanha a cena, não é copiada do brief.
    expect(regras).toMatch(/Use a luz compatível com a cena\./);
    expect(regras).not.toMatch(/luz do brief/);
  });

  it('o rascunho validado conserva a ficha; rascunho sem ficha continua válido', () => {
    const slides = Array.from({ length: 3 }, (_, i) => ({ title: `Título ${i + 1}`, subtitle: 'Apoio do card.', imageQuery: 'cena' }));
    const com = validateCarouselDraft({ slides, caption: 'Legenda.', visualBible: { entities: [raul] } }, { count: 3, presetId: 'livre', densityId: '1_2' });
    expect(normalizeVisualBible(com.visualBible).entities[0].id).toBe('raul');
    const sem = validateCarouselDraft({ slides, caption: 'Legenda.' }, { count: 3, presetId: 'livre', densityId: '1_2' });
    expect(normalizeVisualBible(sem.visualBible)).toBeNull();
    // Ficha malformada não derruba a geração.
    const ruim = validateCarouselDraft({ slides, caption: 'Legenda.', visualBible: 'texto solto' }, { count: 3, presetId: 'livre', densityId: '1_2' });
    expect(normalizeVisualBible(ruim.visualBible)).toBeNull();
  });
});
