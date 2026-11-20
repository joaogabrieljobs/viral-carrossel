import { describe, expect, it } from 'vitest';
import { buildNarrativeModeSequence, narrativeMiddleBeats, NARRATIVE_SEQUENCES } from '../../src/utils/narrative-sequence.js';
import { GEN_MODES } from '../../src/utils/generation-prompts.js';

// MF-06: com o mesmo briefing factual, "Explicar com autoridade", "Falar da
// dor", "Contar uma história" e "Ir a fundo" devolviam a mesma sequência (um
// card por fato, na ordem do briefing). Cada modo agora leva ao prompt uma
// função explícita por posição.
const funcoes = (modeId, count) => buildNarrativeModeSequence(modeId, 'livre', count)
  .split('\n').filter(line => /^\d+\. /.test(line)).map(line => line.replace(/^\d+\. /, '').split(' — ')[0]);

describe('roteiro card a card por modo narrativo', () => {
  it('cobre todos os modos com arco (todos menos "Seguir meu pedido")', () => {
    for (const mode of GEN_MODES) {
      if (mode.id === 'none') expect(buildNarrativeModeSequence('none', 'livre', 7)).toBe('');
      else expect(NARRATIVE_SEQUENCES[mode.id], mode.id).toBeTruthy();
    }
  });

  it.each([3, 5, 7, 10, 12])('dá exatamente uma função para cada um dos %i cards', (count) => {
    for (const id of Object.keys(NARRATIVE_SEQUENCES)) {
      const lines = funcoes(id, count);
      expect(lines, id).toHaveLength(count);
    }
  });

  it('modos diferentes pedem sequências diferentes para o mesmo número de cards', () => {
    const sequencias = Object.keys(NARRATIVE_SEQUENCES).map(id => funcoes(id, 7).join(' > '));
    expect(new Set(sequencias).size).toBe(sequencias.length);
  });

  it('cada modo segue o arco que a tela promete', () => {
    expect(funcoes('pain', 7)).toEqual(['IDENTIFICAÇÃO', 'VALIDAÇÃO', 'RAIZ', 'O QUE NÃO RESOLVE', 'SAÍDA', 'COMO FUNCIONA', 'CONVITE']);
    expect(funcoes('storytelling', 7)).toEqual(['CENA', 'CONTEXTO', 'DESENVOLVIMENTO', 'VIRADA', 'CONSEQUÊNCIA', 'SIGNIFICADO', 'DESFECHO']);
    expect(funcoes('editorial', 7)[0]).toBe('TESE');
    expect(funcoes('deep', 7)[0]).toBe('PERGUNTA');
    expect(funcoes('how_to', 6)).toEqual(['PROMESSA', 'PASSO 1', 'PASSO 2', 'PASSO 3', 'PASSO 4', 'SÍNTESE']);
  });

  it('com poucos cards preserva a abertura e o fecho do argumento', () => {
    expect(narrativeMiddleBeats('pain', 3).map(b => b.split(' — ')[0])).toEqual(['VALIDAÇÃO', 'RAIZ', 'SAÍDA']);
    expect(narrativeMiddleBeats('viral', 2).map(b => b.split(' — ')[0])).toEqual(['BUILD-UP', 'PAYOFF']);
    expect(narrativeMiddleBeats('editorial', 1).map(b => b.split(' — ')[0])).toEqual(['CONSEQUÊNCIA']);
  });

  it('carrossel longo repete a função de desenvolvimento antes do fecho do miolo', () => {
    const beats = narrativeMiddleBeats('editorial', 8).map(b => b.split(' — ')[0]);
    expect(beats.at(-1)).toBe('CONSEQUÊNCIA');
    expect(beats.filter(b => b === 'EVIDÊNCIA').length).toBeGreaterThan(1);
  });

  it('manda distribuir os fatos pelas funções, sem um card por fato nem fato novo', () => {
    const bloco = buildNarrativeModeSequence('storytelling', 'livre', 7);
    expect(bloco).toContain('não siga a ordem em que os fatos aparecem no briefing');
    expect(bloco).toContain('sem criar número, prazo, depoimento');
  });

  it('pacotes com arco próprio e carrosséis curtos demais não recebem roteiro', () => {
    expect(buildNarrativeModeSequence('editorial', 'apresentacao', 8)).toBe('');
    expect(buildNarrativeModeSequence('editorial', 'tendencia_cultura', 8)).toBe('');
    expect(buildNarrativeModeSequence('editorial', 'livre', 2)).toBe('');
  });
});

describe('campo interno "funcao"', () => {
  it('o roteiro pede a função por card e a validação a descarta do card', async () => {
    const { validateCarouselDraft } = await import('../../src/utils/editorial-review.js');
    expect(buildNarrativeModeSequence('pain', 'livre', 5)).toContain('"funcao"');
    const draft = validateCarouselDraft({ caption: '', slides: [
      { funcao: 'IDENTIFICAÇÃO', title: 'Um', subtitle: 'a', imageQuery: '' },
      { funcao: 'VALIDAÇÃO', title: 'Dois', subtitle: 'b', imageQuery: '' },
      { funcao: 'CONVITE', title: 'Três', subtitle: 'c', imageQuery: '' },
    ] }, { count: 3, presetId: 'livre', densityId: '1_1', narrativeMode: 'pain' });
    expect(draft.slides.every(slide => !('funcao' in slide))).toBe(true);
    expect(draft.slides.map(slide => slide.title)).toEqual(['Um', 'Dois', 'Três']);
  });
});
