import { describe, expect, it } from 'vitest';
import {
  hashPassword,
  verifyPassword,
  isValidEmail,
  isValidPassword,
  normalizeEmail,
  generatePassword,
  upsertPassword,
  getAuthRecord,
} from '../../api/lib/password-auth.js';

describe('password-auth', () => {
  it('normaliza e valida e-mail', () => {
    expect(normalizeEmail('  Foo@Bar.COM ')).toBe('foo@bar.com');
    expect(isValidEmail('a@b.co')).toBe(true);
    expect(isValidEmail('x')).toBe(false);
  });

  it('valida senha mínima', () => {
    expect(isValidPassword('1234567')).toBe(false);
    expect(isValidPassword('12345678')).toBe(true);
  });

  it('hash + verify roundtrip', () => {
    const { salt, hash } = hashPassword('SegredoForte1!');
    expect(verifyPassword('SegredoForte1!', { salt, hash })).toBe(true);
    expect(verifyPassword('errada', { salt, hash })).toBe(false);
  });

  it('generatePassword tem comprimento útil', () => {
    const p = generatePassword(14);
    expect(p).toHaveLength(14);
    expect(isValidPassword(p)).toBe(true);
  });

  it('upsertPassword guarda e não sobrescreve sem flag', async () => {
    const email = `user_${Date.now()}@teste.exemplo`;
    await upsertPassword(email, 'senha-forte-1', { overwrite: false });
    const rec = await getAuthRecord(email);
    expect(rec?.hash).toBeTruthy();
    await expect(
      upsertPassword(email, 'outra-senha-2', { overwrite: false }),
    ).rejects.toThrow(/já existe/i);
  });
});
