// QA 24/11 (conta 2): a tela de escolha que já existia para edição de projeto
// excluído passa a mostrar também a edição feita sobre uma versão antiga, com
// as três saídas pedidas: manter a minha, usar a da conta, salvar como cópia.
import React from 'react';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import DeletedProjectEditReview from '../../src/components/DeletedProjectEditReview.jsx';

const render = (props) => renderToStaticMarkup(React.createElement(DeletedProjectEditReview, { open: true, ...props }));
const conflict = { kind: 'conflict', projectId: 'p-a', projectName: 'Projeto A', copyName: 'Projeto A (cópia de conflito)', updatedAt: 0 };
const deleted = { kind: 'deleted', projectId: 'p-b', projectName: 'Projeto B', copyName: 'Projeto B (cópia de conflito)', updatedAt: 0 };
const buttons = (html) => [...html.matchAll(/<button[^>]*>([^<]*)<\/button>/g)].map((match) => match[1]).filter(Boolean);

describe('tela de escolha: edição sobre versão antiga', () => {
  it('oferece as três saídas e diz que a edição continua guardada', () => {
    const html = render({ reviews: [conflict] });
    expect(buttons(html)).toEqual(['Manter a minha', 'Usar a da conta', 'Salvar como cópia', 'Decidir depois']);
    expect(html).toContain('Este projeto tem duas versões');
    expect(html).toContain('Sua edição continua guardada neste navegador');
    expect(html).toContain('Projeto A (cópia de conflito)');
    expect(html).not.toContain('excluído');
    expect(html).not.toMatch(/[—–]/);
  });

  it('edição de projeto excluído segue com as duas saídas de antes', () => {
    const html = render({ reviews: [deleted] });
    expect(buttons(html)).toEqual(['Manter como projeto novo', 'Descartar edição', 'Decidir depois']);
    expect(html).toContain('Edição de um projeto excluído');
    expect(html).not.toContain('Manter a minha');
    // Item sem `kind` (lista antiga) é tratado como projeto excluído.
    expect(buttons(render({ reviews: [{ ...deleted, kind: undefined }] })))
      .toEqual(['Manter como projeto novo', 'Descartar edição', 'Decidir depois']);
  });

  it('com os dois casos, cada projeto mostra as saídas do seu caso', () => {
    const html = render({ reviews: [deleted, conflict] });
    expect(html).toContain('Edições que esperam a sua escolha');
    expect(buttons(html)).toEqual([
      'Manter como projeto novo', 'Descartar edição',
      'Manter a minha', 'Usar a da conta', 'Salvar como cópia', 'Decidir depois',
    ]);
  });

  it('enquanto uma escolha é aplicada, os botões ficam travados', () => {
    const html = render({ reviews: [conflict], busyId: 'p-a' });
    expect(html.match(/<button[^>]*disabled/g)).toHaveLength(5); // fechar + 3 saídas + decidir depois
  });
});

describe('editor: salvar com versão desatualizada', () => {
  const app = readFileSync(new URL('../../ViralCarrossel.jsx', import.meta.url), 'utf8');

  it('todo envio feito com a pessoa no editor pede a escolha em vez de criar a cópia sozinho', () => {
    const flushes = app.match(/flushProjectOutbox\(owner[^)]*\)/g) || [];
    expect(flushes.length).toBeGreaterThanOrEqual(2);
    for (const call of flushes) expect(call).toContain('reviewConflicts: true');
  });

  it('a tela recebe a lista com os dois casos e a ação do conflito', () => {
    expect(app).toContain('projectOutbox.listProjectEditReviews(owner)');
    expect(app).toContain('projectOutbox.resolveProjectConflictEdit(owner, projectId, action)');
    expect(app).toMatch(/onResolveConflict=\{/);
  });
});
