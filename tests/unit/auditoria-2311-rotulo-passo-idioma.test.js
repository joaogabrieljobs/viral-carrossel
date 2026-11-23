import { describe, expect, it } from 'vitest';
import { buildContentLanguageRule } from '../../src/utils/generation-prompts.js';

// Auditoria 23/11 (B4): carrossel BLK FROGDAY em inglês, modo Ensinar passo a
// passo, saiu com "Step 1 · Send your link" e "Passo 2 · Review your new site".
// As regras do modo mandam literalmente "Passo N · …" e a regra de idioma não
// dizia como traduzir o rótulo.
const english = 'Black Frog builds websites for local businesses in San Diego. We build your new site first, and you only pay when you like it. Send your current link or fill the brief, and you see the new site before any payment.';

describe('auditoria 23/11 B4: rótulo de passo no idioma do conteúdo', () => {
  it('em inglês pede "Step N"', () => {
    expect(buildContentLanguageRule({ topic: english })).toContain('"Step N · …"');
  });
  it('em espanhol pede "Paso N"', () => {
    expect(buildContentLanguageRule({ topic: 'Hacemos el sitio nuevo para los negocios de la ciudad con una oferta para los clientes que buscan una web como la de su competencia, por la semana.' })).toContain('"Paso N · …"');
  });
  it('em português não muda', () => {
    expect(buildContentLanguageRule({ topic: 'A padaria vende pão com encomenda para o fim de semana e retirada na loja.' })).not.toContain('Step N');
  });
});
