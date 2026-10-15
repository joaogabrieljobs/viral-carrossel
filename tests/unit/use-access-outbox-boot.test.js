import { describe, expect, it, vi } from 'vitest';
import { flushProjectOutboxForBoot } from '../../src/hooks/useAccess.js';

const OWNER = 'email:conta@example.test';

describe('fila de projetos no boot', () => {
  it('mantém o recibo real quando a fila foi verificada', async () => {
    const receipt = { sent: 1, pending: 1, needsReview: [{ kind: 'put_deleted' }] };
    const flush = vi.fn().mockResolvedValue(receipt);
    expect(await flushProjectOutboxForBoot(OWNER, flush)).toEqual({ receipt, unavailable: false });
    expect(flush).toHaveBeenCalledExactlyOnceWith(OWNER);
  });

  it.each([
    [{ code: 'project_outbox_unavailable' }],
    [{ code: 'project_outbox_timeout' }],
    [new DOMException('IndexedDB indisponível', 'InvalidStateError')],
  ])('continua pela nuvem sem afirmar que a fila local está limpa quando IndexedDB falha', async (error) => {
    const flush = vi.fn().mockRejectedValue(error);
    expect(await flushProjectOutboxForBoot(OWNER, flush)).toEqual({
      receipt: null, unavailable: true,
    });
  });

  it('mantém bloqueios de conta, rede, pendências comuns e recibos inválidos', async () => {
    for (const error of [
      { code: 'project_owner_changed' }, { code: 'project_network_error' },
    ]) {
      await expect(flushProjectOutboxForBoot(OWNER, vi.fn().mockRejectedValue(error)))
        .rejects.toBe(error);
    }
    await expect(flushProjectOutboxForBoot(OWNER, vi.fn().mockResolvedValue({ pending: 1 })))
      .rejects.toThrow('Ainda há projetos aguardando envio');
    await expect(flushProjectOutboxForBoot(OWNER, vi.fn().mockResolvedValue(null)))
      .rejects.toThrow('Não foi possível confirmar as alterações pendentes');
  });
});
