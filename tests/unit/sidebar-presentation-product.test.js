import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
  editorTabGridSpan,
  imageTargetMatches,
  projectKindOf,
  storyboardThumbDimensions,
  visibleEditorTabs,
} from '../../src/components/SidebarContent.jsx';
import {
  PerSlideImageRefBlock,
  perSlideImageActionState,
} from '../../src/components/panels/PerSlideImageRefBlock.jsx';

const source = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

describe('interface lateral por tipo de produto', () => {
  it('Criar rápido mostra só Início e Ajustes na mesma linha', () => {
    const tabs = visibleEditorTabs('criador');
    expect(tabs.map(({ id, label }) => ({ id, label }))).toEqual([
      { id: 'home', label: 'Início' },
      { id: 'ajustes', label: 'Ajustes' },
    ]);
    expect(tabs.map((_, index) => editorTabGridSpan(tabs.length, index)))
      .toEqual(['span 6', 'span 6']);
  });

  it('Controle profissional mantém seus seis domínios independentes', () => {
    expect(visibleEditorTabs('diretor').map(({ id }) => id))
      .toEqual(['home', 'brand', 'narrativa', 'visual', 'imagem', 'texto']);
  });

  it('distribui as sete abas do Studio em 4 + 3 sem coluna vazia', () => {
    const tabs = visibleEditorTabs('studio');
    expect(tabs).toHaveLength(7);

    const spans = tabs.map((_, index) => editorTabGridSpan(tabs.length, index));
    expect(spans.slice(0, 4)).toEqual(Array(4).fill('span 3'));
    expect(spans.slice(4)).toEqual(Array(3).fill('span 4'));
  });

  it('mantém miniatura 16:9 para apresentação e vertical para carrossel', () => {
    expect(storyboardThumbDimensions(true)).toEqual({ width: 64, height: 36 });
    expect(storyboardThumbDimensions(false)).toEqual({ width: 36, height: 44 });
  });

  it('reconhece o tipo real e sincroniza o seletor quando projeto ou formato muda', () => {
    expect(projectKindOf({ doc: { productKind: 'apresentacao', fmt: 'carrossel' } }))
      .toBe('apresentacao');
    expect(projectKindOf({ doc: { fmt: 'apresentacao', creativePreset: 'livre' } }))
      .toBe('apresentacao');
    expect(projectKindOf({ doc: { fmt: 'carrossel', creativePreset: 'apresentacao' } }))
      .toBe('apresentacao');
    expect(projectKindOf({ doc: { fmt: 'carrossel', creativePreset: 'educacional' } }))
      .toBe('carrossel');

    const code = source('src/components/SidebarContent.jsx');
    expect(code).toContain('productKind: activeEntry?.doc?.productKind');
    expect(code).toContain('[activeEntry?.id, activeEntry?.doc?.productKind, creativePreset, fmt]');
  });
});

describe('estado da ação de imagem por slide', () => {
  it('distingue gerar, regenerar, falha e geração em andamento', () => {
    expect(perSlideImageActionState({}, false, 'slide').label).toBe('Gerar imagem');
    expect(perSlideImageActionState({ bgImage: 'blob:foto' }, false, 'slide').label)
      .toBe('Regenerar imagem');
    expect(perSlideImageActionState({ bgImageFailed: true }, false, 'slide').label)
      .toBe('Tentar novamente');
    expect(perSlideImageActionState({ bgImageFailed: true }, true, 'slide').label)
      .toBe('Gerando…');
  });

  it('prioriza uma imagem recuperada mesmo se restar uma marca de falha antiga', () => {
    expect(perSlideImageActionState({
      bgImage: 'blob:foto-recuperada',
      bgImageFailed: true,
    }, false, 'slide').label).toBe('Regenerar imagem');
  });

  it('aceita resultado assíncrono somente no mesmo projeto e slide', () => {
    const target = { projectId: 'p1', slideId: 's1' };
    expect(imageTargetMatches({ projectId: 'p1', slideId: 's1' }, target)).toBe(true);
    expect(imageTargetMatches({ projectId: 'p2', slideId: 's1' }, target)).toBe(false);
    expect(imageTargetMatches({ projectId: 'p1', slideId: 's2' }, target)).toBe(false);
  });

  it('renderiza rótulo, estado ocupado e cópia conforme o produto', () => {
    const common = {
      width: 320,
      onChangeExtra: vi.fn(),
      onRemoveRef: vi.fn(),
      onPickRef: vi.fn(),
      onGenerateImage: vi.fn(),
      generationState: { canGenerate: true },
    };

    const regenerated = renderToStaticMarkup(React.createElement(PerSlideImageRefBlock, {
      ...common,
      itemLabel: 'slide',
      slide: { imgExtraPrompt: '', bgImage: 'blob:foto' },
      generateImageBusy: false,
    }));
    expect(regenerated).toContain('aria-label="Regenerar imagem"');
    expect(regenerated).toContain('Substitui a imagem atual deste slide');
    expect(regenerated).toContain('Regenerar imagem');

    const busy = renderToStaticMarkup(React.createElement(PerSlideImageRefBlock, {
      ...common,
      itemLabel: 'card',
      slide: { imgExtraPrompt: '', bgImageFailed: true },
      generateImageBusy: true,
    }));
    expect(busy).toContain('aria-busy="true"');
    expect(busy).toContain('aria-label="Gerando…"');
    expect(busy).toContain('Gerando…');
    expect(busy).toContain('Direção da imagem (este card)');
  });
});
