import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const sidebarSource = readFileSync(
  new URL('../../src/components/SidebarContent.jsx', import.meta.url),
  'utf8',
);
const appSource = readFileSync(new URL('../../ViralCarrossel.jsx', import.meta.url), 'utf8');
const createFlowSource = readFileSync(
  new URL('../../src/components/CreateProjectFlow.jsx', import.meta.url),
  'utf8',
);

describe('limite do material sem corte silencioso', () => {
  it('mostra contador, preserva texto antigo e bloqueia novas adições acima do limite', () => {
    expect(sidebarSource).toContain('creationMaterialLimits(materialProductKind)');
    expect(sidebarSource).toContain('Nada foi cortado; reduza o texto antes de continuar.');
    expect(sidebarSource).toContain('seu texto completo foi preservado.');
    expect(sidebarSource).toContain('disabled={hasMaterialOverage}');
  });

  it('tem uma barreira central antes de chamar a IA', () => {
    const guard = appSource.indexOf('creationMaterialOverages(material, materialProductKind)');
    const generation = appSource.indexOf('generationRef.current', guard);
    expect(guard).toBeGreaterThanOrEqual(0);
    expect(generation).toBeGreaterThan(guard);
    expect(appSource).toContain('reduza-o para gerar sem cortes');
  });

  it('bloqueia o onboarding depois de trocar para um produto com limite menor', () => {
    expect(createFlowSource).toContain('creationMaterialOverageMessage(material, productKind)');
    expect(createFlowSource).toContain('material:creationMaterialForSubmission(material, productKind)');
    expect(createFlowSource).toContain('!hasTextAI || hasMaterialOverage');
    expect(createFlowSource).not.toContain('material:clampCreationMaterial(material, productKind)');
  });
});
