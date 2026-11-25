import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import EditorialReviewNotice from '../../src/components/EditorialReviewNotice.jsx';
import { docAfterReadyTemplate } from '../../src/utils/ready-template.js';

// Spec 1.1, entrega 5: o resultado da auditoria aparece no bloco de revisão que
// já existe, com slide, regra e evidência, e um botão por slide para gerar
// outra imagem. Nada é trocado sem a pessoa pedir e confirmar o custo.
const app = readFileSync(new URL('../../ViralCarrossel.jsx', import.meta.url), 'utf8');
const slides = [{ id: 's1', title: 'Capa' }, { id: 's2', title: 'Comportamento' }, { id: 's3', title: 'Festa' }];
const finding = { slideId: 's3', slideIndex: 2, ruleId: 'r1', level: 'avoid', rule: 'Sem máscara ou plumas de carnaval', evidence: 'Mulher com máscara dourada e plumas azuis' };
const render = (props) => renderToStaticMarkup(React.createElement(EditorialReviewNotice, {
  status: null, issues: [], isPresentation: true, slides, onRegenerateAuditImage: () => {}, onDismissImageAudit: () => {}, ...props,
}));
const between = (from, to) => {
  const start = app.indexOf(from);
  expect(start, `não achei: ${from}`).toBeGreaterThan(0);
  const end = app.indexOf(to, start);
  expect(end, `não achei depois: ${to}`).toBeGreaterThan(start);
  return app.slice(start, end);
};

describe('spec 1.1 entrega 5 — aviso da auditoria no bloco de revisão', () => {
  it('mostra slide, regra e evidência, com o botão daquele slide', () => {
    const html = render({ imageAuditFindings: [finding] });
    expect(html).toContain('Imagens para conferir');
    expect(html).toContain('Slide 3');
    expect(html).toContain('Sem máscara ou plumas de carnaval');
    expect(html).toContain('Mulher com máscara dourada e plumas azuis');
    expect(html).toContain('aria-label="Gerar outra imagem do slide 3"');
    expect(html).toContain('Conferi as imagens');
    expect(html).toMatch(/custo antes/);
  });

  it('usa a posição atual do slide e some quando o slide saiu ou não há achado', () => {
    expect(render({ imageAuditFindings: [finding], slides: [slides[2], slides[0], slides[1]] })).toContain('Slide 1');
    expect(render({ imageAuditFindings: [finding], slides: slides.slice(0, 2) })).not.toContain('Imagens para conferir');
    expect(render({ imageAuditFindings: [] })).not.toContain('Imagens para conferir');
    expect(render({})).not.toContain('Imagens para conferir');
  });

  it('aparece junto dos outros avisos sem esconder a revisão de texto', () => {
    const html = render({ imageAuditFindings: [finding], status: 'needs_attention', issues: [{ slideIndex: 0, kind: 'missing_title' }], materialNotice: 'Aviso do material.' });
    expect(html).toContain('Imagens para conferir');
    expect(html).toContain('Rascunho preservado');
    expect(html).toContain('Aviso do material.');
  });
});

describe('spec 1.1 entrega 5 — ligação no editor', () => {
  it('o laço guarda as imagens geradas em memória para o mosaico', () => {
    const loop = between('for (const { slideId, i, q, expectedImageIdentity } of slidesWithImage)', 'if (imgQuotaStop) {');
    expect(loop).toMatch(/auditImages\.push\(\{ slideId, dataUrl: url \}\)/);
  });

  it('depois do laço, uma auditoria atrás da flag da conta, só em apresentação com roteiro', () => {
    const block = between('// Spec 1.1 entrega 5: auditoria de imagem', '// Spec 1.1 entrega 5: fim da auditoria de imagem');
    expect(app.indexOf('// Spec 1.1 entrega 5: auditoria de imagem')).toBeGreaterThan(app.indexOf('if (imgQuotaStop) {'));
    expect(block).toContain('accessSessionRef.current?.imageAudit === true');
    expect(block).toContain('isPresentationGeneration && generationPlan');
    expect(block.match(/runImageAudit\(/g)).toHaveLength(1);
    expect(block).toContain('imageAuditFindings');
  });

  it('a auditoria nunca gera imagem sozinha', () => {
    const block = between('// Spec 1.1 entrega 5: auditoria de imagem', '// Spec 1.1 entrega 5: fim da auditoria de imagem');
    for (const call of ['generateDALLEWithRetry', 'generateSlideImageAt', 'guardarImagemDoSlide', 'regenerateAuditImage']) {
      expect(block).not.toContain(call);
    }
  });

  it('o botão pergunta com o custo antes de gerar e só então gera aquela imagem', () => {
    const handler = between('const regenerateAuditImage = useCallback', '}, [');
    const question = handler.indexOf('imageAuditRegenerationPrompt(');
    const confirm = handler.indexOf('window.confirm(');
    const generate = handler.indexOf('generateSlideImageAt(');
    expect(question).toBeGreaterThan(0);
    expect(confirm).toBeGreaterThan(question);
    expect(generate).toBeGreaterThan(confirm);
    expect(handler).toContain('useOwnImageKey');
  });

  it('o aviso recebe os achados e o botão; nova geração e template limpam os achados', () => {
    expect(app).toMatch(/imageAuditFindings=\{doc\.imageAuditFindings\}/);
    expect(app).toMatch(/onRegenerateAuditImage=\{regenerateAuditImage\}/);
    const generationPatch = between('slideTextDensity: td, contentObjective: objective, editorialReviewStatus: reviewStatus,', 'editorialContext: {');
    expect(generationPatch).toContain('imageAuditFindings: []');
    expect(docAfterReadyTemplate({ imageAuditFindings: [finding] }, { slides: [] }).imageAuditFindings).toEqual([]);
  });
});
