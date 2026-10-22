import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AccountHomeShell } from '../../src/components/AccountHomeShell.jsx';
import { ModePicker } from '../../src/components/panels/generate-modal-parts.jsx';

const source = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

describe('seletor de produto na Home e na Biblioteca', () => {
  it('propaga carrossel ou apresentação nas ações da Home lateral', () => {
    const code = source('src/components/SidebarContent.jsx');

    expect(code).toContain('aria-label="Tipo de projeto para criar"');
    expect(code).toContain("onNewProject(homeCreationType)");
    expect(code).toContain("onGenerateProject(homeCreationType)");
    expect(code).toContain("entry?.doc?.fmt === 'apresentacao'");
    expect(code).toContain("const itemLabel = isPresentationProject ? 'slide' : 'card'");
    expect(code).toContain("width: isPresentation ? 72 : 48");
  });

  it('offers opening or guided creation before exposing existing projects or product choices', () => {
    const html = renderToStaticMarkup(React.createElement(AccountHomeShell, {
      library: [{ id: 'saved', name: 'Campanha já salva', doc: { slides: [{}] } }],
      activeDocId: 'saved',
      onStartCreation() {},
    }));

    expect(html).toContain('Abrir um projeto');
    expect(html).toContain('Criar um projeto');
    expect(html).not.toContain('Campanha já salva');
    expect(html).not.toContain('Tipo de projeto para criar');
    expect(html).not.toContain('Modo narrativo');
    expect(html).not.toContain('Padrões visuais');
    expect(html).not.toContain('Gerar com Moont');
  });

  it('opens a mixed project library with search and every saved-project action', () => {
    const library = [
      { id: 'social', name: 'Campanha social', status: 'draft', doc: { productKind: 'carrossel', slides: [{}, {}] } },
      { id: 'deck', name: 'Plano comercial', status: 'draft', doc: { productKind: 'apresentacao', slides: [{}, {}, {}] } },
    ];
    const html = renderToStaticMarkup(React.createElement(AccountHomeShell, {
      library, initialProjectView: 'library', isMobile: true, onStartCreation() {},
    }));

    expect(html).toContain('Buscar projetos');
    expect(html).toContain('2 cards');
    expect(html).toContain('3 slides');
    for (const project of library) {
      for (const action of ['Abrir', 'Duplicar', 'Exportar', 'Apagar']) {
        expect(html).toContain(`aria-label="${action} ${project.name}"`);
      }
      expect(html).toContain(`aria-label="Estado para ${project.name}"`);
    }
    expect(html.match(/>Renomear</g)).toHaveLength(2);
    expect(html).toContain('Criar um projeto');
  });

  it('offers guided creation when the library is empty without displaying a false empty state while loading', () => {
    const empty = renderToStaticMarkup(React.createElement(AccountHomeShell, { initialProjectView: 'library' }));
    expect(empty).toContain('Criar meu primeiro projeto');
    const loading = renderToStaticMarkup(React.createElement(AccountHomeShell, { initialProjectView: 'library', cloudSyncBusy: true }));
    expect(loading).toContain('Carregando sua biblioteca');
    expect(loading).not.toContain('Criar meu primeiro projeto');
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


describe('narrative choices in the existing editor', () => {
  it('uses understandable labels and exposes the selected option and example', () => {
    const html = renderToStaticMarkup(React.createElement(ModePicker, { value: 'viral', onChange() {} }));
    expect(html).toContain('aria-pressed="true" aria-label="Prender atenção"');
    expect(html).toContain('aria-label="Contar uma história"');
    expect(html).toContain('Exemplo:');
    expect(html).not.toContain('Viral Trends');
    expect(html).not.toContain('Odisseia da Dor');
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
  });

  it('keeps group and description IDs unique when two editors render together', () => {
    const html = renderToStaticMarkup(React.createElement(React.Fragment, null,
      React.createElement(ModePicker, { value: 'storytelling', onChange() {} }),
      React.createElement(ModePicker, { value: 'editorial', onChange() {} }),
    ));
    const ids = Array.from(html.matchAll(/\sid="([^"]+)"/g), (match) => match[1]);
    expect(new Set(ids).size).toBe(ids.length);
    for (const match of html.matchAll(/aria-(?:labelledby|describedby)="([^"]+)"/g)) {
      expect(ids).toContain(match[1]);
    }
  });
});
