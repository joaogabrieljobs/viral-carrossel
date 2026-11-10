import { describe, expect, it } from 'vitest';
import {
  buildExplicitCardScriptPrompt,
  canAutoApplyExplicitCardScript,
  parseExplicitCardScript,
} from '../../src/utils/structured-card-script.js';

describe('parseExplicitCardScript', () => {
  it('reconhece o roteiro inline com zeros à esquerda', () => {
    const parsed = parseExplicitCardScript('Card 01; xxxx. card 02; xxxxxx');

    expect(parsed).toMatchObject({
      count: 2,
      preamble: '',
      blocks: [
        { number: 1, text: 'xxxx.' },
        { number: 2, text: 'xxxxxx' },
      ],
      requiresConfirmation: false,
    });
  });

  it('reconhece marcadores inline quando cada bloco tem uma fronteira explícita', () => {
    const parsed = parseExplicitCardScript('Card 01; xxx. card 02;xxxx. card 03 xxxx.');

    expect(parsed?.blocks).toEqual([
      { number: 1, text: 'xxx.' },
      { number: 2, text: 'xxxx.' },
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
    expect(parsed?.requiresConfirmation).toBe(true);
  });

  it.each([
    ['Post 1: dado A. Post 2: dado B.', 'post'],
    ['Ideia 1: reels. Ideia 2: live.', 'idea'],
    ['Página 1: capa. Página 2: relatório.', 'page'],
  ])('classifica rótulos ambíguos sem perder a prévia: %s', (source, kind) => {
    const parsed = parseExplicitCardScript(source);
    expect(parsed).toMatchObject({
      count: 2,
      requiresConfirmation: true,
      ambiguity: { reason: 'ambiguous-label', labels: [kind] },
    });
    expect(canAutoApplyExplicitCardScript(parsed)).toBe(false);
  });

  it.each([
    'Post 1 contra o Post 2: qual vendeu mais?',
    'Página 1 de Página 2',
    'Card 1.5: nota. Card 2.5: outra nota.',
  ])('não confunde comparação, referência ou decimal com roteiro: %s', (source) => {
    expect(parseExplicitCardScript(source)).toBeNull();
  });

  it('ignora menções internas e mantém a sequência que realmente abre blocos', () => {
    const parsed = parseExplicitCardScript(`Card 1: Prepare o card 3 com antecedência.
Card 2: Neste card 2 mostramos o contexto.
Card 3: Encerramento.`);

    expect(parsed?.blocks).toEqual([
      { number: 1, text: 'Prepare o card 3 com antecedência.' },
      { number: 2, text: 'Neste card 2 mostramos o contexto.' },
      { number: 3, text: 'Encerramento.' },
    ]);
  });

  it('ignora a menção ao próximo card no texto e usa o cabeçalho real', () => {
    const parsed = parseExplicitCardScript(`Card 1: Veja o card 2 antes de continuar.
Card 2: Este é o segundo bloco real.`);

    expect(parsed?.blocks).toEqual([
      { number: 1, text: 'Veja o card 2 antes de continuar.' },
      { number: 2, text: 'Este é o segundo bloco real.' },
    ]);
  });

  it.each([
    'Card nº 1: Abertura. Card nº 2: Fecho.',
    'Card um: Abertura. Card dois: Fecho.',
    'Story 1: Abertura. Story 2: Fecho.',
    'Cartão 1: Abertura. Cartão 2: Fecho.',
    'Cartões 1: Abertura. Cartões 2: Fecho.',
    'Diapositiva 1: Apertura. Diapositiva 2: Cierre.',
  ])('aceita variantes legítimas: %s', (source) => {
    expect(parseExplicitCardScript(source)?.count).toBe(2);
  });

  it.each([
    ['card-n-ordinal', 'Card nº 1: Abertura. Card nº 2: Meio. Card nº 3: Fecho.'],
    ['card-hifen-numero', 'Card-1: Abertura. Card-2: Meio. Card-3: Fecho.'],
    ['slide-1-de-5', 'Slide 1 de 5: Um. Slide 2 de 5: Dois. Slide 3 de 5: Três. Slide 4 de 5: Quatro. Slide 5 de 5: Cinco.'],
    ['slide-1-barra-3', 'Slide 1/3: Abertura. Slide 2/3: Meio. Slide 3/3: Fecho.'],
    ['espanhol-diapositiva', 'Diapositiva 1: Apertura. Diapositiva 2: Medio. Diapositiva 3: Cierre.'],
    ['story-label', 'Story 1: Open. Story 2: Middle. Story 3: Close.'],
    ['mencao-interna-quebra', 'Card 1: Prepare o card 3. Card 2: Meio. Card 3: Fecho.'],
    ['autorreferencia-no-bloco', 'Card 1: Abertura. Card 2: Neste card 2 mostramos algo. Card 3: Fecho.'],
    ['markdown-negrito', '**Card 1** — Abertura. **Card 2** — Meio. **Card 3** — Fecho.'],
    ['separador-linha', 'Card 1: Abertura.\n---\nCard 2: Meio.\n---\nCard 3: Fecho.\n---'],
  ])('fecha caso nominal da sonda 10/11: %s', (_caseName, source) => {
    const parsed = parseExplicitCardScript(source);

    expect(parsed?.count).toBeGreaterThanOrEqual(3);
    expect(parsed?.blocks).toHaveLength(parsed.count);
    expect(parsed?.blocks.every((block) => block.text && !block.text.includes('---'))).toBe(true);
  });

  it('recusa roteiro incompleto ou inconsistente quando o marcador declara um total', () => {
    expect(parseExplicitCardScript('Slide 1 de 5: Um. Slide 2 de 5: Dois.')).toBeNull();
    expect(parseExplicitCardScript('Slide 1/3: Um. Slide 2/4: Dois. Slide 3/3: Três.')).toBeNull();
  });

  it.each([
    ['um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze'],
    ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'],
  ])('reconhece números por extenso até doze: %s', (...words) => {
    const source = words.map((word, index) => `Card ${word}: Texto ${index + 1}.`).join(' ');
    expect(parseExplicitCardScript(source)?.count).toBe(12);
  });

  it.each([
    ['Slide 1 de 2: Abertura. Slide 2 de 2: Fecho.', ['Abertura.', 'Fecho.']],
    ['Slide 1/2: Abertura. Slide 2/2: Fecho.', ['Abertura.', 'Fecho.']],
    ['**Card 1** 👉 Abertura. **Card 2** 👉 Fecho.---', ['Abertura.', 'Fecho.']],
  ])('remove totais e resíduos dos rótulos: %s', (source, expected) => {
    expect(parseExplicitCardScript(source)?.blocks.map((block) => block.text)).toEqual(expected);
  });

  it('preserva emoji de conteúdo depois da pontuação e remove emoji usado como separador', () => {
    const parsed = parseExplicitCardScript('Card 1: 🔥 Promoção. Card 2 👉 Prova.');
    expect(parsed?.blocks.map((block) => block.text)).toEqual(['🔥 Promoção.', 'Prova.']);
  });

  it('remove markdown e separadores em linhas diferentes', () => {
    const parsed = parseExplicitCardScript(`Card 1 de 2: **A**
---
Card 2/2: **B**
---`);
    expect(parsed?.blocks.map((block) => block.text)).toEqual(['A', 'B']);
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
    expect(parseExplicitCardScript('Card 1: A. Card 1: B. Card 2: C.')).toBeNull();
    expect(parseExplicitCardScript('Card 1: A. Card 3: C.')).toBeNull();
    expect(parseExplicitCardScript('Card 1: A. Card 1.5: transição. Card 2: B.')).toBeNull();
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

