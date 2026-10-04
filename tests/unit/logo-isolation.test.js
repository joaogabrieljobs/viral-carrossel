import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

function between(code, start, end) {
  const from = code.indexOf(start);
  const to = code.indexOf(end, from + start.length);
  expect(from, `marcador ausente: ${start}`).toBeGreaterThanOrEqual(0);
  expect(to, `marcador ausente: ${end}`).toBeGreaterThan(from);
  return code.slice(from, to);
}

describe('isolamento das logos de marca, projeto e card', () => {
  it('não promove a logo do projeto para a identidade global durante a geração', () => {
    const app = source('ViralCarrossel.jsx');
    const generation = between(app, 'const generationBrand =', 'const resolvedImgMode');
    expect(generation).toContain('projectLogoAsset');
    expect(generation).not.toContain('brandLogoInsertPatch');
    expect(app).toContain('applyGenerationLogoPolicy(newSlides');
    expect(app).toMatch(/if \(!remix\) \{\s*newSlides = applyGenerationLogoPolicy/);
  });

  it('duplicar a logo só neste card não altera o kit do projeto', () => {
    const panel = source('src/components/panels/SlideLogoPanel.jsx');
    const action = between(panel, 'const applyProjectOrBrandToCard', 'return (');
    expect(action).toContain('updateSlide({');
    expect(action).not.toContain('setStyleKit');
  });

  it('a logo do projeto tem remoção própria e limpar contexto não apaga a marca global', () => {
    const panel = source('src/components/panels/ProjectStyleKitPanel.jsx');
    expect(panel).toContain('aria-label="Remover logo deste projeto"');
    const from = panel.lastIndexOf('uploadVersion.current++;');
    const to = panel.indexOf('toast(`Estilo e contexto', from);
    expect(from).toBeGreaterThanOrEqual(0);
    expect(to).toBeGreaterThan(from);
    const clear = panel.slice(from, to);
    expect(clear).toContain('setStyleKit(clearStyleKit())');
    expect(clear).not.toContain('setBrand');
  });

  it('hidrata logos sem consumir o próximo passo de desfazer do usuário', () => {
    const history = source('src/hooks/useHistory.js');
    expect(history).toContain('const setSilent = React.useCallback');
    expect(history).not.toContain('skipNext');
  });

  it('não reverte edições feitas enquanto uma logo está sendo salva', () => {
    const quick = source('src/components/panels/CriarRapidoHome.jsx');
    const panel = source('src/components/panels/SlideLogoPanel.jsx');
    expect(quick).toContain('setBrand?.((current) => ({');
    expect(panel).toContain('setBrand((current) => ({');
  });

  it('migra logos base64 dos perfis e mantém identidades legadas separadas no backup', () => {
    const app = source('ViralCarrossel.jsx');
    const library = source('src/hooks/useLibrary.js');
    expect(app).toContain('legacyBrandLogoJobsRef');
    expect(app).toContain('brandRosterPersistRef.current');
    expect(app).toContain('idsDeImagemEmUso(\n          libraryPersistRef.current,\n          brandRosterPersistRef.current');
    expect(app).toContain("profile.logo.startsWith('data:image/png;base64,')");
    expect(library).toContain('const hasPortableProfiles = Array.isArray(parsed.brands)');
    expect(library).toContain('const mappedBrandId = hasPortableProfiles');
    expect(library).toContain('brands,');
    expect(library).toContain('activeBrandId,');
  });

  it('salva o rascunho do pedido por projeto e limpa o objetivo ao trocar', () => {
    const app = source('ViralCarrossel.jsx');
    const quick = source('src/components/panels/CriarRapidoHome.jsx');
    expect(app).toContain('current.quickPromptDraft === quickPrompt');
    expect(app).toContain("{ ...current, quickPromptDraft: quickPrompt }");
    expect(quick).toMatch(/useEffect\(\(\) => \{\s*setUploadingLogo\(false\);\s*setObjectiveId\(null\);\s*\}, \[projectId\]\);/);
  });
});
