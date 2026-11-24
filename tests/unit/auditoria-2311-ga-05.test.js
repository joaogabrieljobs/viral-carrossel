import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as viewer from '../../src/components/card/FullscreenViewer.jsx';

// O ambiente de teste é node (sem DOM): a regra do gesto e das setas é uma
// função pura, testada aqui com nós de mentira; a ligação ao componente é
// conferida no código-fonte, como em dialog-focus-trap.test.js.
const no = (tagName, parentElement = null, extra = {}) => ({ tagName, parentElement, ...extra });
const raiz = no('DIV');
const barraDeAjustes = no('DIV', raiz);
const controleBrilho = no('INPUT', no('LABEL', barraDeAjustes), { type: 'range' });
const botaoMenos = no('BUTTON', barraDeAjustes);
const legenda = no('TEXTAREA', no('DIV', raiz));
const card = no('DIV', no('DIV', raiz));

describe('GA-05: tela cheia não troca de slide com gesto ou seta que pertence a um controle', () => {
  it('controle de ajuste e caixa de legenda ficam com o próprio arrasto e as próprias setas', () => {
    const { fullscreenTargetKeepsOwnInput } = viewer;
    expect(typeof fullscreenTargetKeepsOwnInput).toBe('function');
    expect(fullscreenTargetKeepsOwnInput(controleBrilho)).toBe(true);
    expect(fullscreenTargetKeepsOwnInput(legenda)).toBe(true);
    expect(fullscreenTargetKeepsOwnInput(no('SELECT', raiz))).toBe(true);
    expect(fullscreenTargetKeepsOwnInput(no('SPAN', no('DIV', raiz, { isContentEditable: true })))).toBe(true);
    expect(fullscreenTargetKeepsOwnInput(card)).toBe(false);
    expect(fullscreenTargetKeepsOwnInput(botaoMenos)).toBe(false);
    expect(fullscreenTargetKeepsOwnInput(raiz)).toBe(false);
    expect(fullscreenTargetKeepsOwnInput(null)).toBe(false);
  });

  it('arrastar um controle de ponta a ponta não troca de slide', () => {
    const { fullscreenSwipeStep, fullscreenTargetKeepsOwnInput } = viewer;
    for (const dx of [-320, -51, 51, 320]) {
      expect(fullscreenSwipeStep({ dx, dy: 4, startedOnControl: fullscreenTargetKeepsOwnInput(controleBrilho) })).toBe(0);
      expect(fullscreenSwipeStep({ dx, dy: 4, startedOnControl: fullscreenTargetKeepsOwnInput(legenda) })).toBe(0);
    }
  });

  it('fora dos controles o gesto continua trocando de slide', () => {
    const { fullscreenSwipeStep, fullscreenTargetKeepsOwnInput } = viewer;
    const fora = fullscreenTargetKeepsOwnInput(card);
    expect(fullscreenSwipeStep({ dx: -120, dy: 10, startedOnControl: fora })).toBe(1);
    expect(fullscreenSwipeStep({ dx: 120, dy: -10, startedOnControl: fora })).toBe(-1);
    // Curto demais ou mais vertical que horizontal: não é troca de slide.
    expect(fullscreenSwipeStep({ dx: -50, dy: 0, startedOnControl: fora })).toBe(0);
    expect(fullscreenSwipeStep({ dx: -120, dy: 200, startedOnControl: fora })).toBe(0);
  });

  it('com o foco num controle, ← e → ficam com o controle; fora dele trocam de slide', () => {
    const { fullscreenArrowStep } = viewer;
    expect(fullscreenArrowStep({ key: 'ArrowRight', target: controleBrilho, captionOpen: false })).toBe(0);
    expect(fullscreenArrowStep({ key: 'ArrowLeft', target: controleBrilho, captionOpen: false })).toBe(0);
    expect(fullscreenArrowStep({ key: 'ArrowRight', target: raiz, captionOpen: false })).toBe(1);
    expect(fullscreenArrowStep({ key: 'ArrowLeft', target: botaoMenos, captionOpen: false })).toBe(-1);
    // Legenda aberta continua sem trocar de slide; outras teclas não são navegação.
    expect(fullscreenArrowStep({ key: 'ArrowRight', target: raiz, captionOpen: true })).toBe(0);
    expect(fullscreenArrowStep({ key: 'ArrowUp', target: raiz, captionOpen: false })).toBe(0);
    expect(fullscreenArrowStep({ key: 'a', target: raiz, captionOpen: false })).toBe(0);
  });

  it('o visualizador usa a regra no teclado e no toque, e só cancela a tecla quando troca de slide', () => {
    const fonte = readFileSync(new URL('../../src/components/card/FullscreenViewer.jsx', import.meta.url), 'utf8');
    expect(fonte).toMatch(/const step = fullscreenArrowStep\(\{ key: e\.key, target: e\.target, captionOpen \}\);\s*if \(step\) \{ e\.preventDefault\(\);/);
    expect(fonte).toMatch(/onControl: fullscreenTargetKeepsOwnInput\(e\.target\)/);
    expect(fonte).toMatch(/fullscreenSwipeStep\(\{ dx, dy, startedOnControl: touchRef\.current\.onControl \}\)/);
    // A regra antiga (toda seta troca de slide) não fica ao lado da nova.
    expect(fonte).not.toMatch(/e\.key === 'ArrowLeft' && !captionOpen/);
    expect(fonte).not.toMatch(/Math\.abs\(dx\) > 50 && Math\.abs\(dx\) > Math\.abs\(dy\)\) \{/);
  });
});
