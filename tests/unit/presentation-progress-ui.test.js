import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import GenerationPreview, { PresentationStructureSummary } from '../../src/components/GenerationPreview.jsx';
import EditorialReviewNotice from '../../src/components/EditorialReviewNotice.jsx';

const plan = {
  thesis: 'A decisão precisa de critérios claros.',
  slides: Array.from({ length: 6 }, (_, index) => ({
    index: index + 1, question: `Qual é o critério da etapa ${index + 1}?`, keyMessage: `Verifique o critério ${index + 1}.`,
  })),
};
const slides = [{ title: 'Decida com critérios', subtitle: 'Organize as informações antes de escolher.' }];

describe('acompanhamento de apresentações', () => {
  it('mostra o roteiro validado antes de existir redação sem tratá-lo como slide concluído', () => {
    const html = renderToStaticMarkup(React.createElement(GenerationPreview, { active:true, isPresentation:true, plan, phase:'writing', totalCount:6 }));
    expect(html).toContain('Roteiro organizado · 6 slides');
    expect(html).toContain('Qual é o critério da etapa 6?');
    expect(html).toContain('Este é o roteiro de trabalho');
    expect(html).not.toContain('Prévia dos slides');
    expect(html).not.toContain('Texto revisado');
  });
  it('distingue uma redação parcial da revisão completa e não infla o total concluído', () => {
    const html = renderToStaticMarkup(React.createElement(GenerationPreview, { active:true, isPresentation:true, plan, slides, phase:'writing', completedCount:5, totalCount:6 }));
    expect(html).toContain('Rascunho — criando os slides');
    expect(html).toContain('Slides preparados: 1 de 6');
    expect(html).toContain('Esta prévia é somente para acompanhar');
    expect(html).not.toContain('Texto revisado');
  });
  it('mantém explícita a incompletude depois de interromper a geração', () => {
    const html = renderToStaticMarkup(React.createElement(GenerationPreview, { active:false, isPresentation:true, plan, slides, phase:'needs_attention', totalCount:6 }));
    expect(html).toContain('A geração parou antes de completar a apresentação');
    expect(html).toContain('Slides preparados: 1 de 6');
    expect(html).not.toContain('Texto revisado');
  });
  it('avisa quantos slides persistidos ainda faltam, mantendo os outros achados de revisão', () => {
    const html = renderToStaticMarkup(React.createElement(EditorialReviewNotice, { status:'needs_attention', isPresentation:true, issues:[
      { code:'presentation_incomplete', completedCount:3, totalCount:6 },
      { kind:'factual', slideIndex:1, claim:'Prazo não informado' },
    ] }));
    expect(html).toContain('Apresentação incompleta');
    expect(html).toContain('3 de 6 slides preservados');
    expect(html).toContain('Complete a sequência antes de exportar');
    expect(html).toContain('Prazo não informado');
    expect(html).not.toContain('Conferi o conteúdo');
  });
  it.each([
    ['subscription_required', 'O serviço pediu a confirmação da assinatura'],
    ['session_required', 'A sessão não pôde ser confirmada'],
    ['rate_limited', 'O serviço limitou novas solicitações'],
    ['access_denied', 'O serviço não autorizou a continuação'],
    ['writing_failed', 'Não foi possível concluir a redação do próximo grupo'],
  ])('mostra a causa explícita %s sem perder o total preservado', (interruptionReason, message) => {
    const html = renderToStaticMarkup(React.createElement(EditorialReviewNotice, { status:'needs_attention', isPresentation:true, issues:[
      { code:'presentation_incomplete', completedCount:6, totalCount:12, interruptionReason },
    ] }));
    expect(html).toContain(message);
    expect(html).toContain('6 de 12 slides preservados');
    expect(html).toContain('os 6 restantes');
    expect(html).toContain('Complete a sequência antes de exportar');
    expect(html).not.toContain('assinatura inativa');
    expect(html).not.toContain('Conferi o conteúdo');
  });
  it.each([undefined, 'unknown', '402', 'subscription_inactive'])('não deduz causa a partir de motivo ausente ou não reconhecido: %s', interruptionReason => {
    const html = renderToStaticMarkup(React.createElement(EditorialReviewNotice, { status:'needs_attention', isPresentation:true, issues:[
      { code:'presentation_incomplete', completedCount:6, totalCount:12, interruptionReason, claim:'Assinatura inativa' },
    ] }));
    expect(html).toContain('6 de 12 slides preservados');
    expect(html).not.toContain('confirmação da assinatura');
    expect(html).not.toContain('A sessão não pôde');
    expect(html).not.toContain('O serviço limitou');
    expect(html).not.toContain('Assinatura inativa');
  });
  it('mostra a sequência como sugestão adaptável, sem prometer uma página por etapa', () => {
    const html = renderToStaticMarkup(React.createElement(PresentationStructureSummary, { presentationPath:'pitch', count:6 }));
    expect(html).toContain('Estrutura sugerida');
    expect(html).toContain('aos 6 slides');
    expect(html).toContain('Etapas podem ser combinadas');
    expect(html).toContain('informações ausentes não serão inventadas');
  });
  it('permite conferir indicadores e suas condições durante a redação, sem edição', () => {
    const html = renderToStaticMarkup(React.createElement(GenerationPreview, { active:true, isPresentation:true, phase:'writing', totalCount:6, slides:[{
      ...slides[0], presentationBlocks:[{ type:'metrics', items:[{ label:'Duração média', value:'45 → 33 min', detail:'Abril a maio; sem grupo de controle.' }] }],
    }] }));
    expect(html).toContain('Indicadores do slide');
    expect(html).toContain('45 → 33 min');
    expect(html).toContain('Abril a maio; sem grupo de controle.');
    expect(html).not.toContain('contenteditable');
  });
});
