import { describe, expect, it } from 'vitest';
import {
  buildExplicitCardScriptPrompt,
  parseExplicitCardScript,
} from '../../src/utils/structured-card-script.js';

describe('parseExplicitCardScript', () => {
  it('reconhece o roteiro inline com zeros à esquerda', () => {
    const parsed = parseExplicitCardScript('Card 01; xxxx. card 02; xxxxxx');

    expect(parsed).toEqual({
      count: 2,
      preamble: '',
      blocks: [
        { number: 1, text: 'xxxx.' },
        { number: 2, text: 'xxxxxx' },
      ],
    });
  });

  it('reconhece marcadores seguintes mesmo sem pontuação ou separador', () => {
    const parsed = parseExplicitCardScript('Card 01; xxx. card 02;xxxx card 03 xxxx.');

    expect(parsed?.blocks).toEqual([
      { number: 1, text: 'xxx.' },
      { number: 2, text: 'xxxx' },
      { number: 3, text: 'xxxx.' },
    ]);
  });

  it.each([
    'Carrossel 01, Abertura. Carrossel 02, Desenvolvimento. Carrossel 03, Fecho.',
    'Carrosel 01: Abertura. Carrosel 02: Desenvolvimento. Carrosel 03: Fecho.',
    'Carossel 01; Abertura. Carossel 02; Desenvolvimento. Carossel 03; Fecho.',
    'Carosel 01; Abertura. Carosel 02; Desenvolvimento. Carosel 03; Fecho.',
    'Página 01 — Abertura. Pagina 02 — Desenvolvimento. Página 03 — Fecho.',
    'Ideia 01. Abertura. Ideia 02. Desenvolvimento. Ideia 03. Fecho.',
    'Post #01: Abertura. Post #02: Desenvolvimento. Post #03: Fecho.',
    'Postagem 01: Abertura. Postagem 02: Desenvolvimento. Postagem 03: Fecho.',
    'Bloco 01: Abertura. Bloco 02: Desenvolvimento. Bloco 03: Fecho.',
    'Tela 01: Abertura. Tela 02: Desenvolvimento. Tela 03: Fecho.',
  ])('reconhece rótulos equivalentes: %s', (source) => {
    const parsed = parseExplicitCardScript(source);

    expect(parsed?.count).toBe(3);
    expect(parsed?.blocks.map((block) => block.number)).toEqual([1, 2, 3]);
    expect(parsed?.blocks.map((block) => block.text)).toEqual([
      'Abertura.',
      'Desenvolvimento.',
      'Fecho.',
    ]);
  });

  it('aceita markdown, páginas, slides, Page e um preâmbulo', () => {
    const parsed = parseExplicitCardScript(`Siga este roteiro sem trocar a ordem.
### Página 01 — Abertura com contexto
Texto complementar.
=== Slide 02 ===
Desenvolvimento
Page 03: Encerramento`);

    expect(parsed?.preamble).toBe('Siga este roteiro sem trocar a ordem.');
    expect(parsed?.blocks).toEqual([
      { number: 1, text: 'Abertura com contexto\nTexto complementar.' },
      { number: 2, text: 'Desenvolvimento' },
      { number: 3, text: 'Encerramento' },
    ]);
  });

  it('não ativa com uma menção natural isolada', () => {
    expect(parseExplicitCardScript('Explique por que o card 2 precisa de uma imagem melhor.')).toBeNull();
    expect(parseExplicitCardScript('Card 1: esta é apenas uma referência.')).toBeNull();
    expect(parseExplicitCardScript('Compare o card 1 com o card 2 antes de decidir.')).toBeNull();
    expect(parseExplicitCardScript('Card 1 versus Card 2: qual funciona melhor?')).toBeNull();
    expect(parseExplicitCardScript('Card 1 e Card 2 são apenas exemplos.')).toBeNull();
    expect(parseExplicitCardScript('Página 1 de Página 2')).toBeNull();
  });

  it('rejeita sequência duplicada, fora de ordem, incompleta ou acima do limite', () => {
    expect(parseExplicitCardScript('Card 1: A. Card 1: B.')).toBeNull();
    expect(parseExplicitCardScript('Card 1: A. Card 3: C.')).toBeNull();
    expect(parseExplicitCardScript('Card 2: B. Card 3: C.')).toBeNull();
    expect(parseExplicitCardScript('Card 1: A. Card 2:')).toBeNull();
    expect(parseExplicitCardScript('Ideia 01: A. Ideia 03: B. Ideia 03: C.')).toBeNull();
    const tooMany = Array.from({ length: 25 }, (_, index) => `Card ${index + 1}: Texto ${index + 1}.`).join(' ');
    expect(parseExplicitCardScript(tooMany)).toBeNull();
  });
});

describe('buildExplicitCardScriptPrompt', () => {
  it('torna quantidade, ordem e fidelidade regras explícitas', () => {
    const script = parseExplicitCardScript('Card 1: Diagnóstico. Card 2: Próximo passo.');
    const prompt = buildExplicitCardScriptPrompt(script);

    expect(prompt).toContain('Gere exatamente 2 cards');
    expect(prompt).toContain('Não funda, troque, antecipe, omita nem crie cards extras');
    expect(prompt.indexOf('CARD 1\nDiagnóstico.')).toBeLessThan(prompt.indexOf('CARD 2\nPróximo passo.'));
  });
});

