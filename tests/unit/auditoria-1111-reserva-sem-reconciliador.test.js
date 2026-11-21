/** Auditoria 11/11, achado 3 (= MOO-28 da auditoria 20/11): reserva de
 *  crédito do editor sem reconciliador.
 *
 *  CORRIGIDO no backend Postgres (o de produção desde 15/10): o cron
 *  /api/cron/reconcile-image-credits chama reconcileStaleImageReservations,
 *  que devolve ou confirma reservas `reserved` com mais de 15 min. Os casos
 *  reais estão em image-quota-postgres.test.js e reconcile-image-credits-cron.
 *  O backend em memória (só testes/dev) não guarda a data da reserva. */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => ({ listSettlement: vi.fn() }));
vi.mock('@vercel/functions', () => ({ waitUntil: vi.fn() }));
vi.mock('../../api/lib/agent-visual-batch.js', async (importOriginal) => ({
  ...(await importOriginal()),
  listAgentImageJobsForSettlement: mocked.listSettlement,
}));

import { reconcileAgentImageCredits } from '../../api/lib/agent-image-generation.js';
import {
  consumeImageCredit, getQuotaUsage, reconcileStaleImageReservations, resetMemoryQuotas,
} from '../../api/lib/image-quota.js';

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

  it('no backend em memória a reconciliação do editor é no-op explícito (sem data da reserva)', async () => {
    await consumeImageCredit({ ...conta, operationId: 'editor-op-morta' });
    const agente = await reconcileAgentImageCredits({ limit: 100 });
    const editor = await reconcileStaleImageReservations({ limit: 100, olderThanMinutes: 15 });
    expect(agente.scanned).toBe(0);
    expect(editor).toMatchObject({ scanned: 0, backend: 'legacy' });
    expect((await getQuotaUsage(conta)).used).toBe(1);
  });
});
