import { describe, it, expect } from 'vitest';
import {
  buildTemplateContent, sanitizeTemplateContent, applyTemplateToDoc, templatePreviewDoc, sanitizeTemplateMeta,
  TEMPLATE_MAX_SLIDES,
} from '../../src/utils/published-template.js';

const autora = () => ({
  fmt: 'carrossel',
  brand: { name: 'Marca da autora', handle: '@autora', logo: 'data:image/png;base64,AA', titleFont: 'Playfair Display', bg: '#111111', titleColor: '#ffffff',
    footerPillText: '@autora', footerBarLeft: '{marca} · {ano}', cultureHeaderCenter: 'EDIÇÃO 12' },
  slides: [
    { id: 'a1', title: 'Capa da autora', layout: 'mc', align: 'center', overlay: 50, titleSize: 130, bgImageAssetId: 'foto-autora' },
    { id: 'a2', title: 'Miolo 1', layout: 'ml', align: 'left', titleSize: 90 },
    { id: 'a3', title: 'Miolo 2', layout: 'ml', align: 'right', titleSize: 80 },
    { id: 'a4', title: 'Fechamento', layout: 'mb', align: 'center', titleSize: 100 },
  ],
});

const destino = () => ({
  fmt: 'stories',
  brand: { name: 'Clínica do destino', handle: '@destino', logo: 'data:image/png;base64,BB', titleFont: 'Inter', bg: '#ffffff', titleColor: '#000000' },
  caption: 'Legenda do destino',
  slides: [1, 2, 3, 4, 5, 6].map((n) => ({
    id: `d${n}`, title: `Título ${n} do destino`, subtitle: `Apoio ${n}`, bgImageAssetId: `foto-${n}`,
    imageQuery: `direção ${n}`, layout: 'mt', visualPresetId: 'outro', visualBrand: { bg: '#ff0000' },
  })),
});

describe('montar o modelo a partir do projeto', () => {
  it('leva papel por card, estrutura e marcadores; deixa conteúdo e identidade de fora', () => {
    const content = buildTemplateContent(autora());
    expect(content.slides.map((s) => s.role)).toEqual(['cover', 'content', 'content', 'closing']);
    expect(content.slides[0]).toEqual({ role: 'cover', layout: 'mc', align: 'center', overlay: 50, titleSize: 130 });
    expect(content.brand).toMatchObject({ titleFont: 'Playfair Display', bg: '#111111', footerBarLeft: '{marca} · {ano}' });
    const json = JSON.stringify(content);
    for (const proibido of ['Marca da autora', '@autora', 'data:image', 'Capa da autora', 'foto-autora', 'EDIÇÃO 12', 'Miolo']) {
      expect(json, proibido).not.toContain(proibido);
    }
  });

  it(`no máximo ${TEMPLATE_MAX_SLIDES} cards e projeto vazio vira um card de capa`, () => {
    const muitos = { fmt: 'quadrado', slides: Array.from({ length: 30 }, (_, i) => ({ layout: i % 2 ? 'ml' : 'mc' })) };
    expect(buildTemplateContent(muitos).slides).toHaveLength(TEMPLATE_MAX_SLIDES);
    expect(buildTemplateContent({}).slides).toEqual([{ role: 'cover' }]);
  });

  it('texto perigoso em campo visual é descartado', () => {
    const content = sanitizeTemplateContent({ v: 1, format: 'carrossel', brand: { titleFont: 'x</style><script>', bg: 'url(https://evil)', accent: '#00ff00' },
      slides: [{ role: 'cover', layout: 'mc', bgPattern: 'javascript:alert(1)' }] });
    expect(content.brand).toEqual({ accent: '#00ff00' });
    expect(content.slides[0]).toEqual({ role: 'cover', layout: 'mc' });
  });

  it('metadados: nome obrigatório, uma linha, limites de tamanho', () => {
    expect(() => sanitizeTemplateMeta({ name: '  ' })).toThrow(/nome/);
    expect(sanitizeTemplateMeta({ name: 'A\n\tB', description: '', authorName: '' })).toEqual({ name: 'A B', description: '', authorName: null });
  });
});

describe('aplicar o modelo num projeto', () => {
  const aplicado = () => applyTemplateToDoc(destino(), buildTemplateContent(autora()));

  it('capa no primeiro, fechamento no último, conteúdo se repete no meio', () => {
    const doc = aplicado();
    expect(doc.slides.map((s) => s.layout)).toEqual(['mc', 'ml', 'ml', 'ml', 'ml', 'mb']);
    expect(doc.slides.map((s) => s.align)).toEqual(['center', 'left', 'right', 'left', 'right', 'center']);
    expect(doc.slides[0].titleSize).toBe(130);
  });

  it('textos, fotos, legenda, logo, nome, @ e formato do projeto continuam', () => {
    const doc = aplicado();
    expect(doc.fmt).toBe('stories');
    expect(doc.caption).toBe('Legenda do destino');
    expect(doc.brand).toMatchObject({ name: 'Clínica do destino', handle: '@destino', logo: 'data:image/png;base64,BB', titleFont: 'Playfair Display', bg: '#111111' });
    doc.slides.forEach((slide, i) => {
      expect(slide).toMatchObject({ id: `d${i + 1}`, title: `Título ${i + 1} do destino`, subtitle: `Apoio ${i + 1}`,
        bgImageAssetId: `foto-${i + 1}`, imageQuery: `direção ${i + 1}` });
      // Estilo anterior por card sai, senão o modelo não aparece.
      expect(slide.visualPresetId).toBeUndefined();
      expect(slide.visualBrand).toBeUndefined();
    });
  });

  it('projeto de um card recebe a capa; modelo sem fechamento usa conteúdo no fim', () => {
    expect(applyTemplateToDoc({ slides: [{ id: 'x' }] }, buildTemplateContent(autora())).slides[0].layout).toBe('mc');
    const semFechamento = buildTemplateContent({ slides: [{ layout: 'mc' }, { layout: 'ml' }] });
    semFechamento.slides[1].role = 'content';
    const doc = applyTemplateToDoc({ slides: [{ id: '1' }, { id: '2' }, { id: '3' }] }, semFechamento);
    expect(doc.slides.map((s) => s.layout)).toEqual(['mc', 'ml', 'ml']);
  });

  it('prévia usa texto fictício do Moont, nunca o da autora', () => {
    const preview = templatePreviewDoc(buildTemplateContent(autora()));
    expect(preview.fmt).toBe('carrossel');
    expect(preview.slides[0].title).toBe('Título de exemplo do modelo');
    expect(JSON.stringify(preview)).not.toContain('autora');
  });
});
