/** Auditoria 11/11, achado 3: reserva de crédito do editor sem reconciliador.
 *
 *  DEFEITO ABERTO. O teste com `it.fails` descreve o comportamento correto:
 *  passa enquanto o defeito existe e fica vermelho quando a correção entrar
 *  (aí basta trocar `it.fails` por `it`). */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => ({ listSettlement: vi.fn() }));
vi.mock('@vercel/functions', () => ({ waitUntil: vi.fn() }));
vi.mock('../../api/lib/agent-visual-batch.js', async (importOriginal) => ({
  ...(await importOriginal()),
  listAgentImageJobsForSettlement: mocked.listSettlement,
}));

import { reconcileAgentImageCredits } from '../../api/lib/agent-image-generation.js';
import { consumeImageCredit, getQuotaUsage, resetMemoryQuotas } from '../../api/lib/image-quota.js';

const conta = { customerId: 'cus_reserva_presa', periodStartSec: 1_700_000_000, periodEndSec: 1_702_592_000, limit: 50 };

beforeEach(() => {
  resetMemoryQuotas();
  mocked.listSettlement.mockReset().mockResolvedValue([]);
});

describe('achado 3: reserva do editor que ninguém liquida', () => {
  it('fato de hoje: a função morre depois da reserva e o crédito fica contado', async () => {
    const reserva = await consumeImageCredit({ ...conta, operationId: 'editor-op-morta' });
    expect(reserva.allowed).toBe(true);
    // Sem settle nem refund: é o que sobra quando a função da Vercel morre no meio.
    expect((await getQuotaUsage(conta)).used).toBe(1);
  });

  it.fails('o cron de reconciliação devolve a reserva do editor abandonada', async () => {
    await consumeImageCredit({ ...conta, operationId: 'editor-op-morta' });
    // Simula a reserva já velha: o reconciliador roda bem depois do teto de 300 s da função.
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 20 * 60_000);
    try {
      const resultado = await reconcileAgentImageCredits({ limit: 100 });
      // Hoje: o reconciliador só lê agent_visual_jobs; scanned 0 e o crédito continua preso.
      expect(resultado.scanned).toBeGreaterThan(0);
      expect((await getQuotaUsage(conta)).used).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
