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

  it('informa arrependimento, reembolso e foro sem retirar o foro do consumidor', () => {
    const terms = pageText('/termos');
    expect(terms).toContain('7 dias');
    expect(terms).toContain('devolvidos');
    expect(terms).toContain('foro do domicílio do consumidor');
    expect(terms).toContain('foro da comarca de São Paulo/SP');
  });
});
