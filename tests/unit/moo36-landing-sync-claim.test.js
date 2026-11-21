import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import OnboardingLandingProduct from '../../src/components/OnboardingLandingProduct.jsx';

// MOO-36: a landing prometia "no desktop ou no celular, a versão mais recente
// continua no mesmo projeto" sem ressalva; no grátis o projeto fica só no aparelho.
describe('MOO-36 — promessa de sincronização com a ressalva do plano', () => {
  it('a frase de desktop/celular diz que é nos planos pagos', () => {
    const html = renderToStaticMarkup(React.createElement(OnboardingLandingProduct, { onEnter() {}, onLogin() {}, onRegister() {} }));
    const frase = html.match(/[^.>]*desktop ou no celular[^.<]*\./i)?.[0] || '';
    expect(frase).toBeTruthy();
    expect(frase).toMatch(/planos pagos/i);
  });
});
