import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

// MOO-37 (auditoria 20/11): o evento de erro de geração mandava ao Plausible a
// mensagem bruta da exceção, que pode trazer texto do briefing ou do usuário.
describe('MOO-37 — evento de erro só leva código e etapa', () => {
  it('carousel_generate_error não envia a mensagem da exceção', () => {
    const source = readFileSync(new URL('../../ViralCarrossel.jsx', import.meta.url), 'utf8');
    const call = source.slice(source.indexOf("trackEvent('carousel_generate_error'"), source.indexOf("trackEvent('carousel_generate_error'") + 300);
    expect(call).toContain("trackEvent('carousel_generate_error'");
    expect(call.split('});')[0]).not.toMatch(/\bmsg\s*:|err\?\.message/);
  });
});
