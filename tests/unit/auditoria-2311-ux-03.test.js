// UX-03 (auditoria de 23/11): quem assina sem conta e volta do Stripe com a
// confirmação falhando caía na tela de planos sem aviso nenhum. O "Não pague
// de novo" ia só para a pilha de avisos, que existe apenas no editor.
import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Paywall from '../../src/components/Paywall.jsx';
import { billingReturnUnconfirmed } from '../../src/lib/billing.js';

describe('UX-03: aviso de pagamento não confirmado na tela de planos', () => {
  it('a condição do aviso: voltou do pagamento, confirmação falhou e não há assinatura ativa', () => {
    expect(billingReturnUnconfirmed({ billing: 'success', confirmFailed: true, sessionActive: false })).toBe(true);
    // Conta grátis que assinou: a sessão existe, mas não está ativa.
    expect(billingReturnUnconfirmed({ billing: 'success', confirmFailed: true })).toBe(true);
    // A resposta do confirm se perdeu, mas a sessão já está ativa: sem aviso.
    expect(billingReturnUnconfirmed({ billing: 'success', confirmFailed: true, sessionActive: true })).toBe(false);
    expect(billingReturnUnconfirmed({ billing: 'success', confirmFailed: false, sessionActive: false })).toBe(false);
    expect(billingReturnUnconfirmed({ billing: 'cancel', confirmFailed: true, sessionActive: false })).toBe(false);
    expect(billingReturnUnconfirmed()).toBe(false);
  });

  it('a tela de planos mostra o aviso com role="alert" e o botão de nova tentativa', () => {
    const html = renderToStaticMarkup(React.createElement(Paywall, { paymentUnconfirmed: true }));
    const alert = /<[a-z]+[^>]*role="alert"[^>]*data-vc-payment-unconfirmed[^>]*>([\s\S]*?)<\/section>/.exec(html)?.[1] || '';
    expect(alert).toContain('Não pague de novo');
    expect(alert).toContain('Tentar confirmar de novo');
  });

  it('sem volta de pagamento pendente a tela de planos não mostra o aviso', () => {
    const html = renderToStaticMarkup(React.createElement(Paywall, {}));
    expect(html).not.toContain('Não pague de novo');
    expect(html).not.toContain('data-vc-payment-unconfirmed');
  });
});
