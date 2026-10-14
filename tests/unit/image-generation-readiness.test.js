import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { imageGenerationAccess, slideImageInstruction, slideImageGenerationState } from '../../src/utils/image-generation-readiness.js';
import { PerSlideImageRefBlock } from '../../src/components/panels/PerSlideImageRefBlock.jsx';

const access = { active: true, tier: 'creator', imageQuota: { available: true, status: 'available', limit: 50, remaining: 50 } };
const available = imageGenerationAccess({ access });

describe('instrução e habilitação da imagem por slide', () => {
  it('usa a direção preenchida com referência mesmo sem imageQuery e sem duplicar a instrução', () => {
    const slide = { refImage: 'data:image/png;base64,YQ==', imgExtraPrompt: ' Uma garrafa ao sol, fundo azul. ', imageQuery: '' };
    const state = slideImageGenerationState(slide, available);
    expect(state).toMatchObject({ canGenerate: true, query: 'Uma garrafa ao sol, fundo azul.', extraPrompt: '' });
    const html = renderToStaticMarkup(React.createElement(PerSlideImageRefBlock, { slide, generationState: state, onGenerateImage() {} }));
    expect(html).toContain('aria-label="Gerar imagem"');
    expect(html).not.toContain('disabled=""');
  });

  it('aceita direção sem referência e preserva query + extra existentes', () => {
    expect(slideImageInstruction({ imgExtraPrompt: 'Ilustração de uma cidade.' })).toEqual({ query: 'Ilustração de uma cidade.', extraPrompt: '' });
    expect(slideImageInstruction({ imageQuery: 'City skyline', imgExtraPrompt: 'Cores suaves' })).toEqual({ query: 'City skyline', extraPrompt: 'Cores suaves' });
  });

  it('conecta referência ao conteúdo do slide quando não há direção explícita', () => {
    const slide = { title: 'Café sem complicação', subtitle: 'Um jeito simples de escolher', refImage: 'blob:ref' };
    const state = slideImageGenerationState(slide, available);
    expect(state.canGenerate).toBe(true);
    expect(state.query).toContain(slide.title);
    expect(state.query).toContain(slide.subtitle);
    expect(slideImageGenerationState({ title: 'Café' }, available, { refImages: [{ imageId: 'ref' }] }).canGenerate).toBe(true);
  });

  it('referência sozinha não habilita uma geração sem instrução', () => {
    const slide = { refImage: 'blob:ref', imgExtraPrompt: ' ', imageQuery: ' ' };
    const state = slideImageGenerationState(slide, available);
    expect(state).toMatchObject({ canGenerate: false, reason: 'missing_direction', query: '' });
    const html = renderToStaticMarkup(React.createElement(PerSlideImageRefBlock, { slide, generationState: state, onGenerateImage() {} }));
    expect(html).toContain('disabled=""');
    expect(html).toContain('role="status"');
    expect(html).toContain('Abra Direção e descreva a imagem');
    expect(html).toContain('aria-describedby=');
  });
});

describe('imagem do plano e chave própria', () => {
  it('habilita plano ativo com saldo e preserva BYOK independente do saldo do plano', () => {
    expect(available.canGenerate).toBe(true);
    expect(imageGenerationAccess({ access: { ...access, imageQuota: { limit: 50, remaining: 0 } }, useOwnImageKey: true, hasByokImageKey: true }).canGenerate).toBe(true);
    expect(imageGenerationAccess({ access, useOwnImageKey: true, hasByokImageKey: false }).reason).toBe('missing_image_key');
  });

  it.each([
    { available: false, status: 'unavailable', limit: 50, remaining: null, code: 'quota_store_unavailable' },
    { available: false, status: 'unavailable', limit: 50, remaining: null, code: 'quota_period_unavailable' },
    { limit: 50, remaining: null },
    null,
    {},
  ])('não interpreta quota desconhecida como esgotada: %o', (quota) => {
    const state = imageGenerationAccess({ access: { ...access, imageQuota: quota } });
    expect(state).toMatchObject({ canGenerate: false, reason: 'quota_unavailable' });
    expect(state.message).not.toMatch(/esgot|todas|upgrade/i);
  });

  it('distingue esgotamento, plano sem imagens, sessão e ausência de chave', () => {
    expect(imageGenerationAccess({ access: { ...access, imageQuota: { limit: 50, remaining: 0 } } }).reason).toBe('quota_exhausted');
    expect(imageGenerationAccess({ access: { ...access, tier: 'essential', imageQuota: { limit: 0, remaining: 0 } } }).reason).toBe('plan_without_images');
    expect(imageGenerationAccess({ access: { status: 'loading' } }).reason).toBe('account_loading');
    expect(imageGenerationAccess({ access: { active: false } }).reason).toBe('account_inactive');
  });

  it('mostra o motivo de quota no painel fechado sem atribuir erro à direção', () => {
    const state = slideImageGenerationState({ imageQuery: 'Portrait' }, imageGenerationAccess({ access: { ...access, imageQuota: { limit: 50, remaining: 0 } } }));
    const html = renderToStaticMarkup(React.createElement(PerSlideImageRefBlock, { slide: { imageQuery: 'Portrait' }, collapsible: true, generationState: state, onGenerateImage() {} }));
    expect(html).toContain('disabled=""');
    expect(html).toContain('role="status"');
    expect(html).toContain('Você usou todas as imagens deste ciclo.');
    expect(html).not.toContain('Defina palavras-chave');
  });
});
