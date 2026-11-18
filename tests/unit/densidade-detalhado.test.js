import { describe, it, expect } from 'vitest';
import { buildSocialTextLimitsPrompt } from '../../src/utils/social-generation.js';

// Uso real de 18/11/2026: com "Detalhado" escolhido, um card saiu com título e
// uma linha de 51 caracteres. O contrato de texto dizia, para toda densidade,
// "São TETOS, nunca metas mínimas ... não preencha espaço": o modelo obedecia e
// escrevia o mínimo. "Detalhado" não pedia desenvolvimento em lugar nenhum.
describe('contrato de texto por densidade', () => {
  it('Detalhado pede desenvolvimento nos cards de miolo, com faixa mínima', () => {
    const txt = buildSocialTextLimitsPrompt({ densityId: '1_1' });
    expect(txt).toContain('subtitle: até 160 caracteres');
    expect(txt).toContain('juntos: até 300 caracteres');
    expect(txt).not.toContain('nunca metas mínimas');
    expect(txt).toMatch(/DETALHADO/);
    expect(txt).toMatch(/subtitle com duas frases completas, de 100 a 160 caracteres/);
    expect(txt).toMatch(/bodyAfterImage[^.]*de 80 a 140 caracteres/);
    // Continua proibido encher: cada frase precisa trazer informação do material.
    expect(txt).toMatch(/informação nova/);
    expect(txt).toMatch(/Não invente/);
  });

  it('as outras densidades continuam com tetos e sem mínimo', () => {
    for (const densityId of ['1_2', '1_3', '1_4', '1_5']) {
      const txt = buildSocialTextLimitsPrompt({ densityId });
      expect(txt, densityId).toContain('São TETOS, nunca metas mínimas');
      expect(txt, densityId).not.toMatch(/DETALHADO/);
    }
  });

  it('sem densidade informada vale o contrato de tetos, não o de desenvolvimento', () => {
    const txt = buildSocialTextLimitsPrompt({});
    expect(txt).toContain('São TETOS, nunca metas mínimas');
  });
});
