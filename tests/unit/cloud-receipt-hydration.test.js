import { describe, expect, it } from 'vitest';
import { advanceReceiptAfterHydration } from '../../src/utils/cloud-receipts.js';

// Reteste 21/11 (T07): depois de reabrir, as fotos chegavam em segundo plano,
// a linha de base andava (bytes não são edição), mas o recibo continuava com
// a impressão antiga: "Salvo no aparelho · pendente na conta" até clicar em
// Salvar, que não enviava nada.
describe('recibo da conta acompanha a chegada das fotos', () => {
  const receipts = { p1: { owner: 'id:1', at: 1000, fingerprint: 'antes' }, p2: { owner: 'id:1', at: 900, fingerprint: 'x' } };
  it('move o recibo quando ele confirmava o estado anterior à chegada das fotos', () => {
    const next = advanceReceiptAfterHydration(receipts, 'p1', 'antes', 'depois');
    expect(next.p1).toEqual({ owner: 'id:1', at: 1000, fingerprint: 'depois' });
    expect(next.p2).toBe(receipts.p2);
  });
  it('não confirma o que não estava confirmado', () => {
    expect(advanceReceiptAfterHydration(receipts, 'p1', 'outro', 'depois')).toBe(receipts);
    expect(advanceReceiptAfterHydration(receipts, 'p3', 'antes', 'depois')).toBe(receipts);
    expect(advanceReceiptAfterHydration(receipts, 'p1', 'antes', 'antes')).toBe(receipts);
  });
});
