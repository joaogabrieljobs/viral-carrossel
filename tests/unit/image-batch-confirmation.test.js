import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const sidebarSource = readFileSync(
  new URL('../../src/components/SidebarContent.jsx', import.meta.url),
  'utf8',
);
const quickSource = readFileSync(
  new URL('../../src/components/panels/CriarRapidoHome.jsx', import.meta.url),
  'utf8',
);

describe('confirmação de consumo em lote', () => {
  it('mostra a quantidade e exige confirmação no painel profissional', () => {
    expect(sidebarSource).toContain('Confirmar geração de imagens');
    expect(sidebarSource).toContain('pendingImageCreditCount');
    expect(sidebarSource).toContain('1 por {itemLabel}');
    expect(sidebarSource).toContain('Confirmar · {pendingImageCreditCount} crédito');
  });

  it('informa o custo na seleção do Criar rápido', () => {
    expect(quickSource).toContain('Usa 1 crédito por imagem');
    expect(quickSource).toContain('crédito');
  });
});
