import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

describe('seletor de produto na Home e na Biblioteca', () => {
  it('propaga carrossel ou apresentação nas ações da Home lateral', () => {
    const code = source('src/components/SidebarContent.jsx');

    expect(code).toContain('aria-label="Tipo de projeto para criar"');
    expect(code).toContain("onNewProject(homeCreationType)");
    expect(code).toContain("onGenerateProject(homeCreationType)");
    expect(code).toContain("entry?.doc?.fmt === 'apresentacao'");
    expect(code).toContain("{productLabel} · {itemLabel}");
    expect(code).toContain("width: isPresentation ? 72 : 48");
  });

  it('usa uma única escolha para criar ou gerar na Home da conta', () => {
    const code = source('src/components/AccountHomeShell.jsx');

    expect(code).toContain('useState(() => projectKindOf(activeProject))');
    expect(code).toContain("entry?.doc?.productKind === 'apresentacao'");
    expect(code).toContain('setCreationType(projectKindOf(activeProject))');
    expect(code).toContain("onGenerate?.(creationType)");
    expect(code).toContain("newDoc?.(creationType)");
    expect(code).toContain("{product.singular} · {slides.length}");
    expect(code).toContain("width: isPresentation ? 88 : 56");
    expect(code).not.toContain("newDoc(\n                  {");
  });

  it('mantém a Biblioteca mista e cria o tipo selecionado', () => {
    const code = source('src/components/LibraryModal.jsx');

    expect(code).toContain('aria-label="Biblioteca de projetos"');
    expect(code).toContain("onNew?.(creationType)");
    expect(code).toContain("counts.carrossel");
    expect(code).toContain("counts.apresentacao");
    expect(code).toContain("{product.singular} · {slides.length}");
    expect(code).toContain("width: isPresentation ? 92 : 56");
    expect(code).not.toContain('Nenhum carrossel corresponde aos filtros atuais.');
  });
});
