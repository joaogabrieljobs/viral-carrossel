import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LEGAL_PAGES } from '../../src/LegalPage.jsx';

const pageText = path => LEGAL_PAGES[path].sections.map(section => `${section.heading} ${section.body}`).join(' ');

describe('páginas legais do Moont', () => {
  it('identifica o controlador e informa os direitos e operadores essenciais', () => {
    const privacy = pageText('/privacidade');
    expect(privacy).toContain('ELEVESSY GESTÃO, INOVAÇÃO, TECNOLOGIA E COMÉRCIO LTDA');
    expect(privacy).toContain('52.038.549/0001-79');
    expect(privacy).toContain('até 15 dias');
    for (const operator of ['Vercel', 'Stripe', 'Google']) expect(privacy).toContain(operator);
  });

  it('explica a medição de uso, o consentimento e como revogar', () => {
    const privacy = pageText('/privacidade');
    for (const trecho of ['Plausible', 'Google Analytics', 'só é ligado se você aceitar', 'Preferências de cookies', 'fora do Brasil', '2 meses']) {
      expect(privacy).toContain(trecho);
    }
  });

  it('não contradiz a lista de operadores e deixa revogar na própria página', () => {
    const privacy = pageText('/privacidade');
    expect(privacy).toContain('Google quando você escolhe entrar com Google ou aceita o Google Analytics');
    expect(privacy).toContain('no fim desta página');
    const fonte = readFileSync(new URL('../../src/LegalPage.jsx', import.meta.url), 'utf8');
    expect(fonte).toContain('moontGA4?.abrirPreferencias()');
  });

  it('informa arrependimento, reembolso e foro sem retirar o foro do consumidor', () => {
    const terms = pageText('/termos');
    expect(terms).toContain('7 dias');
    expect(terms).toContain('devolvidos');
    expect(terms).toContain('foro do domicílio do consumidor');
    expect(terms).toContain('foro da comarca de São Paulo/SP');
  });
});
