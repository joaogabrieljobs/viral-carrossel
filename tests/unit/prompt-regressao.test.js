// Task 09 — tripwire dos ReferenceErrors de 2026-08-07 (audit-produto §crítico 1-2).
// generateCaption usava ${capRules} e refineAll usava ${voiceBulk} sem declarar —
// quebrava gerar legenda e refinar todos em produção. Se alguém remover a
// declaração de novo, este teste quebra antes do deploy.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const src = readFileSync(
  fileURLToPath(new URL('../../ViralCarrossel.jsx', import.meta.url)),
  'utf8',
);

describe('regressão capRules / voiceBulk (ViralCarrossel.jsx)', () => {
  for (const nome of ['capRules', 'voiceBulk']) {
    it(`\${${nome}} só é usado depois de "const ${nome} ="`, () => {
      const uso = src.indexOf('${' + nome + '}');
      const decl = src.indexOf(`const ${nome} =`);
      expect(uso, `uso de \${${nome}} sumiu — teste desatualizado?`).toBeGreaterThan(-1);
      expect(decl, `declaração de ${nome} removida — gerar legenda/refinar todos quebram em runtime`).toBeGreaterThan(-1);
      expect(decl).toBeLessThan(uso);
    });
  }
});
