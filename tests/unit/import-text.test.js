import { describe, it, expect } from 'vitest';
import {
  parseImportedText,
  applyImportedTextToSlides,
  scrubLabelLeak,
  joinSlideCaptions,
  IMPORT_TEXT_VISUAL,
} from '../../src/utils/import-text.js';

const mkSlide = (n) => ({
  id: `s${n}`,
  num: n,
  title: `Old ${n}`,
  subtitle: 'old sub',
  bodyAfterImage: '',
  caption: '',
});

describe('parseImportedText', () => {
  it('separa 1 página por card e campos rotulados', () => {
    const raw = `
=== Card 1 ===
Título: Cap 1
Headline: Gancho forte
Subtítulo: Corpo do primeiro.
CTA:

=== Card 2 ===
Headline: Segundo
Subtítulo: Mais corpo.
CTA: Comenta qual dói mais

LEGENDA:
Legenda final #a #b
`;
    const parsed = parseImportedText(raw);
    expect(parsed.cards).toHaveLength(2);
    expect(parsed.cards[0]).toMatchObject({
      title: 'Gancho forte',
      subtitle: expect.stringContaining('Cap 1'),
    });
    expect(parsed.cards[0].title).not.toMatch(/Headline/i);
    expect(parsed.cards[0].subtitle).toMatch(/Corpo do primeiro/);
    expect(parsed.cards[1].bodyAfterImage).toMatch(/Comenta/);
    expect(parsed.caption).toMatch(/final #a #b/);
    expect(parsed.cards.every((c) => !/legenda/i.test(`${c.title} ${c.subtitle} ${c.bodyAfterImage}`))).toBe(true);
  });

  it('interpreta rótulos inline e guarda legenda no card (não no visual)', () => {
    const raw = `Headline Seus traços orientam o planejamento.
ÁCIDO HIALURÔNICO FACIAL Subtítulo Planejamento de volume e contorno. CTA Agende uma consulta para conhecer as possibilidades. Legenda O ácido hialurônico pode ser utilizado no preenchimento facial.`;
    const parsed = parseImportedText(raw);
    expect(parsed.cards.length).toBe(1);
    expect(parsed.cards[0].title).toBe('Seus traços orientam o planejamento.');
    expect(parsed.cards[0].subtitle).toMatch(/Planejamento de volume/);
    expect(parsed.cards[0].subtitle).not.toMatch(/Subtítulo|CTA|Legenda/i);
    expect(parsed.cards[0].bodyAfterImage).toMatch(/Agende uma consulta/);
    expect(parsed.cards[0].caption).toMatch(/ácido hialurônico/i);
    expect(parsed.caption).toBe('');
    expect(`${parsed.cards[0].title} ${parsed.cards[0].subtitle} ${parsed.cards[0].bodyAfterImage}`).not.toMatch(/Legenda/i);
  });

  it('aceita form-feed e páginas sem rótulos (1ª linha = título)', () => {
    const raw = `Abertura\nCorpo um\fSegundo card\nCorpo dois`;
    const parsed = parseImportedText(raw);
    expect(parsed.cards.length).toBeGreaterThanOrEqual(2);
    expect(parsed.cards[0].title).toBe('Abertura');
    expect(parsed.cards[0].subtitle).toMatch(/Corpo um/);
  });

  it('preserva conteúdo quando os marcadores Card 01 e Card 02 estão inline', () => {
    const parsed = parseImportedText('Card 01; Título: Abertura. Subtítulo: Primeiro argumento. Card 02; Título: Conclusão. Subtítulo: Próximo passo.');

    expect(parsed.cards).toHaveLength(2);
    expect(parsed.cards[0]).toMatchObject({ title: 'Abertura.', subtitle: 'Primeiro argumento.' });
    expect(parsed.cards[1]).toMatchObject({ title: 'Conclusão.', subtitle: 'Próximo passo.' });
    expect(parsed.cards.map((card) => `${card.title} ${card.subtitle}`).join(' ')).not.toMatch(/Card 0?[12]/i);
  });

  it('preserva o preâmbulo no primeiro card em vez de descartá-lo', () => {
    const parsed = parseImportedText('Contexto obrigatório da campanha. Card 1: Abertura. Card 2: Fecho.');

    expect(parsed.cards).toHaveLength(2);
    expect(`${parsed.cards[0].title} ${parsed.cards[0].subtitle}`).toContain('Contexto obrigatório');
    expect(`${parsed.cards[0].title} ${parsed.cards[0].subtitle}`).toContain('Abertura');
  });

  it('preserva o preâmbulo quando o primeiro card também usa Título rotulado', () => {
    const parsed = parseImportedText('Contexto obrigatório. Card 1: Título: Abertura. Card 2: Título: Fecho.');

    expect(parsed.cards).toHaveLength(2);
    expect(parsed.cards[0].title).toBe('Abertura.');
    expect(parsed.cards[0].subtitle).toContain('Contexto obrigatório.');
  });

  it.each([
    ['Post 1: 300 curtidas. Post 2: 120 curtidas.', ['post']],
    ['Ideia 1: bastidor. Ideia 2: oferta.', ['idea']],
    ['Página 1: abertura. Página 2: dados.', ['page']],
  ])('marca roteiro ambíguo para confirmação: %s', (raw, labels) => {
    const parsed = parseImportedText(raw);

    expect(parsed.cards).toHaveLength(2);
    expect(parsed.scriptConfirmation).toEqual({
      required: true,
      reason: 'ambiguous-label',
      labels,
    });
  });

  it('não exige confirmação para Card explícito', () => {
    expect(parseImportedText('Card 1: Abertura. Card 2: Fecho.').scriptConfirmation).toBeNull();
  });

  it.each(['CTA', 'Chamada', 'Legenda', 'Fecho.', 'CTA:'])('não perde bloco cujo conteúdo é apenas %s', (content) => {
    const parsed = parseImportedText(`Card 1: Abertura. Card 2: Meio. Card 3: ${content}`);

    expect(parsed.pageCount).toBe(3);
    expect(parsed.cards).toHaveLength(3);
    expect(Object.values(parsed.cards[2]).join(' ')).toContain(content.replace(':', ''));
  });

  it('preserva o Fecho do exemplo misto Card/Carrosel usado na sonda 10/11', () => {
    const parsed = parseImportedText('Card 1: Abertura. Card 2: Meio. Carrosel 03: Fecho.');

    expect(parsed.pageCount).toBe(3);
    expect(parsed.cards).toHaveLength(3);
    expect(Object.values(parsed.cards[2]).join(' ')).toContain('Fecho.');
  });

  it('limpa total, markdown, emoji e separador sem vazar para os cards', () => {
    const parsed = parseImportedText('**Card 1 de 2** 👉 Abertura.--- **Card 2/2** — Fecho.---');

    expect(parsed.cards).toHaveLength(2);
    expect(parsed.cards.map((card) => Object.values(card).join(' ')).join(' ')).not.toMatch(/de 2|\/2|\*\*|👉|---/);
  });
});

describe('scrubLabelLeak', () => {
  it('remove prefixo Headline / Subtítulo', () => {
    expect(scrubLabelLeak('Headline Seus traços')).toBe('Seus traços');
    expect(scrubLabelLeak('Subtítulo: Planejamento')).toBe('Planejamento');
  });
});

describe('applyImportedTextToSlides', () => {
  it('cria cards novos com visual premium e legenda por card', () => {
    const parsed = parseImportedText(`
---
Headline: A
Subtítulo: 1
Legenda: Nota do card A
---
Headline: B
Subtítulo: 2
---
Headline: C
Subtítulo: 3
CTA: Vá
Legenda: Nota C #tag
`);
    const { slides, created } = applyImportedTextToSlides([mkSlide(1)], parsed, mkSlide);
    expect(slides).toHaveLength(3);
    expect(created).toBe(2);
    expect(slides[2].title).toBe('C');
    expect(slides[0].photoRegion).toBe(IMPORT_TEXT_VISUAL.photoRegion);
    expect(slides[0].textShadow).toBe(false);
    expect(slides[0].titleCase).toBe('normal');
    expect(slides[0].caption).toMatch(/Nota do card A/);
    expect(slides[2].caption).toMatch(/Nota C/);
    expect(slides[2].bodyAfterImage).toMatch(/Vá/);
    expect(slides[2].showSwipeCue).toBe(false);
    expect(joinSlideCaptions(slides)).toMatch(/Nota do card A/);
    expect(joinSlideCaptions(slides)).toMatch(/Nota C/);
  });

  it('recusa roteiro ambíguo sem confirmação explícita e aplica depois dela', () => {
    const parsed = parseImportedText('Post 1: Abertura. Post 2: Fecho.');
    const original = [mkSlide(1)];

    const blocked = applyImportedTextToSlides(original, parsed, mkSlide);
    expect(blocked).toMatchObject({
      slides: original,
      created: 0,
      updated: 0,
      confirmationRequired: true,
    });

    const confirmed = applyImportedTextToSlides(
      original,
      { ...parsed, ambiguousScriptConfirmed: true },
      mkSlide,
    );
    expect(confirmed.confirmationRequired).toBeUndefined();
    expect(confirmed.slides).toHaveLength(2);
    expect(confirmed.updated).toBe(1);
    expect(confirmed.created).toBe(1);
  });
});
