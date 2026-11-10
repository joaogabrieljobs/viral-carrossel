import { describe, expect, it } from 'vitest';
import { parseExplicitCardScript } from '../../src/utils/structured-card-script.js';

describe('reteste 10/11: regressões do reconhecedor no b19ae26', () => {
  it('mantém o exemplo original sem pontuação antes do Card 03', () => {
    const parsed = parseExplicitCardScript('Card 01; xxx. card 02;xxxx card 03 xxxx.');
    expect(parsed?.blocks.map((block) => block.text)).toEqual(['xxx.', 'xxxx', 'xxxx.']);
    expect(parsed).toMatchObject({
      requiresConfirmation: true,
      ambiguity: { reason: 'inline-marker', labels: [] },
    });
  });

  it('mantém o roteiro misto sem pontuação antes de Post 03', () => {
    const parsed = parseExplicitCardScript(
      'Carrosel 01; Abra com a mudança. Página 02; Explique a consequência Post 03 Convide para agir.',
    );
    expect(parsed?.count).toBe(3);
    expect(parsed?.requiresConfirmation).toBe(true);
    expect(parsed?.ambiguity?.reason).toBe('inline-marker');
  });

  it('não esconde Card 00 como preâmbulo antes do Card 01', () => {
    expect(parseExplicitCardScript('Card 00: Capa. Card 01: A. Card 02: B.')).toBeNull();
    expect(parseExplicitCardScript('O relatório cita Card 00: Capa. Card 01: A. Card 02: B.')).toBeNull();
  });

  it.each([
    'Carrossel um pouco mais curto que o anterior.\nCarrossel dos concorrentes tem 5 cards, o nosso tem 8.',
    'Tela uma vez por semana.\nTela dos resultados no fim.',
  ])('não trata número por extenso sem separador como roteiro: %s', (source) => {
    expect(parseExplicitCardScript(source)).toBeNull();
  });

  it.each([
    ['Card um: Abertura. Card dois: Meio. Card tres: Fecho.', 3],
    ['Card um, Abertura. Card dois, Fecho.', 2],
    ['Card um\nAbertura\nCard dois\nFecho', 2],
    ['Card um 👉 Abertura. Card dois 👉 Fecho.', 2],
  ])('mantém número por extenso com separador explícito: %s', (source, count) => {
    expect(parseExplicitCardScript(source)?.count).toBe(count);
  });

  it('não transforma referências naturais 1, 2, 3 em blocos', () => {
    expect(parseExplicitCardScript(
      'Card 1: compare o card 2 do concorrente com o card 3 da marca.',
    )).toBeNull();
  });

  it.each([
    'Card 01: Abertura. card 03 Meio. Card 02: Fecho.',
    'Card 01: Abertura. card 02 Meio. card 02 Fecho.',
  ])('invalida marcador inline forte fora de ordem ou duplicado: %s', (source) => {
    expect(parseExplicitCardScript(source)).toBeNull();
  });

  it('continua ignorando menção fora da sequência e usa cabeçalhos reais', () => {
    const parsed = parseExplicitCardScript('Card 1: Prepare o card 3.\nCard 2: Meio.\nCard 3: Fecho.');
    expect(parsed?.blocks.map((block) => block.text)).toEqual(['Prepare o card 3.', 'Meio.', 'Fecho.']);
  });
});
