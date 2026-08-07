// Task 01 (walking skeleton) — RF-04 parcial: cookie de acesso assinado.
// Válido/adulterado aqui; expirado/ausente na task 03.
import { describe, it, expect } from 'vitest';
import { createAccessToken, verifyAccessToken } from '../../api/lib/access.js';

const USER = { customerId: 'cus_teste_1', email: 'user1@teste.exemplo' };

describe('cookie de acesso (api/lib/access.js)', () => {
  it('token assinado é verificado com os mesmos campos (round-trip)', () => {
    const token = createAccessToken(USER);
    expect(token).toMatch(/^[\w-]+\.[\w-]+$/);
    const payload = verifyAccessToken(token);
    expect(payload).not.toBeNull();
    expect(payload.customerId).toBe(USER.customerId);
    expect(payload.email).toBe(USER.email);
    expect(typeof payload.iat).toBe('number');
  });

  it('assinatura adulterada é rejeitada sem exceção', () => {
    const token = createAccessToken(USER);
    const [body, sig] = token.split('.');
    const flipped = sig.slice(0, -1) + (sig.endsWith('A') ? 'B' : 'A');
    expect(verifyAccessToken(`${body}.${flipped}`)).toBeNull();
  });

  it('payload adulterado com assinatura original é rejeitado', () => {
    const token = createAccessToken(USER);
    const [, sig] = token.split('.');
    const forgedBody = Buffer.from(
      JSON.stringify({ customerId: 'cus_atacante', email: 'atacante@teste.exemplo', iat: Math.floor(Date.now() / 1000) }),
    )
      .toString('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
    expect(verifyAccessToken(`${forgedBody}.${sig}`)).toBeNull();
  });
});
