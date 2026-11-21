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

// MOO-35: o paywall dizia "Imagens inclusas nos planos pagos" e, abaixo, que o
// Essencial (pago, 0 imagens) pede chave própria, enquanto o cartão do plano
// dizia "imagens só por upload". Uma regra só, derivada de shared/plans.js.
describe('MOO-35 — paywall coerente com o Essencial', () => {
  it('não promete imagens em todos os planos pagos e diz a mesma regra no texto e no cartão', async () => {
    const { PLAN_TIERS } = await import('../../shared/plans.js');
    const html = renderToStaticMarkup(React.createElement(Paywall, { onClose: () => {} }));
    expect(PLAN_TIERS.essential.imageQuota).toBe(0);
    expect(html).not.toContain('Imagens inclusas nos planos pagos');
    expect(html).toContain('Imagens inclusas a partir do Plano Criador');
    expect(PLAN_TIERS.essential.blurb).toMatch(/upload ou (com )?sua chave/);
    expect(html).not.toContain('imagens só por upload');
  });
});
