import { describe, expect, it } from 'vitest';
import { buildGenerationImageLayer } from '../../src/utils/generation-prompts.js';

describe('direção fotográfica do preset no prompt realmente usado pela geração', () => {
  it.each(['auto', 'aula_workshop', 'pitch'])('leva a família Luxo ao caminho %s sem perder a regra factual', (path) => {
    const prompt = buildGenerationImageLayer('apresentacao', 'Ateliê de cerâmica', '', '', false, path, 'presentation_premium_dark');
    expect(prompt).toContain('DIREÇÃO FOTOGRÁFICA — LUXO DISCRETO');
    expect(prompt).toContain('cerâmica');
    expect(prompt).toContain('Não inclua texto, letras, números, gráficos nem logotipos');
    if (path === 'pitch') expect(prompt).toContain('Não peça à IA para inventar screenshot');
  });

  it('não altera o prompt de carrossel quando existe um preset de apresentação no estado anterior', () => {
    const before = buildGenerationImageLayer('livre', 'Ateliê', '', '', false, 'auto');
    const after = buildGenerationImageLayer('livre', 'Ateliê', '', '', false, 'auto', 'presentation_premium_dark');
    expect(after).toBe(before);
  });
});
