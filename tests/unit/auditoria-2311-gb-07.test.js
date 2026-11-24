import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as presentation from '../../src/utils/presentation.js';

// Auditoria 23/11 (GB-07): "Outro" aceitava de 1 a 24 slides na apresentação,
// o resumo mostrava 3 slides e 3 créditos, e a geração subia para 5 sem avisar.
// No Criar rápido, valor fora da faixa ficava no campo e era ignorado.
const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

describe('auditoria 23/11 GB-07: quantidade personalizada respeita o que a geração faz', () => {
  it('apresentação: a faixa é a mesma da geração', () => {
    expect(presentation.customCountLimits(true)).toEqual({ min: presentation.PRESENTATION_SLIDE_LIMITS.min, max: presentation.PRESENTATION_SLIDE_LIMITS.max });
    for (const n of [5, 12, 24]) {
      expect(presentation.customCountIssue(String(n), { isPresentation: true })).toBe('');
      expect(presentation.clampPresentationSlideCount(n)).toBe(n);
    }
  });

  it('apresentação: 3 slides mostra o mínimo em vez de virar 5 em silêncio', () => {
    expect(presentation.customCountIssue('3', { isPresentation: true })).toMatch(/mínimo 5 slides/);
    expect(presentation.customCountIssue(1, { isPresentation: true })).toMatch(/mínimo 5 slides/);
    expect(presentation.customCountIssue('30', { isPresentation: true })).toMatch(/máximo é 24 slides/);
  });

  it('carrossel: de 1 a 24; 0 e 30 mostram erro', () => {
    expect(presentation.customCountLimits(false)).toEqual({ min: 1, max: 24 });
    expect(presentation.customCountIssue('1')).toBe('');
    expect(presentation.customCountIssue('24')).toBe('');
    expect(presentation.customCountIssue('30')).toMatch(/máximo é 24 cards/);
    expect(presentation.customCountIssue('0')).toMatch(/mínimo é 1 card/);
  });

  it('campo vazio não é erro; texto que não é número inteiro é', () => {
    expect(presentation.customCountIssue('')).toBe('');
    expect(presentation.customCountIssue(null)).toBe('');
    expect(presentation.customCountIssue('2.5', { isPresentation: false })).toMatch(/número inteiro/);
  });

  it.each([
    ['assistente', 'src/components/panels/GenerateModal.jsx'],
    ['Criar rápido', 'src/components/panels/CriarRapidoHome.jsx'],
  ])('%s valida o campo com a mesma regra e não promete "de 1 a 24" fixo', (_name, path) => {
    const source = read(path);
    expect(source).toMatch(/customCountIssue\(/);
    expect(source).toMatch(/customCountLimits\(/);
    expect(source).not.toMatch(/entre 1 e 24|Digite de 1 a|min=\{1\}/);
  });
});
