import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Paywall from '../../src/components/Paywall.jsx';

// MOO-14 / WEB-001 (auditorias 15/10 e 20/11): o erro do checkout no paywall
// aparecia sem role="alert"; leitor de tela não anunciava a falha.
describe('MOO-14 — erro do paywall é anunciado', () => {
  it('mensagem de erro do checkout sai com role="alert"', () => {
    const html = renderToStaticMarkup(React.createElement(Paywall, { loginHint: 'Não foi possível abrir o pagamento.', onClose: () => {} }));
    expect(html).toMatch(/<p[^>]*role="alert"[^>]*>Não foi possível abrir o pagamento\.<\/p>/);
  });
});
