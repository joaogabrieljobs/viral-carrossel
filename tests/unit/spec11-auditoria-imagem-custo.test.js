import { describe, expect, it } from 'vitest';
import * as readiness from '../../src/utils/image-generation-readiness.js';

// Spec 1.1, entrega 5: a auditoria só aponta. Gerar outra imagem é decisão da
// pessoa e passa sempre pela confirmação com o custo, como no "Regenerar
// imagem" de card com foto enviada (QA-2411 editor 7).
const ask = (options) => readiness.imageAuditRegenerationPrompt?.(options);

describe('spec 1.1 entrega 5 — confirmação com custo para gerar outra imagem', () => {
  it('no plano, diz que usa 1 crédito de imagem e quantos restam', () => {
    const message = ask({ slideNumber: 3, imageQuota: { used: 12, limit: 50, tier: 'creator' } });
    expect(message).toContain('Gerar outra imagem para o slide 3 troca a imagem atual.');
    expect(message).toContain('usa 1 crédito de imagem do plano');
    expect(message).toContain('Restam 38 neste ciclo.');
    expect(message).toContain('Cancelar mantém a imagem atual e não usa crédito.');
  });

  it('com chave própria fala da chave e não fala em crédito do plano', () => {
    const message = ask({ slideNumber: 2, useOwnImageKey: true, imageQuota: { used: 12, limit: 50, tier: 'creator' } });
    expect(message).toContain('sua chave de imagem');
    expect(message).toContain('cobrança é do provedor da chave');
    expect(message).not.toMatch(/crédito|plano|Restam/);
    expect(message).toContain('Cancelar mantém a imagem atual e não gera nada.');
  });

  it('saldo desconhecido ou sem limite não inventa número; sempre pergunta', () => {
    expect(ask({ slideNumber: 1, imageQuota: { used: 4, limit: 50, unlimited: true } })).not.toMatch(/Restam/);
    expect(ask({ slideNumber: 1, imageQuota: { status: 'unavailable', used: 0, limit: 50 } })).not.toMatch(/Restam/);
    expect(ask({ slideNumber: 1 })).toContain('usa 1 crédito de imagem do plano');
    expect(ask({ slideNumber: 1, billingDisabled: true })).toContain('A cobrança está desativada neste ambiente.');
    expect(ask({})).toContain('Gerar outra imagem para este slide');
  });
});
