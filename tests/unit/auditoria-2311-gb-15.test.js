import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

// GB-15 (auditoria 23/11): `vite dev` escutava na rede local, e os proxies de
// IA do ambiente de desenvolvimento usam as chaves do .env. Em rede
// compartilhada, qualquer aparelho gastava a chave de quem desenvolve.
describe('GB-15 — ambiente de desenvolvimento só escuta nesta máquina por padrão', () => {
  it('o servidor de desenvolvimento usa localhost e só abre a rede com variável explícita', () => {
    const config = source('vite.config.js');
    expect(config).not.toMatch(/server:\s*\{\s*host:\s*true/);
    expect(config).toMatch(/host:\s*env\.DEV_SERVER_LAN === '1' \? true : 'localhost'/);
  });
  it('.env.example explica a variável', () => {
    expect(source('.env.example')).toMatch(/DEV_SERVER_LAN/);
  });
});
