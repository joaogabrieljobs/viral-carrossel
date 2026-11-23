import { describe, expect, it } from 'vitest';
import { shouldAutoEnterStudio } from '../../src/utils/landing-gate.js';

// Auditoria 23/11 (B6): conta ativa (/api/auth/session active:true) abria
// moont.ai na landing e "Entrar" pedia a senha de novo.
describe('auditoria 23/11 B6: quem está logado entra direto no studio', () => {
  it('sessão ativa sem parâmetro entra no studio', () => {
    expect(shouldAutoEnterStudio('', true)).toBe(true);
    expect(shouldAutoEnterStudio('?utm_source=ig', true)).toBe(true);
  });
  it('preview forçado da landing continua na landing', () => {
    for (const q of ['?landing=1', '?intro=1', '?welcome=1']) expect(shouldAutoEnterStudio(q, true), q).toBe(false);
  });
  it('sem sessão continua na landing', () => {
    expect(shouldAutoEnterStudio('', false)).toBe(false);
  });
});
