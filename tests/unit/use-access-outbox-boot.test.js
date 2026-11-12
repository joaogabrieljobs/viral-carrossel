import { describe, expect, it, vi } from 'vitest';
import { flushProjectOutboxForBoot, resumePendingLogoutCleanup } from '../../src/hooks/useAccess.js';

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

describe('limpeza pendente no boot', () => {
  function memoryStore(value) {
    const values = new Map(value ? [['vc_logout_cleanup_pending', value]] : []);
    return {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, next) => values.set(key, next),
      removeItem: (key) => values.delete(key),
    };
  }

  it('repete o wipe destrutivo e só libera o lock após confirmação estrita', async () => {
    const store = memoryStore('device-wipe');
    const clear = vi.fn().mockResolvedValue(undefined);
    const unlock = vi.fn();
    await expect(resumePendingLogoutCleanup({
      store, clear, unlock, hasResidue: () => false,
    })).resolves.toEqual({ pending: false, completed: true, wipeDevice: true });
    expect(clear).toHaveBeenCalledWith({ timeoutMs: 1_200, wipeMedia: true });
    expect(store.getItem('vc_logout_cleanup_pending')).toBeNull();
    expect(unlock).toHaveBeenCalledTimes(1);
  });

  it('restaura o marcador device-wipe quando outra aba bloqueia a exclusão', async () => {
    const store = memoryStore('device-wipe');
    const clear = vi.fn().mockImplementation(async () => {
      store.removeItem('vc_logout_cleanup_pending');
      throw new Error('blocked');
    });
    const unlock = vi.fn();
    await expect(resumePendingLogoutCleanup({
      store, clear, unlock, hasResidue: () => false,
    })).rejects.toThrow('blocked');
    expect(store.getItem('vc_logout_cleanup_pending')).toBe('device-wipe');
    expect(unlock).not.toHaveBeenCalled();
  });

  it('mantém compatibilidade com marcador legado sem apagar mídia', async () => {
    const store = memoryStore('1');
    const clear = vi.fn().mockResolvedValue(undefined);
    await resumePendingLogoutCleanup({ store, clear, unlock: vi.fn(), hasResidue: () => false });
    expect(clear).toHaveBeenCalledWith({ timeoutMs: 1_200, wipeMedia: false });
  });
});
