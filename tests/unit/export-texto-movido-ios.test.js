import { describe, expect, it } from 'vitest';
import { vcFlattenTranslateTransforms } from '../../src/utils/export-helpers.js';

// João (28/11, iPhone): no PDF/PNG exportado sumiam o título e o subtítulo que
// ele tinha movido no card (slides 8 e 10 da Apoteose 10), e outros saíam
// cortados. Na cópia que vira arquivo, a caixa movida tem `transform: translate`
// e `overflow: hidden`; no Safari do iOS o html2canvas recorta a caixa no lugar
// sem o deslocamento e desenha o texto no lugar deslocado, então o texto cai
// fora do recorte. A cópia troca o deslocamento puro por left/top.

function fakeTree(nodes) {
  const styles = new Map(nodes.map((n) => [n.el, n.cs]));
  const root = { querySelectorAll: () => nodes.map((n) => n.el) };
  const doc = { defaultView: { getComputedStyle: (el) => styles.get(el) } };
  return { doc, root };
}
const node = (cs) => ({ el: { style: {} }, cs: { position: 'static', left: 'auto', top: 'auto', right: 'auto', bottom: 'auto', transform: 'none', ...cs } });

describe('export: caixa de texto movida', () => {
  it('deslocamento puro de caixa absoluta vira left/top', () => {
    const a = node({ position: 'absolute', left: '40px', top: '274px', transform: 'matrix(1, 0, 0, 1, -35.17, -85.7)' });
    const { doc, root } = fakeTree([a]);
    vcFlattenTranslateTransforms(doc, root);
    expect(a.el.style.transform).toBe('none');
    expect(a.el.style.left).toBe('4.83px');
    expect(a.el.style.top).toBe('188.3px');
  });

  it('caixa ancorada à direita e embaixo ajusta right/bottom', () => {
    const a = node({ position: 'absolute', right: '20px', bottom: '30px', transform: 'matrix(1, 0, 0, 1, 10, -5)' });
    const { doc, root } = fakeTree([a]);
    vcFlattenTranslateTransforms(doc, root);
    expect(a.el.style.right).toBe('10px');
    expect(a.el.style.bottom).toBe('35px');
  });

  it('caixa no fluxo passa a relativa com o deslocamento', () => {
    const a = node({ position: 'static', transform: 'matrix(1, 0, 0, 1, 34.6, -95.5)' });
    const { doc, root } = fakeTree([a]);
    vcFlattenTranslateTransforms(doc, root);
    expect(a.el.style.position).toBe('relative');
    expect(a.el.style.left).toBe('34.6px');
    expect(a.el.style.top).toBe('-95.5px');
    expect(a.el.style.transform).toBe('none');
  });

  it('relativa já deslocada soma os dois', () => {
    const a = node({ position: 'relative', left: '5px', top: '0px', transform: 'matrix(1, 0, 0, 1, 10, 20)' });
    const { doc, root } = fakeTree([a]);
    vcFlattenTranslateTransforms(doc, root);
    expect(a.el.style.left).toBe('15px');
    expect(a.el.style.top).toBe('20px');
  });

  it('escala, rotação e deslocamento zero ficam como estão', () => {
    const escala = node({ position: 'absolute', left: '0px', top: '0px', transform: 'matrix(0.5, 0, 0, 0.5, 10, 10)' });
    const giro = node({ position: 'absolute', left: '0px', top: '0px', transform: 'matrix(0.98, 0.17, -0.17, 0.98, 4, 4)' });
    const zero = node({ position: 'absolute', left: '0px', top: '0px', transform: 'matrix(1, 0, 0, 1, 0, 0)' });
    const fixo = node({ position: 'fixed', left: '0px', top: '0px', transform: 'matrix(1, 0, 0, 1, 9, 9)' });
    const { doc, root } = fakeTree([escala, giro, zero, fixo]);
    vcFlattenTranslateTransforms(doc, root);
    for (const n of [escala, giro, zero, fixo]) expect(n.el.style).toEqual({});
  });
});
