// Auditoria 2026-09-15 — H8 (prompt SJinn truncado), L2 (cascatas ⊆ config).
import { describe, it, expect } from 'vitest';
import { buildGptImageFullPrompt, planImagePrompt, OPENAI_IMAGE_MODELS, ZAI_FALLBACK_MODELS } from '../../src/utils/ai-client.js';
import { IMAGE_PROVIDERS, TEXT_PROVIDERS } from '../../src/config/ai-providers.js';

describe('H8 — prompt de imagem do plano cabe em 4000 chars sem perder o essencial', () => {
  it('estilo do projeto e regras fixas ficam inteiros no pedido do plano', () => {
    const extra = 'B'.repeat(2000);
    const full = buildGptImageFullPrompt('moonrise over a quiet city', null, extra, { route: 'sjinn' });
    expect(full.length).toBeLessThanOrEqual(4000);
    expect(full.startsWith('SCENE: moonrise over a quiet city\n\nHARD RULES: No lettering')).toBe(true);
    expect(full).toContain(`PROJECT OR SLIDE STYLE: Apply the requested medium, palette, materials and lighting below. Use natural subject colours unless the project specifies otherwise.\n${extra}\nCANVAS:`);
  });
});

describe('L2 — cascatas de modelos só citam modelos conhecidos', () => {
  it('ZAI_FALLBACK_MODELS ⊆ TEXT_PROVIDERS.zai.models', () => {
    const known = new Set(TEXT_PROVIDERS.zai.models.map((m) => m.id));
    for (const id of ZAI_FALLBACK_MODELS) expect(known.has(id), id).toBe(true);
  });
  it('OPENAI_IMAGE_MODELS ⊆ IMAGE_PROVIDERS.openai.models ∪ legado explícito', () => {
    const known = new Set([...IMAGE_PROVIDERS.openai.models.map((m) => m.id), 'gpt-image-1', 'dall-e-3']);
    for (const m of OPENAI_IMAGE_MODELS) expect(known.has(m.name), m.name).toBe(true);
  });
});

describe('cena do card — ficha visual e enquadramento no prompt de imagem', () => {
  const ficha = 'PROJECT SUBJECTS: Apply the following visible traits...\n- raul: adult man wearing a plain olive-green shirt.';
  const coluna = 'FRAMING: Compose for the final visible image panel. The panel is a tall, narrow column.';

  it('sem direção estruturada o pedido traz cena, regras fixas e o enquadramento-base', () => {
    const base = buildGptImageFullPrompt('quiet city', null, '', {});
    expect(base).toMatch(/^SCENE: quiet city\n\nHARD RULES: [^\n]+\n\nFRAMING: Compose for the final visible image panel\./);
    expect(buildGptImageFullPrompt('quiet city', null, '   ', {})).toBe(base);
    expect(buildGptImageFullPrompt('quiet city', null, {}, {})).toBe(base);
  });

  it('ficha e enquadramento do painel entram depois das regras fixas, em todas as rotas, sem remover nada', () => {
    for (const opts of [{ route: 'openai', model: 'gpt-image-2' }, { route: 'sjinn' }, { route: 'zai' }, { route: 'openai', model: 'gpt-image-2', withReference: true }]) {
      const sem = buildGptImageFullPrompt('quiet city', null, { framing: coluna }, opts);
      const com = buildGptImageFullPrompt('quiet city', null, { framing: coluna, subjects: ficha }, opts);
      expect(com).toMatch(/^SCENE: quiet city\n\nHARD RULES: [^\n]+\n\nFRAMING: [^\n]+tall, narrow column\./);
      expect(com).toContain(`\n\n${ficha}\n\n`);
      expect(com.replace(`\n\n${ficha}`, '')).toBe(sem);
    }
  });

  it('a ficha não troca a linguagem visual: sem estilo explícito, a direção de arte padrão continua', () => {
    const com = buildGptImageFullPrompt('quiet city', null, { subjects: ficha }, {});
    expect(com).toContain('DEFAULT ART DIRECTION: Generate a realistic, natural image');
    expect(com).not.toContain('PROJECT OR SLIDE STYLE');
  });

  it('no teto de 4000 do plano as regras fixas, a ficha e o estilo ficam; a bíblia longa cede em fim de frase', () => {
    const estilo = `PROJECT VISUAL STYLE BIBLE:\n${'Brand sentence that is complete. '.repeat(120)}`.trim();
    const fichaLonga = `${ficha}\n${Array.from({ length: 4 }, (_, i) => `- extra${i}: ${'trait '.repeat(40).trim()}.`).join('\n')}`;
    const plano = planImagePrompt('moonrise over a quiet city', null, { styleBody: estilo, subjects: fichaLonga }, { route: 'sjinn' });
    expect(plano.chars).toBeLessThanOrEqual(4000);
    expect(plano.prompt).toContain('HARD RULES: No lettering, captions, logos or watermarks anywhere in the image.');
    expect(plano.prompt).toContain(fichaLonga);
    expect(plano.prompt).toContain('PROJECT OR SLIDE STYLE');
    expect(plano.trimmed).toEqual(['style']);
    expect(plano.prompt).toMatch(/Brand sentence that is complete\.\nCANVAS: /);
  });

  it('sem estilo explícito, o que não cabe em 4000 sai inteiro: a estética padrão primeiro', () => {
    const fichaLonga = `${ficha}\n${Array.from({ length: 11 }, (_, i) => `- extra${i}: ${'trait '.repeat(45).trim()}.`).join('\n')}`;
    const plano = planImagePrompt('moonrise', null, { subjects: fichaLonga }, { route: 'sjinn' });
    expect(plano.chars).toBeLessThanOrEqual(4000);
    expect(plano.prompt).toContain(fichaLonga);
    expect(plano.dropped).toEqual(['defaultArtDirection']);
    expect(plano.prompt).not.toContain('DEFAULT ART DIRECTION');
    expect(plano.prompt).toContain('For a carousel with no specified medium, use editorial photography.');
  });
});
