import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { collectExportQualityWarnings, exportQualityError } from '../../src/hooks/useExport.js';

// João (28/11, iPhone): "Tire esse bloqueio de exportar. Diz que tem erro onde
// não tem." A conferência automática acusou "conteúdo fora da área do slide" num
// slide inteiro na tela. Ela continua rodando, mas só registra: nunca impede o
// download nem pergunta antes.
describe('exportar sem trava da conferência', () => {
  it('aviso de qualidade vira registro e não interrompe', () => {
    const avisos = collectExportQualityWarnings(
      () => { throw exportQualityError('Slide 9: Há conteúdo fora da área do slide.'); },
      () => { throw exportQualityError('Card 2: o texto pode não caber.'); },
      () => {},
    );
    expect(avisos).toEqual(['Slide 9: Há conteúdo fora da área do slide.', 'Card 2: o texto pode não caber.']);
  });

  it('erro que não é da conferência continua aparecendo', () => {
    expect(() => collectExportQualityWarnings(() => { throw new Error('falhou a fonte'); })).toThrow('falhou a fonte');
  });

  it('o exportar não pergunta nem recusa por causa da conferência', () => {
    const fonte = readFileSync(new URL('../../src/hooks/useExport.js', import.meta.url), 'utf8');
    const corpo = fonte.slice(fonte.indexOf('const waitForRender'), fonte.indexOf('const beginExport'));
    expect(corpo).toContain('collectExportQualityWarnings');
    expect(corpo).not.toContain('window.confirm');
    expect(corpo).not.toMatch(/^\s*(resolveOverflowExport|if \(isPresentation\) assertPresentationExportQuality)/m);
  });
});
