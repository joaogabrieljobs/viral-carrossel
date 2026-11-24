import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readTypedText } from '../../src/utils/inline-edit-text.js';

/**
 * Imita o que o navegador faz num elemento `contentEditable`: `innerText`
 * devolve o texto como está pintado, já com o `text-transform` em vigor
 * (o do estilo do card, a menos que o próprio elemento diga outra coisa), e
 * `textContent` devolve o texto do DOM sem as quebras criadas pelo Enter.
 */
function editavel({ pintado, caixaDoEstilo = 'none', caixaInline = '' }) {
  const style = { textTransform: caixaInline };
  return {
    style,
    textContent: pintado.replace(/\n/g, ''),
    get innerText() {
      const caixa = style.textTransform || caixaDoEstilo;
      if (caixa === 'uppercase') return pintado.toUpperCase();
      if (caixa === 'lowercase') return pintado.toLowerCase();
      return pintado;
    },
  };
}

describe('GA-01: editar no card não grava a caixa do estilo', () => {
  it('estilo em MAIÚSCULAS: sair da edição sem digitar devolve o texto como estava', () => {
    const el = editavel({ pintado: 'Você está fazendo errado.', caixaDoEstilo: 'uppercase' });
    expect(readTypedText(el)).toBe('Você está fazendo errado.');
  });

  it('digitar "Novo título" num estilo de caixa alta grava "Novo título"', () => {
    const el = editavel({ pintado: 'Novo título', caixaDoEstilo: 'uppercase' });
    expect(readTypedText(el)).toBe('Novo título');
  });

  it('vale também para minúsculas e para a caixa posta no próprio elemento', () => {
    expect(readTypedText(editavel({ pintado: 'Preço Cheio', caixaDoEstilo: 'lowercase' }))).toBe('Preço Cheio');
    expect(readTypedText(editavel({ pintado: 'Preço Cheio', caixaInline: 'uppercase' }))).toBe('Preço Cheio');
  });

  it('Enter no meio continua virando quebra de linha', () => {
    const el = editavel({ pintado: 'Foco\nClaro', caixaDoEstilo: 'uppercase' });
    expect(readTypedText(el)).toBe('Foco\nClaro');
  });

  it('devolve a caixa do elemento como estava depois de ler', () => {
    const herdada = editavel({ pintado: 'Título', caixaDoEstilo: 'uppercase' });
    readTypedText(herdada);
    expect(herdada.style.textTransform).toBe('');
    const inline = editavel({ pintado: 'Título', caixaInline: 'uppercase' });
    readTypedText(inline);
    expect(inline.style.textTransform).toBe('uppercase');
  });

  it('sem `innerText` (fora do navegador) usa o texto do DOM', () => {
    expect(readTypedText({ textContent: 'Texto simples' })).toBe('Texto simples');
    expect(readTypedText(null)).toBe('');
  });

  it('o card e o quadro de apresentação leem o texto por esta função', () => {
    for (const arquivo of ['src/components/card/SlideCardInner.jsx', 'src/components/PresentationBlocks.jsx']) {
      const fonte = readFileSync(new URL(`../../${arquivo}`, import.meta.url), 'utf8');
      expect(fonte.includes('readTypedText(ref.current)'), `${arquivo} usa readTypedText`).toBe(true);
      expect(/ref\.current\?\.innerText/.test(fonte), `${arquivo} lê innerText direto`).toBe(false);
    }
  });
});
