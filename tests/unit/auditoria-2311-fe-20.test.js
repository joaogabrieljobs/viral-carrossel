import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { docAfterReadyTemplate } from '../../src/utils/ready-template.js';
import { TemplateApplyPanel } from '../../src/components/TemplatesModal.jsx';
import { TEMPLATES } from '../../src/utils/design-data.js';

// FE-20: "Templates prontos" trocava cards, fotos e marca sem avisar e deixava
// no projeto o aviso de revisão e a ficha visual do conteúdo que saiu.
const antes = () => ({
  fmt: 'stories', creativePreset: 'jornal', productKind: 'carrossel', visualPreset: 'bold_promo',
  caption: 'Legenda escrita à mão', material: { content: 'briefing' },
  slides: [{ id: 'velho', title: 'Conteúdo antigo', bgImage: 'blob:foto' }],
  brand: { bg: '#fff' },
  editorialReviewStatus: 'needs_attention',
  editorialReviewIssues: [{ slideIndex: 0, field: 'title', kind: 'fact' }],
  materialNotice: 'O material não cobre este modo.',
  presentationMaterialNotice: 'aviso antigo',
  visualBible: { subjects: [{ id: 'ana', kind: 'person' }] },
});
const template = { slides: [{ id: 'novo', title: 'Do template' }], brand: { bg: '#000' }, creativePreset: 'minimal' };

describe('FE-20 — template pronto substitui o conteúdo e o que falava dele', () => {
  it('o aviso de revisão e a ficha visual do conteúdo antigo saem junto', () => {
    const depois = docAfterReadyTemplate(antes(), template);
    expect(depois.editorialReviewIssues).toEqual([]);
    expect(depois.visualBible).toBeNull();
    expect(['needs_attention', 'unavailable']).not.toContain(depois.editorialReviewStatus);
    expect(depois.materialNotice).toBe('');
    expect(depois.presentationMaterialNotice || '').toBe('');
  });

  it('cards, marca e pacote criativo passam a ser os do template', () => {
    const depois = docAfterReadyTemplate(antes(), template);
    expect(depois.slides).toBe(template.slides);
    expect(depois.brand).toBe(template.brand);
    expect(depois).toMatchObject({ creativePreset: 'minimal', productKind: 'carrossel', fmt: 'stories', visualPreset: null });
    // O que não é conteúdo dos cards continua no projeto.
    expect(depois.caption).toBe('Legenda escrita à mão');
    expect(depois.material).toEqual({ content: 'briefing' });
  });

  it('apresentação vira carrossel no Feed; sem pacote no template, mantém o do projeto', () => {
    const depois = docAfterReadyTemplate({ ...antes(), fmt: 'apresentacao' }, { ...template, creativePreset: '' });
    expect(depois.fmt).toBe('carrossel');
    expect(depois.creativePreset).toBe('jornal');
  });

  const painel = (hasContent) => renderToStaticMarkup(React.createElement(TemplateApplyPanel, {
    template: TEMPLATES[0], hasContent, onApply: () => {}, onBack: () => {},
  }));

  it('projeto com conteúdo: o passo de confirmação avisa o que será substituído', () => {
    const html = painel(true);
    expect(html).toContain('role="alert"');
    expect(html).toMatch(/Este projeto já tem cards\. O template substitui os cards, as fotos e as cores atuais\./);
    expect(html).toContain('Desfazer recupera esta versão.');
    expect(html).toContain('Voltar</button>');
  });

  it('projeto vazio: nada a avisar', () => {
    const html = painel(false);
    expect(html).not.toContain('substitui');
    expect(html).toContain('Aplicar só layout</button>');
  });

  it('o editor informa ao modal se o projeto tem conteúdo e usa a função pura', () => {
    const app = readFileSync(new URL('../../ViralCarrossel.jsx', import.meta.url), 'utf8');
    expect(app).toMatch(/<TemplatesModal[\s\S]{0,200}hasContent=\{projectHasCarouselContent\(slides\)\}/);
    expect(app).toContain('return docAfterReadyTemplate(d, {');
  });
});
