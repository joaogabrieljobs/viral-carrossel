import { describe, expect, it } from 'vitest';
import { toastTtl } from '../../src/hooks/useToasts.js';

describe('toastTtl', () => {
  it('fecha erros comuns automaticamente após tempo suficiente para leitura', () => {
    expect(toastTtl('error')).toBe(7000);
    expect(toastTtl('error', 4500)).toBe(4500);
  });

  it('mantém somente avisos explicitamente bloqueantes', () => {
    expect(toastTtl('error', 0)).toBe(0);
  });
});
