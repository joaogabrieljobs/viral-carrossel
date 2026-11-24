// Conferência de composição da apresentação pulada em silêncio (24/11/2026).
// Depois de gravar os slides gerados, o código esperava dois quadros de
// animação e lia as raízes dos slides. Quando os dois quadros rodam antes de o
// React desenhar (medido: quadro 1 a +1 ms, quadro 2 a +2 ms, render a +3 ms),
// as raízes ainda são as do documento antigo, a conferência inteira era pulada
// e `presentationQuality.renderCheckStatus` nunca era gravado.
import { describe, expect, it } from 'vitest';
import { waitForRenderedSlides } from '../../src/utils/presentation-render-review.js';

/** Tela simulada: os quadros andam sob comando e o "React" desenha num quadro escolhido. */
function screen({ commitAtFrame, msPerFrame = 1 }) {
  const generated = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  const state = { frame: 0, rendered: [{ id: 'antigo' }], roots: { antigo: { nodeName: 'DIV' } } };
  return {
    generated, state,
    options: {
      slides: generated,
      nextFrame: async () => {
        state.frame += 1;
        if (state.frame === commitAtFrame) {
          state.rendered = generated;
          state.roots = Object.fromEntries(generated.map((slide) => [slide.id, { id: slide.id }]));
        }
      },
      getRoot: (id) => state.roots[id],
      isCommitted: () => state.rendered === generated,
      now: () => state.frame * msPerFrame,
    },
  };
}

describe('conferência de composição espera o desenho dos slides gerados', () => {
  it('dois quadros antes do render (a sequência que perdia a conferência) não bastam: espera o terceiro', async () => {
    const { options, state, generated } = screen({ commitAtFrame: 3 });
    const roots = await waitForRenderedSlides(options);
    expect(state.frame).toBe(3);
    expect(roots).toEqual(generated.map((slide) => ({ id: slide.id })));
  });

  it('render já feito no primeiro quadro: mantém os dois quadros para o layout assentar', async () => {
    const { options, state } = screen({ commitAtFrame: 1 });
    expect(await waitForRenderedSlides(options)).toHaveLength(3);
    expect(state.frame).toBe(2);
  });

  it('raízes presentes mas de um render anterior (mesmos ids) não contam como desenhadas', async () => {
    const { options, state, generated } = screen({ commitAtFrame: 4 });
    // Reparo de texto: os ids não mudam, só o conteúdo. As raízes já existem.
    state.roots = Object.fromEntries(generated.map((slide) => [slide.id, { id: slide.id, antigo: true }]));
    const roots = await waitForRenderedSlides(options);
    expect(state.frame).toBe(4);
    expect(roots.some((root) => root.antigo)).toBe(false);
  });

  it('se os slides nunca forem desenhados devolve null, para o chamador registrar em vez de pular', async () => {
    const { options, state } = screen({ commitAtFrame: Infinity, msPerFrame: 16 });
    expect(await waitForRenderedSlides({ ...options, timeoutMs: 3_000 })).toBeNull();
    expect(state.frame * 16).toBeGreaterThanOrEqual(3_000);
  });

  it('quadros muito rápidos não encerram a espera antes do prazo', async () => {
    // Em navegador sem limite de quadros, 240 quadros passam em poucos ms.
    const { options, state } = screen({ commitAtFrame: 1_500, msPerFrame: 1 });
    expect(await waitForRenderedSlides({ ...options, timeoutMs: 3_000 })).toHaveLength(3);
    expect(state.frame).toBe(1_500);
  });
});
